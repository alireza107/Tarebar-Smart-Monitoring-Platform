import { z } from 'zod'

export const createUserSchema = z.object({
  username: z.string().min(1, 'نام کاربری الزامی است').max(50),
  name: z.string().min(1, 'نام الزامی است').max(100),
  email: z.string().email('ایمیل نامعتبر است').optional(),
  password: z.string().min(6, 'رمز عبور حداقل ۶ کاراکتر است'),
  role: z.enum(['ORG_ADMIN', 'FIELD_MANAGER', 'MARKET_MANAGER']),
  isActive: z.boolean().default(true),
})

export const updateUserSchema = z.object({
  name: z.string().min(1, 'نام الزامی است').max(100).optional(),
  email: z.string().email('ایمیل نامعتبر است').optional(),
  password: z.string().min(6, 'رمز عبور حداقل ۶ کاراکتر است').optional(),
  role: z.enum(['ORG_ADMIN', 'FIELD_MANAGER', 'MARKET_MANAGER']).optional(),
  isActive: z.boolean().optional(),
})

export type CreateUserDto = z.infer<typeof createUserSchema>
export type UpdateUserDto = z.infer<typeof updateUserSchema>
