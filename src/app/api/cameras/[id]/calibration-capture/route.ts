import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { forbidden, notFound, serverError, unauthorized, validationError } from '@/lib/api-responses'
import { checkPermission, PermissionError } from '@/lib/permissions'
import { assertCameraScope, ScopeError } from '@/lib/scope-guard'
import { logger } from '@/lib/logger'
import { cameraService } from '@/modules/camera/service'
import { deriveAnalyticsRtspUrl } from '@/modules/camera/stream'
import type { Role } from '@/lib/permissions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const requestSchema = z.object({
  camera_group: z.string().max(100).optional().nullable(),
  board: z.enum(['checkerboard', 'charuco']).default('charuco'),
  columns: z.number().int().min(2),
  rows: z.number().int().min(2),
  square_size_mm: z.number().positive(),
  marker_size_mm: z.number().positive(),
  dictionary: z.string().min(1).max(100),
  frame_step: z.number().int().min(1),
  min_frames: z.number().int().min(3),
  max_reprojection_error: z.number().positive(),
  capture_seconds: z.number().int().min(5).max(120),
})

type Params = { params: Promise<{ id: string }> }

/** Start a bounded server-side recording from a camera's private stream. */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'camera', 'read')

    const parsed = requestSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return validationError(parsed.error)

    const { id } = await params
    const camera = await cameraService.getById(id)
    if (!camera) return notFound()
    await assertCameraScope(session.user.id, session.user.role as Role, camera)
    if (!camera.streamUrl) {
      return NextResponse.json({ error: 'برای این دوربین آدرس استریم تنظیم نشده است' }, { status: 409 })
    }

    const fruitBase = (
      process.env.FRUIT_PIPELINE_API_URL ?? 'http://localhost:8010'
    ).replace(/\/+$/, '')
    const response = await fetch(`${fruitBase}/api/v1/calibrations/from-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...parsed.data,
        camera_id: camera.id,
        stream_url: deriveAnalyticsRtspUrl(camera.streamUrl),
      }),
      signal: AbortSignal.timeout(20_000),
    })
    const result: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      logger.warn({ cameraId: camera.id, status: response.status, result }, 'live calibration capture rejected')
      return NextResponse.json(
        { error: 'شروع ضبط کالیبراسیون از دوربین ممکن نشد', detail: result },
        { status: response.status },
      )
    }
    return NextResponse.json(result, { status: 202 })
  } catch (error) {
    if (error instanceof PermissionError || error instanceof ScopeError) return forbidden()
    logger.error({ err: error }, 'failed to start live calibration capture')
    return serverError('شروع ضبط کالیبراسیون از دوربین ممکن نشد')
  }
}
