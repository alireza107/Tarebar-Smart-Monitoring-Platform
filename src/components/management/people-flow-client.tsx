'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeftRight, DoorOpen, Gauge, LogIn, LogOut, UsersRound } from 'lucide-react'
import { GlobalFilterBar } from './global-filter-bar'
import { EmptyAnalytics, Panel } from './analytics-ui'
import { ComparisonLineChart, DataQualityBanner, DayHourHeatmap, DrillableMetricCard, MetricDrilldown, ModuleHeader, type DrilldownSelection } from './phase2-ui'
import { fetchPeopleFlow } from '@/modules/management-analytics/client'
import type { ManagementFilters, PeopleFlowAnalytics, TimeBucket } from '@/modules/management-analytics/types'
import { useManagementFilters } from '@/stores/management-filters'

const KPI = [
  { key: 'currentOccupancy', title: 'حضور فعلی', icon: UsersRound, trend: 'occupancy', location: 'currentOccupancy' },
  { key: 'averageOccupancy', title: 'میانگین حضور', icon: Gauge, trend: 'occupancy', location: 'currentOccupancy' },
  { key: 'peakOccupancy', title: 'اوج حضور', icon: DoorOpen, trend: 'occupancy', location: 'currentOccupancy' },
  { key: 'entries', title: 'ورودی', icon: LogIn, trend: 'entries', location: 'entries' },
  { key: 'exits', title: 'خروجی', icon: LogOut, trend: 'exits', location: 'exits' },
  { key: 'uniqueVisitors', title: 'بازدیدکنندگان یکتا', icon: ArrowLeftRight, trend: 'uniqueVisitors', location: 'uniqueVisitors' },
] as const

export function PeopleFlowClient() {
  const [bucket, setBucket] = useState<TimeBucket>('hour')
  const [selection, setSelection] = useState<DrilldownSelection | null>(null)
  const state = useManagementFilters()
  const filters = useMemo<ManagementFilters>(() => ({ locationType: state.locationType, locationId: state.locationId, placeType: state.placeType, from: state.from, to: state.to, comparison: state.comparison, timeFrom: state.timeFrom, timeTo: state.timeTo }), [state.locationType, state.locationId, state.placeType, state.from, state.to, state.comparison, state.timeFrom, state.timeTo])
  const query = useQuery({ queryKey: ['people-flow', filters, bucket], queryFn: () => fetchPeopleFlow(filters, bucket), refetchInterval: 60_000 })
  return <div className="space-y-5"><ModuleHeader title="تردد و تراکم" description="تحلیل تجمیعی حضور و جریان افراد در سطح میدان، بازار و غرفه" bucket={bucket} onBucketChange={setBucket} /><GlobalFilterBar />{query.isLoading ? <Loading /> : query.isError || !query.data ? <EmptyAnalytics label="دریافت داده تردد با خطا روبه‌رو شد." /> : <Content data={query.data} onSelect={setSelection} />} {query.data && <MetricDrilldown selection={selection} onOpenChange={(open) => { if (!open) setSelection(null) }} filters={filters} events={query.data.events} />}</div>
}

function Content({ data, onSelect }: { data: PeopleFlowAnalytics; onSelect: (selection: DrilldownSelection) => void }) {
  const select = (config: typeof KPI[number]) => onSelect({
    key: config.key, title: config.title, metric: data.kpis[config.key],
    trend: data.trend.map((point) => ({ timestamp: point.timestamp, current: point[config.trend], previous: config.trend === 'occupancy' ? point.previousOccupancy : null })),
    locations: data.locations.map((row) => ({ ...row, value: row[config.location] })),
  })
  const occupancyTrend = data.trend.map((point) => ({ timestamp: point.timestamp, current: point.occupancy, previous: point.previousOccupancy }))
  return <><DataQualityBanner status={data.dataStatus} quality={data.dataQuality} /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">{KPI.map((config) => <DrillableMetricCard key={config.key} title={config.title} icon={config.icon} metric={data.kpis[config.key]} onClick={() => select(config)} note={config.key === 'uniqueVisitors' && data.uniqueVisitorsAggregation === 'not_available' ? 'شناسه یکتا در این سطح معتبر نیست' : undefined} />)}</div><div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,.8fr)]"><Panel title="روند حضور" description={`دانه‌بندی ${data.bucket === 'hour' ? 'ساعتی' : 'روزانه'} و مقایسه با دوره منتخب`}><ComparisonLineChart points={occupancyTrend} /></Panel><Panel title="دوره‌های اوج" description="بازه‌های پرتراکم مرتب‌شده بر اساس مقدار">{data.peakPeriods.length === 0 ? <EmptyAnalytics /> : <div className="space-y-2">{data.peakPeriods.slice(0, 6).map((peak, index) => <div key={`${peak.from}-${index}`} className="flex items-center gap-3 rounded-lg border p-3 text-xs"><span className="flex size-7 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">{(index + 1).toLocaleString('fa-IR')}</span><div className="flex-1"><p className="font-medium">{peak.label}</p><p className="mt-1 text-[10px] text-muted-foreground">{new Date(peak.from).toLocaleString('fa-IR')} تا {new Date(peak.to).toLocaleString('fa-IR')}</p></div><strong>{peak.value.toLocaleString('fa-IR')}</strong></div>)}</div>}</Panel></div><Panel title="الگوی روز × ساعت" description="شدت حضور تجمیعی؛ خانه‌های کم‌رنگ فاقد پوشش معتبر هستند"><DayHourHeatmap cells={data.activityHeatmap} /></Panel><Panel title="مقایسه و ورود به جزئیات مکان" description="دوربین‌ها فقط منبع داده‌اند؛ ردیف‌های کسب‌وکاری میدان، بازار و غرفه هستند"><LocationTable data={data} /></Panel></>
}

function LocationTable({ data }: { data: PeopleFlowAnalytics }) {
  if (!data.locations.length) return <EmptyAnalytics />
  return <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-xs"><thead><tr className="border-b text-muted-foreground"><th className="p-2 text-right">مکان</th><th>حضور فعلی</th><th>ورودی</th><th>خروجی</th><th>بازدیدکننده یکتا</th><th>تغییر</th><th>پوشش</th><th /></tr></thead><tbody className="divide-y">{data.locations.map((row) => <tr key={row.locationId}><td className="p-2.5 font-medium">{row.name}<small className="mr-1 text-muted-foreground">{row.parentName}</small></td><td className="text-center">{row.currentOccupancy?.toLocaleString('fa-IR') ?? '—'}</td><td className="text-center">{row.entries?.toLocaleString('fa-IR') ?? '—'}</td><td className="text-center">{row.exits?.toLocaleString('fa-IR') ?? '—'}</td><td className="text-center">{row.uniqueVisitors?.toLocaleString('fa-IR') ?? '—'}</td><td className="text-center">{row.changePercent === null ? '—' : `${row.changePercent.toLocaleString('fa-IR')}٪`}</td><td className="text-center">{row.coveragePercent === null ? '—' : `${row.coveragePercent.toLocaleString('fa-IR')}٪`}</td><td><Link href={`/locations/${row.locationType}/${row.locationId}`} className="text-primary">جزئیات</Link></td></tr>)}</tbody></table></div>
}

function Loading() { return <div className="space-y-4 animate-pulse"><div className="h-14 rounded-xl bg-muted" /><div className="grid gap-3 sm:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-32 rounded-xl bg-muted" />)}</div><div className="h-72 rounded-xl bg-muted" /></div> }
