'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Footprints, Gauge, Hourglass, Pause, Play, UsersRound } from 'lucide-react'
import { GlobalFilterBar } from './global-filter-bar'
import { EmptyAnalytics, Panel } from './analytics-ui'
import { childPlaceType, DataQualityBanner, DrillableMetricCard, HeatSurface, LocationOccupancyBreadcrumb, MetricDrilldown, ModuleHeader, occupancyCellsFromHierarchy, PlaceOccupancyHeatmap, type DrilldownSelection } from './phase2-ui'
import { fetchManagementLocations, fetchPeopleFlow, fetchSpatialAnalytics } from '@/modules/management-analytics/client'
import type { LocationHierarchy, ManagementFilters, ManagementLocationType, MetricValue, PeopleFlowAnalytics, SpatialAnalytics, SpatialLayer, SpatialLayerData, TimeBucket } from '@/modules/management-analytics/types'
import { useManagementFilters } from '@/stores/management-filters'

const LAYERS: Array<{ key: SpatialLayer; label: string }> = [{ key: 'occupancy', label: 'اشغال' }, { key: 'dwell', label: 'ماندگاری' }, { key: 'traffic', label: 'حرکت' }, { key: 'congestion', label: 'ازدحام' }]
const VIEWS = [{ key: 'periodA', label: 'دوره A' }, { key: 'periodB', label: 'دوره B' }, { key: 'difference', label: 'اختلاف' }] as const
const MAP_TABS = [{ key: 'places', label: 'اشغال مکان‌ها' }, { key: 'behavior', label: 'نقشه رفتار مکانی' }] as const
type View = typeof VIEWS[number]['key']
type MapTab = typeof MAP_TABS[number]['key']

export function SpatialAnalyticsClient() {
  const [bucket, setBucket] = useState<TimeBucket>('hour')
  const [layer, setLayer] = useState<SpatialLayer>('occupancy')
  const [view, setView] = useState<View>('periodA')
  const [mapTab, setMapTab] = useState<MapTab>('places')
  const [frame, setFrame] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [selection, setSelection] = useState<DrilldownSelection | null>(null)
  const state = useManagementFilters()
  const filters = useMemo<ManagementFilters>(() => ({ locationType: state.locationType, locationId: state.locationId, placeType: state.placeType, from: state.from, to: state.to, comparison: state.comparison, timeFrom: state.timeFrom, timeTo: state.timeTo }), [state.locationType, state.locationId, state.placeType, state.from, state.to, state.comparison, state.timeFrom, state.timeTo])
  const occupancyFilters = useMemo<ManagementFilters>(() => ({ ...filters, placeType: childPlaceType(filters.locationType) }), [filters])
  const spatialQuery = useQuery({ queryKey: ['spatial-analytics', filters, bucket], queryFn: () => fetchSpatialAnalytics(filters, bucket), refetchInterval: 15_000 })
  const flowQuery = useQuery({ queryKey: ['people-flow', occupancyFilters, bucket], queryFn: () => fetchPeopleFlow(occupancyFilters, bucket), refetchInterval: 15_000 })
  const locationsQuery = useQuery({ queryKey: ['management-locations'], queryFn: fetchManagementLocations, staleTime: 5 * 60_000 })
  const dataLayer = spatialQuery.data?.layers.find((item) => item.layer === layer)
  usePlayer(playing, dataLayer, frame, setFrame, setPlaying)
  return (
    <div className="space-y-5">
      <ModuleHeader title="نقشه حرارتی و رفتار مکانی" description="با انتخاب هر مکان، اشغال زیرمجموعه‌های آن به‌صورت نقشه رنگی نمایش داده می‌شود" bucket={bucket} onBucketChange={(value) => { setBucket(value); setFrame(null) }} />
      <GlobalFilterBar onLocationChange={(type, id) => { state.setLocation(type, id); state.setPlaceType('all'); setMapTab('places') }} />
      <PlaceOccupancyPanel
        filters={filters}
        hierarchy={locationsQuery.data}
        flow={flowQuery.data}
        isLoading={locationsQuery.isLoading && !locationsQuery.data}
        isError={locationsQuery.isError}
        mapTab={mapTab}
        onMapTab={setMapTab}
        onSelectLocation={(type, id) => { state.setLocation(type, id); state.setPlaceType('all'); setMapTab('places') }}
        onShowChildren={() => { state.setPlaceType(childPlaceType(state.locationType)); setMapTab('places') }}
        spatial={spatialQuery.data}
        spatialLoading={spatialQuery.isLoading}
        spatialError={spatialQuery.isError}
        layer={layer}
        onLayer={setLayer}
        view={view}
        onView={setView}
        frame={frame}
        onFrame={setFrame}
        playing={playing}
        onPlaying={setPlaying}
        onSelect={setSelection}
      />
      {spatialQuery.data && <MetricDrilldown selection={selection} onOpenChange={(open) => { if (!open) setSelection(null) }} filters={filters} events={spatialQuery.data.events} />}
    </div>
  )
}

