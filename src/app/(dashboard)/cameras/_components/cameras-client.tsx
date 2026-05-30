'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CameraForm, type CameraFormValues } from './camera-form'
import type { Camera } from '@/modules/camera/types'

const statusConfig: Record<string, { label: string; className: string }> = {
  ONLINE:  { label: 'آنلاین',   className: 'bg-green-100 text-green-700' },
  OFFLINE: { label: 'آفلاین',   className: 'bg-red-100 text-red-700' },
  UNKNOWN: { label: 'نامشخص',   className: 'bg-gray-100 text-gray-500' },
}

function locationLabel(camera: Camera): string {
  if (camera.booth)  return `غرفه ${camera.booth.number}`
  if (camera.market) return camera.market.name
  if (camera.field)  return camera.field.name
  return '—'
}

async function fetchCameras(): Promise<Camera[]> {
  const res = await fetch('/api/cameras')
  if (!res.ok) throw new Error('خطا در دریافت دوربین‌ها')
  const json = await res.json()
  return json.data
}

async function createCamera(data: CameraFormValues): Promise<Camera> {
  const payload = {
    ...data,
    streamUrl: data.streamUrl || undefined,
    fieldId:  data.fieldId  || undefined,
    marketId: data.marketId || undefined,
    boothId:  data.boothId  || undefined,
  }
  const res = await fetch('/api/cameras', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('خطا در ایجاد دوربین')
  const json = await res.json()
  return json.data
}

async function updateCamera(id: string, data: CameraFormValues): Promise<Camera> {
  const payload = {
    name:      data.name,
    streamUrl: data.streamUrl || null,
    status:    data.status,
    fieldId:   data.fieldId  || null,
    marketId:  data.marketId || null,
    boothId:   data.boothId  || null,
  }
  const res = await fetch(`/api/cameras/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('خطا در ویرایش دوربین')
  const json = await res.json()
  return json.data
}

async function deleteCamera(id: string): Promise<void> {
  const res = await fetch(`/api/cameras/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('خطا در حذف دوربین')
}

export function CamerasClient() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Camera | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)

  const { data: cameras = [], isLoading } = useQuery({
    queryKey: ['cameras'],
    queryFn: fetchCameras,
  })

  const createMutation = useMutation({
    mutationFn: createCamera,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cameras'] })
      setCreateOpen(false)
      setMutationError(null)
    },
    onError: (e: Error) => setMutationError(e.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CameraFormValues }) => updateCamera(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cameras'] })
      setEditTarget(null)
      setMutationError(null)
    },
    onError: (e: Error) => setMutationError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCamera,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cameras'] }),
  })

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">دوربین‌ها</h1>
        <Button onClick={() => { setCreateOpen(true); setMutationError(null) }}>+ افزودن دوربین</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">در حال بارگذاری...</p>
      ) : cameras.length === 0 ? (
        <p className="text-sm text-gray-500">هیچ دوربینی ثبت نشده است.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>نام</TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead>مکان</TableHead>
              <TableHead>آدرس استریم</TableHead>
              <TableHead>تاریخ ثبت</TableHead>
              <TableHead className="w-36">عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cameras.map((camera) => {
              const status = statusConfig[camera.status] ?? statusConfig.UNKNOWN
              return (
                <TableRow key={camera.id}>
                  <TableCell className="font-medium">{camera.name}</TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>
                      {status.label}
                    </span>
                  </TableCell>
                  <TableCell>{locationLabel(camera)}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs text-gray-500" dir="ltr">
                    {camera.streamUrl ?? '—'}
                  </TableCell>
                  <TableCell>{new Date(camera.createdAt).toLocaleDateString('fa-IR')}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setEditTarget(camera); setMutationError(null) }}
                      >
                        ویرایش
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (confirm('آیا از حذف این دوربین مطمئن هستید؟')) {
                            deleteMutation.mutate(camera.id)
                          }
                        }}
                      >
                        حذف
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) setMutationError(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>افزودن دوربین جدید</DialogTitle>
          </DialogHeader>
          {mutationError && createOpen && (
            <p className="text-sm text-red-500">{mutationError}</p>
          )}
          <CameraForm
            onSubmit={(data) => createMutation.mutate(data)}
            onCancel={() => setCreateOpen(false)}
            isPending={createMutation.isPending}
            submitLabel="ایجاد"
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) { setEditTarget(null); setMutationError(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ویرایش دوربین</DialogTitle>
          </DialogHeader>
          {mutationError && !!editTarget && (
            <p className="text-sm text-red-500">{mutationError}</p>
          )}
          {editTarget && (
            <CameraForm
              defaultValues={{
                name:      editTarget.name,
                streamUrl: editTarget.streamUrl ?? '',
                status:    editTarget.status,
                fieldId:   editTarget.fieldId  ?? '',
                marketId:  editTarget.marketId ?? '',
                boothId:   editTarget.boothId  ?? '',
              }}
              onSubmit={(data) => updateMutation.mutate({ id: editTarget.id, data })}
              onCancel={() => setEditTarget(null)}
              isPending={updateMutation.isPending}
              submitLabel="ذخیره تغییرات"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
