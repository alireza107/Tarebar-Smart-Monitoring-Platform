import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { forbidden, serverError, unauthorized, validationError } from '@/lib/api-responses'
import { checkPermission, PermissionError, type Role } from '@/lib/permissions'
import { managementFiltersSchema } from '@/modules/management-analytics/schema'
import { managementAnalyticsService } from '@/modules/management-analytics/service'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'report', 'read')

    const parsed = managementFiltersSchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    )
    if (!parsed.success) return validationError(parsed.error)

    const data = await managementAnalyticsService.getOverview(
      session.user.id,
      session.user.role as Role,
      parsed.data,
    )
    if (!data) return forbidden()
    return NextResponse.json({ data })
  } catch (error) {
    if (error instanceof PermissionError) return forbidden()
    return serverError()
  }
}
