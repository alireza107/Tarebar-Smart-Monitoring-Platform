import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { unauthorized, forbidden, validationError, serverError } from '@/lib/api-responses'
import { checkPermission, PermissionError } from '@/lib/permissions'
import { boothCategoryService } from '@/modules/booth-category/service'
import { createBoothCategorySchema } from '@/modules/booth-category/schema'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'booth_category', 'read')
    const categories = await boothCategoryService.getAll()
    return NextResponse.json({ data: categories })
  } catch (e) {
    if (e instanceof PermissionError) return forbidden()
    return serverError()
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'booth_category', 'create')
    const body = await req.json()
    const parsed = createBoothCategorySchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)
    const category = await boothCategoryService.create(parsed.data)
    return NextResponse.json({ data: category }, { status: 201 })
  } catch (e) {
    if (e instanceof PermissionError) return forbidden()
    return serverError()
  }
}
