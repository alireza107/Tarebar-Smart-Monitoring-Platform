import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { unauthorized, forbidden, notFound, validationError, serverError } from '@/lib/api-responses'
import { checkPermission, PermissionError } from '@/lib/permissions'
import { cameraService } from '@/modules/camera/service'
import { updateCameraSchema } from '@/modules/camera/schema'

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
    const body = await req.json()
    const parsed = updateCameraSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)
    const camera = await cameraService.update(id, parsed.data)
    return NextResponse.json({ data: camera })
  } catch (e) {
    if (e instanceof PermissionError) return forbidden()
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
    await cameraService.delete(id)
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    if (e instanceof PermissionError) return forbidden()
    return serverError()
  }
}
