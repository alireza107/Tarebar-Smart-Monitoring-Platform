'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Activity, AlarmClock, Gauge, ListOrdered, MoveHorizontal, Percent, Timer, Users, Waves } from 'lucide-react'
import { GlobalFilterBar } from './global-filter-bar'
import { EmptyAnalytics, Panel } from './analytics-ui'
import { ComparisonLineChart, DataQualityBanner, DrillableMetricCard, MetricDrilldown, ModuleHeader, type DrilldownSelection } from './phase2-ui'
import { fetchQueueAnalytics } from '@/modules/management-analytics/client'
import type { ManagementFilters, QueueAnalytics, QueueDetail, TimeBucket } from '@/modules/management-analytics/types'
import { useManagementFilters } from '@/stores/management-filters'

const KPI = [
  { key: 'currentLength', title: 'طول فعلی صف', icon: Users },
  { key: 'averageLength', title: 'میانگین طول صف', icon: ListOrdered },
  { key: 'maximumLength', title: 'بیشترین طول صف', icon: Waves },
  { key: 'averageWaitMinutes', title: 'میانگین انتظار', icon: AlarmClock, suffix: ' دقیقه' },
  { key: 'p50WaitMinutes', title: 'انتظار P50', icon: Timer, suffix: ' دقیقه' },
  { key: 'p90WaitMinutes', title: 'انتظار P90', icon: Timer, suffix: ' دقیقه' },
  { key: 'p95WaitMinutes', title: 'انتظار P95', icon: Timer, suffix: ' دقیقه' },
  { key: 'movementSpeedMetersPerMinute', title: 'سرعت حرکت صف', icon: MoveHorizontal, suffix: ' متر/دقیقه' },
  { key: 'throughputPerHour', title: 'نرخ خدمت', icon: Gauge, suffix: ' نفر/ساعت' },
  { key: 'slaPercent', title: 'تحقق SLA', icon: Percent, suffix: '٪' },
  { key: 'warningMinutes', title: 'مدت هشدار', icon: Activity, suffix: ' دقیقه' },
  { key: 'criticalMinutes', title: 'مدت بحرانی', icon: Activity, suffix: ' دقیقه' },
] as const

export function QueueAnalyticsClient() {
  const [bucket, setBucket] = useState<TimeBucket>('hour')
  const [selection, setSelection] = useState<DrilldownSelection | null>(null)
  const [queue, setQueue] = useState<QueueDetail | null>(null)
  const state = useManagementFilters()
  const filters = useMemo<ManagementFilters>(() => ({ locationType: state.locationType, locationId: state.locationId, placeType: state.placeType, from: state.from, to: state.to, comparison: state.comparison, timeFrom: state.timeFrom, timeTo: state.timeTo }), [state.locationType, state.locationId, state.placeType, state.from, state.to, state.comparison, state.timeFrom, state.timeTo])
  const query = useQuery({ queryKey: ['queue-analytics', filters, bucket], queryFn: () => fetchQueueAnalytics(filters, bucket), refetchInterval: 10_000 })
  return <div className="space-y-5"><ModuleHeader title="صف و خدمت‌رسانی" description="زمان انتظار، ظرفیت خدمت و پایبندی به SLA در صف‌های مکان" bucket={bucket} onBucketChange={setBucket} /><GlobalFilterBar />{query.isLoading ? <Loading /> : query.isError || !query.data ? <EmptyAnalytics label="دریافت داده صف با خطا روبه‌رو شد." /> : <Content data={query.data} onSelect={setSelection} selectedQueue={queue} onQueueSelect={setQueue} />}{query.data && <MetricDrilldown selection={selection} onOpenChange={(open) => { if (!open) setSelection(null) }} filters={filters} events={query.data.events} />}</div>
}

