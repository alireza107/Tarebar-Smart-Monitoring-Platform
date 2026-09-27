import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { businessDate, businessRangeToUtc, comparisonRange, daysBetween } from '@/lib/dates'
import type { Role } from '@/lib/permissions'
import { getUserScopeIds } from '@/lib/scope-guard'
import type { RecordWhere } from '@/modules/analysis-records/repository'
import { DEFECT_LABELS_FA, type DefectType, type QualityDetails } from '@/modules/analysis-records/types'
import { phase2AnalyticsService } from '@/modules/management-analytics/phase2-service'
import { managementAnalyticsRepository } from '@/modules/management-analytics/repository'
import { boothLabel } from '@/lib/persian'
import { managementAnalyticsService } from '@/modules/management-analytics/service'
import {
  EMPTY_METRIC,
  type ActivityCell,
  type ManagementFilters,
  type ManagementLocationType,
  type MetricValue,
  type PeopleFlowAnalytics,
  type QueueAnalytics,
} from '@/modules/management-analytics/types'
import { buildHighlights, buildRecommendations, buildScorecard } from './insights'
import type { ChildRow, DailyPoint, ExecutiveReport, InsightInput } from './types'

type ChildType = ChildRow['type']
type Location = { locationType: ManagementLocationType; locationId?: string }

const CHILD_TYPE: Record<ManagementLocationType, ChildType | null> = {
  organization: 'field',
  field: 'market',
  market: 'booth',
  booth: null,
}

const round = (value: number, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits

function changePercent(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null
  return round(((current - previous) / previous) * 100)
}

function metric(current: number | null, previous: number | null, digits = 1): MetricValue {
  return { value: current === null ? null : round(current, digits), changePercent: changePercent(current, previous) }
}

/** Rows of the analysis tables that belong to a location (the report is location-based, not author-based). */
async function locationWhere(userId: string, role: Role, location: Location): Promise<RecordWhere> {
  if (location.locationType === 'field') return { fieldId: location.locationId }
  if (location.locationType === 'market') return { marketId: location.locationId }
  if (location.locationType === 'booth') return { boothId: location.locationId }
  if (role === 'ORG_ADMIN') return {}
  const scope = await getUserScopeIds(userId)
  return role === 'FIELD_MANAGER' ? { fieldId: { in: scope.fieldIds } } : { marketId: { in: scope.marketIds } }
}

function cameraWhere(location: Location): Prisma.CameraWhereInput {
  const id = location.locationId
  if (location.locationType === 'field') {
    return { deletedAt: null, OR: [{ fieldId: id }, { market: { fieldId: id } }, { booth: { market: { fieldId: id } } }] }
  }
  if (location.locationType === 'market') {
    return { deletedAt: null, OR: [{ marketId: id }, { booth: { marketId: id } }] }
  }
  if (location.locationType === 'booth') return { deletedAt: null, boothId: id }
  return { deletedAt: null }
}

type ManagerScope = { fieldIds?: string[]; marketIds?: string[] }

function scopedCameraWhere(scope: ManagerScope): Prisma.CameraWhereInput {
  if (scope.fieldIds) {
    const ids = scope.fieldIds
    return { deletedAt: null, OR: [{ fieldId: { in: ids } }, { market: { fieldId: { in: ids } } }, { booth: { market: { fieldId: { in: ids } } } }] }
  }
  const ids = scope.marketIds ?? []
  return { deletedAt: null, OR: [{ marketId: { in: ids } }, { booth: { marketId: { in: ids } } }] }
}

async function describe(location: Location): Promise<{ name: string; parentName: string | null }> {
  const id = location.locationId
  if (location.locationType === 'field') {
    const field = await db.field.findFirst({ where: { id }, select: { name: true } })
    return { name: field?.name ?? 'میدان', parentName: null }
  }
  if (location.locationType === 'market') {
    const market = await db.market.findFirst({ where: { id }, select: { name: true, field: { select: { name: true } } } })
    return { name: market?.name ?? 'بازار', parentName: market?.field.name ?? null }
  }
  if (location.locationType === 'booth') {
    const booth = await db.booth.findFirst({ where: { id }, select: { number: true, market: { select: { name: true } } } })
    return { name: booth ? boothLabel(booth.number) : 'غرفه', parentName: booth?.market.name ?? null }
  }
  return { name: 'کل سازمان', parentName: null }
}

function inRange(where: RecordWhere, from: string, to: string): RecordWhere {
  const { start, end } = businessRangeToUtc(from, to)
  return { AND: [where, { createdAt: { gte: start, lt: end } }] }
}

function dailySeries(rows: Array<{ createdAt: Date; value: number | null }>): DailyPoint[] {
  const buckets = new Map<string, { sum: number; count: number }>()
  for (const row of rows) {
    if (row.value === null) continue
    const key = businessDate(row.createdAt)
    const bucket = buckets.get(key) ?? { sum: 0, count: 0 }
    bucket.sum += row.value
    bucket.count += 1
    buckets.set(key, bucket)
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, bucket]) => ({ date, value: round(bucket.sum / bucket.count), count: bucket.count }))
}

