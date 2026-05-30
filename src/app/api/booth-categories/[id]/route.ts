import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { unauthorized, forbidden, notFound, validationError, serverError } from '@/lib/api-responses'
import { checkPermission, PermissionError } from '@/lib/permissions'
import { boothCategoryService } from '@/modules/booth-category/service'
import { updateBoothCategorySchema } from '@/modules/booth-category/schema'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'booth_category', 'read')
    const { id } = await params
    const category = await boothCategoryService.getById(id)
    if (!category) return notFound()
    return NextResponse.json({ data: category })
  } catch (e) {
    if (e instanceof PermissionError) return forbidden()
    return serverError()
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'booth_category', 'update')
    const { id } = await params
    const existing = await boothCategoryService.getById(id)
    if (!existing) return notFound()
    const body = await req.json()
    const parsed = updateBoothCategorySchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)
    const category = await boothCategoryService.update(id, parsed.data)
    return NextResponse.json({ data: category })
  } catch (e) {
    if (e instanceof PermissionError) return forbidden()
    return serverError()
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'booth_category', 'delete')
    const { id } = await params
    const existing = await boothCategoryService.getById(id)
    if (!existing) return notFound()
    await boothCategoryService.delete(id)
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    if (e instanceof PermissionError) return forbidden()
    return serverError()
  }
}