function Content({ data, onSelect, selectedQueue, onQueueSelect }: { data: QueueAnalytics; onSelect: (value: DrilldownSelection) => void; selectedQueue: QueueDetail | null; onQueueSelect: (value: QueueDetail | null) => void }) {
  const select = (config: typeof KPI[number]) => {
    const waitMetric = config.key.includes('Wait')
    const current = (point: QueueAnalytics['trend'][number]) => config.key === 'slaPercent' ? point.slaPercent : config.key === 'throughputPerHour' ? point.throughput : config.key.includes('Length') ? point.averageLength : waitMetric ? point.averageWaitMinutes : null
    const locationValue = (row: QueueAnalytics['locations'][number]) => config.key === 'slaPercent' ? row.slaPercent : config.key === 'throughputPerHour' ? row.throughput : config.key.includes('Length') ? row.currentLength : config.key === 'p95WaitMinutes' ? row.p95WaitMinutes : config.key === 'warningMinutes' ? row.warningMinutes : config.key === 'criticalMinutes' ? row.criticalMinutes : waitMetric ? row.averageWaitMinutes : null
    onSelect({ key: config.key, title: config.title, metric: data.kpis[config.key], suffix: 'suffix' in config ? config.suffix : undefined, trend: data.trend.map((point) => ({ timestamp: point.timestamp, current: current(point), previous: waitMetric ? point.previousWaitMinutes : null })), locations: data.locations.map((row) => ({ ...row, value: locationValue(row) })) })
  }
  const trend = data.trend.map((point) => ({ timestamp: point.timestamp, current: point.averageWaitMinutes, previous: point.previousWaitMinutes }))
  const calibrated = data.dataQuality.calibratedSources ?? 0
  return <><DataQualityBanner status={data.dataStatus} quality={data.dataQuality} /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{KPI.map((config) => <DrillableMetricCard key={config.key} title={config.title} icon={config.icon} metric={data.kpis[config.key]} suffix={'suffix' in config ? config.suffix : undefined} onClick={() => select(config)} note={config.key === 'movementSpeedMetersPerMinute' && calibrated === 0 ? 'نیازمند کالیبراسیون فیزیکی' : undefined} />)}</div><div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,.7fr)]"><Panel title="روند انتظار صف" description="دوره جاری در برابر دوره مقایسه"><ComparisonLineChart points={trend} /></Panel><Panel title="تعریف سطح خدمت"><div className="flex min-h-40 flex-col items-center justify-center text-center"><Percent className="size-8 text-primary" /><p className="mt-3 text-3xl font-bold">{data.kpis.slaPercent.value === null ? '—' : `${data.kpis.slaPercent.value.toLocaleString('fa-IR')}٪`}</p><p className="mt-2 text-xs text-muted-foreground">سهم خدمت در کمتر از {data.slaTargetMinutes?.toLocaleString('fa-IR') ?? '—'} دقیقه</p></div></Panel></div><Panel title="مقایسه صف بین مکان‌ها" description="هشدار و بحرانی بر مبنای مدت عبور از آستانه"><LocationComparison data={data} /></Panel><Panel title="جزئیات صف" description="برای بازکردن نمای جزئیات، یک صف را از فهرست انتخاب کنید"><QueueList data={data} selected={selectedQueue} onSelect={onQueueSelect} /></Panel></>
}

function LocationComparison({ data }: { data: QueueAnalytics }) {
  if (!data.locations.length) return <EmptyAnalytics />
  return <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-xs"><thead><tr className="border-b text-muted-foreground"><th className="p-2 text-right">مکان</th><th>صف فعلی</th><th>انتظار متوسط</th><th>P95</th><th>نرخ خدمت</th><th>SLA</th><th>هشدار</th><th>بحرانی</th><th /></tr></thead><tbody className="divide-y">{data.locations.map((row) => <tr key={row.locationId}><td className="p-2.5 font-medium">{row.name}</td><td className="text-center">{row.currentLength?.toLocaleString('fa-IR') ?? '—'}</td><td className="text-center">{row.averageWaitMinutes?.toLocaleString('fa-IR') ?? '—'}</td><td className="text-center">{row.p95WaitMinutes?.toLocaleString('fa-IR') ?? '—'}</td><td className="text-center">{row.throughput?.toLocaleString('fa-IR') ?? '—'}</td><td className="text-center">{row.slaPercent === null ? '—' : `${row.slaPercent.toLocaleString('fa-IR')}٪`}</td><td className="text-center text-amber-600">{row.warningMinutes?.toLocaleString('fa-IR') ?? '—'}</td><td className="text-center text-red-500">{row.criticalMinutes?.toLocaleString('fa-IR') ?? '—'}</td><td><Link href={`/locations/${row.locationType}/${row.locationId}`} className="text-primary">مکان</Link></td></tr>)}</tbody></table></div>
}

