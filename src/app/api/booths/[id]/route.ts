import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { unauthorized, forbidden, notFound, validationError, serverError } from '@/lib/api-responses'
import { checkPermission, PermissionError, type Role } from '@/lib/permissions'
import { assertMarketScope, ScopeError } from '@/lib/scope-guard'
import { boothService } from '@/modules/booth/service'
import { updateBoothSchema } from '@/modules/booth/schema'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'booth', 'read')
    const { id } = await params
    const booth = await boothService.getById(id)
    if (!booth) return notFound()
    return NextResponse.json({ data: booth })
  } catch (e) {
    if (e instanceof PermissionError) return forbidden()
    return serverError()
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'booth', 'update')
    const { id } = await params
    const existing = await boothService.getById(id)
    if (!existing) return notFound()
    await assertMarketScope(session.user.id, session.user.role as Role, existing.marketId)
    const body = await req.json()
    const parsed = updateBoothSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)
    // If marketId is being changed, validate the new market is also in scope
    if (parsed.data.marketId && parsed.data.marketId !== existing.marketId) {
      await assertMarketScope(session.user.id, session.user.role as Role, parsed.data.marketId)
    }
    const booth = await boothService.update(id, parsed.data)
    return NextResponse.json({ data: booth })
  } catch (e) {
    if (e instanceof PermissionError || e instanceof ScopeError) return forbidden()
    return serverError()
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'booth', 'delete')
    const { id } = await params
    const existing = await boothService.getById(id)
    if (!existing) return notFound()
    await assertMarketScope(session.user.id, session.user.role as Role, existing.marketId)
    await boothService.delete(id)
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    if (e instanceof PermissionError || e instanceof ScopeError) return forbidden()
    return serverError()
  }
}
