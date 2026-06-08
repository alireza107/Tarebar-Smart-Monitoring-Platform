import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { unauthorized, notFound, validationError } from '@/lib/api-responses'
import { checkPermission } from '@/lib/permissions'
import { assertRegionScope } from '@/lib/scope-guard'
import { regionService } from '@/modules/region/service'
import { updateRegionSchema } from '@/modules/region/schema'
import { regionErrorResponse } from '@/modules/region/http'
import type { Role } from '@/lib/permissions'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'region', 'read')

    const { id } = await params
    const region = await regionService.getById(id)
    if (!region) return notFound('منطقه یافت نشد')
    await assertRegionScope(session.user.id, session.user.role as Role, region.marketId)
    return NextResponse.json({ data: region })
  } catch (e) {
    return regionErrorResponse(e)
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'region', 'update')

    const { id } = await params
    const existing = await regionService.getById(id)
    if (!existing) return notFound('منطقه یافت نشد')
    await assertRegionScope(session.user.id, session.user.role as Role, existing.marketId)

    const body = await req.json()
    const parsed = updateRegionSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)

    const region = await regionService.update(id, parsed.data, {
      id: session.user.id,
      name: session.user.name,
    })
    return NextResponse.json({ data: region })
  } catch (e) {
    return regionErrorResponse(e)
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'region', 'delete')

    const { id } = await params
    const existing = await regionService.getById(id)
    if (!existing) return notFound('منطقه یافت نشد')
    await assertRegionScope(session.user.id, session.user.role as Role, existing.marketId)

    await regionService.remove(id, { id: session.user.id, name: session.user.name })
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    return regionErrorResponse(e)
  }
}
