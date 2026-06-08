import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { unauthorized, notFound, validationError } from '@/lib/api-responses'
import { checkPermission } from '@/lib/permissions'
import { assertRegionScope } from '@/lib/scope-guard'
import { regionService } from '@/modules/region/service'
import { createCameraRegionSchema } from '@/modules/region/schema'
import { regionErrorResponse } from '@/modules/region/http'
import type { Role } from '@/lib/permissions'

type Params = { params: Promise<{ id: string }> }

// List the camera mappings for a region.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'region', 'read')

    const { id } = await params
    const region = await regionService.getById(id)
    if (!region) return notFound('منطقه یافت نشد')
    await assertRegionScope(session.user.id, session.user.role as Role, region.marketId)

    return NextResponse.json({ data: region.cameraRegions })
  } catch (e) {
    return regionErrorResponse(e)
  }
}

// Create a camera mapping (camera + polygon + exclusions) for a region.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'region', 'update')

    const { id } = await params
    const region = await regionService.getById(id)
    if (!region) return notFound('منطقه یافت نشد')
    await assertRegionScope(session.user.id, session.user.role as Role, region.marketId)

    const body = await req.json()
    const parsed = createCameraRegionSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)

    const mapping = await regionService.addCameraMapping(id, parsed.data, {
      id: session.user.id,
      name: session.user.name,
    })
    return NextResponse.json({ data: mapping }, { status: 201 })
  } catch (e) {
    return regionErrorResponse(e)
  }
}
