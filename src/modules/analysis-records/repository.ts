import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { businessRangeToUtc } from '@/lib/dates'
import type { Role } from '@/lib/permissions'
import { getUserScopeIds } from '@/lib/scope-guard'
import type { RecordQuery } from './schema'

/**
 * The three analysis tables share their location, camera, author and time
 * columns, so one structural filter type serves all of them.
 */
export interface RecordWhere {
  AND?: RecordWhere[]
  OR?: RecordWhere[]
  fieldId?: string | { in: string[] }
  marketId?: string | { in: string[] }
  boothId?: string
  cameraId?: string
  createdById?: string
  createdAt?: { gte?: Date; lt?: Date }
}

const locationInclude = {
  camera: { select: { id: true, name: true } },
  field: { select: { id: true, name: true } },
  market: { select: { id: true, name: true } },
  booth: { select: { id: true, number: true } },
} as const

/**
 * Rows a user may see: everything for admins; for managers the rows of their
 * fields or markets, plus rows they created themselves (an uploaded file that
 * was not filed under any location would otherwise be invisible to its author).
 */
export async function visibilityWhere(userId: string, role: Role): Promise<RecordWhere> {
  if (role === 'ORG_ADMIN') return {}
  const scope = await getUserScopeIds(userId)
  if (role === 'FIELD_MANAGER') {
    return { OR: [{ fieldId: { in: scope.fieldIds } }, { createdById: userId }] }
  }
  return { OR: [{ marketId: { in: scope.marketIds } }, { createdById: userId }] }
}

export function filterWhere(query: Pick<RecordQuery, 'locationType' | 'locationId' | 'cameraId' | 'from' | 'to'>): RecordWhere {
  const where: RecordWhere = {}
  if (query.locationId) {
    if (query.locationType === 'field') where.fieldId = query.locationId
    if (query.locationType === 'market') where.marketId = query.locationId
    if (query.locationType === 'booth') where.boothId = query.locationId
  }
  if (query.cameraId) where.cameraId = query.cameraId
  if (query.from || query.to) {
    const range = businessRangeToUtc(query.from ?? '1970-01-01', query.to ?? '2999-12-31')
    where.createdAt = {
      ...(query.from ? { gte: range.start } : {}),
      ...(query.to ? { lt: range.end } : {}),
    }
  }
  return where
}

export const analysisRecordRepository = {
  createQuality: (data: Prisma.FruitQualityAssessmentUncheckedCreateInput) =>
    db.fruitQualityAssessment.create({ data, include: locationInclude, omit: { thumbnails: true } }),

  findQualityById: (id: string) =>
    db.fruitQualityAssessment.findUnique({ where: { id }, include: locationInclude }),

  listQuality: (where: RecordWhere, take: number, skip: number) =>
    db.fruitQualityAssessment.findMany({
      where,
      include: locationInclude,
      omit: { thumbnails: true },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),

  countQuality: (where: RecordWhere) => db.fruitQualityAssessment.count({ where }),

  createIncident: (data: Prisma.IncidentCheckUncheckedCreateInput) =>
    db.incidentCheck.create({ data, include: locationInclude, omit: { thumbnail: true } }),

  listIncidents: (where: RecordWhere, take: number, skip: number, withThumbnail = false) =>
    db.incidentCheck.findMany({
      where,
      include: locationInclude,
      omit: { thumbnail: !withThumbnail },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),

  countIncidents: (where: RecordWhere) => db.incidentCheck.count({ where }),

  upsertMeasurementRun: (data: Prisma.FruitMeasurementRunUncheckedCreateInput) =>
    db.fruitMeasurementRun.upsert({
      where: { serviceJobId: data.serviceJobId },
      create: data,
      // A live job is recorded again when it progresses; keep the newest numbers.
      update: {
        processedFrames: data.processedFrames,
        totalFruitObservations: data.totalFruitObservations,
        lastFruitCount: data.lastFruitCount,
        avgWidthMm: data.avgWidthMm,
        avgLengthMm: data.avgLengthMm,
        avgDiameterMm: data.avgDiameterMm,
        sizeStatistics: data.sizeStatistics,
      },
      include: locationInclude,
    }),

  listMeasurementRuns: (where: RecordWhere, take: number, skip: number) =>
    db.fruitMeasurementRun.findMany({
      where,
      include: locationInclude,
      omit: { sizeStatistics: true },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),

  countMeasurementRuns: (where: RecordWhere) => db.fruitMeasurementRun.count({ where }),
}
