# Live cameras with MediaMTX

MediaMTX is the protocol boundary for live cameras. The platform stores and
hands the CV service one normalized RTSP URL; browser playback is derived from
the same path through WebRTC/WHEP, with low-latency HLS as a fallback.

```text
Larix (RTMP or RTSP) ─┐
                      ├─> MediaMTX path ─┬─> RTSP ─> OpenCV / AI pipeline
RTSP/IP camera ───────┘                  └─> WebRTC ─> monitoring dashboard
                                                   └─> HLS fallback
```

## Start the stack

From `Tarebar-Smart-Monitoring-Platform`:

```bash
cp .env.example .env
# Set AUTH_SECRET. For LAN access, also set the three MediaMTX host values below.
docker compose up -d --build
docker compose exec app npx prisma migrate deploy
```

When the dashboard is opened from another computer or phone, replace
`192.168.1.20` with the Docker host's LAN address:

```dotenv
NEXT_PUBLIC_MEDIAMTX_WEBRTC_URL=http://192.168.1.20:8889
NEXT_PUBLIC_MEDIAMTX_HLS_URL=http://192.168.1.20:8888
MEDIAMTX_WEBRTC_HOST=192.168.1.20
```

These `NEXT_PUBLIC_` values are embedded during the Next.js Docker build. Run
`docker compose up -d --build app mediamtx` after changing them.

## Larix Broadcaster setup

1. Connect the phone and Docker host to the same reachable network.
2. In Larix, add a new RTMP connection with URL
   `rtmp://192.168.1.20:1935/mobile-1`.
3. Select H.264 video. AAC audio is optional. A 1–2 second keyframe interval is
   recommended; H.265 commonly cannot be decoded by browsers through WebRTC.
4. Start broadcasting.
5. In **Cameras**, create a camera with this processing URL when the platform
   runs in Docker: `rtsp://mediamtx:8554/mobile-1`. For a locally-run Next.js
   backend, use `rtsp://localhost:8554/mobile-1`.

The path (`mobile-1`) must match in Larix and the camera record. No stream key
is needed in this development configuration. Add MediaMTX authentication and
TLS before exposing ingest to an untrusted network.

The monitoring page probes the exact RTSP path every 30 seconds. It reports a
path without a publisher as offline. The player attempts WebRTC three times,
then falls back to HLS, and offers a manual reconnect if both fail.

## Live AI/CV processing

For an online camera, click **Select live analysis** on its monitoring card.
Choose human detection, tracking, people counting, movement/dwell heatmap, or
automatic vertical-queue analysis. The authenticated Next.js route reads the
camera's stored RTSP URL and creates the selected stream job in the FastAPI
service. Job state, processed live preview, metrics, cancellation, and artifacts
use the existing Analytics page. One task is run per camera-card request so the
preview and metrics have a clear owner. The card starts a bounded
1,800-processed-frame session (about ten minutes at the default 30 FPS source
and frame stride 10) so one click cannot occupy the only worker or grow an
artifact indefinitely; it can be started again when needed.

Restricted-area and configured-queue analytics are not shown as live choices
until camera-specific polygons and service points are stored. The stream API
rejects these geometry-dependent presets when no camera YAML is available.

The FastAPI endpoint can also run several live analytics in one shared pipeline.
Detection and tracking run once, and the selected modules reuse their results:

```bash
curl -X POST http://localhost:8000/api/v1/stream-jobs \
  -H 'Content-Type: application/json' \
  -d '{
    "stream_url":"rtsp://mediamtx:8554/mobile-1",
    "application_ids":["people_counting","heatmap","vertical_queue"],
    "camera_id":"mobile-1",
    "max_frames":1000
  }'
```

`application_ids` accepts one or more of `people_counting`, `heatmap`, and
`vertical_queue`. The older singular `application_id` contract remains
available for compatibility, but the two fields must not be sent together.

Omit `max_frames` for a job that runs until cancelled or until the source ends.
Configured analytics that need polygons still require camera YAML and are not
accepted by the JSON stream endpoint yet.

## Replacing the phone with an IP camera

Keep the MediaMTX path as the platform-facing URL and make MediaMTX pull the
real camera. Add a named entry to `infrastructure/mediamtx.yml`:

```yaml
paths:
  entrance-1:
    source: rtsp://camera-user:camera-password@10.0.0.50/live
    sourceOnDemand: true
  all_others:
```

Then store `rtsp://mediamtx:8554/entrance-1` on the Camera record. The dashboard,
health check, and CV pipeline remain unchanged. Credentials stay in MediaMTX
configuration instead of being returned by the camera API or rendered in the
browser.

## Ports and network notes

| Port | Protocol | Purpose |
|---|---|---|
| 1935/TCP | RTMP | Larix ingest |
| 8554/TCP | RTSP | publisher/read and CV input |
| 8889/TCP | HTTP/WHEP | WebRTC signaling |
| 8189/UDP | ICE/UDP | WebRTC media |
| 8888/TCP | HTTP | low-latency HLS fallback |
| 8000/TCP | HTTP | video analytics API |
| 9997/TCP | HTTP | MediaMTX Control API, bound to localhost only |

Allow 1935/TCP, 8889/TCP, 8189/UDP, and optionally 8888/TCP through the host
firewall for LAN clients. WebRTC across NAT normally needs a public address and
port-forwarding for 8189/UDP, or a STUN/TURN server configured in MediaMTX.

An HTTPS dashboard cannot load plain HTTP WebRTC/HLS endpoints because browsers
block mixed content. In production, terminate TLS for ports 8889 and 8888 (or
reverse proxy them under HTTPS), set the two public URL variables to `https://`,
and restrict MediaMTX CORS/authentication for the deployment origin.
