'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Activity, AlarmClock, ArrowRight, Footprints, Gauge, History, Radio, UsersRound } from 'lucide-react'
import { AnalyticsCard, EmptyAnalytics, Panel } from '@/components/management/analytics-ui'
import { childPlaceType, LocationOccupancyBreadcrumb, occupancyCellsFromHierarchy, PlaceOccupancyHeatmap } from '@/components/management/phase2-ui'
import { GlobalFilterBar } from '@/components/management/global-filter-bar'
import { fetchManagementLocations, fetchManagementOverview, fetchPeopleFlow } from '@/modules/management-analytics/client'
import type { ManagementFilters, ManagementLocationType } from '@/modules/management-analytics/types'
import { useManagementFilters } from '@/stores/management-filters'

const TABS = [
  { id: 'overview', label: 'نمای کلی' }, { id: 'traffic', label: 'تردد' }, { id: 'queue', label: 'صف' },
  { id: 'spatial', label: 'مکانی' }, { id: 'events', label: 'رویدادها' }, { id: 'history', label: 'تاریخچه' }, { id: 'live', label: 'زنده' },
] as const
type Tab = typeof TABS[number]['id']

export function LocationOverviewClient({ type, id }: { type: ManagementLocationType; id: string }) {
  const [tab, setTab] = useState<Tab>('overview')
  const router = useRouter()
  const state = useManagementFilters()
  const locations = useQuery({ queryKey: ['management-locations'], queryFn: fetchManagementLocations, staleTime: 5 * 60_000 })
  const filters = useMemo<ManagementFilters>(() => ({ locationType: type, locationId: id, placeType: state.placeType, from: state.from, to: state.to, comparison: state.comparison, timeFrom: state.timeFrom, timeTo: state.timeTo }), [type, id, state.placeType, state.from, state.to, state.comparison, state.timeFrom, state.timeTo])
  const overview = useQuery({ queryKey: ['management-overview', filters], queryFn: () => fetchManagementOverview(filters), refetchInterval: 5_000 })
  const all = locations.data ? [...locations.data.fields, ...locations.data.markets, ...locations.data.booths] : []
  const location = all.find((item) => item.type === type && item.id === id)
  return <div className="space-y-5">
    <div><Link href="/locations" className="mb-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"><ArrowRight className="size-3" />بازگشت به مکان‌ها</Link><h2 className="text-lg font-semibold">{location?.name ?? 'نمای مکان'}</h2><p className="mt-0.5 text-xs text-muted-foreground">{location?.parentName ? `${location.parentName} · ` : ''}تحلیل تجمیعی سطح {type === 'field' ? 'میدان' : type === 'market' ? 'بازار' : 'غرفه'}</p></div>
    <GlobalFilterBar locationOverride={{ type, id }} onLocationChange={(nextType, nextId) => router.push(nextType === 'organization' ? '/dashboard' : `/locations/${nextType}/${nextId}`)} />
    <div className="overflow-x-auto border-b"><div className="flex min-w-max gap-1">{TABS.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`border-b-2 px-4 py-2.5 text-xs transition ${tab === item.id ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{item.label}</button>)}</div></div>
    {overview.isLoading ? <div className="h-72 animate-pulse rounded-xl bg-muted" /> : overview.isError || !overview.data ? <EmptyAnalytics label="این مکان یافت نشد یا در محدوده دسترسی شما نیست." /> : <TabContent tab={tab} data={overview.data} type={type} id={id} filters={filters} hierarchy={locations.data} onOpenLocation={(nextType, nextId) => router.push(`/locations/${nextType}/${nextId}`)} />}
  </div>
}

function TabContent({ tab, data, type, id, filters, hierarchy, onOpenLocation }: { tab: Tab; data: Awaited<ReturnType<typeof fetchManagementOverview>>; type: ManagementLocationType; id: string; filters: ManagementFilters; hierarchy: Awaited<ReturnType<typeof fetchManagementLocations>> | undefined; onOpenLocation: (type: Exclude<ManagementLocationType, 'organization'>, id: string) => void }) {
  if (tab === 'overview') return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><AnalyticsCard title="بازدیدکنندگان" icon={UsersRound} metric={data.kpis.visitors} /><AnalyticsCard title="تردد ورودی" icon={Footprints} metric={data.kpis.entries} /><AnalyticsCard title="اوج اشغال" icon={Gauge} metric={data.kpis.peakOccupancy} suffix="٪" /><AnalyticsCard title="ماندگاری متوسط" icon={History} metric={data.kpis.averageDwellMinutes} suffix=" دقیقه" /><AnalyticsCard title="انتظار متوسط" icon={AlarmClock} metric={data.kpis.averageWaitMinutes} suffix=" دقیقه" /><AnalyticsCard title="تحقق SLA" icon={Activity} metric={data.kpis.queueSlaPercent} suffix="٪" /></div>
  if (tab === 'traffic') return <Panel title="روند تردد و اشغال">{data.trend.length ? <div className="space-y-2">{data.trend.map((point) => <div key={point.timestamp} className="flex justify-between border-b py-2 text-xs"><span>{new Date(point.timestamp).toLocaleString('fa-IR')}</span><span>{point.traffic ?? '—'} تردد · {point.occupancy ?? '—'}٪ اشغال</span></div>)}</div> : <EmptyAnalytics />}</Panel>
  if (tab === 'queue') return <Panel title="عملکرد صف"><div className="grid gap-3 sm:grid-cols-3"><AnalyticsCard title="انتظار متوسط" icon={AlarmClock} metric={data.queue.averageWaitMinutes} suffix=" دقیقه" /><AnalyticsCard title="تحقق SLA" icon={Activity} metric={data.queue.slaPercent} suffix="٪" /><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">صف‌های فعال</p><p className="mt-2 text-2xl font-bold">{data.queue.activeQueues ?? '—'}</p></div></div></Panel>
  if (tab === 'spatial') return <LocationOccupancyTab type={type} id={id} filters={filters} hierarchy={hierarchy} onOpenLocation={onOpenLocation} />
  if (tab === 'events') return <Panel title="رویدادهای مکان">{data.alerts.length ? <div className="divide-y">{data.alerts.map((alert) => <p key={alert.id} className="py-3 text-xs">{alert.title} · <span className="text-muted-foreground">{new Date(alert.occurredAt).toLocaleString('fa-IR')}</span></p>)}</div> : <EmptyAnalytics label="رویدادی ثبت نشده است." />}</Panel>
  if (tab === 'history') return <Panel title="تاریخچه تغییرات"><EmptyAnalytics label="تاریخچه دوره‌های تجمیعی پس از اتصال انبار تحلیلی نمایش داده می‌شود." /></Panel>
  return <Panel title="عملیات زنده"><div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center"><Radio className="size-7 text-primary" /><p className="text-xs text-muted-foreground">برای مشاهده منابع زنده این مکان وارد عملیات زنده شوید.</p><Link href="/live-operations" className="rounded-lg bg-primary px-4 py-2 text-xs text-primary-foreground">رفتن به عملیات زنده</Link></div></Panel>
}


function LocationOccupancyTab({ type, id, filters, hierarchy, onOpenLocation }: { type: ManagementLocationType; id: string; filters: ManagementFilters; hierarchy: Awaited<ReturnType<typeof fetchManagementLocations>> | undefined; onOpenLocation: (type: Exclude<ManagementLocationType, 'organization'>, id: string) => void }) {
  const occupancyFilters = { ...filters, placeType: childPlaceType(type) }
  const flow = useQuery({ queryKey: ['people-flow', occupancyFilters, 'hour'], queryFn: () => fetchPeopleFlow(occupancyFilters, 'hour'), refetchInterval: 15_000 })
  const cells = occupancyCellsFromHierarchy(hierarchy, type, id, flow.data?.locations)
  return (
    <Panel title="اشغال زیرمجموعه‌ها" description="با کلیک روی هر کاشی وارد سطح پایین‌تر می‌شوید؛ رنگ نشان‌دهنده جمعیت نسبی است">
      <div className="mb-4">
        <LocationOccupancyBreadcrumb hierarchy={hierarchy} locationType={type} locationId={id} onSelect={(nextType, nextId) => { if (nextType === 'organization' || !nextId) return; onOpenLocation(nextType, nextId) }} onShowChildren={() => { if (type === 'organization') return; /* stay on this location and show defined children */ }} />
      </div>
      {!hierarchy ? <div className="h-64 animate-pulse rounded-xl bg-muted" /> : (
        <PlaceOccupancyHeatmap cells={cells} onSelect={onOpenLocation} emptyLabel="برای این مکان هنوز بازار، غرفه یا زیرمجموعه‌ای تعریف نشده است." />
      )}
    </Panel>
  )
}
