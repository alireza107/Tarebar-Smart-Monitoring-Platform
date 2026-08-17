import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { forbidden, notFound, serverError, unauthorized } from '@/lib/api-responses'
import { checkPermission, PermissionError } from '@/lib/permissions'
import { assertCameraScope, ScopeError } from '@/lib/scope-guard'
import { logger } from '@/lib/logger'
import { cameraService } from '@/modules/camera/service'
import { deriveAnalyticsRtspUrl } from '@/modules/camera/stream'
import type { Role } from '@/lib/permissions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

type AnalyticsFramePayload = {
  data?: {
    data_url?: string
    width?: number
    height?: number
    aspect_ratio?: number
  }
  detail?: unknown
}

/**
 * Capture a single still from the camera RTSP stream via the video-analytics
 * service (the same OpenCV path used by live analytics) and cache it.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'camera', 'read')

    const { id } = await params
    const camera = await cameraService.getById(id)
    if (!camera) return notFound()
    await assertCameraScope(session.user.id, session.user.role as Role, camera)
    if (!camera.streamUrl) {
      return NextResponse.json({ error: 'برای این دوربین آدرس استریم تنظیم نشده است' }, { status: 409 })
    }

    const analyticsBase = (
      process.env.VIDEO_ANALYTICS_API_URL ?? 'http://localhost:8000'
    ).replace(/\/+$/, '')
    const response = await fetch(`${analyticsBase}/api/v1/frames/from-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stream_url: deriveAnalyticsRtspUrl(camera.streamUrl) }),
      signal: AbortSignal.timeout(15_000),
    })
    const result = (await response.json().catch(() => null)) as AnalyticsFramePayload | null
    const payload = result?.data
    const dataUrl = payload?.data_url
    if (!response.ok || typeof dataUrl !== 'string') {
      logger.warn({ cameraId: camera.id, status: response.status, result }, 'camera frame capture rejected')
      return NextResponse.json(
        { error: 'دریافت تصویر از دوربین ممکن نشد', detail: result?.detail ?? result },
        { status: response.ok ? 502 : response.status },
      )
    }

    const saved = await cameraService.updateSnapshot(id, dataUrl)
    return NextResponse.json({
      data: {
        dataUrl,
        updatedAt: saved.snapshotUpdatedAt,
        width: payload?.width ?? null,
        height: payload?.height ?? null,
        aspectRatio: payload?.aspect_ratio ?? null,
      },
    })
  } catch (error) {
    if (error instanceof PermissionError || error instanceof ScopeError) return forbidden()
    logger.error({ err: error }, 'failed to capture camera frame')
    return serverError('دریافت تصویر از دوربین ممکن نشد')
  }
}
