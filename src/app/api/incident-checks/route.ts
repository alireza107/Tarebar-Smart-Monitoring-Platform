import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { forbidden, serverError, unauthorized, validationError } from '@/lib/api-responses'
import { logger } from '@/lib/logger'
import { checkPermission, PermissionError, type Role } from '@/lib/permissions'
import { ScopeError } from '@/lib/scope-guard'
import { canQueryLocation, parseRecordQuery, resolveUploadTarget } from '@/modules/analysis-records/http'
import { createIncidentCheckSchema } from '@/modules/analysis-records/schema'
import { analysisRecordService } from '@/modules/analysis-records/service'

export const runtime = 'nodejs'

/** Stored incident-detection windows (fighting / floor cleanliness), newest first. */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'report', 'read')
    const parsed = parseRecordQuery(request.nextUrl)
    if (!parsed.success) return validationError(parsed.error)
    if (!(await canQueryLocation(session, parsed.data))) return forbidden()
    const { items, total } = await analysisRecordService.listIncidents(
      session.user.id, session.user.role as Role, parsed.data,
    )
    return NextResponse.json({ data: items, meta: { total, limit: parsed.data.limit, offset: parsed.data.offset } })
  } catch (error) {
    if (error instanceof PermissionError) return forbidden()
    logger.error({ err: error }, 'failed to list incident checks')
    return serverError()
  }
}

/** Store one window of an uploaded-video analysis (live windows are stored by the camera route). */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'camera', 'read')
    const parsed = createIncidentCheckSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return validationError(parsed.error)
    const target = await resolveUploadTarget(session, parsed.data.locationType, parsed.data.locationId)
    const record = await analysisRecordService.recordIncident({
      actor: { id: session.user.id, name: session.user.name },
      source: 'UPLOAD',
      target,
      fileName: parsed.data.fileName,
      windowLabel: parsed.data.windowLabel,
      windowSeconds: parsed.data.windowSeconds,
      result: parsed.data.result,
    })
    return NextResponse.json({ data: record }, { status: 201 })
  } catch (error) {
    if (error instanceof PermissionError || error instanceof ScopeError) return forbidden()
    logger.error({ err: error }, 'failed to store incident check')
    return serverError()
  }
}
