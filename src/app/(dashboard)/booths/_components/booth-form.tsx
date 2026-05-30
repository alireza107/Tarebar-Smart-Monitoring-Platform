'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createBoothSchema, type CreateBoothDto } from '@/modules/booth/schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Market } from '@/modules/market/types'
import type { BoothCategory } from '@/modules/booth-category/types'

interface BoothFormProps {
  markets: Market[]
  categories: BoothCategory[]
  defaultValues?: Partial<CreateBoothDto>
  onSubmit: (data: CreateBoothDto) => void
  onCancel: () => void
  isPending: boolean
  submitLabel?: string
}

export function BoothForm({ markets, categories, defaultValues, onSubmit, onCancel, isPending, submitLabel = 'ذخیره' }: BoothFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<CreateBoothDto>({
    resolver: zodResolver(createBoothSchema),
    defaultValues,
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="number">شماره غرفه</Label>
        <Input id="number" {...register('number')} placeholder="مثال: A-101" />
        {errors.number && <p className="text-sm text-red-500">{errors.number.message}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor="marketId">بازار</Label>
        <select
          id="marketId"
          {...register('marketId')}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">انتخاب بازار...</option>
          {markets.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        {errors.marketId && <p className="text-sm text-red-500">{errors.marketId.message}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor="categoryId">دسته‌بندی</Label>
        <select
          id="categoryId"
          {...register('categoryId')}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">انتخاب دسته‌بندی...</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {errors.categoryId && <p className="text-sm text-red-500">{errors.categoryId.message}</p>}
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
