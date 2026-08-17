import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { unauthorized, forbidden, notFound, validationError, serverError } from '@/lib/api-responses'
import { checkPermission, PermissionError } from '@/lib/permissions'
import { assertCameraScope, ScopeError } from '@/lib/scope-guard'
import { logger } from '@/lib/logger'
import { cameraService } from '@/modules/camera/service'
import { updateCameraSchema } from '@/modules/camera/schema'
import type { Role } from '@/lib/permissions'

// Stops and removes a camera's video-file publisher on the video-analytics
// service. Best-effort: never lets that service's availability block the
// primary Camera CRUD flow, which would otherwise leave a user unable to
// edit/delete a camera whenever the analytics service happens to be down.
async function stopVideoSource(cameraId: string): Promise<void> {
  const analyticsBase = (
    process.env.VIDEO_ANALYTICS_API_URL ?? 'http://localhost:8000'
  ).replace(/\/+$/, '')
  try {
    await fetch(`${analyticsBase}/api/v1/virtual-cameras/${cameraId}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(10_000),
    })
  } catch (error) {
    logger.warn({ err: error, cameraId }, 'failed to stop virtual camera publisher')
  }
}

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'camera', 'read')
    const { id } = await params
    const camera = await cameraService.getById(id)
    if (!camera) return notFound()
    return NextResponse.json({ data: camera })
  } catch (e) {
    if (e instanceof PermissionError) return forbidden()
    return serverError()
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'camera', 'update')
    const { id } = await params
    const existing = await cameraService.getById(id)
    if (!existing) return notFound()
    // Verify user can access the existing camera's location
    await assertCameraScope(session.user.id, session.user.role as Role, {
      fieldId: existing.fieldId,
      marketId: existing.marketId,
      boothId: existing.boothId,
    })
    const body = await req.json()
    const parsed = updateCameraSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)
    // Verify the new location is also in scope
    await assertCameraScope(session.user.id, session.user.role as Role, {
      fieldId: parsed.data.fieldId ?? null,
      marketId: parsed.data.marketId ?? null,
      boothId: parsed.data.boothId ?? null,
    })
    // A VIDEO_FILE camera switches back to RTSP mode by submitting a streamUrl
    // through this same endpoint (the camera form's RTSP-mode submit always
    // includes it) — stop its publisher and clear the video-source fields.
    if (existing.sourceType === 'VIDEO_FILE' && parsed.data.streamUrl !== undefined) {
      await stopVideoSource(id)
      await cameraService.detachVideoSource(id)
    }
    const camera = await cameraService.update(id, parsed.data)
    return NextResponse.json({ data: camera })
  } catch (e) {
    if (e instanceof PermissionError || e instanceof ScopeError) return forbidden()
    return serverError()
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'camera', 'delete')
    const { id } = await params
    const existing = await cameraService.getById(id)
    if (!existing) return notFound()
    await assertCameraScope(session.user.id, session.user.role as Role, {
      fieldId: existing.fieldId,
      marketId: existing.marketId,
      boothId: existing.boothId,
    })
    if (existing.sourceType === 'VIDEO_FILE') {
      await stopVideoSource(id)
    }
    await cameraService.delete(id)
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    if (e instanceof PermissionError || e instanceof ScopeError) return forbidden()
    return serverError()
  }
}
