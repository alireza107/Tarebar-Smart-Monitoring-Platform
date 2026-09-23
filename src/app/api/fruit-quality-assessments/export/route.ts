import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { forbidden, serverError, unauthorized, validationError } from '@/lib/api-responses'
import { csvResponse, jsonDownloadResponse, toCsv } from '@/lib/csv'
import { businessDate } from '@/lib/dates'
import { checkPermission, PermissionError, type Role } from '@/lib/permissions'
import { canQueryLocation, parseRecordQuery } from '@/modules/analysis-records/http'
import { analysisRecordService } from '@/modules/analysis-records/service'
import { SEVERITY_LABELS_FA, type QualityDetails } from '@/modules/analysis-records/types'

export const runtime = 'nodejs'
const EXPORT_LIMIT = 5000

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'report', 'read')
    const parsed = parseRecordQuery(request.nextUrl)
    if (!parsed.success) return validationError(parsed.error)
    if (!(await canQueryLocation(session, parsed.data))) return forbidden()

    const { items } = await analysisRecordService.listQuality(
      session.user.id, session.user.role as Role, { ...parsed.data, limit: 500, offset: 0 },
    )
    // Page through the remainder so an export is complete, up to a hard ceiling.
    const rows = [...items]
    while (rows.length % 500 === 0 && rows.length > 0 && rows.length < EXPORT_LIMIT) {
      const next = await analysisRecordService.listQuality(
        session.user.id, session.user.role as Role, { ...parsed.data, limit: 500, offset: rows.length },
      )
      if (next.items.length === 0) break
      rows.push(...next.items)
    }

    const stamp = businessDate()
    if (request.nextUrl.searchParams.get('format') === 'json') {
      return jsonDownloadResponse(`fruit-quality-${stamp}.json`, { exportedAt: new Date().toISOString(), count: rows.length, assessments: rows })
    }

    const csv = toCsv(
      ['شناسه', 'زمان ثبت', 'منبع', 'دوربین', 'میدان', 'بازار', 'غرفه', 'فایل', 'میوه دیده شد', 'برچسب کیفیت', 'درجه', 'امتیاز تازگی', 'اطمینان مدل', 'درصد تازه', 'درصد متوسط', 'درصد فاسد', 'عیوب مشاهده‌شده', 'پروفایل کیفیت', 'نتیجه ارزیابی', 'توصیه', 'تعداد فریم', 'زمان استنتاج (ثانیه)', 'ثبت‌کننده'],
      rows.map(row => {
        const details = row.details as unknown as QualityDetails | null
        return [
          row.id,
          row.createdAt,
          row.source === 'LIVE' ? 'دوربین زنده' : 'فایل بارگذاری‌شده',
          row.camera?.name ?? '',
          row.field?.name ?? '',
          row.market?.name ?? '',
          row.booth ? `غرفه ${row.booth.number}` : '',
          row.fileName ?? '',
          row.hasFruit ? 'بله' : 'خیر',
          row.label,
          row.grade ?? '',
          row.freshnessScore,
          row.confidence,
          row.freshPercent,
          row.middlePercent,
          row.rottenPercent,
          (details?.defects ?? []).map(item => `${item.label_fa} (${SEVERITY_LABELS_FA[item.severity]}${item.extent_label_fa ? `، ${item.extent_label_fa}` : ''})`).join('، '),
          (details?.qualityProfile ?? []).map(item => `${item.label_fa}: ${item.value_fa}`).join('، '),
          details?.verdictFa ?? '',
          row.recommendationFa ?? '',
          row.frameCount,
          row.inferenceSeconds,
          row.createdByName ?? '',
        ]
      }),
    )
    return csvResponse(`fruit-quality-${stamp}.csv`, csv)
  } catch (error) {
    if (error instanceof PermissionError) return forbidden()
    return serverError()
  }
}
