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

/**
 * Proxy an unannotated MJPEG preview of the camera RTSP stream. Browser
 * WebRTC/HLS playback is unreliable here; live analytics already reads this
 * same OpenCV path once a job is running.
 */
export async function GET(_req: NextRequest, { params }: Params) {
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
    const response = await fetch(`${analyticsBase}/api/v1/preview-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stream_url: deriveAnalyticsRtspUrl(camera.streamUrl) }),
      cache: 'no-store',
    })
    if (!response.ok || !response.body) {
      const result = await response.json().catch(() => null)
      logger.warn({ cameraId: camera.id, status: response.status, result }, 'camera preview stream rejected')
      return NextResponse.json(
        { error: 'پیش‌نمایش زنده دوربین در دسترس نیست', detail: result },
        { status: response.ok ? 502 : response.status },
      )
    }

    return new NextResponse(response.body, {
      headers: {
        'Content-Type':
          response.headers.get('Content-Type') ?? 'multipart/x-mixed-replace; boundary=frame',
        'Cache-Control': 'no-store, no-transform',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error) {
    if (error instanceof PermissionError || error instanceof ScopeError) return forbidden()
    logger.error({ err: error }, 'failed to open camera preview stream')
    return serverError('پیش‌نمایش زنده دوربین در دسترس نیست')
  }
}
