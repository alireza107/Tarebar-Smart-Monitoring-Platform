import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { unauthorized, forbidden, validationError, serverError } from '@/lib/api-responses'
import { checkPermission, PermissionError, type Role } from '@/lib/permissions'
import { assertFieldScope, ScopeError } from '@/lib/scope-guard'
import { marketService } from '@/modules/market/service'
import { createMarketSchema } from '@/modules/market/schema'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'market', 'read')
    const markets = await marketService.getAll(session.user.id, session.user.role as Role)
    return NextResponse.json({ data: markets })
  } catch (e) {
    if (e instanceof PermissionError) return forbidden()
    return serverError()
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'market', 'create')
    const body = await req.json()
    const parsed = createMarketSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)
    await assertFieldScope(session.user.id, session.user.role as Role, parsed.data.fieldId)
    const market = await marketService.create(parsed.data)
    return NextResponse.json({ data: market }, { status: 201 })
  } catch (e) {
    if (e instanceof PermissionError || e instanceof ScopeError) return forbidden()
    return serverError()
  }
}
