import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { unauthorized, forbidden, notFound, validationError, serverError } from '@/lib/api-responses'
import { checkPermission, PermissionError } from '@/lib/permissions'
import { marketService } from '@/modules/market/service'
import { updateMarketSchema } from '@/modules/market/schema'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'market', 'read')
    const { id } = await params
    const market = await marketService.getById(id)
    if (!market) return notFound()
    return NextResponse.json({ data: market })
  } catch (e) {
    if (e instanceof PermissionError) return forbidden()
    return serverError()
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'market', 'update')
    const { id } = await params
    const existing = await marketService.getById(id)
    if (!existing) return notFound()
    const body = await req.json()
    const parsed = updateMarketSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)
    const market = await marketService.update(id, parsed.data)
    return NextResponse.json({ data: market })
  } catch (e) {
    if (e instanceof PermissionError) return forbidden()
    return serverError()
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'market', 'delete')
    const { id } = await params
    const existing = await marketService.getById(id)
    if (!existing) return notFound()
    await marketService.delete(id)
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    if (e instanceof PermissionError) return forbidden()
    return serverError()
  }
}
