import { z } from 'zod'

export const createBoothSchema = z.object({
  number: z.string().min(1, 'شماره غرفه الزامی است').max(50),
  marketId: z.string().min(1, 'بازار الزامی است'),
  categoryId: z.string().min(1, 'دسته‌بندی الزامی است'),
  ownerId: z.string().optional(),
})

export const updateBoothSchema = createBoothSchema.partial()

export type CreateBoothDto = z.infer<typeof createBoothSchema>
export type UpdateBoothDto = z.infer<typeof updateBoothSchema>
