import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { unauthorized, forbidden, validationError, serverError } from '@/lib/api-responses'
import { checkPermission, PermissionError, type Role } from '@/lib/permissions'
import { boothService } from '@/modules/booth/service'
import { createBoothSchema } from '@/modules/booth/schema'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'booth', 'read')
    const booths = await boothService.getAll(session.user.id, session.user.role as Role)
    return NextResponse.json({ data: booths })
  } catch (e) {
    if (e instanceof PermissionError) return forbidden()
    return serverError()
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'booth', 'create')
    const body = await req.json()
    const parsed = createBoothSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)
    const booth = await boothService.create(parsed.data)
    return NextResponse.json({ data: booth }, { status: 201 })
  } catch (e) {
    if (e instanceof PermissionError) return forbidden()
    return serverError()
  }
}
