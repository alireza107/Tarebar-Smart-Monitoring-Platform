'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { ArrowLeft, CheckCircle2, CircleAlert, Database, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyAnalytics } from './analytics-ui'
import type { ActivityCell, AnalyticsEvent, ComparisonPoint, DataQuality, LocationHierarchy, LocationOption, ManagementFilters, ManagementLocationType, ManagementPlaceType, MetricLocationRow, MetricValue, SpatialHeatPointV2, TimeBucket } from '@/modules/management-analytics/types'

export function ModuleHeader({ title, description, bucket, onBucketChange }: { title: string; description: string; bucket: TimeBucket; onBucketChange: (value: TimeBucket) => void }) {
  return <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">{title}</h2><p className="mt-0.5 text-xs text-muted-foreground">{description}</p></div><div className="flex rounded-lg border bg-card p-1 text-[11px]"><button type="button" onClick={() => onBucketChange('hour')} className={`rounded-md px-3 py-1.5 ${bucket === 'hour' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>ساعتی</button><button type="button" onClick={() => onBucketChange('day')} className={`rounded-md px-3 py-1.5 ${bucket === 'day' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>روزانه</button></div></div>
}

export function DataQualityBanner({ status, quality }: { status: 'live' | 'partial' | 'unavailable'; quality: DataQuality }) {
  const ready = status !== 'unavailable'
  const Icon = status === 'live' ? CheckCircle2 : status === 'partial' ? CircleAlert : Database
  return <div className={`flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border px-4 py-3 text-xs ${status === 'partial' ? 'border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/10' : 'bg-card'}`}><span className="flex items-center gap-2 font-medium"><Icon className={`size-4 ${status === 'live' ? 'text-emerald-600' : status === 'partial' ? 'text-amber-600' : 'text-muted-foreground'}`} />{status === 'live' ? 'پوشش داده کامل' : status === 'partial' ? 'داده با پوشش ناقص' : 'انبار تحلیلی متصل نیست'}</span><span className="text-muted-foreground">پوشش: {quality.coveragePercent === null ? '—' : `${quality.coveragePercent.toLocaleString('fa-IR')}٪`}</span><span className="text-muted-foreground">اطمینان: {quality.confidencePercent === null ? '—' : `${quality.confidencePercent.toLocaleString('fa-IR')}٪`}</span><span className="text-muted-foreground">منابع مؤثر: {ready ? `${quality.contributingSources.toLocaleString('fa-IR')} از ${quality.expectedSources.toLocaleString('fa-IR')}` : '—'}</span>{quality.note && <span className="basis-full text-[11px] text-muted-foreground">{quality.note}</span>}</div>
}

export function DrillableMetricCard({ title, icon: Icon, metric, suffix = '', onClick, note }: { title: string; icon: LucideIcon; metric: MetricValue; suffix?: string; onClick: () => void; note?: string }) {
  const change = metric.changePercent
  return <button type="button" onClick={onClick} className="group rounded-xl border bg-card p-4 text-right shadow-sm transition hover:border-primary/40 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">{title}</p><p className="mt-2 text-2xl font-bold tracking-tight">{metric.value === null ? '—' : `${metric.value.toLocaleString('fa-IR')}${suffix}`}</p></div><span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4.5" /></span></div><div className={`mt-3 flex items-center gap-1 text-[11px] ${change === null ? 'text-muted-foreground' : change >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{change === null ? <Minus className="size-3.5" /> : change >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}<span>{change === null ? (note ?? 'داده مقایسه موجود نیست') : `${Math.abs(change).toLocaleString('fa-IR')}٪ نسبت به دوره قبل`}</span><ArrowLeft className="mr-auto size-3 opacity-0 transition group-hover:opacity-100" /></div></button>
}

export interface DrilldownSelection {
  key: string
  title: string
  metric: MetricValue
  suffix?: string
  trend: ComparisonPoint[]
  locations: MetricLocationRow[]
}

