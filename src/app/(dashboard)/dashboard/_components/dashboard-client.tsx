'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, AlarmClock, ArrowLeft, BellRing, Footprints, Gauge, Hourglass, UsersRound } from 'lucide-react'
import { GlobalFilterBar } from '@/components/management/global-filter-bar'
import { AnalyticsCard, EmptyAnalytics, Panel } from '@/components/management/analytics-ui'
import { fetchFleetLive, fetchManagementOverview, type FleetLiveStatus } from '@/modules/management-analytics/client'
import type { ActivityCell, ManagementFilters, ManagementOverview, TrendPoint } from '@/modules/management-analytics/types'
import { useManagementFilters } from '@/stores/management-filters'

const KPI_CONFIG = [
  { key: 'visitors', title: 'بازدیدکنندگان یکتا', icon: UsersRound },
  { key: 'entries', title: 'تردد ورودی', icon: Footprints },
  { key: 'peakOccupancy', title: 'اوج اشغال', icon: Gauge, suffix: '٪' },
  { key: 'averageDwellMinutes', title: 'میانگین ماندگاری', icon: Hourglass, suffix: ' دقیقه' },
  { key: 'averageWaitMinutes', title: 'میانگین انتظار', icon: AlarmClock, suffix: ' دقیقه' },
  { key: 'queueSlaPercent', title: 'تحقق SLA صف', icon: Activity, suffix: '٪' },
] as const

export function DashboardClient() {
  const state = useManagementFilters()
  const filters = useMemo<ManagementFilters>(() => ({
    locationType: state.locationType,
    locationId: state.locationId,
    placeType: state.placeType,
    from: state.from,
    to: state.to,
    comparison: state.comparison,
    timeFrom: state.timeFrom,
    timeTo: state.timeTo,
  }), [state.locationType, state.locationId, state.placeType, state.from, state.to, state.comparison, state.timeFrom, state.timeTo])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['management-overview', filters],
    queryFn: () => fetchManagementOverview(filters),
    refetchInterval: 5_000,
  })
  const live = useQuery({
    queryKey: ['fleet-live'],
    queryFn: fetchFleetLive,
    refetchInterval: 4_000,
  })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">نمای کلی مدیریتی</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">تصویر یکپارچه تردد، تراکم و کیفیت خدمت‌رسانی در سطح مکان</p>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] ${data?.dataStatus === 'live' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'text-muted-foreground'}`}>
          <span className={`size-1.5 rounded-full ${data?.dataStatus === 'live' ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
          {data?.dataStatus === 'live' ? 'داده زنده' : data?.dataStatus === 'partial' ? 'داده ناقص' : 'در انتظار داده تحلیلی'}
        </span>
      </div>

      <GlobalFilterBar />

      <LiveCameraStrip status={live.data} />

      {isError ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center text-sm text-destructive">دریافت نمای کلی با خطا روبه‌رو شد.</div>
      ) : isLoading || !data ? (
        <OverviewSkeleton />
      ) : (
        <OverviewContent data={data} />
      )}
    </div>
  )
}