function QueueList({ data, selected, onSelect }: { data: QueueAnalytics; selected: QueueDetail | null; onSelect: (value: QueueDetail | null) => void }) {
  if (!data.queues.length) return <EmptyAnalytics />
  return <div className="grid gap-4 lg:grid-cols-[minmax(260px,.7fr)_minmax(0,1.3fr)]"><div className="max-h-80 space-y-2 overflow-auto">{data.queues.map((queue) => <button type="button" key={queue.id} onClick={() => onSelect(queue)} className={`w-full rounded-lg border p-3 text-right text-xs ${selected?.id === queue.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/30'}`}><span className="font-medium">{queue.name}</span><span className="mr-2 text-muted-foreground">{queue.locationName}</span><p className="mt-1 text-[10px] text-muted-foreground">{queue.currentLength?.toLocaleString('fa-IR') ?? '—'} نفر · {queue.averageWaitMinutes?.toLocaleString('fa-IR') ?? '—'} دقیقه انتظار</p></button>)}</div>{selected ? <QueueDetailPanel queue={selected} /> : <EmptyAnalytics label="یک صف را برای مشاهده جزئیات انتخاب کنید." />}</div>
}

function QueueDetailPanel({ queue }: { queue: QueueDetail }) {
  const items = [['طول فعلی', queue.currentLength, ' نفر'], ['میانگین طول', queue.averageLength, ' نفر'], ['بیشترین طول', queue.maximumLength, ' نفر'], ['انتظار متوسط', queue.averageWaitMinutes, ' دقیقه'], ['P50 / P90 / P95', queue.p50WaitMinutes === null ? null : `${queue.p50WaitMinutes} / ${queue.p90WaitMinutes ?? '—'} / ${queue.p95WaitMinutes ?? '—'}`, ' دقیقه'], ['سرعت حرکت', queue.movementSpeedMetersPerMinute, ' متر/دقیقه'], ['نرخ خدمت', queue.throughputPerHour, ' نفر/ساعت'], ['تحقق SLA', queue.slaPercent, '٪']] as const
  return <div className="rounded-xl border bg-muted/15 p-4"><div className="mb-4 flex items-start justify-between"><div><h4 className="text-sm font-semibold">{queue.name}</h4><p className="mt-1 text-[11px] text-muted-foreground">{queue.locationName}</p></div><span className={`rounded-full px-2 py-1 text-[10px] ${queue.isPhysicallyCalibrated ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{queue.isPhysicallyCalibrated ? 'کالیبره' : 'بدون کالیبراسیون فیزیکی'}</span></div><div className="grid gap-2 sm:grid-cols-2">{items.map(([label, value, suffix]) => <div key={label} className="rounded-lg border bg-card p-2.5"><p className="text-[10px] text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value === null ? '—' : `${typeof value === 'number' ? value.toLocaleString('fa-IR') : value}${suffix}`}</p></div>)}</div></div>
}

function Loading() { return <div className="space-y-4 animate-pulse"><div className="h-14 rounded-xl bg-muted" /><div className="grid gap-3 sm:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-32 rounded-xl bg-muted" />)}</div><div className="h-72 rounded-xl bg-muted" /></div> }
