import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { unauthorized, forbidden, notFound, validationError, serverError } from '@/lib/api-responses'
import { checkPermission, PermissionError } from '@/lib/permissions'
import { userService } from '@/modules/user/service'
import { updateUserSchema } from '@/modules/user/schema'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'user', 'read')
    const { id } = await params
    const user = await userService.getById(id)
    if (!user) return notFound()
    return NextResponse.json({ data: user })
  } catch (e) {
    if (e instanceof PermissionError) return forbidden()
    return serverError()
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'user', 'update')
    const { id } = await params
    const existing = await userService.getById(id)
    if (!existing) return notFound()
    const body = await req.json()
    const parsed = updateUserSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)
    const user = await userService.update(id, parsed.data)
    return NextResponse.json({ data: user })
  } catch (e) {
    if (e instanceof PermissionError) return forbidden()
    return serverError()
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'user', 'delete')
    const { id } = await params
    const existing = await userService.getById(id)
    if (!existing) return notFound()
    await userService.delete(id)
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    if (e instanceof PermissionError) return forbidden()
    return serverError()
  }
}
