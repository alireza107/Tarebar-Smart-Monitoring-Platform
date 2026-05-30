import { z } from 'zod'

export const createBoothCategorySchema = z.object({
  name: z.string().min(1, 'نام دسته‌بندی الزامی است').max(100),
})

export const updateBoothCategorySchema = createBoothCategorySchema.partial()

export type CreateBoothCategoryDto = z.infer<typeof createBoothCategorySchema>
export type UpdateBoothCategoryDto = z.infer<typeof updateBoothCategorySchema>
