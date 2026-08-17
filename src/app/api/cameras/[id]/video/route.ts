import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { forbidden, notFound, serverError, unauthorized } from '@/lib/api-responses'
import { checkPermission, PermissionError } from '@/lib/permissions'
import { assertCameraScope, ScopeError } from '@/lib/scope-guard'
import { logger } from '@/lib/logger'
import { cameraService } from '@/modules/camera/service'
import type { Role } from '@/lib/permissions'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

// Uploads a video file and has the video-analytics service republish it into
// MediaMTX as a real, continuously-looping RTSP stream on a per-camera path.
// Once that succeeds, this camera's streamUrl becomes a genuine rtsp(s):// URL
// — the health probe, live preview, and analytics-start flow all treat it
// exactly like a real camera from then on, with no further special-casing.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'camera', 'update')

    const { id } = await params
    const camera = await cameraService.getById(id)
    if (!camera) return notFound()
    await assertCameraScope(session.user.id, session.user.role as Role, camera)

    if (!req.body) return NextResponse.json({ error: 'Missing video upload body' }, { status: 400 })

    const analyticsBase = (
      process.env.VIDEO_ANALYTICS_API_URL ?? 'http://localhost:8000'
    ).replace(/\/+$/, '')

    let upstream: Response
    try {
      upstream = await fetch(`${analyticsBase}/api/v1/virtual-cameras/${camera.id}/video`, {
        method: 'POST',
        headers: { 'Content-Type': req.headers.get('content-type') ?? 'application/octet-stream' },
        // Stream the multipart body straight through instead of buffering the
        // whole video in memory; `duplex: 'half'` is required by Node's fetch
        // whenever the request body is a stream.
        body: req.body,
        duplex: 'half',
      } as RequestInit)
    } catch (error) {
      logger.error({ err: error, cameraId: camera.id }, 'video-analytics service unreachable for video upload')
      return NextResponse.json(
        { error: 'Video analytics service is unreachable' },
        { status: 502 },
      )
    }

    const result: unknown = await upstream.json().catch(() => null)
    if (!upstream.ok) {
      logger.warn({ cameraId: camera.id, status: upstream.status, result }, 'virtual camera upload rejected')
      return NextResponse.json(
        { error: 'Video analytics service rejected the video upload', detail: result },
        { status: upstream.status },
      )
    }

    const data = (result as { data?: { push_url?: string; original_filename?: string } } | null)?.data
    if (!data?.push_url) {
      logger.error({ cameraId: camera.id, result }, 'virtual camera upload response missing push_url')
      return serverError()
    }

    const updated = await cameraService.attachVideoSource(camera.id, {
      streamUrl: data.push_url,
      videoFileName: data.original_filename ?? 'video',
    })
    return NextResponse.json({ data: updated }, { status: 202 })
  } catch (error) {
    if (error instanceof PermissionError || error instanceof ScopeError) return forbidden()
    logger.error({ err: error }, 'failed to upload virtual camera video')
    return serverError()
  }
}
