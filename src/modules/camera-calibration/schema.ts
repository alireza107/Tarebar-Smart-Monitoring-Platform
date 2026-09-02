import { z } from 'zod'

export const createCameraCalibrationSchema = z.object({
  cameraId: z.string().min(1),
  serviceJobId: z.string().min(1),
  cameraGroup: z.string().max(100).optional().nullable(),
  boardType: z.enum(['checkerboard', 'charuco']),
  columns: z.number().int().min(2),
  rows: z.number().int().min(2),
  squareSizeMm: z.number().positive(),
  markerSizeMm: z.number().positive().optional().nullable(),
  dictionary: z.string().max(100).optional().nullable(),
  resolutionWidth: z.number().int().positive(),
  resolutionHeight: z.number().int().positive(),
  reprojectionError: z.number().nonnegative(),
  maxReprojectionError: z.number().positive(),
  calibrationPath: z.string().min(1).max(500),
  parameters: z.record(z.string(), z.unknown()),
})

export type CreateCameraCalibrationDto = z.infer<typeof createCameraCalibrationSchema>
