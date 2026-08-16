export type ManagementLocationType = 'organization' | 'field' | 'market' | 'booth'
export type ManagementPlaceType = 'all' | 'field' | 'market' | 'booth'

export interface ManagementFilters {
  locationType: ManagementLocationType
  locationId?: string
  placeType: ManagementPlaceType
  from: string
  to: string
  comparison: 'previous_period' | 'previous_week' | 'previous_month' | 'none'
  timeFrom?: string
  timeTo?: string
}

export interface LocationOption {
  id: string
  name: string
  type: ManagementLocationType
  parentId: string | null
  parentName?: string
  marketId?: string
  cameraCount: number
  zoneCount: number
}

export interface LocationHierarchy {
  organization: LocationOption
  fields: LocationOption[]
  markets: LocationOption[]
  booths: LocationOption[]
}

export interface MetricValue {
  value: number | null
  changePercent: number | null
}

export interface TrendPoint {
  timestamp: string
  traffic: number | null
  occupancy: number | null
}

export interface ActivityCell {
  day: number
  hour: number
  value: number | null
}

export interface ManagementAlert {
  id: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  locationName: string
  occurredAt: string
}

export interface LocationRankingRow {
  locationId: string
  locationType: Exclude<ManagementLocationType, 'organization'>
  name: string
  parentName?: string
  traffic: number | null
  occupancy: number | null
  queueScore: number | null
}

export interface SpatialHeatPoint {
  x: number
  y: number
  intensity: number
}

export interface QueueSummary {
  averageWaitMinutes: MetricValue
  slaPercent: MetricValue
  activeQueues: number | null
  longestQueueLocation: string | null
}

export interface ManagementOverview {
  generatedAt: string
  dataStatus: 'live' | 'partial' | 'unavailable'
  filters: ManagementFilters
  kpis: {
    visitors: MetricValue
    entries: MetricValue
    peakOccupancy: MetricValue
    averageDwellMinutes: MetricValue
    averageWaitMinutes: MetricValue
    queueSlaPercent: MetricValue
  }
  trend: TrendPoint[]
  alerts: ManagementAlert[]
  activityHeatmap: ActivityCell[]
  queue: QueueSummary
  ranking: LocationRankingRow[]
  spatialHeatmap: SpatialHeatPoint[]
  importantChanges: string[]
}

export const EMPTY_METRIC: MetricValue = { value: null, changePercent: null }

export type DataStatus = 'live' | 'partial' | 'unavailable'
export type TimeBucket = 'hour' | 'day'

export interface DataQuality {
  coveragePercent: number | null
  confidencePercent: number | null
  contributingSources: number
  expectedSources: number
  calibratedSources?: number
  note?: string
}

export interface AnalyticsEvent {
  id: string
  title: string
  severity: 'critical' | 'warning' | 'info'
  locationId: string
  locationType: Exclude<ManagementLocationType, 'organization'>
  locationName: string
  occurredAt: string
  metricKey?: string
  value?: number
}

export interface ComparisonPoint {
  timestamp: string
  current: number | null
  previous: number | null
}

export interface MetricLocationRow {
  locationId: string
  locationType: Exclude<ManagementLocationType, 'organization'>
  name: string
  parentName?: string
  value: number | null
  previousValue: number | null
  changePercent: number | null
  coveragePercent: number | null
}

export interface PeakPeriod {
  from: string
  to: string
  value: number
  label: string
}

export interface TrafficTrendPoint {
  timestamp: string
  occupancy: number | null
  entries: number | null
  exits: number | null
  uniqueVisitors: number | null
  previousOccupancy: number | null
}

