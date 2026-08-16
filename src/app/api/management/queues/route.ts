import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { forbidden, serverError, unauthorized, validationError } from '@/lib/api-responses'
import { checkPermission, PermissionError, type Role } from '@/lib/permissions'
import { analyticalModuleFiltersSchema } from '@/modules/management-analytics/schema'
import { phase2AnalyticsService } from '@/modules/management-analytics/phase2-service'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'report', 'read')
    const parsed = analyticalModuleFiltersSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()))
    if (!parsed.success) return validationError(parsed.error)
    const data = await phase2AnalyticsService.get(session.user.id, session.user.role as Role, 'queues', parsed.data)
    return data ? NextResponse.json({ data }) : forbidden()
  } catch (error) {
    if (error instanceof PermissionError) return forbidden()
    return serverError()
  }
}