function busiest(cells: ActivityCell[], key: 'hour' | 'day', take: number) {
  const totals = new Map<number, { sum: number; count: number }>()
  for (const cell of cells) {
    if (cell.value === null) continue
    const bucket = totals.get(cell[key]) ?? { sum: 0, count: 0 }
    bucket.sum += cell.value
    bucket.count += 1
    totals.set(cell[key], bucket)
  }
  return [...totals.entries()]
    .map(([index, bucket]) => ({ index, value: round(bucket.sum / bucket.count) }))
    .filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, take)
}

async function qualitySection(where: RecordWhere, from: string, to: string, previous: { from: string; to: string } | null) {
  const current = inRange(where, from, to)
  const withFruit: RecordWhere = { AND: [current] }
  const [aggregate, labels, grades, scored, detailRows, lowest, previousAggregate] = await Promise.all([
    db.fruitQualityAssessment.aggregate({
      where: { ...withFruit, hasFruit: true },
      _avg: { freshnessScore: true, freshPercent: true, middlePercent: true, rottenPercent: true },
      _count: { _all: true },
    }),
    db.fruitQualityAssessment.groupBy({ by: ['label'], where: current, _count: { _all: true } }),
    db.fruitQualityAssessment.groupBy({ by: ['grade'], where: { ...withFruit, hasFruit: true }, _count: { _all: true } }),
    db.fruitQualityAssessment.findMany({
      where: { ...withFruit, hasFruit: true },
      select: { createdAt: true, freshnessScore: true },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    }),
    db.fruitQualityAssessment.findMany({
      where: current,
      select: { details: true },
      orderBy: { createdAt: 'desc' },
      take: 300,
    }),
    db.fruitQualityAssessment.findMany({
      where: { ...withFruit, hasFruit: true },
      select: {
        id: true, createdAt: true, label: true, freshnessScore: true,
        camera: { select: { name: true } }, market: { select: { name: true } }, booth: { select: { number: true } },
      },
      orderBy: [{ freshnessScore: 'asc' }, { createdAt: 'desc' }],
      take: 5,
    }),
    previous
      ? db.fruitQualityAssessment.aggregate({
          where: { AND: [inRange(where, previous.from, previous.to)], hasFruit: true },
          _avg: { freshnessScore: true },
          _count: { _all: true },
        })
      : null,
  ])

  const total = await db.fruitQualityAssessment.count({ where: current })
  const defects = new Map<string, number>()
  for (const row of detailRows) {
    const details = row.details as unknown as QualityDetails | null
    // One assessment counts a defect type once, however many times the model listed it.
    for (const type of new Set((details?.defects ?? []).map(item => item.type))) {
      defects.set(type, (defects.get(type) ?? 0) + 1)
    }
  }

  return {
    assessments: total,
    previousAssessments: previousAggregate?._count._all ?? 0,
    averageScore: metric(aggregate._avg.freshnessScore, previousAggregate?._avg.freshnessScore ?? null),
    averageDistribution:
      aggregate._count._all > 0
        ? {
            fresh: round(aggregate._avg.freshPercent ?? 0),
            middle: round(aggregate._avg.middlePercent ?? 0),
            rotten: round(aggregate._avg.rottenPercent ?? 0),
          }
        : null,
    labels: labels.map(item => ({ label: item.label, count: item._count._all })).sort((a, b) => b.count - a.count),
    grades: grades
      .filter(item => item.grade)
      .map(item => ({ grade: item.grade!, count: item._count._all }))
      .sort((a, b) => a.grade.localeCompare(b.grade)),
    topDefects: [...defects.entries()]
      .map(([type, count]) => ({ type, label: DEFECT_LABELS_FA[type as DefectType] ?? type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    daily: dailySeries(scored.map(row => ({ createdAt: row.createdAt, value: row.freshnessScore }))),
    lowest: lowest.map(row => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      locationName: row.booth ? boothLabel(row.booth.number) : row.market?.name ?? row.camera?.name ?? '—',
      label: row.label,
      score: row.freshnessScore,
    })),
  }
}

async function safetySection(where: RecordWhere, from: string, to: string, previous: { from: string; to: string } | null) {
  const current = inRange(where, from, to)
  const attention: RecordWhere = { AND: [current] }
  const [checks, fights, dirty, recent, previousFights, previousDirty] = await Promise.all([
    db.incidentCheck.count({ where: current }),
    db.incidentCheck.count({ where: { ...attention, fighting: true } }),
    db.incidentCheck.count({ where: { ...attention, floorClean: false } }),
    db.incidentCheck.findMany({
      where: { ...attention, OR: [{ fighting: true }, { floorClean: false }] },
      select: {
        id: true, createdAt: true, fighting: true, floorClean: true, thumbnail: true,
        camera: { select: { name: true } }, market: { select: { name: true } }, booth: { select: { number: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
    previous ? db.incidentCheck.count({ where: { AND: [inRange(where, previous.from, previous.to)], fighting: true } }) : 0,
    previous ? db.incidentCheck.count({ where: { AND: [inRange(where, previous.from, previous.to)], floorClean: false } }) : 0,
  ])
  return {
    checks,
    fights,
    cleanlinessAlerts: dirty,
    previousFights,
    previousCleanlinessAlerts: previousDirty,
    recent: recent.map(row => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      cameraName: row.camera?.name ?? null,
      locationName: row.booth ? boothLabel(row.booth.number) : row.market?.name ?? '—',
      fighting: row.fighting,
      floorClean: row.floorClean,
      thumbnail: row.thumbnail,
    })),
  }
}

async function measurementSection(where: RecordWhere, from: string, to: string, previous: { from: string; to: string } | null) {
  const current = inRange(where, from, to)
  const [aggregate, rows, previousAggregate] = await Promise.all([
    db.fruitMeasurementRun.aggregate({ where: current, _avg: { avgDiameterMm: true, lastFruitCount: true }, _count: { _all: true } }),
    db.fruitMeasurementRun.findMany({ where: current, select: { createdAt: true, avgDiameterMm: true }, orderBy: { createdAt: 'desc' }, take: 2000 }),
    previous ? db.fruitMeasurementRun.aggregate({ where: inRange(where, previous.from, previous.to), _avg: { avgDiameterMm: true } }) : null,
  ])
  return {
    runs: aggregate._count._all,
    averageDiameterMm: metric(aggregate._avg.avgDiameterMm, previousAggregate?._avg.avgDiameterMm ?? null),
    averageFruitCount: aggregate._avg.lastFruitCount === null ? null : round(aggregate._avg.lastFruitCount, 0),
    daily: dailySeries(rows.map(row => ({ createdAt: row.createdAt, value: row.avgDiameterMm }))),
  }
}

/** Children of the reported location with whatever numbers exist for each of them. */
async function childRows(
  location: Location,
  where: RecordWhere,
  from: string,
  to: string,
  flow: PeopleFlowAnalytics | null,
  queues: QueueAnalytics | null,
  scope: ManagerScope,
): Promise<{ type: ChildType | null; rows: ChildRow[] }> {
  const type = CHILD_TYPE[location.locationType]
  if (!type) return { type: null, rows: [] }
  const current = inRange(where, from, to)
  const attention = { AND: [current], OR: [{ fighting: true }, { floorClean: false }] }

  let children: Array<{ id: string; name: string }> = []
  let quality: Array<{ id: string | null; score: number | null; count: number }> = []
  let incidents: Array<{ id: string | null; count: number }> = []

  if (type === 'field') {
    const fields = await db.field.findMany({
      where: { deletedAt: null, ...(scope.fieldIds ? { id: { in: scope.fieldIds } } : {}) },
      select: { id: true, name: true }, orderBy: { name: 'asc' }, take: 200,
    })
    children = fields
    const [q, i] = await Promise.all([
      db.fruitQualityAssessment.groupBy({ by: ['fieldId'], where: { AND: [current], hasFruit: true }, _avg: { freshnessScore: true }, _count: { _all: true } }),
      db.incidentCheck.groupBy({ by: ['fieldId'], where: attention, _count: { _all: true } }),
    ])
    quality = q.map(row => ({ id: row.fieldId, score: row._avg.freshnessScore, count: row._count._all }))
    incidents = i.map(row => ({ id: row.fieldId, count: row._count._all }))
  } else if (type === 'market') {
    const markets = await db.market.findMany({
      where: { deletedAt: null, fieldId: location.locationId }, select: { id: true, name: true }, orderBy: { name: 'asc' }, take: 200,
    })
    children = markets
    const [q, i] = await Promise.all([
      db.fruitQualityAssessment.groupBy({ by: ['marketId'], where: { AND: [current], hasFruit: true }, _avg: { freshnessScore: true }, _count: { _all: true } }),
      db.incidentCheck.groupBy({ by: ['marketId'], where: attention, _count: { _all: true } }),
    ])
    quality = q.map(row => ({ id: row.marketId, score: row._avg.freshnessScore, count: row._count._all }))
    incidents = i.map(row => ({ id: row.marketId, count: row._count._all }))
  } else {
    const booths = await db.booth.findMany({
      where: { deletedAt: null, marketId: location.locationId }, select: { id: true, number: true }, orderBy: { number: 'asc' }, take: 300,
    })
    children = booths.map(booth => ({ id: booth.id, name: boothLabel(booth.number) }))
    const [q, i] = await Promise.all([
      db.fruitQualityAssessment.groupBy({ by: ['boothId'], where: { AND: [current], hasFruit: true }, _avg: { freshnessScore: true }, _count: { _all: true } }),
      db.incidentCheck.groupBy({ by: ['boothId'], where: attention, _count: { _all: true } }),
    ])
    quality = q.map(row => ({ id: row.boothId, score: row._avg.freshnessScore, count: row._count._all }))
    incidents = i.map(row => ({ id: row.boothId, count: row._count._all }))
  }

  const flowById = new Map((flow?.locations ?? []).filter(row => row.locationType === type).map(row => [row.locationId, row]))
  const queueById = new Map((queues?.locations ?? []).filter(row => row.locationType === type).map(row => [row.locationId, row]))
  const qualityById = new Map(quality.map(row => [row.id, row]))
  const incidentsById = new Map(incidents.map(row => [row.id, row.count]))

  const rows = children.map<ChildRow>(child => ({
    id: child.id,
    type,
    name: child.name,
    occupancy: flowById.get(child.id)?.value ?? null,
    averageWaitMinutes: queueById.get(child.id)?.averageWaitMinutes ?? null,
    slaPercent: queueById.get(child.id)?.slaPercent ?? null,
    qualityScore: qualityById.get(child.id)?.score == null ? null : round(qualityById.get(child.id)!.score!),
    assessments: qualityById.get(child.id)?.count ?? 0,
    incidents: incidentsById.get(child.id) ?? 0,
  }))
  // Children with data first, best quality on top; a long tail of empty rows is noise on paper.
  const hasData = (row: ChildRow) => row.occupancy !== null || row.qualityScore !== null || row.incidents > 0 || row.averageWaitMinutes !== null
  const withData = rows.filter(hasData).sort((a, b) => (b.qualityScore ?? -1) - (a.qualityScore ?? -1) || (b.occupancy ?? -1) - (a.occupancy ?? -1))
  return { type, rows: [...withData, ...rows.filter(row => !hasData(row)).slice(0, Math.max(0, 25 - withData.length))] }
}

export const executiveReportService = {
  /** Null when the location is outside the caller's scope. */
  async build(
    user: { id: string; role: Role; name?: string | null },
    filters: ManagementFilters,
  ): Promise<ExecutiveReport | null> {
    const location = await managementAnalyticsRepository.narrowToScope(user.id, user.role, filters.locationType, filters.locationId)
    if (!location) return null

    const effective: ManagementFilters = { ...filters, ...location, placeType: 'all' }
    const previous = comparisonRange(filters.from, filters.to, filters.comparison)
    const where = await locationWhere(user.id, user.role, location)
    const scopeIds = user.role === 'ORG_ADMIN' ? null : await getUserScopeIds(user.id)
    const scope: ManagerScope = !scopeIds
      ? {}
      : user.role === 'FIELD_MANAGER'
        ? { fieldIds: scopeIds.fieldIds }
        : { marketIds: scopeIds.marketIds }
    // "Whole organisation" for a manager without a single assigned location still means "my scope".
    const cameras = location.locationType === 'organization' && scopeIds ? scopedCameraWhere(scope) : cameraWhere(location)

    const [names, overview, flow, queues, quality, safety, measurement, totalCameras, streamCameras, calibrated] = await Promise.all([
      describe(location),
      managementAnalyticsService.getOverview(user.id, user.role, effective),
      phase2AnalyticsService.get(user.id, user.role, 'people-flow', { ...effective, bucket: 'day' }) as Promise<PeopleFlowAnalytics | null>,
      phase2AnalyticsService.get(user.id, user.role, 'queues', { ...effective, bucket: 'day' }) as Promise<QueueAnalytics | null>,
      qualitySection(where, filters.from, filters.to, previous),
      safetySection(where, filters.from, filters.to, previous),
      measurementSection(where, filters.from, filters.to, previous),
      db.camera.count({ where: cameras }),
      db.camera.count({ where: { AND: [cameras, { streamUrl: { not: null } }] } }),
      db.cameraCalibration.findMany({ where: { camera: cameras }, distinct: ['cameraId'], select: { cameraId: true } }),
    ])

    const children = await childRows(location, where, filters.from, filters.to, flow, queues, scope)
    const heatmap = flow?.activityHeatmap ?? overview?.activityHeatmap ?? []
    const restrictedAlerts = (overview?.alerts ?? []).filter(alert => /ممنوع|restricted/i.test(alert.title)).length

    const sections = {
      traffic: {
        averageOccupancy: flow?.kpis.averageOccupancy ?? EMPTY_METRIC,
        peakOccupancy: flow?.kpis.peakOccupancy ?? overview?.kpis.peakOccupancy ?? EMPTY_METRIC,
        visitors: overview?.kpis.visitors ?? EMPTY_METRIC,
        entries: flow?.kpis.entries ?? overview?.kpis.entries ?? EMPTY_METRIC,
        busiestHours: busiest(heatmap, 'hour', 3).map(item => ({ hour: item.index, value: item.value })),
        busiestDays: busiest(heatmap, 'day', 3).map(item => ({ day: item.index, value: item.value })),
        peakPeriods: (flow?.peakPeriods ?? []).slice(0, 5),
        daily: (flow?.trend ?? []).map(point => ({ date: point.timestamp.slice(0, 10), value: point.occupancy })),
      },
      service: {
        slaTargetMinutes: queues?.slaTargetMinutes ?? null,
        averageWaitMinutes: queues?.kpis.averageWaitMinutes ?? EMPTY_METRIC,
        p90WaitMinutes: queues?.kpis.p90WaitMinutes ?? EMPTY_METRIC,
        slaPercent: queues?.kpis.slaPercent ?? EMPTY_METRIC,
        maximumLength: queues?.kpis.maximumLength ?? EMPTY_METRIC,
        queues: (queues?.queues ?? []).slice(0, 8).map(queue => ({
          name: queue.name,
          locationName: queue.locationName,
          averageWaitMinutes: queue.averageWaitMinutes,
          slaPercent: queue.slaPercent,
          maximumLength: queue.maximumLength,
        })),
      },
      quality,
      safety: { ...safety, restrictedAreaAlerts: restrictedAlerts, alerts: (overview?.alerts ?? []).slice(0, 8) },
      children,
    }

    const camerasMeta = { total: totalCameras, withStream: streamCameras, calibrated: calibrated.length }
    const insightInput: InsightInput = {
      ...sections,
      dataQuality: flow?.dataQuality ?? null,
      cameras: camerasMeta,
      measurementRuns: measurement.runs,
    }

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        generatedBy: user.name ?? null,
        location: { type: location.locationType, id: location.locationId ?? null, ...names },
        period: { from: filters.from, to: filters.to, days: daysBetween(filters.from, filters.to) },
        comparison: previous,
        dataStatus: flow?.dataStatus ?? overview?.dataStatus ?? 'unavailable',
        dataQuality: flow?.dataQuality ?? null,
        cameras: camerasMeta,
      },
      scorecard: buildScorecard(insightInput),
      ...sections,
      measurement,
      highlights: buildHighlights(insightInput),
      recommendations: buildRecommendations(insightInput),
    }
  },
}
