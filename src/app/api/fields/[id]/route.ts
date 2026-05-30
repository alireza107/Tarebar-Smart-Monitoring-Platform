import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { unauthorized, forbidden, notFound, validationError, serverError } from '@/lib/api-responses'
import { checkPermission, PermissionError, type Role } from '@/lib/permissions'
import { fieldService } from '@/modules/field/service'
import { updateFieldSchema } from '@/modules/field/schema'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'field', 'read')
    const { id } = await params
    const field = await fieldService.getById(id)
    if (!field) return notFound()
    return NextResponse.json({ data: field })
  } catch (e) {
    if (e instanceof PermissionError) return forbidden()
    return serverError()
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'field', 'update')
    const { id } = await params
    const existing = await fieldService.getById(id)
    if (!existing) return notFound()
    const body = await req.json()
    const parsed = updateFieldSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)
    const field = await fieldService.update(id, parsed.data)
    return NextResponse.json({ data: field })
  } catch (e) {
    if (e instanceof PermissionError) return forbidden()
    return serverError()
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'field', 'delete')
    const { id } = await params
    const existing = await fieldService.getById(id)
    if (!existing) return notFound()
    await fieldService.delete(id)
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    if (e instanceof PermissionError) return forbidden()
    return serverError()
  }
}
