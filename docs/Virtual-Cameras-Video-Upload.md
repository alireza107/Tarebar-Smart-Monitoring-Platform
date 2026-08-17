# Virtual cameras: uploaded video as a camera

## What changed

A camera can now be created from an uploaded video file instead of a live RTSP
address. Once uploaded, the video is republished as a genuine, continuously
looping RTSP stream — the camera behaves exactly like a real Larix/IP camera
everywhere in the platform: it shows **online** on the monitoring grid, has a
live WHEP/HLS preview, and its people-counting/queue analytics results feed
the same "تردد و تراکم" (traffic/density) and "صف" (queue) Reports sections a
real camera's would.

```text
Video upload ─> ffmpeg (loop, transcode) ─> MediaMTX path camera-<id> ─┬─> RTSP ─> CV pipeline ─> Reports
                                                                        └─> WebRTC/HLS ─> monitoring dashboard
```

No changes were made to the RTSP health probe, the WHEP/HLS preview
derivation, `/api/v1/stream-jobs`, or the Reports ingestion pipeline — all of
them already worked generically off `Camera.streamUrl`, so a virtual camera's
stream is indistinguishable from a real one to every downstream consumer.

## Why this approach

Three designs were considered:

- **Republish into MediaMTX via ffmpeg (chosen).** Costs one permanent
  real-time transcode process per active virtual camera, but requires zero
  special-casing anywhere else in the stack.
- **MediaMTX `runOnDemand` (lazy publish on read).** Cheaper at idle, but the
  camera would flip offline whenever nobody was viewing it or running
  analytics — contradicting the goal of "it seems the camera is online."
- **Special-case a `VIDEO_FILE` source throughout monitoring/preview/reports.**
  Rejected: would need a parallel "online" concept and a parallel preview
  mechanism instead of reusing the real, already-correct ones.

The existing one-off `/api/v1/jobs` upload-and-run tool (the "Video Analytics"
tab) is unrelated and untouched — it stays a quick, non-camera-linked test
tool for a single video.

## Backend (`video_analytics`)

New module `app/api/virtual_cameras.py`:

- `VirtualCameraManager` — one supervised, looping `ffmpeg` process per
  `camera_id`, mirroring the existing `JobManager` pattern in `app/api/jobs.py`
  but long-running instead of one-shot. Restarts on crash with capped
  exponential backoff (1s → 30s, gives up after 10 crashes in 5 minutes).
  Video files and per-camera state (`record.json`, `ffmpeg.log`) persist under
  `VIRTUAL_CAMERAS_DIR` (default `output/virtual-cameras`, its own Docker
  volume) and are relaunched automatically on service restart
  (`load_existing()`, called from the FastAPI startup hook).
- ffmpeg always re-encodes (`libx264`/`yuv420p`, capped resolution/fps,
  audio dropped) rather than trusting arbitrary uploaded codecs, mirroring the
  existing `_make_browser_video()` precedent in `jobs.py`. `-stream_loop -1`
  loops indefinitely regardless of source length.
- New endpoints, mounted under `/api/v1/virtual-cameras`:
  - `POST /{camera_id}/video` — multipart upload, (re)starts the publisher.
  - `GET /{camera_id}` — status (`starting` / `running` / `crashed` /
    `stopped`), restart count, last error.
  - `DELETE /{camera_id}` — stops the process and removes the stored video.
- `camera_id` validation was deduplicated: `StreamJobRequest.validate_camera_id`
  and `create_job`'s inline check now both call the same
  `virtual_cameras.validate_camera_id`.

Environment additions (`docker-compose.yml`): `MEDIAMTX_RTSP_URL` (so ffmpeg
knows where to publish) and `VIRTUAL_CAMERAS_DIR` on the `video-analytics`
service, plus a new `virtual-camera-videos` volume.

## Dashboard (`Tarebar-Smart-Monitoring-Platform`)

- **Prisma**: `Camera` gained `sourceType` (`RTSP` default, or `VIDEO_FILE`),
  `videoFileName`, `videoUploadedAt`. `streamUrl`/`status` stay authoritative
  for every consumer regardless of source type — the new fields are
  UI-routing/display metadata only. `sourceType` is never accepted as a
  freeform field on the regular camera PATCH; it only changes as a side
  effect of an actual successful video upload or an explicit switch back to
  RTSP, so a client can't claim `VIDEO_FILE` without a real publisher backing
  it.
- **`POST /api/cameras/[id]/video`** (new) — streams the multipart upload
  straight through to the Python backend (no buffering), then on success sets
  `streamUrl` to the returned MediaMTX path and `sourceType: VIDEO_FILE`.
  Leaves `status` for the next real health-probe cycle rather than guessing.
- **`DELETE`/`PATCH /api/cameras/[id]`** — deleting a `VIDEO_FILE` camera (or
  switching it back to RTSP by submitting a `streamUrl`) now also stops the
  Python-side publisher first. This call is best-effort and never blocks the
  primary CRUD action if the analytics service happens to be unreachable.
- **Camera form** — a source-type toggle ("آدرس RTSP" / "آپلود ویدیو") swaps
  the stream-URL field for a file picker. Create and edit both use a two-step
  submit (create/update the `Camera` row, then upload the video with the
  returned id) orchestrated in `cameras-client.tsx`; `CameraForm` itself stays
  a plain field-rendering component.
- **Monitoring card / cameras table** — a small "ویدیو آپلودی" badge marks
  virtual cameras; the live-preview, "online" pill, and "شروع تحلیل زنده"
  button are all unmodified since they already key off `status`/`streamUrl`.

## Verification performed

- Backend: `python -m pytest tests/test_api_jobs.py tests/test_management_analytics.py`
  — all 23 pre-existing tests still pass.
- `npx tsc --noEmit` and `eslint` clean on every changed file (pre-existing,
  unrelated failures in two test files were left untouched).
- Rebuilt and restarted the `video-analytics` container and ran a live
  end-to-end smoke test: uploaded a synthetic clip via
  `POST /api/v1/virtual-cameras/{id}/video`, confirmed status went
  `starting` → `running`, confirmed with `ffprobe` that
  `rtsp://localhost:8554/camera-<id>` was a genuinely live, looping H.264
  stream, then confirmed `DELETE` stopped it and the status endpoint
  returned 404 again.
- Not yet done: rebuilding the Next.js `app` container (its image bakes
  source, no bind mount) and a click-through of the camera form / monitoring
  grid / Reports pages in the browser.

## Manual end-to-end check (once the `app` image is rebuilt)

1. `docker compose up -d --build app`, `docker compose exec app npx prisma
   migrate deploy` (already applied against the running dev database for
   this change).
2. Cameras → New → assign to a Market → "آپلود ویدیو" → upload a short clip.
3. Monitoring: within one 30s probe cycle, the camera shows **ONLINE** with
   the uploaded-video badge and a live looping preview.
4. Start "شمارش افراد" (people counting) from the camera card.
5. After a rollup interval, check the Reports "تردد و تراکم" section for that
   market and confirm the virtual camera's counts appear.
6. Delete the camera and confirm (via `docker compose logs video-analytics`)
   the ffmpeg process stops and the stored video is removed.
