import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { forbidden, serverError, unauthorized, validationError } from '@/lib/api-responses'
import { logger } from '@/lib/logger'
import { checkPermission, PermissionError, type Role } from '@/lib/permissions'
import { executiveReportService } from '@/modules/executive-report/service'
import { managementFiltersSchema } from '@/modules/management-analytics/schema'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Executive summary of one location (organisation, field, market or booth) for a period. */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'report', 'read')
    const parsed = managementFiltersSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()))
    if (!parsed.success) return validationError(parsed.error)
    const report = await executiveReportService.build(
      { id: session.user.id, role: session.user.role as Role, name: session.user.name },
      parsed.data,
    )
    if (!report) return forbidden()
    return NextResponse.json({ data: report }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof PermissionError) return forbidden()
    logger.error({ err: error }, 'failed to build executive report')
    return serverError('تهیه گزارش مدیریتی ممکن نشد')
  }
}
