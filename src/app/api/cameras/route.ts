import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { unauthorized, forbidden, validationError, serverError } from '@/lib/api-responses'
import { checkPermission, PermissionError } from '@/lib/permissions'
import { cameraService } from '@/modules/camera/service'
import { createCameraSchema } from '@/modules/camera/schema'
import type { Role } from '@/lib/permissions'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'camera', 'read')
    const cameras = await cameraService.getAll(session.user.id, session.user.role as Role)
    return NextResponse.json({ data: cameras })
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
    const camera = await cameraService.create(parsed.data)
    return NextResponse.json({ data: camera }, { status: 201 })
  } catch (e) {
    if (e instanceof PermissionError) return forbidden()
    return serverError()
  }
}
