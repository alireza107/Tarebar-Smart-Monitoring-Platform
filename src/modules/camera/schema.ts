import { z } from 'zod'

export const createCameraSchema = z.object({
  name: z.string().min(1, 'نام دوربین الزامی است').max(100),
  streamUrl: z.string().url('آدرس استریم نامعتبر است').optional().or(z.literal('')),
  status: z.enum(['ONLINE', 'OFFLINE', 'UNKNOWN']).default('UNKNOWN'),
  fieldId: z.string().optional(),
  marketId: z.string().optional(),
  boothId: z.string().optional(),
})

export const updateCameraSchema = z.object({
  name: z.string().min(1, 'نام دوربین الزامی است').max(100).optional(),
  streamUrl: z.string().url('آدرس استریم نامعتبر است').optional().or(z.literal('')),
  status: z.enum(['ONLINE', 'OFFLINE', 'UNKNOWN']).optional(),
  fieldId: z.string().optional().nullable(),
  marketId: z.string().optional().nullable(),
  boothId: z.string().optional().nullable(),
})

export type CreateCameraDto = z.infer<typeof createCameraSchema>
export type UpdateCameraDto = z.infer<typeof updateCameraSchema>
