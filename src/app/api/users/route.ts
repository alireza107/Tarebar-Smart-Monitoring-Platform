import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { unauthorized, forbidden, validationError, serverError } from '@/lib/api-responses'
import { checkPermission, PermissionError } from '@/lib/permissions'
import { userService, UsernameConflictError } from '@/modules/user/service'
import { createUserSchema } from '@/modules/user/schema'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'user', 'read')
    const users = await userService.getAll()
    return NextResponse.json({ data: users })
  } catch (e) {
    if (e instanceof PermissionError) return forbidden()
    return serverError()
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'user', 'create')
    const body = await req.json()
    const parsed = createUserSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)
    const user = await userService.create(parsed.data)
    return NextResponse.json({ data: user }, { status: 201 })
  } catch (e) {
    if (e instanceof PermissionError) return forbidden()
    if (e instanceof UsernameConflictError) {
      return NextResponse.json({ error: e.message }, { status: 409 })
    }
    return serverError()
  }
}
