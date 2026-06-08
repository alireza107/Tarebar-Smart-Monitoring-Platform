import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { unauthorized, notFound, validationError } from '@/lib/api-responses'
import { checkPermission } from '@/lib/permissions'
import { assertRegionScope } from '@/lib/scope-guard'
import { regionService } from '@/modules/region/service'
import { updateCameraRegionSchema } from '@/modules/region/schema'
import { regionErrorResponse } from '@/modules/region/http'
import type { Role } from '@/lib/permissions'

type Params = { params: Promise<{ id: string; mappingId: string }> }

// Update a camera mapping's geometry (main polygon and/or exclusion polygons).
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'region', 'update')

    const { id, mappingId } = await params
    const mapping = await regionService.getMapping(mappingId)
    if (!mapping || mapping.regionId !== id) return notFound('نگاشت دوربین یافت نشد')
    await assertRegionScope(session.user.id, session.user.role as Role, mapping.region.marketId)

    const body = await req.json()
    const parsed = updateCameraRegionSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)

    const updated = await regionService.updateCameraMapping(mappingId, parsed.data, {
      id: session.user.id,
      name: session.user.name,
    })
    return NextResponse.json({ data: updated })
  } catch (e) {
    return regionErrorResponse(e)
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'region', 'update')

    const { id, mappingId } = await params
    const mapping = await regionService.getMapping(mappingId)
    if (!mapping || mapping.regionId !== id) return notFound('نگاشت دوربین یافت نشد')
    await assertRegionScope(session.user.id, session.user.role as Role, mapping.region.marketId)

    await regionService.removeCameraMapping(mappingId, {
      id: session.user.id,
      name: session.user.name,
    })
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    return regionErrorResponse(e)
  }
}
