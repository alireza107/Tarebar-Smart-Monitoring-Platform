import { z } from 'zod'

export const createFieldSchema = z.object({
  name: z.string().min(1, 'نام میدان الزامی است').max(100),
  address: z.string().min(1, 'آدرس الزامی است'),
})

export const updateFieldSchema = createFieldSchema.partial()

export type CreateFieldDto = z.infer<typeof createFieldSchema>
export type UpdateFieldDto = z.infer<typeof updateFieldSchema>
