'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
  onSubmit: (data: CameraFormValues) => void
  onCancel: () => void
  isPending: boolean
  submitLabel?: string
}

export function CameraForm({ defaultValues, onSubmit, onCancel, isPending, submitLabel = 'ذخیره' }: CameraFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<CameraFormValues>({
    resolver: zodResolver(cameraFormSchema),
    defaultValues: { status: 'UNKNOWN', ...defaultValues },
  })

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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="name">نام دوربین</Label>
        <Input id="name" {...register('name')} placeholder="مثال: دوربین ورودی" />
        {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor="streamUrl">آدرس استریم (اختیاری)</Label>
        <Input id="streamUrl" {...register('streamUrl')} placeholder="rtsp://..." dir="ltr" />
        {errors.streamUrl && <p className="text-sm text-red-500">{errors.streamUrl.message}</p>}
      </div>

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