function OverviewContent({ data }: { data: ManagementOverview }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {KPI_CONFIG.map(({ key, ...config }) => <AnalyticsCard key={key} {...config} metric={data.kpis[key]} />)}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.8fr)]">
        <Panel title="روند تردد و اشغال" description="روند تجمیعی همه حسگرهای مکان انتخاب‌شده">
          <TrendChart points={data.trend} />
        </Panel>
        <Panel title="هشدارهای مهم" description="مواردی که نیازمند اقدام مدیریتی هستند" action={<Link href="/events" className="flex items-center gap-1 text-[11px] text-primary hover:underline">همه رویدادها <ArrowLeft className="size-3" /></Link>}>
          {data.alerts.length === 0 ? <EmptyAnalytics label="هشدار مهمی در این بازه ثبت نشده است." /> : (
            <div className="space-y-2.5">{data.alerts.slice(0, 4).map((alert) => (
              <div key={alert.id} className="flex gap-2.5 rounded-lg bg-muted/35 p-2.5">
                <BellRing className={`mt-0.5 size-4 shrink-0 ${alert.severity === 'critical' ? 'text-red-500' : alert.severity === 'warning' ? 'text-amber-500' : 'text-blue-500'}`} />
                <div className="min-w-0"><p className="truncate text-xs font-medium">{alert.title}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{alert.locationName} · {new Date(alert.occurredAt).toLocaleString('fa-IR')}</p></div>
              </div>
            ))}</div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="الگوی فعالیت روز × ساعت" description="شدت نسبی حضور در ساعات هفته"><ActivityHeatmap cells={data.activityHeatmap} /></Panel>
        <Panel title="عملکرد صف و خدمت‌رسانی" description="شاخص‌های تجمیعی غرفه‌ها و نواحی صف"><QueueSummary data={data} /></Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <Panel title="رتبه‌بندی مکان‌ها" description="مقایسه بر اساس تردد، اشغال و کیفیت صف"><LocationRanking data={data} /></Panel>
        <Panel title="پیش‌نمایش نقشه حرارتی" description="تراکم مکانی تجمیع‌شده؛ بدون نمایش شاخص دوربین"><SpatialPreview data={data} /></Panel>
      </div>

      <Panel title="تغییرات مهم امروز" description="خلاصه خودکار تغییرات معنادار نسبت به دوره مقایسه">
        {data.importantChanges.length === 0 ? <EmptyAnalytics label="تغییر معناداری برای امروز شناسایی نشده است." /> : <ul className="grid gap-2 md:grid-cols-2">{data.importantChanges.map((change) => <li key={change} className="rounded-lg border bg-muted/20 px-3 py-2 text-xs leading-6">{change}</li>)}</ul>}
      </Panel>
    </>
  )
}

function LiveCameraStrip({ status }: { status: FleetLiveStatus | undefined }) {
  if (!status?.enabled) {
    return <Panel title="پردازش زنده دوربین‌ها"><EmptyAnalytics label="نمونه‌بردار پس‌زمینه هنوز فعال نشده است." /></Panel>
  }
  if (status.workers.length === 0) {
    return <Panel title="پردازش زنده دوربین‌ها"><EmptyAnalytics label="دوربین متصل با آدرس RTSP یافت نشد." /></Panel>
  }
  return (
    <Panel title="پردازش زنده دوربین‌ها" description="هر ۲ ثانیه یک فریم؛ اعداد حضور فعلی بدون انتظار برای رول‌آپ ساعتی">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {status.workers.map((worker) => (
          <div key={worker.cameraId} className="rounded-lg border bg-muted/20 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs font-medium">{worker.name}</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] ${worker.status === 'running' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                {worker.status === 'running' ? 'در حال پردازش' : worker.status === 'reconnect' ? 'قطع استریم' : worker.status}
              </span>
            </div>
            <p className="mt-2 text-lg font-semibold">{worker.currentPeople == null ? '—' : `${worker.currentPeople.toLocaleString('fa-IR')} نفر`}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {worker.queueLength == null ? 'بدون صف پیکربندی‌شده' : `صف ${worker.queueLength.toLocaleString('fa-IR')} نفر`}
              {worker.lastError ? ` · ${worker.lastError}` : ''}
            </p>
          </div>
        ))}
      </div>
    </Panel>
  )
}

function TrendChart({ points }: { points: TrendPoint[] }) {
  if (points.length < 2) return <EmptyAnalytics />
  const values = points.flatMap((point) => [point.traffic, point.occupancy]).filter((value): value is number => value !== null)
  if (values.length === 0) return <EmptyAnalytics />
  const max = Math.max(...values, 1)
  const makePolyline = (key: 'traffic' | 'occupancy') => points.map((point, index) => {
    const x = (index / (points.length - 1)) * 100
    const y = 96 - ((point[key] ?? 0) / max) * 88
    return `${x},${y}`
  }).join(' ')
  return (
    <div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-52 w-full" role="img" aria-label="نمودار روند تردد و اشغال">
        {[20, 40, 60, 80].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="currentColor" className="text-border" strokeWidth="0.4" />)}
        <polyline points={makePolyline('traffic')} fill="none" stroke="var(--chart-1)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <polyline points={makePolyline('occupancy')} fill="none" stroke="var(--chart-3)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-center gap-5 text-[11px] text-muted-foreground"><span><i className="ml-1 inline-block size-2 rounded-full bg-[var(--chart-1)]" />تردد</span><span><i className="ml-1 inline-block size-2 rounded-full bg-[var(--chart-3)]" />اشغال</span></div>
    </div>
  )
}

