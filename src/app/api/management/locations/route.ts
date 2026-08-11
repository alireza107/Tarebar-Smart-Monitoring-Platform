import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { forbidden, serverError, unauthorized } from '@/lib/api-responses'
import { checkPermission, PermissionError, type Role } from '@/lib/permissions'
import { managementAnalyticsService } from '@/modules/management-analytics/service'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'report', 'read')
    const data = await managementAnalyticsService.getLocations(
      session.user.id,
      session.user.role as Role,
    )
    return NextResponse.json({ data })
  } catch (error) {
    if (error instanceof PermissionError) return forbidden()
    return serverError()
  }
}

