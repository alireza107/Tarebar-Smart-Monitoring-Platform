import { downloadCsv, downloadJson } from '@/lib/download'
import type { ExecutiveReport } from '@/modules/executive-report/types'

const PRIORITY_FA = { high: 'فوری', medium: 'متوسط', low: 'کم' } as const
const STATUS_FA = { good: 'مطلوب', watch: 'نیازمند توجه', poor: 'نامطلوب', unknown: 'بدون داده' } as const

function fileName(report: ExecutiveReport, extension: string) {
  const place = report.meta.location.name.replace(/\s+/g, '-')
  return `executive-report_${place}_${report.meta.period.from}_${report.meta.period.to}.${extension}`
}

export function exportExecutiveJson(report: ExecutiveReport) {
  // Evidence images make the file heavy without adding information for a spreadsheet or BI tool.
  downloadJson(fileName(report, 'json'), {
    ...report,
    safety: { ...report.safety, recent: report.safety.recent.map(item => ({ ...item, thumbnail: item.thumbnail ? '[image omitted]' : null })) },
  })
}

/** One CSV a manager can open in Excel: KPI block, scorecard, children, recommendations. */
export function exportExecutiveCsv(report: ExecutiveReport) {
  const { meta, traffic, service, quality, safety, measurement } = report
  const value = (metric: { value: number | null; changePercent: number | null }) => [metric.value, metric.changePercent]
  const rows: Array<Array<string | number | null>> = [
    ['مکان', meta.location.name, meta.location.parentName ?? ''],
    ['بازه', meta.period.from, meta.period.to],
    ['بازه مقایسه', meta.comparison?.from ?? '', meta.comparison?.to ?? ''],
    ['تهیه‌کننده', meta.generatedBy ?? '', meta.generatedAt],
    ['امتیاز کلی', report.scorecard.overall, STATUS_FA[report.scorecard.status]],
    [],
    ['بعد', 'امتیاز', 'وضعیت', 'شرح'],
    ...report.scorecard.dimensions.map(item => [item.label, item.score, STATUS_FA[item.status], item.summary]),
    [],
    ['شاخص', 'مقدار', 'تغییر نسبت به دوره مقایسه (٪)'],
    ['میانگین حضور (نفر)', ...value(traffic.averageOccupancy)],
    ['اوج حضور (نفر)', ...value(traffic.peakOccupancy)],
    ['بازدیدکنندگان', ...value(traffic.visitors)],
    ['ورود', ...value(traffic.entries)],
    ['میانگین انتظار در صف (دقیقه)', ...value(service.averageWaitMinutes)],
    ['صدک ۹۰ انتظار (دقیقه)', ...value(service.p90WaitMinutes)],
    ['تحقق زمان هدف خدمت (٪)', ...value(service.slaPercent)],
    ['تعداد ارزیابی کیفیت', quality.assessments, null],
    ['میانگین امتیاز تازگی', ...value(quality.averageScore)],
    ['میانگین سهم فاسد (٪)', quality.averageDistribution?.rotten ?? null, null],
    ['تعداد اندازه‌گیری میوه', measurement.runs, null],
    ['میانگین قطر میوه (mm)', ...value(measurement.averageDiameterMm)],
    ['بازه‌های پایش حادثه', safety.checks, null],
    ['درگیری تشخیص‌داده‌شده', safety.fights, null],
    ['هشدار نظافت', safety.cleanlinessAlerts, null],
    ['هشدار ناحیه ممنوعه', safety.restrictedAreaAlerts, null],
    ['پوشش داده (٪)', meta.dataQuality?.coveragePercent ?? null, null],
    ['دوربین‌ها', meta.cameras.total, null],
  ]
  if (report.children.rows.length) {
    rows.push([], ['زیرمجموعه', 'میانگین حضور', 'میانگین انتظار (دقیقه)', 'تحقق زمان هدف (٪)', 'امتیاز تازگی', 'تعداد ارزیابی', 'رویداد نیازمند توجه'])
    for (const child of report.children.rows) {
      rows.push([child.name, child.occupancy, child.averageWaitMinutes, child.slaPercent, child.qualityScore, child.assessments, child.incidents])
    }
  }
  if (report.recommendations.length) {
    rows.push([], ['اولویت', 'اقدام پیشنهادی', 'شرح'])
    for (const item of report.recommendations) rows.push([PRIORITY_FA[item.priority], item.title, item.detail])
  }
  downloadCsv(fileName(report, 'csv'), ['گزارش مدیریتی اجرایی', '', ''], rows)
}
