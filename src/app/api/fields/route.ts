import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { unauthorized, forbidden, validationError, serverError } from '@/lib/api-responses'
import { checkPermission, PermissionError, type Role } from '@/lib/permissions'
import { fieldService } from '@/modules/field/service'
import { createFieldSchema } from '@/modules/field/schema'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'field', 'read')
    const fields = await fieldService.getAll(session.user.id, session.user.role as Role)
    return NextResponse.json({ data: fields })
  } catch (e) {
    if (e instanceof PermissionError) return forbidden()
    return serverError()
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'field', 'create')
    const body = await req.json()
    const parsed = createFieldSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)
    const field = await fieldService.create(parsed.data)
    return NextResponse.json({ data: field }, { status: 201 })
  } catch (e) {
    if (e instanceof PermissionError) return forbidden()
    return serverError()
  }
}