export interface PeopleFlowAnalytics {
  generatedAt: string
  dataStatus: DataStatus
  dataQuality: DataQuality
  filters: ManagementFilters
  bucket: TimeBucket
  uniqueVisitorsAggregation: 'location_period' | 'not_available'
  kpis: {
    currentOccupancy: MetricValue
    averageOccupancy: MetricValue
    peakOccupancy: MetricValue
    entries: MetricValue
    exits: MetricValue
    uniqueVisitors: MetricValue
  }
  trend: TrafficTrendPoint[]
  peakPeriods: PeakPeriod[]
  activityHeatmap: ActivityCell[]
  locations: Array<MetricLocationRow & {
    currentOccupancy: number | null
    entries: number | null
    exits: number | null
    uniqueVisitors: number | null
  }>
  events: AnalyticsEvent[]
}

export interface QueueTrendPoint {
  timestamp: string
  averageLength: number | null
  averageWaitMinutes: number | null
  throughput: number | null
  slaPercent: number | null
  previousWaitMinutes: number | null
}

export interface QueueLocationRow extends MetricLocationRow {
  currentLength: number | null
  averageWaitMinutes: number | null
  p95WaitMinutes: number | null
  throughput: number | null
  slaPercent: number | null
  warningMinutes: number | null
  criticalMinutes: number | null
}

export interface QueueDetail {
  id: string
  name: string
  locationId: string
  locationType: Exclude<ManagementLocationType, 'organization'>
  locationName: string
  currentLength: number | null
  averageLength: number | null
  maximumLength: number | null
  averageWaitMinutes: number | null
  p50WaitMinutes: number | null
  p90WaitMinutes: number | null
  p95WaitMinutes: number | null
  movementSpeedMetersPerMinute: number | null
  isPhysicallyCalibrated: boolean
  throughputPerHour: number | null
  slaPercent: number | null
  warningMinutes: number | null
  criticalMinutes: number | null
  coveragePercent: number | null
}

export interface QueueAnalytics {
  generatedAt: string
  dataStatus: DataStatus
  dataQuality: DataQuality
  filters: ManagementFilters
  bucket: TimeBucket
  slaTargetMinutes: number | null
  kpis: {
    currentLength: MetricValue
    averageLength: MetricValue
    maximumLength: MetricValue
    averageWaitMinutes: MetricValue
    p50WaitMinutes: MetricValue
    p90WaitMinutes: MetricValue
    p95WaitMinutes: MetricValue
    movementSpeedMetersPerMinute: MetricValue
    throughputPerHour: MetricValue
    slaPercent: MetricValue
    warningMinutes: MetricValue
    criticalMinutes: MetricValue
  }
  trend: QueueTrendPoint[]
  locations: QueueLocationRow[]
  queues: QueueDetail[]
  events: AnalyticsEvent[]
}

export type SpatialLayer = 'occupancy' | 'dwell' | 'traffic' | 'congestion'

export interface SpatialHeatPointV2 {
  x: number
  y: number
  value: number
  intensity: number
  zoneId?: string
}

export interface SpatialFrame {
  timestamp: string
  points: SpatialHeatPointV2[]
}

export interface SpatialLayerData {
  layer: SpatialLayer
  unit: 'people' | 'minutes' | 'movements' | 'percent'
  periodA: SpatialHeatPointV2[]
  periodB: SpatialHeatPointV2[]
  difference: SpatialHeatPointV2[]
  timeline: SpatialFrame[]
}

export interface SpatialZoneMetric {
  zoneId: string
  zoneName: string
  locationId: string
  locationType: Exclude<ManagementLocationType, 'organization'>
  locationName: string
  averageDwellMinutes: number | null
  p90DwellMinutes: number | null
  occupancy: number | null
  traffic: number | null
  congestionPercent: number | null
  changePercent: number | null
  coveragePercent: number | null
}

export interface SpatialAnalytics {
  generatedAt: string
  dataStatus: DataStatus
  dataQuality: DataQuality
  filters: ManagementFilters
  coordinateSystem: 'location_normalized_percent'
  periodA: { from: string; to: string }
  periodB: { from: string; to: string } | null
  layers: SpatialLayerData[]
  zones: SpatialZoneMetric[]
  events: AnalyticsEvent[]
}
