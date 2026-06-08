import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { unauthorized, validationError } from '@/lib/api-responses'
import { checkPermission } from '@/lib/permissions'
import { assertRegionScope } from '@/lib/scope-guard'
import { regionService } from '@/modules/region/service'
import { createRegionSchema, regionQuerySchema } from '@/modules/region/schema'
import { regionErrorResponse } from '@/modules/region/http'
import type { Role } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'region', 'read')

    const parsed = regionQuerySchema.safeParse({
      q: req.nextUrl.searchParams.get('q') ?? undefined,
      marketId: req.nextUrl.searchParams.get('marketId') ?? undefined,
    })
    if (!parsed.success) return validationError(parsed.error)

    const regions = await regionService.getAll(
      session.user.id,
      session.user.role as Role,
      parsed.data.q,
      parsed.data.marketId,
    )
    return NextResponse.json({ data: regions })
  } catch (e) {
    return regionErrorResponse(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'region', 'create')

    const body = await req.json()
    const parsed = createRegionSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)

    await assertRegionScope(session.user.id, session.user.role as Role, parsed.data.marketId)

    const region = await regionService.create(parsed.data, {
      id: session.user.id,
      name: session.user.name,
    })
    return NextResponse.json({ data: region }, { status: 201 })
  } catch (e) {
    return regionErrorResponse(e)
  }
}
