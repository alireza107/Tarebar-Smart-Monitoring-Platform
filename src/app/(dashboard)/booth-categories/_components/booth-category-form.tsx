'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createBoothCategorySchema, type CreateBoothCategoryDto } from '@/modules/booth-category/schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface BoothCategoryFormProps {
  defaultValues?: Partial<CreateBoothCategoryDto>
  onSubmit: (data: CreateBoothCategoryDto) => void
  onCancel: () => void
  isPending: boolean
  submitLabel?: string
}

export function BoothCategoryForm({ defaultValues, onSubmit, onCancel, isPending, submitLabel = 'ذخیره' }: BoothCategoryFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<CreateBoothCategoryDto>({
    resolver: zodResolver(createBoothCategorySchema),
    defaultValues,
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="name">نام دسته‌بندی</Label>
        <Input id="name" {...register('name')} placeholder="مثال: میوه، سبزیجات، خشکبار" />
        {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
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
