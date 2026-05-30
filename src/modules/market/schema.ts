import { z } from 'zod'

export const createMarketSchema = z.object({
  name: z.string().min(1, 'نام بازار الزامی است').max(100),
  address: z.string().max(255).optional(),
  fieldId: z.string().min(1, 'میدان الزامی است'),
})

export const updateMarketSchema = createMarketSchema.partial()

export type CreateMarketDto = z.infer<typeof createMarketSchema>
export type UpdateMarketDto = z.infer<typeof updateMarketSchema>
