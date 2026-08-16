import type { Role } from '@/lib/permissions'
import { managementAnalyticsRepository } from './repository'
import {
  EMPTY_METRIC,
  type ManagementFilters,
  type PeopleFlowAnalytics,
  type QueueAnalytics,
  type SpatialAnalytics,
  type TimeBucket,
} from './types'

type ModuleFilters = ManagementFilters & { bucket: TimeBucket }
type ModuleName = 'people-flow' | 'queues' | 'spatial'

const quality = { coveragePercent: null, confidencePercent: null, contributingSources: 0, expectedSources: 0 }

function emptyPeopleFlow(filters: ModuleFilters): PeopleFlowAnalytics {
  return {
    generatedAt: new Date().toISOString(), dataStatus: 'unavailable', dataQuality: quality,
    filters, bucket: filters.bucket, uniqueVisitorsAggregation: 'not_available',
    kpis: { currentOccupancy: EMPTY_METRIC, averageOccupancy: EMPTY_METRIC, peakOccupancy: EMPTY_METRIC, entries: EMPTY_METRIC, exits: EMPTY_METRIC, uniqueVisitors: EMPTY_METRIC },
    trend: [], peakPeriods: [], activityHeatmap: [], locations: [], events: [],
  }
}

function emptyQueues(filters: ModuleFilters): QueueAnalytics {
  return {
    generatedAt: new Date().toISOString(), dataStatus: 'unavailable', dataQuality: quality,
    filters, bucket: filters.bucket, slaTargetMinutes: null,
    kpis: {
      currentLength: EMPTY_METRIC, averageLength: EMPTY_METRIC, maximumLength: EMPTY_METRIC,
      averageWaitMinutes: EMPTY_METRIC, p50WaitMinutes: EMPTY_METRIC, p90WaitMinutes: EMPTY_METRIC,
      p95WaitMinutes: EMPTY_METRIC, movementSpeedMetersPerMinute: EMPTY_METRIC,
      throughputPerHour: EMPTY_METRIC, slaPercent: EMPTY_METRIC,
      warningMinutes: EMPTY_METRIC, criticalMinutes: EMPTY_METRIC,
    },
    trend: [], locations: [], queues: [], events: [],
  }
}

function comparisonPeriod(filters: ManagementFilters) {
  if (filters.comparison === 'none') return null
  const from = new Date(`${filters.from}T00:00:00Z`)
  const to = new Date(`${filters.to}T00:00:00Z`)
  if (filters.comparison === 'previous_week') {
    from.setUTCDate(from.getUTCDate() - 7)
    to.setUTCDate(to.getUTCDate() - 7)
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
  }
  if (filters.comparison === 'previous_month') {
    from.setUTCMonth(from.getUTCMonth() - 1)
    to.setUTCMonth(to.getUTCMonth() - 1)
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
  }
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1
  const previousTo = new Date(from)
  previousTo.setUTCDate(previousTo.getUTCDate() - 1)
  const previousFrom = new Date(previousTo)
  previousFrom.setUTCDate(previousFrom.getUTCDate() - days + 1)
  return { from: previousFrom.toISOString().slice(0, 10), to: previousTo.toISOString().slice(0, 10) }
}

function emptySpatial(filters: ModuleFilters): SpatialAnalytics {
  return {
    generatedAt: new Date().toISOString(), dataStatus: 'unavailable', dataQuality: quality,
    filters, coordinateSystem: 'location_normalized_percent',
    periodA: { from: filters.from, to: filters.to }, periodB: comparisonPeriod(filters),
    layers: ['occupancy', 'dwell', 'traffic', 'congestion'].map((layer) => ({
      layer: layer as 'occupancy' | 'dwell' | 'traffic' | 'congestion',
      unit: layer === 'occupancy' ? 'people' : layer === 'dwell' ? 'minutes' : layer === 'traffic' ? 'movements' : 'percent',
      periodA: [], periodB: [], difference: [], timeline: [],
    })),
    zones: [], events: [],
  }
}

function isModuleResponse(module: ModuleName, value: unknown): value is PeopleFlowAnalytics | QueueAnalytics | SpatialAnalytics {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  if (typeof candidate.generatedAt !== 'string' || typeof candidate.dataStatus !== 'string') return false
  return module === 'spatial' ? Array.isArray(candidate.layers) : !!candidate.kpis && Array.isArray(candidate.trend)
}

async function fetchAggregates(module: ModuleName, filters: ModuleFilters) {
  const analyticsBase = process.env.VIDEO_ANALYTICS_API_URL?.replace(/\/+$/, '')
  if (!analyticsBase) return null
  const query = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => { if (value !== undefined) query.set(key, String(value)) })
  try {
    const analyticsKey = process.env.ANALYTICS_READ_KEY
    const response = await fetch(`${analyticsBase}/api/v1/management/${module}?${query}`, {
      cache: 'no-store', signal: AbortSignal.timeout(8_000),
      headers: analyticsKey ? { 'X-Analytics-Key': analyticsKey } : undefined,
    })
    if (!response.ok) return null
    const body: unknown = await response.json()
    const data = body && typeof body === 'object' && 'data' in body ? (body as { data: unknown }).data : body
    return isModuleResponse(module, data) ? data : null
  } catch {
    return null
  }
}

export const phase2AnalyticsService = {
  async get(userId: string, role: Role, module: ModuleName, filters: ModuleFilters) {
    const allowed = await managementAnalyticsRepository.canAccessLocation(userId, role, filters.locationType, filters.locationId)
    if (!allowed) return null
    const data = await fetchAggregates(module, filters)
    if (data) return { ...data, filters, bucket: filters.bucket }
    if (module === 'people-flow') return emptyPeopleFlow(filters)
    if (module === 'queues') return emptyQueues(filters)
    return emptySpatial(filters)
  },
}
