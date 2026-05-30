'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createFieldSchema, type CreateFieldDto } from '@/modules/field/schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Field } from '@/modules/field/types'

interface FieldFormProps {
  defaultValues?: Partial<CreateFieldDto>
  onSubmit: (data: CreateFieldDto) => void
  onCancel: () => void
  isPending: boolean
  submitLabel?: string
}

export function FieldForm({ defaultValues, onSubmit, onCancel, isPending, submitLabel = 'ذخیره' }: FieldFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<CreateFieldDto>({
    resolver: zodResolver(createFieldSchema),
    defaultValues,
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="name">نام میدان</Label>
        <Input id="name" {...register('name')} placeholder="مثال: میدان مرکزی تهران" />
        {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor="address">آدرس</Label>
        <Input id="address" {...register('address')} placeholder="آدرس کامل میدان" />
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
