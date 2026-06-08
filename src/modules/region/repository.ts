import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import type { Point } from './geometry'
import type { CreateRegionDto, UpdateRegionDto } from './schema'
import type { CameraRegionMapping, RegionBoothLink, RegionDetail, RegionSummary } from './types'

// ─── Prisma query fragments ──────────────────────────────────────────────────

const summaryCount = {
  _count: {
    select: {
      cameraRegions: { where: { deletedAt: null } },
      booths: { where: { deletedAt: null } },
    },
  },
  market: { select: { id: true, name: true, fieldId: true } },
} as const

const detailInclude = {
  market: { select: { id: true, name: true, fieldId: true } },
  cameraRegions: {
    where: { deletedAt: null },
    include: { camera: { select: { id: true, name: true, status: true } } },
    orderBy: { createdAt: 'asc' },
  },
  booths: {
    where: { deletedAt: null },
    include: {
      booth: {
        select: { id: true, number: true, market: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
} as const

// ─── Mappers (JSON columns -> typed geometry) ────────────────────────────────

type SummaryRow = Prisma.RegionGetPayload<{ include: typeof summaryCount }>
type DetailRow = Prisma.RegionGetPayload<{ include: typeof detailInclude }>

function toSummary(r: SummaryRow): RegionSummary {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    color: r.color,
    marketId: r.marketId,
    market: r.market,
    cameraCount: r._count.cameraRegions,
    boothCount: r._count.booths,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    deletedAt: r.deletedAt,
  }
}

function toMapping(m: DetailRow['cameraRegions'][number]): CameraRegionMapping {
  return {
    id: m.id,
    cameraId: m.cameraId,
    regionId: m.regionId,
    mainPolygon: m.mainPolygon as unknown as Point[],
    exclusionPolygons: m.exclusionPolygons as unknown as Point[][],
    camera: m.camera,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  }
}

function toBoothLink(b: DetailRow['booths'][number]): RegionBoothLink {
  return { id: b.id, boothId: b.boothId, booth: b.booth }
}

function toDetail(r: DetailRow): RegionDetail {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    color: r.color,
    marketId: r.marketId,
    market: r.market,
    cameraCount: r.cameraRegions.length,
    boothCount: r.booths.length,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    deletedAt: r.deletedAt,
    cameraRegions: r.cameraRegions.map(toMapping),
    booths: r.booths.map(toBoothLink),
  }
}

// ─── Repository ──────────────────────────────────────────────────────────────

function searchWhere(q?: string): Prisma.RegionWhereInput {
  if (!q) return {}
  return {
    OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ],
  }
}

export const regionRepository = {
  findAll: (q?: string, marketId?: string): Promise<RegionSummary[]> =>
    db.region
      .findMany({
        where: { deletedAt: null, ...(marketId ? { marketId } : {}), ...searchWhere(q) },
        include: summaryCount,
        orderBy: { createdAt: 'desc' },
      })
      .then(rows => rows.map(toSummary)),

  findByMarketIds: (marketIds: string[], q?: string, marketId?: string): Promise<RegionSummary[]> =>
    db.region
      .findMany({
        where: {
          deletedAt: null,
          marketId: marketId ? marketId : { in: marketIds },
          ...searchWhere(q),
        },
        include: summaryCount,
        orderBy: { createdAt: 'desc' },
      })
      .then(rows => rows.map(toSummary)),

  findById: (id: string): Promise<RegionDetail | null> =>
    db.region
      .findFirst({ where: { id, deletedAt: null }, include: detailInclude })
      .then(r => (r ? toDetail(r) : null)),

  /** Raw region (for market/scope checks) without the heavy includes. */
  findRaw: (id: string) => db.region.findFirst({ where: { id, deletedAt: null } }),

  /** Case-insensitive name uniqueness within a market (excluding optional id). */
  nameTaken: (marketId: string, name: string, excludeId?: string) =>
    db.region
      .findFirst({
        where: {
          marketId,
          name: { equals: name, mode: 'insensitive' },
          deletedAt: null,
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
        select: { id: true },
      })
      .then(Boolean),

  create: (data: CreateRegionDto) =>
    db.region.create({
      data: {
        name: data.name,
        description: data.description || null,
        marketId: data.marketId,
        color: data.color || null,
      },
    }),

  update: (id: string, data: UpdateRegionDto) =>
    db.region.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description || null } : {}),
        ...(data.color !== undefined ? { color: data.color || null } : {}),
      },
    }),

  /** Soft-delete the region and cascade-soft-delete its mappings in one tx. */
  softDelete: (id: string) =>
    db.$transaction(async tx => {
      const now = new Date()
      await tx.cameraRegion.updateMany({ where: { regionId: id, deletedAt: null }, data: { deletedAt: now } })
      await tx.regionBooth.updateMany({ where: { regionId: id, deletedAt: null }, data: { deletedAt: now } })
      return tx.region.update({ where: { id }, data: { deletedAt: now } })
    }),

  // ─── Camera <-> Region mappings ───────────────────────────────────────────

  findMappingById: (id: string) =>
    db.cameraRegion.findFirst({
      where: { id, deletedAt: null },
      include: { region: { select: { id: true, marketId: true } } },
    }),

  /** Resolve a camera + its effective market (booth's market wins over direct marketId). */
  cameraForValidation: (cameraId: string) =>
    db.camera.findFirst({
      where: { id: cameraId, deletedAt: null },
      select: {
        id: true,
        name: true,
        marketId: true,
        fieldId: true,
        booth: { select: { marketId: true } },
      },
    }),

  mappingExists: (regionId: string, cameraId: string) =>
    db.cameraRegion
      .findFirst({ where: { regionId, cameraId, deletedAt: null }, select: { id: true } })
      .then(Boolean),

  activeMapping: (regionId: string, cameraId: string) =>
    db.cameraRegion.findFirst({ where: { regionId, cameraId, deletedAt: null }, select: { id: true } }),

  createMapping: (regionId: string, cameraId: string, mainPolygon: Point[], exclusionPolygons: Point[][]) =>
    db.cameraRegion.create({
      data: {
        regionId,
        cameraId,
        mainPolygon: mainPolygon as unknown as Prisma.InputJsonValue,
        exclusionPolygons: exclusionPolygons as unknown as Prisma.InputJsonValue,
      },
      include: { camera: { select: { id: true, name: true, status: true } } },
    }),

  updateMapping: (
    id: string,
    data: { mainPolygon?: Point[]; exclusionPolygons?: Point[][] },
  ) =>
    db.cameraRegion.update({
      where: { id },
      data: {
        ...(data.mainPolygon ? { mainPolygon: data.mainPolygon as unknown as Prisma.InputJsonValue } : {}),
        ...(data.exclusionPolygons
          ? { exclusionPolygons: data.exclusionPolygons as unknown as Prisma.InputJsonValue }
          : {}),
      },
      include: { camera: { select: { id: true, name: true, status: true } } },
    }),

  softDeleteMapping: (id: string) =>
    db.cameraRegion.update({ where: { id }, data: { deletedAt: new Date() } }),

  // ─── Region <-> Booth (Stall) mappings ────────────────────────────────────

  /** Booth ids currently linked to the region. */
  activeBoothIds: (regionId: string) =>
    db.regionBooth
      .findMany({ where: { regionId, deletedAt: null }, select: { boothId: true } })
      .then(rows => rows.map(r => r.boothId)),

  /** Validate that the given booth ids exist, are not deleted, and (returns) their marketIds. */
  boothsForValidation: (boothIds: string[]) =>
    db.booth.findMany({
      where: { id: { in: boothIds }, deletedAt: null },
      select: { id: true, marketId: true },
    }),

  /**
   * Replace-set semantics with soft-delete reuse:
   *  - links to remove  -> soft delete
   *  - links to add      -> restore (if a soft-deleted row exists) or create
   */
  setBooths: (regionId: string, desiredBoothIds: string[]) =>
    db.$transaction(async tx => {
      const existing = await tx.regionBooth.findMany({ where: { regionId } })
      const desired = new Set(desiredBoothIds)
      const now = new Date()

      const toRemove = existing.filter(e => e.deletedAt === null && !desired.has(e.boothId))
      if (toRemove.length) {
        await tx.regionBooth.updateMany({
          where: { id: { in: toRemove.map(r => r.id) } },
          data: { deletedAt: now },
        })
      }

      for (const boothId of desired) {
        const row = existing.find(e => e.boothId === boothId)
        if (!row) {
          await tx.regionBooth.create({ data: { regionId, boothId } })
        } else if (row.deletedAt !== null) {
          await tx.regionBooth.update({ where: { id: row.id }, data: { deletedAt: null } })
        }
      }
    }),

  // ─── Import / Export ──────────────────────────────────────────────────────

  exportByMarketIds: (marketIds: string[] | null) =>
    db.region.findMany({
      where: { deletedAt: null, ...(marketIds ? { marketId: { in: marketIds } } : {}) },
      include: {
        market: { select: { id: true, name: true } },
        cameraRegions: { where: { deletedAt: null }, include: { camera: { select: { id: true, name: true } } } },
        booths: { where: { deletedAt: null }, select: { boothId: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),

  findByNameInMarket: (marketId: string, name: string) =>
    db.region.findFirst({
      where: { marketId, name: { equals: name, mode: 'insensitive' }, deletedAt: null },
    }),

  // ─── Scope helpers (mirrors other modules) ────────────────────────────────

  getUserFieldIds: (userId: string) =>
    db.userScope
      .findMany({ where: { userId, scopeType: 'FIELD' }, select: { fieldId: true } })
      .then(scopes => scopes.map(s => s.fieldId).filter((id): id is string => id !== null)),

  getUserMarketIds: (userId: string) =>
    db.userScope
      .findMany({ where: { userId, scopeType: 'MARKET' }, select: { marketId: true } })
      .then(scopes => scopes.map(s => s.marketId).filter((id): id is string => id !== null)),

  getMarketIdsByFieldIds: (fieldIds: string[]) =>
    db.market
      .findMany({ where: { fieldId: { in: fieldIds }, deletedAt: null }, select: { id: true } })
      .then(markets => markets.map(m => m.id)),
}