export function MetricDrilldown({ selection, onOpenChange, filters, events }: { selection: DrilldownSelection | null; onOpenChange: (open: boolean) => void; filters: ManagementFilters; events: AnalyticsEvent[] }) {
  if (!selection) return null
  const related = events.filter((event) => !event.metricKey || event.metricKey === selection.key)
  return <Dialog open onOpenChange={onOpenChange}><DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{selection.title}</DialogTitle><DialogDescription>شاخص ← روند ← مقایسه ← مکان ← بازه زمانی ← رویداد مرتبط</DialogDescription></DialogHeader><div className="grid gap-4 md:grid-cols-[190px_1fr]"><div className="rounded-xl border bg-muted/25 p-4"><p className="text-xs text-muted-foreground">مقدار دوره</p><p className="mt-2 text-3xl font-bold">{selection.metric.value === null ? '—' : `${selection.metric.value.toLocaleString('fa-IR')}${selection.suffix ?? ''}`}</p><p className="mt-3 text-[11px] text-muted-foreground">{filters.from} تا {filters.to}</p></div><div className="rounded-xl border p-3"><p className="mb-2 text-xs font-medium">روند و دوره مقایسه</p><ComparisonLineChart points={selection.trend} /></div></div><div><p className="mb-2 text-xs font-medium">شکست بر اساس مکان</p>{selection.locations.length === 0 ? <EmptyAnalytics /> : <div className="max-h-52 overflow-auto rounded-xl border"><table className="w-full text-xs"><thead className="sticky top-0 bg-muted"><tr><th className="p-2 text-right">مکان</th><th>این دوره</th><th>دوره قبل</th><th>پوشش</th><th /></tr></thead><tbody className="divide-y">{selection.locations.map((row) => <tr key={row.locationId}><td className="p-2 font-medium">{row.name}</td><td className="text-center">{row.value?.toLocaleString('fa-IR') ?? '—'}</td><td className="text-center">{row.previousValue?.toLocaleString('fa-IR') ?? '—'}</td><td className="text-center">{row.coveragePercent === null ? '—' : `${row.coveragePercent.toLocaleString('fa-IR')}٪`}</td><td><Link className="text-primary" href={`/locations/${row.locationType}/${row.locationId}`}>مکان</Link></td></tr>)}</tbody></table></div>}</div><div><p className="mb-2 text-xs font-medium">رویدادهای مرتبط در همین بازه</p>{related.length === 0 ? <EmptyAnalytics label="رویداد مرتبطی ثبت نشده است." /> : <div className="grid gap-2 sm:grid-cols-2">{related.slice(0, 6).map((event) => <Link href={`/events?eventId=${event.id}`} key={event.id} className="rounded-lg border p-3 text-xs hover:border-primary/40"><span className={`ml-2 inline-block size-2 rounded-full ${event.severity === 'critical' ? 'bg-red-500' : event.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}`} />{event.title}<p className="mt-1 text-[10px] text-muted-foreground">{event.locationName} · {new Date(event.occurredAt).toLocaleString('fa-IR')}</p></Link>)}</div>}</div></DialogContent></Dialog>
}

export function ComparisonLineChart({ points }: { points: ComparisonPoint[] }) {
  if (points.length < 2) return <EmptyAnalytics />
  const values = points.flatMap((point) => [point.current, point.previous]).filter((value): value is number => value !== null)
  if (!values.length) return <EmptyAnalytics />
  const max = Math.max(...values, 1)
  const line = (key: 'current' | 'previous') => points.map((point, index) => `${(index / (points.length - 1)) * 100},${94 - ((point[key] ?? 0) / max) * 86}`).join(' ')
  return <div><svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-44 w-full" role="img" aria-label="روند دوره جاری و دوره مقایسه">{[20, 40, 60, 80].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="currentColor" className="text-border" strokeWidth=".4" />)}<polyline points={line('current')} fill="none" stroke="var(--chart-1)" strokeWidth="2" vectorEffect="non-scaling-stroke" /><polyline points={line('previous')} fill="none" stroke="var(--chart-3)" strokeDasharray="4 3" strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg><div className="flex justify-center gap-5 text-[10px] text-muted-foreground"><span><i className="ml-1 inline-block size-2 rounded-full bg-[var(--chart-1)]" />دوره جاری</span><span><i className="ml-1 inline-block size-2 rounded-full bg-[var(--chart-3)]" />دوره مقایسه</span></div></div>
}

