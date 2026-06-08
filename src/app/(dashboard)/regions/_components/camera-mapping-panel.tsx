'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { PolygonEditor, type PolygonValue } from './polygon-editor'
import { Pencil, Trash2, Video } from 'lucide-react'
import type { RegionDetail, CameraRegionMapping } from '@/modules/region/types'
import { deriveHlsUrl } from '@/modules/camera/stream'
import { useCameraSnapshot } from '@/modules/camera/use-camera-snapshot'

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

  // Capture a still frame of the camera being edited to draw polygons against.
  const editingCamera = editing ? cameras.find(c => c.id === editing.cameraId) : undefined
  const editingHlsUrl = editing ? deriveHlsUrl(editingCamera?.streamUrl) : null
  const { frame: background } = useCameraSnapshot(editingHlsUrl)

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
          backgroundUrl={background}
        />
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

async function errMessage(res: Response, fallback: string): Promise<string> {
  try {
    const j = await res.json()
    if (typeof j.error === 'string') return j.error
  } catch {}
  return fallback
}
