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

