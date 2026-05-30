'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createMarketSchema, type CreateMarketDto } from '@/modules/market/schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Field } from '@/modules/field/types'

interface MarketFormProps {
  fields: Field[]
  defaultValues?: Partial<CreateMarketDto>
  onSubmit: (data: CreateMarketDto) => void
  onCancel: () => void
  isPending: boolean
  submitLabel?: string
}

export function MarketForm({ fields, defaultValues, onSubmit, onCancel, isPending, submitLabel = 'ذخیره' }: MarketFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<CreateMarketDto>({
    resolver: zodResolver(createMarketSchema),
    defaultValues,
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="name">نام بازار</Label>
        <Input id="name" {...register('name')} placeholder="مثال: بازار مرکزی" />
        {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor="fieldId">میدان</Label>
        <select
          id="fieldId"
          {...register('fieldId')}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">انتخاب میدان...</option>
          {fields.map(f => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        {errors.fieldId && <p className="text-sm text-red-500">{errors.fieldId.message}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor="address">آدرس (اختیاری)</Label>
        <Input id="address" {...register('address')} placeholder="آدرس بازار" />
        {errors.address && <p className="text-sm text-red-500">{errors.address.message}</p>}
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