function ActivityHeatmap({ cells }: { cells: ActivityCell[] }) {
  if (cells.length === 0) return <EmptyAnalytics />
  const lookup = new Map(cells.map((cell) => [`${cell.day}-${cell.hour}`, cell.value]))
  const values = cells.flatMap((cell) => cell.value === null ? [] : [cell.value])
  const max = Math.max(...values, 1)
  return <div className="overflow-x-auto"><div className="grid min-w-[560px] grid-cols-[44px_repeat(18,minmax(18px,1fr))] gap-1 text-[9px] text-muted-foreground">
    <span />{Array.from({ length: 18 }, (_, index) => <span key={index} className="text-center">{index + 6}</span>)}
    {['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map((dayName, day) => <div key={dayName} className="contents"><span className="flex items-center">{dayName}</span>{Array.from({ length: 18 }, (_, index) => { const value = lookup.get(`${day}-${index + 6}`); return <span key={index} title={value == null ? 'بدون داده' : String(value)} className="aspect-square rounded-sm bg-primary" style={{ opacity: value == null ? 0.06 : 0.15 + (value / max) * 0.85 }} /> })}</div>)}
  </div></div>
}

function QueueSummary({ data }: { data: ManagementOverview }) {
  if (data.queue.averageWaitMinutes.value === null && data.queue.slaPercent.value === null && data.queue.activeQueues === null) return <EmptyAnalytics />
  return <div className="grid grid-cols-2 gap-3"><SmallMetric label="میانگین انتظار" value={data.queue.averageWaitMinutes.value} suffix=" دقیقه" /><SmallMetric label="تحقق SLA" value={data.queue.slaPercent.value} suffix="٪" /><SmallMetric label="صف‌های فعال" value={data.queue.activeQueues} /><SmallMetric label="طولانی‌ترین انتظار" value={data.queue.longestQueueLocation} /></div>
}

function SmallMetric({ label, value, suffix = '' }: { label: string; value: string | number | null; suffix?: string }) { return <div className="rounded-lg border bg-muted/20 p-3"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 text-base font-semibold">{value === null ? '—' : typeof value === 'number' ? `${value.toLocaleString('fa-IR')}${suffix}` : value}</p></div> }

function LocationRanking({ data }: { data: ManagementOverview }) {
  if (data.ranking.length === 0) return <EmptyAnalytics />
  return <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-xs"><thead><tr className="border-b text-muted-foreground"><th className="pb-2 text-right font-medium">مکان</th><th className="pb-2 text-center font-medium">تردد</th><th className="pb-2 text-center font-medium">اشغال</th><th className="pb-2 text-center font-medium">امتیاز صف</th></tr></thead><tbody className="divide-y">{data.ranking.slice(0, 6).map((row) => <tr key={row.locationId}><td className="py-2.5"><Link href={`/locations/${row.locationType}/${row.locationId}`} className="font-medium hover:text-primary">{row.name}</Link><span className="mr-1 text-[10px] text-muted-foreground">{row.parentName}</span></td><td className="text-center">{row.traffic?.toLocaleString('fa-IR') ?? '—'}</td><td className="text-center">{row.occupancy === null ? '—' : `${row.occupancy.toLocaleString('fa-IR')}٪`}</td><td className="text-center">{row.queueScore?.toLocaleString('fa-IR') ?? '—'}</td></tr>)}</tbody></table></div>
}

function SpatialPreview({ data }: { data: ManagementOverview }) {
  if (data.spatialHeatmap.length === 0) return <EmptyAnalytics />
  return <div className="relative h-56 overflow-hidden rounded-lg border bg-[radial-gradient(circle_at_center,var(--muted),transparent)]">{data.spatialHeatmap.map((point, index) => <span key={`${point.x}-${point.y}-${index}`} className="absolute size-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 blur-xl" style={{ left: `${point.x}%`, top: `${point.y}%`, opacity: Math.max(0.08, point.intensity * 0.55) }} />)}</div>
}

function OverviewSkeleton() { return <div className="space-y-4 animate-pulse"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-32 rounded-xl bg-muted" />)}</div><div className="grid gap-4 xl:grid-cols-2"><div className="h-72 rounded-xl bg-muted" /><div className="h-72 rounded-xl bg-muted" /></div></div> }
