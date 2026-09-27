import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { forbidden, notFound, serverError, unauthorized, validationError } from '@/lib/api-responses'
import { logger } from '@/lib/logger'
import { checkPermission, PermissionError, type Role } from '@/lib/permissions'
import { assertCameraScope, ScopeError } from '@/lib/scope-guard'
import { canQueryLocation, parseRecordQuery } from '@/modules/analysis-records/http'
import { createMeasurementRunSchema } from '@/modules/analysis-records/schema'
import { analysisRecordService } from '@/modules/analysis-records/service'
import { cameraService } from '@/modules/camera/service'

export const runtime = 'nodejs'

/** Stored summaries of fruit counting and sizing jobs, newest first. */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'report', 'read')
    const parsed = parseRecordQuery(request.nextUrl)
    if (!parsed.success) return validationError(parsed.error)
    if (!(await canQueryLocation(session, parsed.data))) return forbidden()
    const { items, total } = await analysisRecordService.listMeasurementRuns(
      session.user.id, session.user.role as Role, parsed.data,
    )
    return NextResponse.json({ data: items, meta: { total, limit: parsed.data.limit, offset: parsed.data.offset } })
  } catch (error) {
    if (error instanceof PermissionError) return forbidden()
    logger.error({ err: error }, 'failed to list fruit measurement runs')
    return serverError()
  }
}

/** Record (or refresh) the summary of a fruit-pipeline job. Idempotent per service job id. */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'camera', 'read')
    const parsed = createMeasurementRunSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return validationError(parsed.error)
    const camera = await cameraService.getById(parsed.data.cameraId)
    if (!camera) return notFound('Camera not found')
    await assertCameraScope(session.user.id, session.user.role as Role, camera)
    const record = await analysisRecordService.recordMeasurementRun(
      { id: session.user.id, name: session.user.name },
      { cameraId: camera.id, fieldId: camera.fieldId, marketId: camera.marketId, boothId: camera.boothId },
      parsed.data,
    )
    return NextResponse.json({ data: record }, { status: 201 })
  } catch (error) {
    if (error instanceof PermissionError || error instanceof ScopeError) return forbidden()
    logger.error({ err: error }, 'failed to store fruit measurement run')
    return serverError()
  }
}
