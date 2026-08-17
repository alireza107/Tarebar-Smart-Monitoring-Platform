'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CameraSourceType } from '@/modules/camera/types'

const ALLOWED_VIDEO_EXTENSIONS = '.mp4,.mov,.avi,.mkv,.webm,.m4v'

const cameraFormSchema = z.object({
  name: z.string().min(1, 'نام دوربین الزامی است').max(100),
  streamUrl: z.string().url('آدرس استریم نامعتبر است').optional().or(z.literal('')),
  status: z.enum(['ONLINE', 'OFFLINE', 'UNKNOWN']),
  fieldId: z.string().optional().or(z.literal('')),
  marketId: z.string().optional().or(z.literal('')),
  boothId: z.string().optional().or(z.literal('')),
})

export type CameraFormValues = z.infer<typeof cameraFormSchema>

const statusLabels: Record<string, string> = {
  ONLINE:  'آنلاین',
  OFFLINE: 'آفلاین',
  UNKNOWN: 'نامشخص',
}

interface CameraFormProps {
  defaultValues?: Partial<CameraFormValues>
  defaultSourceType?: CameraSourceType
  currentVideoFileName?: string | null
  currentVideoUploadedAt?: string | Date | null
  onSubmit: (data: CameraFormValues, video: { sourceType: CameraSourceType; file: File | null }) => void
  onCancel: () => void
  isPending: boolean
  submitLabel?: string
}

export function CameraForm({
  defaultValues,
  defaultSourceType = 'RTSP',
  currentVideoFileName,
  currentVideoUploadedAt,
  onSubmit,
  onCancel,
  isPending,
  submitLabel = 'ذخیره',
}: CameraFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<CameraFormValues>({
    resolver: zodResolver(cameraFormSchema),
    defaultValues: { status: 'UNKNOWN', ...defaultValues },
  })
  const [sourceType, setSourceType] = useState<CameraSourceType>(defaultSourceType)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoFileError, setVideoFileError] = useState<string | null>(null)

  function submit(data: CameraFormValues) {
    if (sourceType === 'VIDEO_FILE' && !videoFile && !currentVideoFileName) {
      setVideoFileError('انتخاب فایل ویدیو الزامی است')
      return
    }
    setVideoFileError(null)
    onSubmit(data, { sourceType, file: videoFile })
  }

  const { data: fields = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['fields-select'],
    queryFn: () => fetch('/api/fields').then(r => r.json()).then(j => j.data),
  })

  const { data: markets = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['markets-select'],
    queryFn: () => fetch('/api/markets').then(r => r.json()).then(j => j.data),
  })

  const { data: booths = [] } = useQuery<{ id: string; number: string; market: { name: string } }[]>({
    queryKey: ['booths-select'],
    queryFn: () => fetch('/api/booths').then(r => r.json()).then(j => j.data),
  })

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="name">نام دوربین</Label>
        <Input id="name" {...register('name')} placeholder="مثال: دوربین ورودی" />
        {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
      </div>

      <div className="space-y-1">
        <Label>منبع دوربین</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={sourceType === 'RTSP' ? 'default' : 'outline'}
            onClick={() => setSourceType('RTSP')}
          >
            آدرس RTSP
          </Button>
          <Button
            type="button"
            size="sm"
            variant={sourceType === 'VIDEO_FILE' ? 'default' : 'outline'}
            onClick={() => setSourceType('VIDEO_FILE')}
          >
            آپلود ویدیو (دوربین مجازی)
          </Button>
        </div>
      </div>

      {sourceType === 'RTSP' ? (
        <div className="space-y-1">
          <Label htmlFor="streamUrl">آدرس RTSP پردازش (اختیاری)</Label>
          <Input id="streamUrl" {...register('streamUrl')} placeholder="rtsp://mediamtx:8554/mobile-1" dir="ltr" />
          {errors.streamUrl && <p className="text-sm text-red-500">{errors.streamUrl.message}</p>}
          <p className="text-xs text-muted-foreground">
            برای Larix مسیر MediaMTX را وارد کنید؛ همین آدرس بدون تغییر به سرویس تحلیل تصویر داده می‌شود.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          <Label htmlFor="video">فایل ویدیو</Label>
          <Input
            id="video"
            type="file"
            accept={ALLOWED_VIDEO_EXTENSIONS}
            onChange={e => setVideoFile(e.target.files?.[0] ?? null)}
          />
          {videoFileError && <p className="text-sm text-red-500">{videoFileError}</p>}
          {currentVideoFileName && (
            <p className="text-xs text-muted-foreground" dir="ltr">
              فایل فعلی: {currentVideoFileName}
              {currentVideoUploadedAt && ` — ${new Date(currentVideoUploadedAt).toLocaleString('fa-IR')}`}
              {' — برای جایگزینی فایل جدیدی انتخاب کنید.'}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            ویدیو به‌صورت مداوم و حلقه‌ای در سرویس تحلیل تصویر پخش می‌شود و دوربین مانند یک دوربین زنده رفتار می‌کند.
          </p>
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor="status">وضعیت</Label>
        <select
          id="status"
          {...register('status')}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="fieldId">میدان (اختیاری)</Label>
        <select
          id="fieldId"
          {...register('fieldId')}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">-- بدون میدان --</option>
          {fields.map(f => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="marketId">بازار (اختیاری)</Label>
        <select
          id="marketId"
          {...register('marketId')}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">-- بدون بازار --</option>
          {markets.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="boothId">غرفه (اختیاری)</Label>
        <select
          id="boothId"
          {...register('boothId')}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">-- بدون غرفه --</option>
          {booths.map(b => (
            <option key={b.id} value={b.id}>
              غرفه {b.number} — {b.market.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          انصراف
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'در حال ذخیره...' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
