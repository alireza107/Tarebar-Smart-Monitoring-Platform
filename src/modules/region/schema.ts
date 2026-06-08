import { z } from 'zod'
import { polygonSchema, exclusionPolygonsSchema } from './geometry'

const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{6})$/, 'رنگ نامعتبر است')
  .optional()
  .or(z.literal(''))

// ─── Region CRUD ─────────────────────────────────────────────────────────────

export const createRegionSchema = z.object({
  name: z.string().min(1, 'نام منطقه الزامی است').max(100),
  description: z.string().max(500).optional().or(z.literal('')),
  marketId: z.string().min(1, 'انتخاب بازار الزامی است'),
  color: hexColor,
})

export const updateRegionSchema = z.object({
  name: z.string().min(1, 'نام منطقه الزامی است').max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  color: hexColor.nullable(),
  // marketId is intentionally immutable after creation (scope + mapping integrity).
})

// ─── Camera <-> Region mapping (geometry lives here) ─────────────────────────

export const createCameraRegionSchema = z.object({
  cameraId: z.string().min(1, 'انتخاب دوربین الزامی است'),
  mainPolygon: polygonSchema,
  exclusionPolygons: exclusionPolygonsSchema,
})

export const updateCameraRegionSchema = z.object({
  mainPolygon: polygonSchema.optional(),
  exclusionPolygons: exclusionPolygonsSchema.optional(),
})

// ─── Region <-> Booth (Stall) mapping ────────────────────────────────────────

// Replace-the-whole-set semantics: the UI sends the desired booth list.
export const setRegionBoothsSchema = z.object({
  boothIds: z.array(z.string().min(1)).max(500),
})

// ─── Search / list query ─────────────────────────────────────────────────────

export const regionQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  marketId: z.string().optional(),
})

// ─── Import / Export ─────────────────────────────────────────────────────────

export const importRegionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  marketId: z.string().min(1),
  color: z.string().regex(/^#([0-9a-fA-F]{6})$/).optional().nullable(),
  cameraMappings: z
    .array(
      z.object({
        cameraId: z.string().min(1),
        mainPolygon: polygonSchema,
        exclusionPolygons: exclusionPolygonsSchema,
      }),
    )
    .default([]),
  boothIds: z.array(z.string().min(1)).default([]),
})

export const importRegionsSchema = z.object({
  // upsert by (marketId, name); existing regions are updated, new ones created.
  regions: z.array(importRegionSchema).min(1, 'حداقل یک منطقه برای ورود لازم است').max(1000),
})

export type CreateRegionDto = z.infer<typeof createRegionSchema>
export type UpdateRegionDto = z.infer<typeof updateRegionSchema>
export type CreateCameraRegionDto = z.infer<typeof createCameraRegionSchema>
export type UpdateCameraRegionDto = z.infer<typeof updateCameraRegionSchema>
export type SetRegionBoothsDto = z.infer<typeof setRegionBoothsSchema>
export type RegionQueryDto = z.infer<typeof regionQuerySchema>
export type ImportRegionDto = z.infer<typeof importRegionSchema>
export type ImportRegionsDto = z.infer<typeof importRegionsSchema>
