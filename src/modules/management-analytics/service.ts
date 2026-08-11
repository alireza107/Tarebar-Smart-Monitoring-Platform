import type { Role } from '@/lib/permissions'
import { managementAnalyticsRepository } from './repository'
import { EMPTY_METRIC, type ManagementFilters, type ManagementOverview } from './types'

function emptyOverview(filters: ManagementFilters): ManagementOverview {
  return {
    generatedAt: new Date().toISOString(),
    dataStatus: 'unavailable',
    filters,
    kpis: {
      visitors: EMPTY_METRIC,
      entries: EMPTY_METRIC,
      peakOccupancy: EMPTY_METRIC,
      averageDwellMinutes: EMPTY_METRIC,
      averageWaitMinutes: EMPTY_METRIC,
      queueSlaPercent: EMPTY_METRIC,
    },
    trend: [],
    alerts: [],
    activityHeatmap: [],
    queue: {
      averageWaitMinutes: EMPTY_METRIC,
      slaPercent: EMPTY_METRIC,
      activeQueues: null,
      longestQueueLocation: null,
    },
    ranking: [],
    spatialHeatmap: [],
    importantChanges: [],
  }
}

function isOverview(value: unknown): value is ManagementOverview {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ManagementOverview>
  return typeof candidate.generatedAt === 'string' && !!candidate.kpis && Array.isArray(candidate.trend)
}

export const managementAnalyticsService = {
  getLocations: managementAnalyticsRepository.getLocationHierarchy,

  async getOverview(
    userId: string,
    role: Role,
    filters: ManagementFilters,
  ): Promise<ManagementOverview | null> {
    const allowed = await managementAnalyticsRepository.canAccessLocation(
      userId,
      role,
      filters.locationType,
      filters.locationId,
    )
    if (!allowed) return null

    const analyticsBase = process.env.VIDEO_ANALYTICS_API_URL?.replace(/\/+$/, '')
    if (!analyticsBase) return emptyOverview(filters)

    const query = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) query.set(key, String(value))
    })

    try {
      const response = await fetch(`${analyticsBase}/api/v1/management/overview?${query}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(5_000),
      })
      if (!response.ok) return emptyOverview(filters)
      const body: unknown = await response.json()
      const data = body && typeof body === 'object' && 'data' in body
        ? (body as { data: unknown }).data
        : body
      return isOverview(data) ? { ...data, filters } : emptyOverview(filters)
    } catch {
      return emptyOverview(filters)
    }
  },
}

