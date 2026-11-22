import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { forbidden, notFound, serverError, unauthorized, validationError } from '@/lib/api-responses'
import { checkPermission, PermissionError } from '@/lib/permissions'
import { assertCameraScope, ScopeError } from '@/lib/scope-guard'
import { logger } from '@/lib/logger'
import { serviceAuthHeaders } from '@/lib/service-token'
import { fruitQualityResultSchema } from '@/modules/analysis-records/schema'
import { analysisRecordService } from '@/modules/analysis-records/service'
import { cameraService } from '@/modules/camera/service'
import { deriveAnalyticsRtspUrl } from '@/modules/camera/stream'
import type { Role } from '@/lib/permissions'

export const runtime = 'nodejs'
export const maxDuration = 300

const requestSchema = z.object({
  numFrames: z.number().int().min(2).max(16).default(8),
  intervalSeconds: z.number().min(10).max(60).default(10),
  detailLevel: z.enum(['summary', 'detailed']).default('summary'),
  perFrame: z.boolean().default(false),
  includeThumbnails: z.boolean().default(false),
})

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'camera', 'read')
    const parsed = requestSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return validationError(parsed.error)

    const { id } = await params
    const camera = await cameraService.getById(id)
    if (!camera) return notFound()
    await assertCameraScope(session.user.id, session.user.role as Role, camera)
    if (!camera.streamUrl) {
      return NextResponse.json({ error: 'برای این دوربین آدرس استریم تنظیم نشده است' }, { status: 409 })
    }

    const analyticsBase = (process.env.VIDEO_ANALYTICS_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '')
    const response = await fetch(`${analyticsBase}/api/v1/fruit-quality/from-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...serviceAuthHeaders(session.user) },
      body: JSON.stringify({
        stream_url: deriveAnalyticsRtspUrl(camera.streamUrl),
        num_frames: parsed.data.numFrames,
        interval_seconds: parsed.data.intervalSeconds,
        detail_level: parsed.data.detailLevel,
        per_frame: parsed.data.perFrame,
        include_thumbnails: parsed.data.includeThumbnails,
      }),
      cache: 'no-store',
    })
    const result: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      logger.warn({ cameraId: camera.id, status: response.status, result }, 'live fruit quality rejected')
      return NextResponse.json({ error: 'سرویس ارزیابی کیفیت میوه درخواست را نپذیرفت', detail: result }, { status: response.status })
    }

    // Keep the assessment so it can be exported and counted in the location's reports.
    const payload = result && typeof result === 'object' && 'data' in result ? (result as { data: unknown }).data : result
    const validated = fruitQualityResultSchema.safeParse(payload)
    const record = validated.success
      ? await analysisRecordService.recordQualitySafely({
          actor: { id: session.user.id, name: session.user.name },
          source: 'LIVE',
          target: { cameraId: camera.id, fieldId: camera.fieldId, marketId: camera.marketId, boothId: camera.boothId },
          result: validated.data,
        })
      : null
    if (!validated.success) logger.warn({ cameraId: camera.id, issues: validated.error.issues.slice(0, 5) }, 'fruit quality result was not stored: unexpected shape')
    return NextResponse.json({ data: payload, recordId: record?.id ?? null })
  } catch (error) {
    if (error instanceof PermissionError || error instanceof ScopeError) return forbidden()
    logger.error({ err: error }, 'failed to score live fruit quality')
    return serverError('ارزیابی کیفیت میوه در استریم زنده ممکن نشد')
  }
}
