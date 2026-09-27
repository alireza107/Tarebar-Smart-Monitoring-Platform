'use client'

import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, CheckCircle2, FileJson, FileSpreadsheet, Info, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { GlobalFilterBar } from '@/components/management/global-filter-bar'
import { faDate, faNumber, MiniBars, PrintButton, ReportSection, ReportSheet, ReportStat } from '@/components/report/report-primitives'
import { weekdayName } from '@/modules/executive-report/insights'
import type { DimensionStatus, ExecutiveReport, ReportRecommendation } from '@/modules/executive-report/types'
import type { ManagementFilters, ManagementLocationType, MetricValue } from '@/modules/management-analytics/types'
import { useManagementFilters } from '@/stores/management-filters'
import { exportExecutiveCsv, exportExecutiveJson } from './executive-report-export'

const LOCATION_LABEL: Record<ManagementLocationType, string> = { organization: 'سازمان', field: 'میدان', market: 'بازار', booth: 'غرفه' }
const STATUS_LABEL: Record<DimensionStatus, string> = { good: 'مطلوب', watch: 'نیازمند توجه', poor: 'نامطلوب', unknown: 'بدون داده' }
const STATUS_RING: Record<DimensionStatus, string> = { good: '#10b981', watch: '#f59e0b', poor: '#ef4444', unknown: '#94a3b8' }
const PRIORITY: Record<ReportRecommendation['priority'], { label: string; className: string }> = {
  high: { label: 'فوری', className: 'border-red-200 bg-red-50 text-red-800' },
  medium: { label: 'متوسط', className: 'border-amber-200 bg-amber-50 text-amber-800' },
  low: { label: 'کم', className: 'border-slate-200 bg-slate-50 text-slate-700' },
}

async function fetchReport(filters: ManagementFilters): Promise<ExecutiveReport> {
  const query = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== '') query.set(key, String(value)) })
  const response = await fetch(`/api/reports/executive?${query}`)
  if (response.status === 403) throw new Error('این مکان در محدوده دسترسی شما نیست.')
  if (!response.ok) throw new Error('تهیه گزارش مدیریتی ممکن نشد.')
  return ((await response.json()) as { data: ExecutiveReport }).data
}

function metricText(metric: MetricValue, digits = 1, suffix = '') {
  return metric.value === null ? '—' : `${faNumber(metric.value, digits)}${suffix}`
}

function changeText(metric: MetricValue) {
  if (metric.changePercent === null) return 'بدون داده مقایسه'
  const direction = metric.changePercent > 0 ? 'افزایش' : metric.changePercent < 0 ? 'کاهش' : 'بدون تغییر'
  return `${faNumber(Math.abs(metric.changePercent), 1)}٪ ${direction} نسبت به دوره مقایسه`
}

export function ExecutiveReportClient() {
  const state = useManagementFilters()
  const params = useSearchParams()

  // A link from a location page or the reports hub may preselect the location and period.
  useEffect(() => {
    const type = params.get('locationType') as ManagementLocationType | null
    if (type && ['organization', 'field', 'market', 'booth'].includes(type)) state.setLocation(type, params.get('locationId') ?? undefined)
    const from = params.get('from')
    const to = params.get('to')
    if (from && to) state.setDateRange(from, to)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apply the link once
  }, [])

  const filters = useMemo<ManagementFilters>(() => ({
    locationType: state.locationType, locationId: state.locationId, placeType: 'all',
    from: state.from, to: state.to, comparison: state.comparison, timeFrom: state.timeFrom, timeTo: state.timeTo,
  }), [state.locationType, state.locationId, state.from, state.to, state.comparison, state.timeFrom, state.timeTo])

  const { data: report, isLoading, isFetching, error } = useQuery({
    queryKey: ['executive-report', filters],
    queryFn: () => fetchReport(filters),
    staleTime: 60_000,
  })

  return <div className="space-y-4">
    <div className="space-y-3 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/reports" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowRight className="size-3.5" />گزارش‌ها</Link>
          <h2 className="mt-1 text-lg font-semibold">گزارش مدیریتی اجرایی</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">خلاصه یک‌صفحه‌ای عملکرد میدان، بازار یا غرفه برای مدیر همان واحد؛ قابل چاپ و ذخیره به‌صورت PDF</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!report} onClick={() => report && exportExecutiveCsv(report)} className="inline-flex h-9 items-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium hover:bg-accent disabled:opacity-40"><FileSpreadsheet className="size-4" />CSV</button>
          <button type="button" disabled={!report} onClick={() => report && exportExecutiveJson(report)} className="inline-flex h-9 items-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium hover:bg-accent disabled:opacity-40"><FileJson className="size-4" />JSON</button>
          <PrintButton />
        </div>
      </div>
      <GlobalFilterBar />
    </div>

    {isLoading && <div className="mx-auto h-96 max-w-5xl animate-pulse rounded-xl bg-muted" />}
    {error && <div className="mx-auto max-w-xl rounded-xl border bg-card p-6 text-center text-sm text-red-600">{error.message}</div>}
    {report && <div className={isFetching ? 'opacity-60 transition' : 'transition'}><ReportBody report={report} /></div>}
  </div>
}

