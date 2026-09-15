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
export const maxDuration = 300

const requestSchema = z.object({
  query: z.string().trim().min(1).max(4000),
  numFrames: z.number().int().min(2).max(16).default(8),
  maxNewTokens: z.number().int().min(16).max(512).default(80),
  detailed: z.boolean().default(false),
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stream_url: deriveAnalyticsRtspUrl(camera.streamUrl),
        query: parsed.data.query,
        num_frames: parsed.data.numFrames,
        max_new_tokens: parsed.data.maxNewTokens,
        detailed: parsed.data.detailed,
      }),
      cache: 'no-store',
    })
    const result: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      logger.warn({ cameraId: camera.id, status: response.status, result }, 'live video insight rejected')
      return NextResponse.json({ error: 'سرویس درک ویدیو درخواست را نپذیرفت', detail: result }, { status: response.status })
    }
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof PermissionError || error instanceof ScopeError) return forbidden()
    logger.error({ err: error }, 'failed to interpret live camera video')
    return serverError('درک استریم زنده ممکن نشد')
  }
}