export function DayHourHeatmap({ cells }: { cells: ActivityCell[] }) {
  if (!cells.length) return <EmptyAnalytics />
  const lookup = new Map(cells.map((cell) => [`${cell.day}-${cell.hour}`, cell.value]))
  const max = Math.max(...cells.flatMap((cell) => cell.value === null ? [] : [cell.value]), 1)
  return <div className="overflow-x-auto"><div className="grid min-w-[650px] grid-cols-[42px_repeat(24,minmax(16px,1fr))] gap-1 text-[9px] text-muted-foreground"><span />{Array.from({ length: 24 }, (_, hour) => <span key={hour} className="text-center">{hour % 3 === 0 ? hour : ''}</span>)}{['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map((name, day) => <div className="contents" key={name}><span className="flex items-center">{name}</span>{Array.from({ length: 24 }, (_, hour) => { const value = lookup.get(`${day}-${hour}`); return <span key={hour} title={value == null ? 'بدون داده' : `${name}، ساعت ${hour}: ${value}`} className="aspect-square rounded-sm bg-primary" style={{ opacity: value == null ? .05 : .12 + (value / max) * .88 }} /> })}</div>)}</div></div>
}

export function HeatSurface({ points, difference = false }: { points: SpatialHeatPointV2[]; difference?: boolean }) {
  if (!points.length) return <EmptyAnalytics />
  return <div className="relative h-[430px] overflow-hidden rounded-xl border bg-[linear-gradient(90deg,var(--border)_1px,transparent_1px),linear-gradient(var(--border)_1px,transparent_1px)] bg-[size:40px_40px]">{points.map((point, index) => <span key={`${point.x}-${point.y}-${index}`} title={point.value.toLocaleString('fa-IR')} className={`absolute size-28 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl ${difference && point.value < 0 ? 'bg-blue-500' : point.intensity > .68 ? 'bg-red-500' : point.intensity > .35 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ left: `${point.x}%`, top: `${point.y}%`, opacity: .18 + Math.abs(point.intensity) * .6 }} />)}</div>
}


const TYPE_LABEL: Record<string, string> = { organization: 'سازمان', field: 'میدان', market: 'بازار', booth: 'غرفه' }
const CHILD_LABEL: Record<string, string> = { organization: 'میادین', field: 'بازارها', market: 'غرفه‌ها', booth: 'غرفه' }

export interface OccupancyHeatCell {
  locationId: string
  locationType: Exclude<ManagementLocationType, 'organization'>
  name: string
  parentName?: string
  occupancy: number | null
  coveragePercent?: number | null
}

export function childPlaceType(locationType: ManagementLocationType): Exclude<ManagementPlaceType, 'all'> {
  if (locationType === 'organization') return 'field'
  if (locationType === 'field') return 'market'
  return 'booth'
}

export function hierarchyChildren(hierarchy: LocationHierarchy | undefined, locationType: ManagementLocationType, locationId?: string): LocationOption[] {
  if (!hierarchy) return []
  if (locationType === 'organization') return hierarchy.fields
  if (locationType === 'field' && locationId) return hierarchy.markets.filter((item) => item.parentId === locationId)
  if (locationType === 'market' && locationId) return hierarchy.booths.filter((item) => item.parentId === locationId || item.marketId === locationId)
  if (locationType === 'booth' && locationId) return hierarchy.booths.filter((item) => item.id === locationId)
  return []
}

export function occupancyCellsFromHierarchy(
  hierarchy: LocationHierarchy | undefined,
  locationType: ManagementLocationType,
  locationId: string | undefined,
  flowLocations?: Array<{ locationId: string; value: number | null; coveragePercent: number | null }>,
): OccupancyHeatCell[] {
  const occupancyById = new Map((flowLocations ?? []).map((row) => [row.locationId, row]))
  return hierarchyChildren(hierarchy, locationType, locationId).flatMap((item) => {
    if (item.type === 'organization') return []
    const occupancy = occupancyById.get(item.id)
    return [{
      locationId: item.id,
      locationType: item.type,
      name: item.name,
      parentName: item.parentName,
      occupancy: occupancy?.value ?? null,
      coveragePercent: occupancy?.coveragePercent ?? null,
    }]
  })
}

export function occupancyBreadcrumb(hierarchy: LocationHierarchy | undefined, locationType: ManagementLocationType, locationId?: string) {
  if (!hierarchy) return [{ type: 'organization' as ManagementLocationType, id: undefined as string | undefined, name: 'کل سازمان' }]
  const crumbs: Array<{ type: ManagementLocationType; id?: string; name: string }> = [{ type: 'organization', name: hierarchy.organization.name }]
  if (locationType === 'organization' || !locationId) return crumbs
  const booth = hierarchy.booths.find((item) => item.id === locationId)
  const market = hierarchy.markets.find((item) => item.id === (locationType === 'market' ? locationId : booth?.parentId))
  const field = hierarchy.fields.find((item) => item.id === (locationType === 'field' ? locationId : market?.parentId ?? booth?.parentId))
  if (locationType === 'field') {
    const current = hierarchy.fields.find((item) => item.id === locationId)
    if (current) crumbs.push({ type: 'field', id: current.id, name: current.name })
    return crumbs
  }
  if (field) crumbs.push({ type: 'field', id: field.id, name: field.name })
  if (locationType === 'market') {
    const current = hierarchy.markets.find((item) => item.id === locationId)
    if (current) crumbs.push({ type: 'market', id: current.id, name: current.name })
    return crumbs
  }
  if (market) crumbs.push({ type: 'market', id: market.id, name: market.name })
  if (booth) crumbs.push({ type: 'booth', id: booth.id, name: booth.name })
  return crumbs
}

export function LocationOccupancyBreadcrumb({ hierarchy, locationType, locationId, onSelect, onShowChildren }: { hierarchy?: LocationHierarchy; locationType: ManagementLocationType; locationId?: string; onSelect: (type: ManagementLocationType, id?: string) => void; onShowChildren?: () => void }) {
  const crumbs = occupancyBreadcrumb(hierarchy, locationType, locationId)
  const childLabel = CHILD_LABEL[locationType] ?? 'زیرمجموعه‌ها'
  return (
    <nav aria-label="مسیر مکان" className="flex flex-wrap items-center gap-1 text-xs">
      {crumbs.map((crumb, index) => {
        const last = index === crumbs.length - 1
        return (
          <span key={`${crumb.type}:${crumb.id ?? 'root'}`} className="flex items-center gap-1">
            {index > 0 && <span className="text-muted-foreground">/</span>}
            {last ? (
              <span className="font-medium text-foreground">{crumb.name}</span>
            ) : (
              <button type="button" onClick={() => onSelect(crumb.type, crumb.id)} className="text-primary hover:underline">{crumb.name}</button>
            )}
          </span>
        )
      })}
      <button
        type="button"
        onClick={() => onShowChildren ? onShowChildren() : onSelect(locationType, locationId)}
        className="mr-2 rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/15"
      >
        نمایش {childLabel}
      </button>
    </nav>
  )
}

export function PlaceOccupancyHeatmap({ cells, onSelect, emptyLabel = 'برای این مکان زیرمجموعه‌ای تعریف نشده است.' }: { cells: OccupancyHeatCell[]; onSelect: (type: Exclude<ManagementLocationType, 'organization'>, id: string) => void; emptyLabel?: string }) {
  if (!cells.length) return <EmptyAnalytics label={emptyLabel} />
  const values = cells.map((cell) => cell.occupancy).filter((value): value is number => value !== null)
  const max = Math.max(...values, 1)
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
        {cells.map((cell) => {
          const occupancy = cell.occupancy
          const ratio = occupancy == null ? 0 : occupancy / max
          const hue = occupancy == null ? 0 : Math.round((1 - ratio) * 120)
          return (
            <button
              type="button"
              key={cell.locationId}
              onClick={() => onSelect(cell.locationType, cell.locationId)}
              className="flex min-h-[92px] flex-col justify-between rounded-lg border p-2.5 text-right shadow-sm transition hover:ring-2 hover:ring-primary/40"
              style={{ backgroundColor: occupancy == null ? undefined : `hsl(${hue} 72% 42% / ${0.18 + ratio * 0.55})` }}
            >
              <span className="text-[10px] text-muted-foreground">{TYPE_LABEL[cell.locationType]}{cell.parentName ? ` · ${cell.parentName}` : ''}</span>
              <span className="mt-1 line-clamp-2 text-sm font-semibold">{cell.name}</span>
              <span className="mt-2 text-lg font-bold tracking-tight">{occupancy == null ? 'بدون داده' : `${Math.round(occupancy).toLocaleString('fa-IR')} نفر`}</span>
            </button>
          )
        })}
      </div>
      <div className="flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
        <span>کم</span>
        <span className="h-2 w-28 rounded-full bg-[linear-gradient(to_left,#22c55e,#f59e0b,#ef4444)]" />
        <span>زیاد</span>
      </div>
    </div>
  )
}
