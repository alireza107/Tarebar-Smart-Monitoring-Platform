'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Separate UI schema: password optional on edit
const userFormSchema = z.object({
  username: z.string().min(1, 'نام کاربری الزامی است').max(50),
  name: z.string().min(1, 'نام الزامی است').max(100),
  email: z.string().email('ایمیل نامعتبر است').optional().or(z.literal('')),
  password: z.string().min(6, 'رمز عبور حداقل ۶ کاراکتر است').optional().or(z.literal('')),
  role: z.enum(['ORG_ADMIN', 'FIELD_MANAGER', 'MARKET_MANAGER']),
  isActive: z.boolean(),
})

export type UserFormValues = z.infer<typeof userFormSchema>

const roleLabels: Record<string, string> = {
  ORG_ADMIN: 'مدیر سازمان',
  FIELD_MANAGER: 'مدیر میدان',
  MARKET_MANAGER: 'مدیر بازار',
}

interface UserFormProps {
  defaultValues?: Partial<UserFormValues>
  isEdit?: boolean
  onSubmit: (data: UserFormValues) => void
  onCancel: () => void
  isPending: boolean
  submitLabel?: string
}

export function UserForm({ defaultValues, isEdit, onSubmit, onCancel, isPending, submitLabel = 'ذخیره' }: UserFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: { isActive: true, role: 'MARKET_MANAGER', ...defaultValues },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="username">نام کاربری</Label>
        <Input id="username" {...register('username')} disabled={isEdit} placeholder="مثال: john_doe" />
        {errors.username && <p className="text-sm text-red-500">{errors.username.message}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor="name">نام و نام خانوادگی</Label>
        <Input id="name" {...register('name')} placeholder="نام کامل" />
        {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor="email">ایمیل (اختیاری)</Label>
        <Input id="email" type="email" {...register('email')} placeholder="example@email.com" />
        {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor="password">{isEdit ? 'رمز عبور جدید (اختیاری)' : 'رمز عبور'}</Label>
        <Input id="password" type="password" {...register('password')} placeholder={isEdit ? 'خالی بگذارید تا تغییر نکند' : 'حداقل ۶ کاراکتر'} />
        {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor="role">نقش</Label>
        <select
          id="role"
          {...register('role')}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {Object.entries(roleLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        {errors.role && <p className="text-sm text-red-500">{errors.role.message}</p>}
      </div>

      <div className="flex items-center gap-2">
        <input id="isActive" type="checkbox" {...register('isActive')} className="h-4 w-4" />
        <Label htmlFor="isActive">کاربر فعال است</Label>
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
