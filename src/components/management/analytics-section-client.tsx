'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Activity, AlarmClock, ArrowLeft, Footprints, Gauge, MapPinned, UsersRound } from 'lucide-react'
import { GlobalFilterBar } from './global-filter-bar'
import { AnalyticsCard, EmptyAnalytics, Panel } from './analytics-ui'
import { fetchManagementOverview } from '@/modules/management-analytics/client'
import type { ManagementFilters } from '@/modules/management-analytics/types'
import { useManagementFilters } from '@/stores/management-filters'

type SectionKind = 'traffic' | 'queue' | 'spatial' | 'events' | 'compare'

const META: Record<SectionKind, { title: string; description: string }> = {
  traffic: { title: 'تردد و تراکم', description: 'تحلیل روند ورود، حضور و ظرفیت در سطح میدان، بازار و غرفه' },
  queue: { title: 'صف و خدمت‌رسانی', description: 'پایش زمان انتظار و تحقق سطح خدمت در نواحی صف' },
  spatial: { title: 'نقشه حرارتی و رفتار مکانی', description: 'نمای تجمیعی الگوهای حضور و حرکت در فضای مکان' },
  events: { title: 'رویدادها', description: 'رویدادهای مهم عملیاتی با اولویت و زمینه مکانی' },
  compare: { title: 'مقایسه مکان‌ها', description: 'مقایسه هم‌سطح مکان‌ها بر مبنای شاخص‌های مدیریتی' },
}

export function AnalyticsSectionClient({ kind }: { kind: SectionKind }) {
  const state = useManagementFilters()
  const filters = useMemo<ManagementFilters>(() => ({ locationType: state.locationType, locationId: state.locationId, placeType: state.placeType, from: state.from, to: state.to, comparison: state.comparison, timeFrom: state.timeFrom, timeTo: state.timeTo }), [state.locationType, state.locationId, state.placeType, state.from, state.to, state.comparison, state.timeFrom, state.timeTo])
  const query = useQuery({ queryKey: ['management-overview', filters], queryFn: () => fetchManagementOverview(filters), refetchInterval: 60_000 })
  const meta = META[kind]
  return <div className="space-y-5"><div><h2 className="text-lg font-semibold">{meta.title}</h2><p className="mt-0.5 text-xs text-muted-foreground">{meta.description}</p></div><GlobalFilterBar />{query.isLoading ? <div className="h-80 animate-pulse rounded-xl bg-muted" /> : query.isError || !query.data ? <EmptyAnalytics label="دریافت داده با خطا روبه‌رو شد." /> : <SectionContent kind={kind} data={query.data} />}</div>
}

function SectionContent({ kind, data }: { kind: SectionKind; data: Awaited<ReturnType<typeof fetchManagementOverview>> }) {
  if (kind === 'traffic') return <><div className="grid gap-3 sm:grid-cols-3"><AnalyticsCard title="بازدیدکنندگان" icon={UsersRound} metric={data.kpis.visitors} /><AnalyticsCard title="تردد ورودی" icon={Footprints} metric={data.kpis.entries} /><AnalyticsCard title="اوج اشغال" icon={Gauge} metric={data.kpis.peakOccupancy} suffix="٪" /></div><Panel title="روند تردد و تراکم">{data.trend.length === 0 ? <EmptyAnalytics /> : <div className="grid gap-2">{data.trend.slice(-12).map((point) => <div key={point.timestamp} className="grid grid-cols-[110px_1fr_60px] items-center gap-3 text-xs"><span className="text-muted-foreground">{new Date(point.timestamp).toLocaleDateString('fa-IR')}</span><div className="h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, point.occupancy ?? 0)}%` }} /></div><span className="text-left">{point.traffic?.toLocaleString('fa-IR') ?? '—'}</span></div>)}</div>}</Panel></>
  if (kind === 'queue') return <><div className="grid gap-3 sm:grid-cols-3"><AnalyticsCard title="میانگین انتظار" icon={AlarmClock} metric={data.queue.averageWaitMinutes} suffix=" دقیقه" /><AnalyticsCard title="تحقق SLA" icon={Activity} metric={data.queue.slaPercent} suffix="٪" /><AnalyticsCard title="میانگین انتظار کل" icon={Gauge} metric={data.kpis.averageWaitMinutes} suffix=" دقیقه" /></div><Panel title="خلاصه صف‌ها">{data.queue.activeQueues === null ? <EmptyAnalytics /> : <p className="text-sm">{data.queue.activeQueues.toLocaleString('fa-IR')} صف فعال · بیشترین انتظار: {data.queue.longestQueueLocation ?? '—'}</p>}</Panel></>
  if (kind === 'spatial') return <Panel title="نقشه حرارتی تجمیعی" description="مختصات در سطح مکان نگهداری می‌شوند و هویت دوربین در KPI نمایش داده نمی‌شود.">{data.spatialHeatmap.length === 0 ? <EmptyAnalytics /> : <div className="relative h-[420px] overflow-hidden rounded-xl border bg-muted/30">{data.spatialHeatmap.map((point, index) => <span key={index} className="absolute size-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 blur-2xl" style={{ left: `${point.x}%`, top: `${point.y}%`, opacity: point.intensity * .55 }} />)}</div>}</Panel>
  if (kind === 'events') return <Panel title="رویدادهای مهم">{data.alerts.length === 0 ? <EmptyAnalytics label="رویدادی در این بازه ثبت نشده است." /> : <div className="divide-y">{data.alerts.map((alert) => <div key={alert.id} className="flex items-center gap-3 py-3 text-xs"><span className={`size-2 rounded-full ${alert.severity === 'critical' ? 'bg-red-500' : alert.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}`} /><div className="flex-1"><p className="font-medium">{alert.title}</p><p className="mt-0.5 text-muted-foreground">{alert.locationName}</p></div><time className="text-muted-foreground">{new Date(alert.occurredAt).toLocaleString('fa-IR')}</time></div>)}</div>}</Panel>
  return <Panel title="رتبه‌بندی مقایسه‌ای" action={<MapPinned className="size-4 text-muted-foreground" />}>{data.ranking.length === 0 ? <EmptyAnalytics /> : <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-xs"><thead><tr className="border-b text-muted-foreground"><th className="p-2 text-right">مکان</th><th>تردد</th><th>اشغال</th><th>امتیاز صف</th><th /></tr></thead><tbody>{data.ranking.map((row) => <tr key={row.locationId} className="border-b last:border-0"><td className="p-2.5 font-medium">{row.name}</td><td className="text-center">{row.traffic?.toLocaleString('fa-IR') ?? '—'}</td><td className="text-center">{row.occupancy === null ? '—' : `${row.occupancy}٪`}</td><td className="text-center">{row.queueScore ?? '—'}</td><td><Link href={`/locations/${row.locationType}/${row.locationId}`} className="inline-flex items-center gap-1 text-primary">جزئیات <ArrowLeft className="size-3" /></Link></td></tr>)}</tbody></table></div>}</Panel>
}

