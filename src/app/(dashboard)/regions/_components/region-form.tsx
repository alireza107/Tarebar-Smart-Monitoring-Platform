'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Check, Palette } from 'lucide-react'

const regionFormSchema = z.object({
  name: z.string().min(1, 'نام منطقه الزامی است').max(100),
  description: z.string().max(500).optional().or(z.literal('')),
  marketId: z.string().min(1, 'انتخاب بازار الزامی است'),
  color: z.string().regex(/^#([0-9a-fA-F]{6})$/, 'رنگ نامعتبر است').optional().or(z.literal('')),
})

export type RegionFormValues = z.infer<typeof regionFormSchema>

const COLOR_PRESETS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#84cc16', // lime
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#64748b', // slate
]

interface RegionFormProps {
  defaultValues?: Partial<RegionFormValues>
  /** When true the market cannot be changed (edit mode). */
  lockMarket?: boolean
  onSubmit: (data: RegionFormValues) => void
  onCancel: () => void
  isPending: boolean
  submitLabel?: string
}

export function RegionForm({
  defaultValues,
  lockMarket = false,
  onSubmit,
  onCancel,
  isPending,
  submitLabel = 'ذخیره',
}: RegionFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegionFormValues>({
    resolver: zodResolver(regionFormSchema),
    defaultValues: { color: '#10b981', ...defaultValues },
  })

  const { data: markets = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['markets-select'],
    queryFn: () => fetch('/api/markets').then(r => r.json()).then(j => j.data),
  })

  const selectedColor = watch('color') || '#10b981'
  const lockedMarketName = lockMarket
    ? markets.find(m => m.id === defaultValues?.marketId)?.name
    : undefined

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="name">نام منطقه</Label>
        <Input id="name" {...register('name')} placeholder="مثال: ناحیه میوه" />
        {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor="description">توضیحات (اختیاری)</Label>
        <Input id="description" {...register('description')} placeholder="توضیح کوتاه درباره منطقه" />
        {errors.description && <p className="text-sm text-red-500">{errors.description.message}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor="marketId">بازار</Label>
        {lockMarket ? (
          <>
            <input type="hidden" {...register('marketId')} />
            <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground">
              {lockedMarketName ?? '—'}
            </div>
            <p className="text-xs text-muted-foreground">بازار پس از ایجاد قابل تغییر نیست.</p>
          </>
        ) : (
          <select
            id="marketId"
            {...register('marketId')}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">-- انتخاب بازار --</option>
            {markets.map(m => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        )}
        {errors.marketId && <p className="text-sm text-red-500">{errors.marketId.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>رنگ نمایش (اختیاری)</Label>
        <input type="hidden" {...register('color')} />
        <div className="flex flex-wrap items-center gap-2">
          {COLOR_PRESETS.map(c => {
            const active = selectedColor.toLowerCase() === c.toLowerCase()
            return (
              <button
                key={c}
                type="button"
                onClick={() => setValue('color', c, { shouldValidate: true, shouldDirty: true })}
                title={c}
                className={`size-7 rounded-full transition-transform hover:scale-110 ${
                  active ? 'ring-2 ring-offset-2 ring-offset-background' : ''
                }`}
                style={{ background: c, boxShadow: active ? `0 0 0 2px ${c}` : undefined }}
                aria-label={c}
              >
                {active && <Check className="mx-auto size-4 text-white" />}
              </button>
            )
          })}
          <label
            className="relative flex size-7 cursor-pointer items-center justify-center rounded-full border border-dashed border-input text-muted-foreground hover:bg-muted"
            title="رنگ دلخواه"
          >
            <Palette className="size-4" />
            <input
              type="color"
              value={selectedColor}
              onChange={e => setValue('color', e.target.value, { shouldValidate: true, shouldDirty: true })}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
        {errors.color && <p className="text-sm text-red-500">{errors.color.message}</p>}
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