function ReportBody({ report }: { report: ExecutiveReport }) {
  const { meta, scorecard, traffic, service, quality, measurement, safety, children } = report
  const path = [meta.location.parentName, meta.location.name].filter(Boolean).join(' › ')

  return <ReportSheet>
    <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-emerald-600 pb-4">
      <div>
        <p className="text-xs font-medium text-emerald-700">سامانه هوشمند میادین میوه و تره‌بار</p>
        <h1 className="mt-1 text-2xl font-bold">گزارش مدیریتی {LOCATION_LABEL[meta.location.type]}</h1>
        <p className="mt-1 text-base font-semibold text-slate-700">{path}</p>
      </div>
      <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-1 text-xs text-slate-600">
        <dt>بازه گزارش</dt><dd className="font-medium text-slate-900">{faDate(meta.period.from)} تا {faDate(meta.period.to)} ({faNumber(meta.period.days)} روز)</dd>
        <dt>دوره مقایسه</dt><dd className="font-medium text-slate-900">{meta.comparison ? `${faDate(meta.comparison.from)} تا ${faDate(meta.comparison.to)}` : 'بدون مقایسه'}</dd>
        <dt>زمان تهیه</dt><dd className="font-medium text-slate-900">{faDate(meta.generatedAt, true)}</dd>
        <dt>تهیه‌کننده</dt><dd className="font-medium text-slate-900">{meta.generatedBy ?? '—'}</dd>
      </dl>
    </header>

    <ReportSection title="کارنامه عملکرد" description="امتیاز هر بعد از ۰ تا ۱۰۰؛ امتیاز کلی میانگین وزنی ابعادی است که داده دارند.">
      <div className="grid gap-4 lg:grid-cols-[14rem_1fr] print:grid-cols-[12rem_1fr]">
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4">
          <ScoreRing score={scorecard.overall} status={scorecard.status} />
          <p className="mt-2 text-sm font-semibold">امتیاز کلی</p>
          <p className="text-xs" style={{ color: STATUS_RING[scorecard.status] }}>{STATUS_LABEL[scorecard.status]}</p>
        </div>
        <div className="space-y-2">{scorecard.dimensions.map(item => <div key={item.key} className="rounded-lg border border-slate-200 p-3">
          <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">{item.label}</span><span className="text-sm font-bold" style={{ color: STATUS_RING[item.status] }}>{item.score === null ? '—' : faNumber(item.score)}<span className="mr-2 text-[11px] font-medium">{STATUS_LABEL[item.status]}</span></span></div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${item.score ?? 0}%`, backgroundColor: STATUS_RING[item.status] }} /></div>
          <p className="mt-1.5 text-[11px] leading-5 text-slate-600">{item.summary}</p>
        </div>)}</div>
      </div>
    </ReportSection>

    {report.highlights.length > 0 && <ReportSection title="نکات کلیدی دوره">
      <ul className="space-y-1.5">{report.highlights.map((item, index) => <li key={index} className="flex items-start gap-2 text-sm leading-6">
        {item.tone === 'positive' ? <TrendingUp className="mt-1 size-4 shrink-0 text-emerald-600" /> : item.tone === 'negative' ? <TrendingDown className="mt-1 size-4 shrink-0 text-red-600" /> : <Minus className="mt-1 size-4 shrink-0 text-slate-400" />}
        <span>{item.text}</span>
      </li>)}</ul>
    </ReportSection>}

    <ReportSection title="اقدام‌های پیشنهادی" description="بر پایه قواعد ثابت از شاخص‌های همین گزارش استخراج شده است.">
      {report.recommendations.length === 0
        ? <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="size-4" />در این دوره مورد نیازمند اقدام شناسایی نشد.</p>
        : <ol className="space-y-2">{report.recommendations.map((item, index) => <li key={index} className="report-section flex items-start gap-3 rounded-lg border border-slate-200 p-3">
            <span className={`mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${PRIORITY[item.priority].className}`}>{PRIORITY[item.priority].label}</span>
            <div><p className="text-sm font-semibold">{item.title}</p><p className="mt-0.5 text-xs leading-6 text-slate-600">{item.detail}</p></div>
          </li>)}</ol>}
    </ReportSection>

    <ReportSection title="تردد و حضور افراد">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
        <ReportStat label="میانگین حضور" value={metricText(traffic.averageOccupancy, 1, ' نفر')} hint={changeText(traffic.averageOccupancy)} />
        <ReportStat label="اوج حضور" value={metricText(traffic.peakOccupancy, 0, ' نفر')} hint={changeText(traffic.peakOccupancy)} />
        <ReportStat label="ورود ثبت‌شده" value={metricText(traffic.entries, 0)} hint={changeText(traffic.entries)} />
        <ReportStat label="پرترددترین زمان" value={traffic.busiestHours[0] ? `ساعت ${faNumber(traffic.busiestHours[0].hour)}` : '—'} hint={traffic.busiestDays[0] ? weekdayName(traffic.busiestDays[0].day) : undefined} />
      </div>
      <MiniBars unit=" نفر" color="#0ea5e9" points={traffic.daily.map(point => ({ label: faDate(point.date).split(' ').slice(0, 2).join(' '), value: point.value }))} />
    </ReportSection>

    <ReportSection title="صف و خدمت‌رسانی">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
        <ReportStat label="میانگین انتظار" value={metricText(service.averageWaitMinutes, 1, ' دقیقه')} hint={changeText(service.averageWaitMinutes)} />
        <ReportStat label="صدک ۹۰ انتظار" value={metricText(service.p90WaitMinutes, 1, ' دقیقه')} />
        <ReportStat label={`خدمت در زمان هدف${service.slaTargetMinutes ? ` (${faNumber(service.slaTargetMinutes)} دقیقه)` : ''}`} value={metricText(service.slaPercent, 0, '٪')} hint={changeText(service.slaPercent)} />
        <ReportStat label="بیشترین طول صف" value={metricText(service.maximumLength, 0, ' نفر')} />
      </div>
      {service.queues.length > 0 && <table className="w-full text-sm"><thead><tr className="border-b border-slate-200 text-right text-xs text-slate-500"><th className="p-2">صف</th><th className="p-2">مکان</th><th className="p-2">میانگین انتظار</th><th className="p-2">زمان هدف</th><th className="p-2">بیشترین طول</th></tr></thead>
        <tbody>{service.queues.map((queue, index) => <tr key={index} className="border-b border-slate-100 last:border-0"><td className="p-2 font-medium">{queue.name}</td><td className="p-2 text-slate-600">{queue.locationName}</td><td className="p-2">{queue.averageWaitMinutes === null ? '—' : `${faNumber(queue.averageWaitMinutes, 1)} دقیقه`}</td><td className="p-2">{queue.slaPercent === null ? '—' : `${faNumber(queue.slaPercent)}٪`}</td><td className="p-2">{queue.maximumLength === null ? '—' : faNumber(queue.maximumLength)}</td></tr>)}</tbody></table>}
    </ReportSection>

    <ReportSection title="کیفیت محصول" description="بر پایه ارزیابی‌های تازگی ثبت‌شده برای این مکان">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
        <ReportStat label="تعداد ارزیابی" value={faNumber(quality.assessments)} hint={`دوره مقایسه: ${faNumber(quality.previousAssessments)}`} />
        <ReportStat label="میانگین امتیاز تازگی" value={metricText(quality.averageScore, 1)} hint={changeText(quality.averageScore)} tone={quality.averageScore.value === null ? 'neutral' : quality.averageScore.value >= 80 ? 'good' : quality.averageScore.value >= 60 ? 'watch' : 'poor'} />
        <ReportStat label="میانگین سهم فاسد" value={quality.averageDistribution ? `${faNumber(quality.averageDistribution.rotten, 0)}٪` : '—'} tone={quality.averageDistribution && quality.averageDistribution.rotten >= 15 ? 'poor' : 'neutral'} />
        <ReportStat label="عیب پرتکرار" value={quality.topDefects[0]?.label ?? '—'} hint={quality.topDefects[0] ? `در ${faNumber(quality.topDefects[0].count)} ارزیابی` : undefined} />
      </div>
      {quality.assessments > 0 && <div className="grid gap-4 lg:grid-cols-2 print:grid-cols-2">
        <div><p className="mb-2 text-xs font-semibold text-slate-600">روند روزانه امتیاز تازگی</p><MiniBars max={100} points={quality.daily.map(point => ({ label: faDate(point.date).split(' ').slice(0, 2).join(' '), value: point.value }))} /></div>
        <div className="space-y-3">
          <div><p className="mb-1.5 text-xs font-semibold text-slate-600">توزیع برچسب‌ها</p><div className="flex flex-wrap gap-1.5">{quality.labels.map(item => <span key={item.label} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs">{item.label} <b>{faNumber(item.count)}</b></span>)}</div></div>
          {quality.topDefects.length > 0 && <div><p className="mb-1.5 text-xs font-semibold text-slate-600">عیوب پرتکرار</p><div className="flex flex-wrap gap-1.5">{quality.topDefects.map(item => <span key={item.type} className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-900">{item.label} <b>{faNumber(item.count)}</b></span>)}</div></div>}
        </div>
      </div>}
      {quality.lowest.length > 0 && <div><p className="mb-1.5 text-xs font-semibold text-slate-600">پایین‌ترین ارزیابی‌ها</p><table className="w-full text-sm"><tbody>{quality.lowest.map(item => <tr key={item.id} className="border-b border-slate-100 last:border-0"><td className="p-2 text-slate-600">{faDate(item.createdAt, true)}</td><td className="p-2">{item.locationName}</td><td className="p-2">{item.label}</td><td className="p-2 font-bold">{faNumber(item.score)}</td><td className="p-2 text-left print:hidden"><Link href={`/reports/quality/${item.id}`} target="_blank" className="text-xs text-primary">جزئیات</Link></td></tr>)}</tbody></table></div>}
      {measurement.runs > 0 && <div className="grid gap-3 sm:grid-cols-3 print:grid-cols-3">
        <ReportStat label="اندازه‌گیری‌های میوه" value={faNumber(measurement.runs)} />
        <ReportStat label="میانگین قطر میوه" value={metricText(measurement.averageDiameterMm, 1, ' mm')} hint={changeText(measurement.averageDiameterMm)} />
        <ReportStat label="میانگین تعداد روی پالت" value={measurement.averageFruitCount === null ? '—' : faNumber(measurement.averageFruitCount)} />
      </div>}
    </ReportSection>

    <ReportSection title="ایمنی و نظافت">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
        <ReportStat label="بازه‌های پایش" value={faNumber(safety.checks)} />
        <ReportStat label="درگیری فیزیکی" value={faNumber(safety.fights)} hint={`دوره مقایسه: ${faNumber(safety.previousFights)}`} tone={safety.fights > 0 ? 'poor' : safety.checks > 0 ? 'good' : 'neutral'} />
        <ReportStat label="هشدار نظافت" value={faNumber(safety.cleanlinessAlerts)} hint={`دوره مقایسه: ${faNumber(safety.previousCleanlinessAlerts)}`} tone={safety.cleanlinessAlerts > 0 ? 'watch' : safety.checks > 0 ? 'good' : 'neutral'} />
        <ReportStat label="ورود به ناحیه ممنوعه" value={faNumber(safety.restrictedAreaAlerts)} tone={safety.restrictedAreaAlerts > 0 ? 'watch' : 'neutral'} />
      </div>
      {safety.recent.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 print:grid-cols-3">{safety.recent.map(item => <figure key={item.id} className="report-section overflow-hidden rounded-lg border border-slate-200">
        {/* Evidence frames are inline data URLs stored with the incident check. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {item.thumbnail && <img src={item.thumbnail} alt="شاهد رویداد" className="aspect-video w-full bg-black object-contain" />}
        <figcaption className="space-y-0.5 p-2 text-[11px]"><p className="flex items-center gap-1 font-semibold text-red-700"><AlertTriangle className="size-3.5" />{[item.fighting ? 'درگیری' : null, item.floorClean ? null : 'کف ناتمیز'].filter(Boolean).join(' و ')}</p><p className="text-slate-600">{item.cameraName ?? item.locationName} · {faDate(item.createdAt, true)}</p></figcaption>
      </figure>)}</div>}
      {safety.alerts.length > 0 && <ul className="space-y-1 text-xs">{safety.alerts.map(alert => <li key={alert.id} className="flex items-center gap-2"><span className={`size-1.5 rounded-full ${alert.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'}`} />{alert.title} · <span className="text-slate-500">{alert.locationName} · {faDate(alert.occurredAt, true)}</span></li>)}</ul>}
    </ReportSection>

    {children.rows.length > 0 && <ReportSection title={`مقایسه ${children.type === 'booth' ? 'غرفه‌ها' : children.type === 'market' ? 'بازارها' : 'میادین'}`}>
      <table className="w-full text-sm"><thead><tr className="border-b border-slate-200 text-right text-xs text-slate-500"><th className="p-2">#</th><th className="p-2">نام</th><th className="p-2">میانگین حضور</th><th className="p-2">میانگین انتظار</th><th className="p-2">امتیاز تازگی</th><th className="p-2">ارزیابی</th><th className="p-2">رویداد</th></tr></thead>
        <tbody>{children.rows.map((row, index) => <tr key={row.id} className="border-b border-slate-100 last:border-0">
          <td className="p-2 text-slate-500">{faNumber(index + 1)}</td>
          <td className="p-2 font-medium"><Link href={`/reports/executive?locationType=${row.type}&locationId=${row.id}`} className="hover:text-primary print:text-slate-900">{row.name}</Link></td>
          <td className="p-2">{row.occupancy === null ? '—' : faNumber(row.occupancy, 1)}</td>
          <td className="p-2">{row.averageWaitMinutes === null ? '—' : `${faNumber(row.averageWaitMinutes, 1)} دقیقه`}</td>
          <td className="p-2 font-semibold" style={{ color: row.qualityScore === null ? undefined : STATUS_RING[row.qualityScore >= 80 ? 'good' : row.qualityScore >= 60 ? 'watch' : 'poor'] }}>{row.qualityScore === null ? '—' : faNumber(row.qualityScore, 1)}</td>
          <td className="p-2">{faNumber(row.assessments)}</td>
          <td className="p-2">{row.incidents ? <span className="font-semibold text-red-700">{faNumber(row.incidents)}</span> : '۰'}</td>
        </tr>)}</tbody></table>
    </ReportSection>}

    <footer className="space-y-1 border-t border-slate-200 pt-3 text-[11px] leading-5 text-slate-500">
      <p className="flex items-start gap-1.5"><Info className="mt-0.5 size-3.5 shrink-0" />وضعیت داده: {meta.dataStatus === 'live' ? 'کامل' : meta.dataStatus === 'partial' ? 'ناقص' : 'داده تجمیعی دریافت نشده'}{meta.dataQuality?.coveragePercent != null && ` · پوشش ${faNumber(meta.dataQuality.coveragePercent)}٪ از ${faNumber(meta.dataQuality.expectedSources)} منبع`} · {faNumber(meta.cameras.total)} دوربین ({faNumber(meta.cameras.withStream)} دارای استریم، {faNumber(meta.cameras.calibrated)} کالیبره‌شده)</p>
      <p>شاخص‌های تردد و صف از نمونه‌برداری پیوسته دوربین‌ها و شاخص‌های کیفیت، ایمنی و اندازه از تحلیل‌های ثبت‌شده در همین بازه محاسبه شده‌اند. ارزیابی کیفیت فقط ظاهری است و جایگزین آزمون ایمنی غذایی نیست.</p>
    </footer>
  </ReportSheet>
}

function ScoreRing({ score, status }: { score: number | null; status: DimensionStatus }) {
  const radius = 42
  const circumference = 2 * Math.PI * radius
  return <svg viewBox="0 0 100 100" className="size-28" role="img" aria-label={`امتیاز کلی ${score ?? 'نامشخص'}`}>
    <circle cx="50" cy="50" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="9" />
    <circle cx="50" cy="50" r={radius} fill="none" stroke={STATUS_RING[status]} strokeWidth="9" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - (score ?? 0) / 100)} transform="rotate(-90 50 50)" />
    <text x="50" y="56" textAnchor="middle" fontSize="24" fontWeight="700" fill="#0f172a">{score === null ? '—' : faNumber(score)}</text>
  </svg>
}
