import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { unauthorized, forbidden, validationError, serverError } from '@/lib/api-responses'
import { checkPermission, hasPermission, PermissionError } from '@/lib/permissions'
import { assertCameraScope, ScopeError } from '@/lib/scope-guard'
import { cameraService } from '@/modules/camera/service'
import { createCameraSchema } from '@/modules/camera/schema'
import { redactStreamCredentials } from '@/modules/camera/stream'
import type { Role } from '@/lib/permissions'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'camera', 'read')
    const role = session.user.role as Role
    const cameras = await cameraService.getAll(session.user.id, role)
    // Stream credentials are only needed by roles that can edit a camera.
    const data = hasPermission(role, 'camera', 'update')
      ? cameras
      : cameras.map(camera => ({ ...camera, streamUrl: redactStreamCredentials(camera.streamUrl) }))
    return NextResponse.json({ data })
  } catch (e) {
    if (e instanceof PermissionError) return forbidden()
    return serverError()
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'camera', 'create')
    const body = await req.json()
    const parsed = createCameraSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)
    await assertCameraScope(session.user.id, session.user.role as Role, {
      fieldId: parsed.data.fieldId,
      marketId: parsed.data.marketId,
      boothId: parsed.data.boothId,
    })
    const camera = await cameraService.create(parsed.data)
    return NextResponse.json({ data: camera }, { status: 201 })
  } catch (e) {
    if (e instanceof PermissionError || e instanceof ScopeError) return forbidden()
    return serverError()
  }
}
