import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { forbidden, serverError, unauthorized, validationError } from '@/lib/api-responses'
import { csvResponse, jsonDownloadResponse, toCsv } from '@/lib/csv'
import { businessDate } from '@/lib/dates'
import { checkPermission, PermissionError, type Role } from '@/lib/permissions'
import { canQueryLocation, parseRecordQuery } from '@/modules/analysis-records/http'
import { analysisRecordService } from '@/modules/analysis-records/service'

export const runtime = 'nodejs'
const EXPORT_LIMIT = 10_000

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'report', 'read')
    const parsed = parseRecordQuery(request.nextUrl)
    if (!parsed.success) return validationError(parsed.error)
    if (!(await canQueryLocation(session, parsed.data))) return forbidden()

    const rows = []
    while (rows.length < EXPORT_LIMIT) {
      const page = await analysisRecordService.listIncidents(
        session.user.id, session.user.role as Role, { ...parsed.data, limit: 500, offset: rows.length },
      )
      rows.push(...page.items)
      if (page.items.length < 500) break
    }

    const stamp = businessDate()
    if (request.nextUrl.searchParams.get('format') === 'json') {
      return jsonDownloadResponse(`incident-checks-${stamp}.json`, { exportedAt: new Date().toISOString(), count: rows.length, checks: rows })
    }
    const csv = toCsv(
      ['شناسه', 'زمان بررسی', 'منبع', 'دوربین', 'میدان', 'بازار', 'غرفه', 'فایل', 'بازه', 'درگیری', 'کف تمیز', 'نیازمند توجه', 'تعداد فریم', 'زمان استنتاج (ثانیه)', 'ثبت‌کننده'],
      rows.map(row => [
        row.id,
        row.createdAt,
        row.source === 'LIVE' ? 'دوربین زنده' : 'فایل بارگذاری‌شده',
        row.camera?.name ?? '',
        row.field?.name ?? '',
        row.market?.name ?? '',
        row.booth ? `غرفه ${row.booth.number}` : '',
        row.fileName ?? '',
        row.windowLabel ?? '',
        row.fighting ? 'بله' : 'خیر',
        row.floorClean ? 'بله' : 'خیر',
        row.fighting || !row.floorClean ? 'بله' : 'خیر',
        row.frameCount,
        row.inferenceSeconds,
        row.createdByName ?? '',
      ]),
    )
    return csvResponse(`incident-checks-${stamp}.csv`, csv)
  } catch (error) {
    if (error instanceof PermissionError) return forbidden()
    return serverError()
  }
}