function PlaceOccupancyPanel({
  filters, hierarchy, flow, isLoading, isError, mapTab, onMapTab, onSelectLocation, onShowChildren, spatial, spatialLoading, spatialError, layer, onLayer, view, onView, frame, onFrame, playing, onPlaying, onSelect,
}: {
  filters: ManagementFilters
  hierarchy?: LocationHierarchy
  flow?: PeopleFlowAnalytics
  isLoading: boolean
  isError: boolean
  mapTab: MapTab
  onMapTab: (value: MapTab) => void
  onSelectLocation: (type: ManagementLocationType, id?: string) => void
  onShowChildren: () => void
  spatial?: SpatialAnalytics
  spatialLoading: boolean
  spatialError: boolean
  layer: SpatialLayer
  onLayer: (value: SpatialLayer) => void
  view: View
  onView: (value: View) => void
  frame: number | null
  onFrame: (value: number | null) => void
  playing: boolean
  onPlaying: (value: boolean) => void
  onSelect: (value: DrilldownSelection) => void
}) {
  const cells = occupancyCellsFromHierarchy(hierarchy, filters.locationType, filters.locationId, flow?.locations)
  const childHint = filters.locationType === 'organization' ? 'میادین' : filters.locationType === 'field' ? 'بازارها' : filters.locationType === 'market' ? 'غرفه‌ها' : 'غرفه انتخاب‌شده'
  return (
    <>
      {spatial ? <DataQualityBanner status={spatial.dataStatus} quality={spatial.dataQuality} /> : null}
      {spatial ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{spatialMetrics(spatial).map((item) => <DrillableMetricCard key={item.key} title={item.title} icon={item.icon} metric={item.metric} suffix={item.suffix} onClick={() => onSelect(item.selection)} />)}</div> : null}
      <Panel
        title="نقشه اشغال مکان‌ها"
        description={`با کلیک روی هر کاشی، ${childHint} سطح پایین‌تر با رنگ و عدد اشغال نمایش داده می‌شود`}
        action={(
          <div className="flex gap-1 rounded-lg border p-1">
            {MAP_TABS.map((item) => (
              <button type="button" key={item.key} onClick={() => onMapTab(item.key)} className={`rounded-md px-3 py-1.5 text-[11px] ${mapTab === item.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>{item.label}</button>
            ))}
          </div>
        )}
      >
        <div className="mb-4">
          <LocationOccupancyBreadcrumb hierarchy={hierarchy} locationType={filters.locationType} locationId={filters.locationId} onSelect={onSelectLocation} onShowChildren={onShowChildren} />
        </div>
        {mapTab === 'places' ? (
          isLoading ? <div className="h-64 animate-pulse rounded-xl bg-muted" /> : isError ? <EmptyAnalytics label="دریافت ساختار مکان‌ها با خطا روبه‌رو شد." /> : (
            <PlaceOccupancyHeatmap
              cells={cells}
              onSelect={(type, id) => onSelectLocation(type, id)}
              emptyLabel="برای این مکان هنوز بازار، غرفه یا زیرمجموعه‌ای تعریف نشده است."
            />
          )
        ) : spatialLoading ? <Loading /> : spatialError || !spatial ? <EmptyAnalytics label="دریافت داده مکانی با خطا روبه‌رو شد." /> : (
          <BehaviorMap data={spatial} layer={layer} onLayer={onLayer} view={view} onView={onView} frame={frame} onFrame={onFrame} playing={playing} onPlaying={onPlaying} />
        )}
      </Panel>
      {spatial ? <Panel title="ماندگاری و رفتار بر اساس ناحیه/مکان" description="ناحیه برای تحلیل مکانی نمایش داده می‌شود؛ سطح کسب‌وکاری همچنان میدان، بازار یا غرفه است"><ZoneTable data={spatial} /></Panel> : null}
    </>
  )
}

function BehaviorMap({ data, layer, onLayer, view, onView, frame, onFrame, playing, onPlaying }: { data: SpatialAnalytics; layer: SpatialLayer; onLayer: (value: SpatialLayer) => void; view: View; onView: (value: View) => void; frame: number | null; onFrame: (value: number | null) => void; playing: boolean; onPlaying: (value: boolean) => void }) {
  const active = data.layers.find((item) => item.layer === layer) ?? data.layers[0]
  const points = frame === null ? (active?.[view] ?? []) : (active?.timeline[frame]?.points ?? [])
  const frameLabel = frame === null ? 'تجمیع کل بازه' : new Date(active?.timeline[frame]?.timestamp ?? '').toLocaleString('fa-IR')
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg border p-1">{LAYERS.map((item) => <button type="button" key={item.key} onClick={() => { onLayer(item.key); onFrame(null) }} className={`rounded-md px-3 py-1.5 text-[11px] ${layer === item.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>{item.label}</button>)}</div>
        <div className="flex gap-1 rounded-lg border p-1">{VIEWS.map((item) => <button type="button" disabled={item.key !== 'periodA' && !data.periodB} key={item.key} onClick={() => { onView(item.key); onFrame(null) }} className={`rounded-md px-3 py-1.5 text-[11px] disabled:opacity-40 ${view === item.key ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground'}`}>{item.label}</button>)}</div>
      </div>
      <p className="mb-2 text-[10px] text-muted-foreground">{frameLabel}</p>
      <HeatSurface points={points} difference={view === 'difference'} />
      <TimePlayer layer={active} frame={frame} onFrame={onFrame} playing={playing} onPlaying={onPlaying} />
    </>
  )
}

function spatialMetrics(data: SpatialAnalytics) {
  const average = (values: Array<number | null>) => { const valid = values.filter((value): value is number => value !== null); return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null }
  const definitions = [
    { key: 'occupancy', title: 'میانگین اشغال', icon: UsersRound, suffix: ' نفر', value: average(data.zones.map((zone) => zone.occupancy)) },
    { key: 'dwell', title: 'میانگین ماندگاری', icon: Hourglass, suffix: ' دقیقه', value: average(data.zones.map((zone) => zone.averageDwellMinutes)) },
    { key: 'traffic', title: 'میانگین حرکت', icon: Footprints, suffix: '', value: average(data.zones.map((zone) => zone.traffic)) },
    { key: 'congestion', title: 'میانگین ازدحام', icon: Gauge, suffix: '٪', value: average(data.zones.map((zone) => zone.congestionPercent)) },
  ] as const
  return definitions.map((definition) => {
    const metric: MetricValue = { value: definition.value, changePercent: average(data.zones.map((zone) => zone.changePercent)) }
    const activeLayer = data.layers.find((item) => item.layer === definition.key)
    const trend = activeLayer?.timeline.map((item) => ({ timestamp: item.timestamp, current: item.points.length ? item.points.reduce((sum, point) => sum + point.value, 0) / item.points.length : null, previous: null })) ?? []
    const locations = data.zones.map((zone) => ({ locationId: zone.locationId, locationType: zone.locationType, name: `${zone.zoneName} · ${zone.locationName}`, value: definition.key === 'occupancy' ? zone.occupancy : definition.key === 'dwell' ? zone.averageDwellMinutes : definition.key === 'traffic' ? zone.traffic : zone.congestionPercent, previousValue: null, changePercent: zone.changePercent, coveragePercent: zone.coveragePercent }))
    return { ...definition, metric, selection: { key: definition.key, title: definition.title, metric, suffix: definition.suffix, trend, locations } }
  })
}

function TimePlayer({ layer, frame, onFrame, playing, onPlaying }: { layer: SpatialLayerData | undefined; frame: number | null; onFrame: (value: number | null) => void; playing: boolean; onPlaying: (value: boolean) => void }) {
  const count = layer?.timeline.length ?? 0
  return <div className="mt-4 flex items-center gap-3 rounded-lg border bg-muted/20 p-3"><button type="button" disabled={!count} onClick={() => { if (frame === null) onFrame(0); onPlaying(!playing) }} className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40">{playing ? <Pause className="size-4" /> : <Play className="size-4" />}</button><input aria-label="زمان تاریخی" type="range" min="0" max={Math.max(0, count - 1)} value={frame ?? 0} disabled={!count} onChange={(event) => { onPlaying(false); onFrame(Number(event.target.value)) }} className="flex-1 accent-primary" /><button type="button" onClick={() => { onPlaying(false); onFrame(null) }} className="text-[11px] text-primary disabled:opacity-40" disabled={frame === null}>کل بازه</button></div>
}

function usePlayer(playing: boolean, layer: SpatialLayerData | undefined, frame: number | null, setFrame: (value: number | null) => void, setPlaying: (value: boolean) => void) {
  const count = layer?.timeline.length ?? 0
  useEffect(() => {
    if (!playing || count === 0) return
    const timer = window.setTimeout(() => {
      const next = (frame ?? -1) + 1
      if (next >= count) { setFrame(count - 1); setPlaying(false) } else setFrame(next)
    }, 900)
    return () => window.clearTimeout(timer)
  }, [playing, count, frame, setFrame, setPlaying])
}

function ZoneTable({ data }: { data: SpatialAnalytics }) {
  if (!data.zones.length) return <EmptyAnalytics />
  return <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-xs"><thead><tr className="border-b text-muted-foreground"><th className="p-2 text-right">ناحیه / مکان</th><th>ماندگاری متوسط</th><th>P90 ماندگاری</th><th>اشغال</th><th>حرکت</th><th>ازدحام</th><th>تغییر</th><th>پوشش</th><th /></tr></thead><tbody className="divide-y">{data.zones.map((zone) => <tr key={zone.zoneId}><td className="p-2.5 font-medium">{zone.zoneName}<small className="mr-1 text-muted-foreground">{zone.locationName}</small></td><td className="text-center">{zone.averageDwellMinutes?.toLocaleString('fa-IR') ?? '—'}</td><td className="text-center">{zone.p90DwellMinutes?.toLocaleString('fa-IR') ?? '—'}</td><td className="text-center">{zone.occupancy?.toLocaleString('fa-IR') ?? '—'}</td><td className="text-center">{zone.traffic?.toLocaleString('fa-IR') ?? '—'}</td><td className="text-center">{zone.congestionPercent === null ? '—' : `${zone.congestionPercent.toLocaleString('fa-IR')}٪`}</td><td className="text-center">{zone.changePercent === null ? '—' : `${zone.changePercent.toLocaleString('fa-IR')}٪`}</td><td className="text-center">{zone.coveragePercent === null ? '—' : `${zone.coveragePercent.toLocaleString('fa-IR')}٪`}</td><td><Link href={`/locations/${zone.locationType}/${zone.locationId}`} className="text-primary">مکان</Link></td></tr>)}</tbody></table></div>
}

function Loading() { return <div className="space-y-4 animate-pulse"><div className="grid gap-3 sm:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-32 rounded-xl bg-muted" />)}</div><div className="h-[320px] rounded-xl bg-muted" /></div> }
