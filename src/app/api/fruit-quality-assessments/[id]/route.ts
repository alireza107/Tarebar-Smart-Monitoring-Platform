import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { forbidden, notFound, serverError, unauthorized } from '@/lib/api-responses'
import { checkPermission, PermissionError, type Role } from '@/lib/permissions'
import { analysisRecordService } from '@/modules/analysis-records/service'

type Params = { params: Promise<{ id: string }> }

/** One assessment with its evidence thumbnails, for the detailed and printable report. */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'report', 'read')
    const { id } = await params
    const record = await analysisRecordService.getQuality(session.user.id, session.user.role as Role, id)
    // Rows outside the caller's scope are reported as missing, not as forbidden.
    if (!record) return notFound()
    return NextResponse.json({ data: record })
  } catch (error) {
    if (error instanceof PermissionError) return forbidden()
    return serverError()
  }
}
