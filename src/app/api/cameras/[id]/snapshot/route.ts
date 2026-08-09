import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { unauthorized, forbidden, notFound, validationError, serverError } from '@/lib/api-responses'
import { checkPermission, PermissionError } from '@/lib/permissions'
import { assertCameraScope, ScopeError } from '@/lib/scope-guard'
import { cameraService } from '@/modules/camera/service'
import { cameraSnapshotSchema } from '@/modules/camera/schema'
import type { Role } from '@/lib/permissions'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'camera', 'read')
    const { id } = await params
    const camera = await cameraService.getSnapshot(id)
    if (!camera) return notFound()
    return NextResponse.json({
      data: { dataUrl: camera.snapshotDataUrl, updatedAt: camera.snapshotUpdatedAt },
    })
  } catch (e) {
    if (e instanceof PermissionError) return forbidden()
    return serverError()
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'camera', 'update')
    const { id } = await params
    const existing = await cameraService.getById(id)
    if (!existing) return notFound()
    await assertCameraScope(session.user.id, session.user.role as Role, {
      fieldId: existing.fieldId,
      marketId: existing.marketId,
      boothId: existing.boothId,
    })
    const body = await req.json()
    const parsed = cameraSnapshotSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)
    const camera = await cameraService.updateSnapshot(id, parsed.data.dataUrl)
    return NextResponse.json({ data: camera })
  } catch (e) {
    if (e instanceof PermissionError || e instanceof ScopeError) return forbidden()
    return serverError()
  }
}
