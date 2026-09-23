import { z } from 'zod'
import { DEFECT_TYPES, FRUIT_QUALITY_LABELS } from './types'

const percent = z.number().min(0).max(100)
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
// JPEG/PNG/WebP evidence thumbnail. ~150 KB decoded is far above a 320 px JPEG.
const thumbnail = z
  .string()
  .regex(/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/]+=*$/)
  .max(200_000)

const qualityFrameSchema = z.object({
  index: z.number().int().nonnegative(),
  timestamp_seconds: z.number().nonnegative().nullable().optional(),
  has_fruit: z.boolean().nullable().optional(),
  freshness_score: percent.nullable().optional(),
  label: z.string().max(40).nullable().optional(),
  note_fa: z.string().max(500).nullable().optional(),
  thumbnail: thumbnail.nullable().optional(),
  error: z.string().max(300).nullable().optional(),
})

/** Validates the analytics-service response before anything is stored. */
export const fruitQualityResultSchema = z.object({
  has_fruit: z.boolean(),
  label: z.enum(FRUIT_QUALITY_LABELS),
  freshness_score: percent,
  distribution: z.object({ fresh: percent, middle: percent, rotten: percent }),
  fruit_count_estimate: z.number().int().nonnegative().nullable(),
  confidence: percent,
  summary_fa: z.string().min(1).max(2000),
  verdict_fa: z.string().max(2000).nullable().optional(),
  frame_count: z.number().int().nonnegative(),
  inference_seconds: z.number().nonnegative(),
  analysis_version: z.number().int().optional(),
  detail_level: z.enum(['summary', 'detailed']).optional(),
  model: z.string().max(200).nullable().optional(),
  grade: z.enum(['A', 'B', 'C', 'D']).nullable().optional(),
  fruit_types: z
    .array(z.object({ name_fa: z.string().min(1).max(100), share_percent: percent.nullable() }))
    .max(20)
    .optional(),
  defects: z
    .array(
      z.object({
        type: z.enum(DEFECT_TYPES),
        label_fa: z.string().max(100),
        severity: z.enum(['low', 'medium', 'high']),
        affected_percent: percent.nullable(),
        note_fa: z.string().max(500).nullable(),
      }),
    )
    .max(30)
    .optional(),
  shelf_life_days_estimate: z.number().min(0).max(365).nullable().optional(),
  recommendation_fa: z.string().max(2000).nullable().optional(),
  storage_advice_fa: z.string().max(2000).nullable().optional(),
  frames: z.array(qualityFrameSchema).max(32).optional(),
  frame_statistics: z
    .object({
      analyzed: z.number().int().nonnegative(),
      score_min: percent.nullable(),
      score_max: percent.nullable(),
      score_mean: percent.nullable(),
      score_stddev: z.number().nonnegative().nullable(),
    })
    .nullable()
    .optional(),
  total_seconds: z.number().nonnegative().optional(),
})

export const incidentResultSchema = z.object({
  answers: z.object({ fighting: z.enum(['Yes', 'No']), floor_clean: z.enum(['Yes', 'No']) }),
  frame_count: z.number().int().nonnegative().optional(),
  inference_seconds: z.number().nonnegative(),
  thumbnail: thumbnail.nullable().optional(),
  model: z.string().max(200).nullable().optional(),
})

/** Optional location an uploaded file is filed under, so it shows in that location's reports. */
const locationTarget = z
  .object({
    locationType: z.enum(['field', 'market', 'booth']).optional(),
    locationId: z.string().min(1).optional(),
  })
  .refine(value => Boolean(value.locationType) === Boolean(value.locationId), {
    message: 'locationType and locationId must be given together',
    path: ['locationId'],
  })

export const createQualityAssessmentSchema = z
  .object({
    result: fruitQualityResultSchema,
    fileName: z.string().max(255).optional().nullable(),
  })
  .and(locationTarget)

export const createIncidentCheckSchema = z
  .object({
    result: incidentResultSchema,
    fileName: z.string().max(255).optional().nullable(),
    windowLabel: z.string().max(60).optional().nullable(),
    windowSeconds: z.number().positive().max(3600).optional().nullable(),
  })
  .and(locationTarget)

const sizeStatisticsSchema = z
  .object({
    count: z.number().int().nonnegative(),
    diameter_mm: z.record(z.string(), z.number().nullable()).optional(),
    histogram: z
      .array(z.object({ from_mm: z.number(), to_mm: z.number(), count: z.number().int().nonnegative() }))
      .max(200)
      .optional(),
  })
  .passthrough()

export const createMeasurementRunSchema = z.object({
  cameraId: z.string().min(1),
  serviceJobId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  source: z.enum(['LIVE', 'UPLOAD']),
  processingMode: z.string().max(40).optional().nullable(),
  palletType: z.string().max(60).optional().nullable(),
  processedFrames: z.number().int().nonnegative(),
  totalFruitObservations: z.number().int().nonnegative(),
  lastFruitCount: z.number().int().nonnegative().optional().nullable(),
  avgWidthMm: z.number().nonnegative().optional().nullable(),
  avgLengthMm: z.number().nonnegative().optional().nullable(),
  avgDiameterMm: z.number().nonnegative().optional().nullable(),
  sizeStatistics: sizeStatisticsSchema.optional().nullable(),
})

export const recordQuerySchema = z
  .object({
    locationType: z.enum(['organization', 'field', 'market', 'booth']).default('organization'),
    locationId: z.string().min(1).optional(),
    cameraId: z.string().min(1).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    limit: z.coerce.number().int().min(1).max(500).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .superRefine((value, context) => {
    if (value.locationType !== 'organization' && !value.locationId) {
      context.addIssue({ code: 'custom', path: ['locationId'], message: 'locationId is required' })
    }
    if (value.from && value.to && value.from > value.to) {
      context.addIssue({ code: 'custom', path: ['to'], message: 'to must be on or after from' })
    }
  })

export type FruitQualityResultInput = z.infer<typeof fruitQualityResultSchema>
export type IncidentResultInput = z.infer<typeof incidentResultSchema>
export type CreateMeasurementRunDto = z.infer<typeof createMeasurementRunSchema>
export type RecordQuery = z.infer<typeof recordQuerySchema>
