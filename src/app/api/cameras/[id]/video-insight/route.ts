import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { forbidden, notFound, serverError, unauthorized, validationError } from '@/lib/api-responses'
import { checkPermission, PermissionError } from '@/lib/permissions'
import { assertCameraScope, ScopeError } from '@/lib/scope-guard'
import { logger } from '@/lib/logger'
import { serviceAuthHeaders } from '@/lib/service-token'
import { incidentResultSchema } from '@/modules/analysis-records/schema'
import { analysisRecordService } from '@/modules/analysis-records/service'
import { cameraService } from '@/modules/camera/service'
import { deriveAnalyticsRtspUrl } from '@/modules/camera/stream'
import type { Role } from '@/lib/permissions'

export const runtime = 'nodejs'
export const maxDuration = 300

const requestSchema = z.object({
  numFrames: z.number().int().min(2).max(16).default(8),
  intervalSeconds: z.number().min(10).max(60).default(10),
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
    const response = await fetch(`${analyticsBase}/api/v1/video-insights/from-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...serviceAuthHeaders(session.user) },
      body: JSON.stringify({
        stream_url: deriveAnalyticsRtspUrl(camera.streamUrl),
        num_frames: parsed.data.numFrames,
        interval_seconds: parsed.data.intervalSeconds,
        // An evidence frame is stored with alerts only (see analysisRecordService).
        include_thumbnail: true,
      }),
      cache: 'no-store',
    })
    const result: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      logger.warn({ cameraId: camera.id, status: response.status, result }, 'live video insight rejected')
      return NextResponse.json({ error: 'سرویس تشخیص حادثه درخواست را نپذیرفت', detail: result }, { status: response.status })
    }

    const payload = result && typeof result === 'object' && 'data' in result ? (result as { data: unknown }).data : result
    const validated = incidentResultSchema.safeParse(payload)
    const record = validated.success
      ? await analysisRecordService.recordIncidentSafely({
          actor: { id: session.user.id, name: session.user.name },
          source: 'LIVE',
          target: { cameraId: camera.id, fieldId: camera.fieldId, marketId: camera.marketId, boothId: camera.boothId },
          windowSeconds: parsed.data.intervalSeconds,
          result: validated.data,
        })
      : null
    return NextResponse.json({ data: payload, recordId: record?.id ?? null })
  } catch (error) {
    if (error instanceof PermissionError || error instanceof ScopeError) return forbidden()
    logger.error({ err: error }, 'failed to detect live camera incidents')
    return serverError('تشخیص حادثه در استریم زنده ممکن نشد')
  }
}
