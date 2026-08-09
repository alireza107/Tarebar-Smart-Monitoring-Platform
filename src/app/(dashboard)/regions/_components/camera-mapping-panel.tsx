'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { PolygonEditor, type PolygonValue } from './polygon-editor'
import { Pencil, Trash2, Video } from 'lucide-react'
import type { RegionDetail, CameraRegionMapping } from '@/modules/region/types'
import { derivePlaybackUrls } from '@/modules/camera/stream'
import { useCameraSnapshot } from '@/modules/camera/use-camera-snapshot'
import {
  CameraStreamPlayer,
  type PlayerState,
} from '@/app/(dashboard)/monitoring/_components/camera-stream-player'

interface CameraOption {
  id: string
  name: string
  streamUrl: string | null
}

interface Props {
  region: RegionDetail
  canEdit: boolean
}

type Editing = { mappingId?: string; cameraId: string; value: PolygonValue }

const EMPTY: PolygonValue = { mainPolygon: [], exclusionPolygons: [] }

export function CameraMappingPanel({ region, canEdit }: Props) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Editing | null>(null)
  const [newCameraId, setNewCameraId] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<CameraRegionMapping | null>(null)

  const { data: cameras = [] } = useQuery<CameraOption[]>({
    queryKey: ['cameras-select'],
    queryFn: () => fetch('/api/cameras').then(r => r.json()).then(j => j.data),
  })

  // Render the same resilient WebRTC/HLS player used by live monitoring behind
  // the SVG. This avoids cross-origin canvas capture failures in some browsers.
  const editingCamera = editing ? cameras.find(c => c.id === editing.cameraId) : undefined
  const editingPlaybackUrls = editing ? derivePlaybackUrls(editingCamera?.streamUrl) : null

  // Live phone/RTMP feeds are flaky. Fall back to the last snapshot captured
  // while the stream was healthy so the editor still has a reference image.
  const [liveState, setLiveState] = useState<PlayerState>('connecting')
  useEffect(() => {
    setLiveState('connecting')
  }, [editing?.cameraId])

  const { data: storedSnapshot } = useQuery({
    queryKey: ['camera-snapshot', editing?.cameraId],
    queryFn: () =>
      fetch(`/api/cameras/${editing!.cameraId}/snapshot`)
        .then(r => r.json())
        .then(j => j.data as { dataUrl: string | null; updatedAt: string | null }),
    enabled: !!editing,
  })

  const { frame: capturedFrame } = useCameraSnapshot(editingPlaybackUrls?.hls)
  const savedFrameRef = useRef<string | null>(null)
  const saveSnapshotMutation = useMutation({
    mutationFn: (dataUrl: string) => putJson(`/api/cameras/${editing!.cameraId}/snapshot`, { dataUrl }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['camera-snapshot', editing?.cameraId] }),
  })
  useEffect(() => {
    if (!capturedFrame || !editing || !canEdit) return
    if (savedFrameRef.current === capturedFrame) return
    savedFrameRef.current = capturedFrame
    saveSnapshotMutation.mutate(capturedFrame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capturedFrame, editing?.cameraId, canEdit])

  const showLive = !!editingPlaybackUrls && liveState !== 'error'
  const snapshotUrl = storedSnapshot?.dataUrl ?? null

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['region', region.id] })
    qc.invalidateQueries({ queryKey: ['regions'] })
  }

  const createMutation = useMutation({
    mutationFn: (e: Editing) =>
      postJson(`/api/regions/${region.id}/cameras`, {
        cameraId: e.cameraId,
        mainPolygon: e.value.mainPolygon,
        exclusionPolygons: e.value.exclusionPolygons,
      }),
    onSuccess: () => { invalidate(); setEditing(null); setNewCameraId(''); toast.success('نگاشت دوربین ذخیره شد') },
    onError: (e: Error) => toast.error(e.message),
  })

  const updateMutation = useMutation({
    mutationFn: (e: Editing) =>
      patchJson(`/api/regions/${region.id}/cameras/${e.mappingId}`, {
        mainPolygon: e.value.mainPolygon,
        exclusionPolygons: e.value.exclusionPolygons,
      }),
    onSuccess: () => { invalidate(); setEditing(null); toast.success('نگاشت دوربین به‌روزرسانی شد') },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (mappingId: string) =>
      fetch(`/api/regions/${region.id}/cameras/${mappingId}`, { method: 'DELETE' }).then(r => {
        if (!r.ok) throw new Error('خطا در حذف نگاشت')
      }),
    onSuccess: () => { invalidate(); toast.success('نگاشت دوربین حذف شد') },
    onError: (e: Error) => toast.error(e.message),
  })

  // Cameras not yet mapped to this region.
  const mappedIds = new Set(region.cameraRegions.map(m => m.cameraId))
  const availableCameras = cameras.filter(c => !mappedIds.has(c.id))

  function save() {
    if (!editing) return
    if (editing.value.mainPolygon.length < 3) {
      toast.error('چندضلعی اصلی باید حداقل ۳ رأس داشته باشد')
      return
    }
    if (editing.mappingId) updateMutation.mutate(editing)
    else createMutation.mutate(editing)
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  if (editing) {
    const cameraName =
      cameras.find(c => c.id === editing.cameraId)?.name ??
      region.cameraRegions.find(m => m.cameraId === editing.cameraId)?.camera?.name ??
      'دوربین'
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Video className="size-4" /> ترسیم ناحیه برای: {cameraName}
          </h3>
        </div>
        <PolygonEditor
          value={editing.value}
          onChange={v => setEditing({ ...editing, value: v })}
          backgroundContent={showLive ? (
            <CameraStreamPlayer
              key={editing.cameraId}
              whepSrc={editingPlaybackUrls!.whep}
              hlsSrc={editingPlaybackUrls!.hls}
              chrome={false}
              onStateChange={setLiveState}
            />
          ) : null}
          backgroundUrl={!showLive ? snapshotUrl : undefined}
        />
        {!editingPlaybackUrls && (
          <p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            آدرس پخش این دوربین معتبر نیست. آدرس RTSP دوربین را بررسی کنید.
          </p>
        )}
        {editingPlaybackUrls && !showLive && (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
            {snapshotUrl
              ? `استریم زنده در دسترس نیست؛ آخرین تصویر ذخیره‌شده${
                  storedSnapshot?.updatedAt
                    ? ' (' + new Date(storedSnapshot.updatedAt).toLocaleString('fa-IR') + ')'
                    : ''
                } نمایش داده می‌شود.`
              : 'استریم زنده در دسترس نیست و هنوز تصویری از این دوربین ذخیره نشده است. به‌محض آنلاین‌شدن دوربین، تصویر به‌طور خودکار ذخیره خواهد شد.'}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(null)} disabled={isPending}>
            انصراف
          </Button>
          <Button size="sm" onClick={save} disabled={isPending}>
            {isPending ? 'در حال ذخیره...' : 'ذخیره ناحیه'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Existing mappings */}
      {region.cameraRegions.length === 0 ? (
        <p className="text-sm text-muted-foreground">هنوز هیچ دوربینی به این منطقه نگاشت نشده است.</p>
      ) : (
        <ul className="divide-y rounded-lg border border-input">
          {region.cameraRegions.map(m => (
            <li key={m.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Video className="size-4 shrink-0 text-muted-foreground" />
                  {m.camera?.name ?? '—'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {m.mainPolygon.length} رأس · {m.exclusionPolygons.length} ناحیه استثناء
                </p>
              </div>
              {canEdit && (
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEditing({
                        mappingId: m.id,
                        cameraId: m.cameraId,
                        value: { mainPolygon: m.mainPolygon, exclusionPolygons: m.exclusionPolygons },
                      })
                    }
                  >
                    <Pencil /> ویرایش
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(m)}>
                    <Trash2 /> حذف
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Add new mapping */}
      {canEdit && (
        <div className="flex items-end gap-2 rounded-lg border border-dashed border-input p-3">
          <div className="flex-1 space-y-1">
            <Label htmlFor="add-camera">افزودن دوربین</Label>
            <select
              id="add-camera"
              value={newCameraId}
              onChange={e => setNewCameraId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">-- انتخاب دوربین --</option>
              {availableCameras.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <Button
            size="sm"
            disabled={!newCameraId}
            onClick={() => setEditing({ cameraId: newCameraId, value: { ...EMPTY } })}
          >
            شروع ترسیم
          </Button>
        </div>
      )}

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={open => { if (!open) setDeleteTarget(null) }}
        description="آیا از حذف این نگاشت دوربین مطمئن هستید؟"
        isPending={deleteMutation.isPending}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id) }}
      />
    </div>
  )
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(await errMessage(res, 'خطا در ذخیره نگاشت'))
  return res.json()
}

async function patchJson(url: string, body: unknown) {
  const res = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(await errMessage(res, 'خطا در به‌روزرسانی نگاشت'))
  return res.json()
}

async function putJson(url: string, body: unknown) {
  const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(await errMessage(res, 'خطا در ذخیره تصویر'))
  return res.json()
}

async function errMessage(res: Response, fallback: string): Promise<string> {
  try {
    const j = await res.json()
    if (typeof j.error === 'string') return j.error
  } catch {}
  return fallback
}
