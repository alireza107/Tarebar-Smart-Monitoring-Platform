import { regionRepository as repo } from './repository'
import { effectiveArea } from './geometry'
import type { Point } from './geometry'
import type {
  CreateRegionDto,
  UpdateRegionDto,
  CreateCameraRegionDto,
  UpdateCameraRegionDto,
  ImportRegionsDto,
} from './schema'
import { audit, type AuditActor } from '@/lib/audit'
import type { Role } from '@/lib/permissions'

/** Domain error mapped to HTTP status by the route handlers. */
export class RegionServiceError extends Error {
  constructor(
    public kind: 'conflict' | 'not_found' | 'bad_request',
    message: string,
  ) {
    super(message)
    this.name = 'RegionServiceError'
  }
}

/** Resolve the set of marketIds a non-admin user can act on. */
async function scopedMarketIds(userId: string, role: Role): Promise<string[]> {
  if (role === 'FIELD_MANAGER') {
    const fieldIds = await repo.getUserFieldIds(userId)
    return repo.getMarketIdsByFieldIds(fieldIds)
  }
  return repo.getUserMarketIds(userId) // MARKET_MANAGER
}

export const regionService = {
  // ─── Region CRUD ───────────────────────────────────────────────────────────

  getAll: async (userId: string, role: Role, q?: string, marketId?: string) => {
    if (role === 'ORG_ADMIN') return repo.findAll(q, marketId)
    const marketIds = await scopedMarketIds(userId, role)
    if (marketIds.length === 0) return []
    return repo.findByMarketIds(marketIds, q, marketId)
  },

  getById: (id: string) => repo.findById(id),

  create: async (data: CreateRegionDto, actor: AuditActor) => {
    if (await repo.nameTaken(data.marketId, data.name)) {
      throw new RegionServiceError('conflict', 'منطقه‌ای با این نام در این بازار وجود دارد')
    }
    const region = await repo.create(data)
    await audit({
      actor,
      action: 'CREATE',
      entityType: 'Region',
      entityId: region.id,
      marketId: region.marketId,
      metadata: { after: { name: region.name, marketId: region.marketId } },
    })
    return region
  },

  update: async (id: string, data: UpdateRegionDto, actor: AuditActor) => {
    const existing = await repo.findRaw(id)
    if (!existing) throw new RegionServiceError('not_found', 'منطقه یافت نشد')

    if (data.name && data.name !== existing.name) {
      if (await repo.nameTaken(existing.marketId, data.name, id)) {
        throw new RegionServiceError('conflict', 'منطقه‌ای با این نام در این بازار وجود دارد')
      }
    }
    const updated = await repo.update(id, data)
    await audit({
      actor,
      action: 'UPDATE',
      entityType: 'Region',
      entityId: id,
      marketId: existing.marketId,
      metadata: {
        before: { name: existing.name, description: existing.description, color: existing.color },
        after: { name: updated.name, description: updated.description, color: updated.color },
      },
    })
    return updated
  },

  remove: async (id: string, actor: AuditActor) => {
    const existing = await repo.findRaw(id)
    if (!existing) throw new RegionServiceError('not_found', 'منطقه یافت نشد')
    await repo.softDelete(id)
    await audit({
      actor,
      action: 'DELETE',
      entityType: 'Region',
      entityId: id,
      marketId: existing.marketId,
      metadata: { name: existing.name },
    })
  },

  // ─── Camera <-> Region mappings ─────────────────────────────────────────────

  addCameraMapping: async (regionId: string, data: CreateCameraRegionDto, actor: AuditActor) => {
    const region = await repo.findRaw(regionId)
    if (!region) throw new RegionServiceError('not_found', 'منطقه یافت نشد')

    const camera = await repo.cameraForValidation(data.cameraId)
    if (!camera) throw new RegionServiceError('not_found', 'دوربین یافت نشد')

    // Validation rule: a camera assigned to a *different* market cannot map a region.
    // Field-level / unassigned cameras are allowed (flexible multi-market coverage).
    const cameraMarket = camera.booth?.marketId ?? camera.marketId ?? null
    if (cameraMarket && cameraMarket !== region.marketId) {
      throw new RegionServiceError('bad_request', 'دوربین متعلق به بازار دیگری است')
    }

    if (await repo.mappingExists(regionId, data.cameraId)) {
      throw new RegionServiceError('conflict', 'این دوربین قبلاً به این منطقه متصل شده است')
    }

    const mapping = await repo.createMapping(
      regionId,
      data.cameraId,
      data.mainPolygon,
      data.exclusionPolygons,
    )
    await audit({
      actor,
      action: 'CREATE',
      entityType: 'CameraRegion',
      entityId: mapping.id,
      marketId: region.marketId,
      metadata: {
        regionId,
        cameraId: data.cameraId,
        vertices: data.mainPolygon.length,
        exclusions: data.exclusionPolygons.length,
        effectiveArea: round(effectiveArea(data.mainPolygon, data.exclusionPolygons)),
      },
    })
    return mapping
  },

  updateCameraMapping: async (mappingId: string, data: UpdateCameraRegionDto, actor: AuditActor) => {
    const existing = await repo.findMappingById(mappingId)
    if (!existing) throw new RegionServiceError('not_found', 'نگاشت دوربین یافت نشد')

    const updated = await repo.updateMapping(mappingId, {
      mainPolygon: data.mainPolygon,
      exclusionPolygons: data.exclusionPolygons,
    })
    await audit({
      actor,
      action: 'UPDATE',
      entityType: 'CameraRegion',
      entityId: mappingId,
      marketId: existing.region.marketId,
      metadata: {
        regionId: existing.regionId,
        cameraId: existing.cameraId,
        effectiveArea:
          data.mainPolygon &&
          round(effectiveArea(data.mainPolygon, data.exclusionPolygons ?? [])),
      },
    })
    return updated
  },

  removeCameraMapping: async (mappingId: string, actor: AuditActor) => {
    const existing = await repo.findMappingById(mappingId)
    if (!existing) throw new RegionServiceError('not_found', 'نگاشت دوربین یافت نشد')
    await repo.softDeleteMapping(mappingId)
    await audit({
      actor,
      action: 'DELETE',
      entityType: 'CameraRegion',
      entityId: mappingId,
      marketId: existing.region.marketId,
      metadata: { regionId: existing.regionId, cameraId: existing.cameraId },
    })
  },

  /** Find a mapping + its region (used by routes to scope-check before mutating). */
  getMapping: (mappingId: string) => repo.findMappingById(mappingId),

  // ─── Region <-> Booth (Stall) mappings ──────────────────────────────────────

  setBooths: async (regionId: string, boothIds: string[], actor: AuditActor) => {
    const region = await repo.findRaw(regionId)
    if (!region) throw new RegionServiceError('not_found', 'منطقه یافت نشد')

    const unique = [...new Set(boothIds)]
    if (unique.length > 0) {
      const found = await repo.boothsForValidation(unique)
      if (found.length !== unique.length) {
        throw new RegionServiceError('bad_request', 'برخی غرفه‌ها یافت نشدند')
      }
      // Per spec, Region<->Stall is unrestricted: booths may live in any market.
    }

    const before = await repo.activeBoothIds(regionId)
    await repo.setBooths(regionId, unique)
    await audit({
      actor,
      action: 'UPDATE',
      entityType: 'RegionBooth',
      entityId: regionId,
      marketId: region.marketId,
      metadata: {
        added: unique.filter(id => !before.includes(id)),
        removed: before.filter(id => !unique.includes(id)),
      },
    })
  },

  // ─── Import / Export ─────────────────────────────────────────────────────────

  exportData: async (userId: string, role: Role) => {
    const marketIds = role === 'ORG_ADMIN' ? null : await scopedMarketIds(userId, role)
    const rows = await repo.exportByMarketIds(marketIds)
    return {
      version: 1 as const,
      exportedAt: new Date().toISOString(),
      regions: rows.map(r => ({
        name: r.name,
        description: r.description,
        marketId: r.marketId,
        marketName: r.market.name,
        color: r.color,
        cameraMappings: r.cameraRegions.map(m => ({
          cameraId: m.cameraId,
          cameraName: m.camera.name,
          mainPolygon: m.mainPolygon as unknown as Point[],
          exclusionPolygons: m.exclusionPolygons as unknown as Point[][],
        })),
        boothIds: r.booths.map(b => b.boothId),
      })),
    }
  },

  /**
   * Upsert regions by (marketId, name). Mappings are validated and created when
   * absent. Returns a per-region result summary. Caller asserts scope per market.
   */
  importData: async (data: ImportRegionsDto, actor: AuditActor) => {
    const results: { name: string; marketId: string; status: 'created' | 'updated' | 'skipped'; reason?: string }[] = []

    for (const incoming of data.regions) {
      const existing = await repo.findByNameInMarket(incoming.marketId, incoming.name)
      const region = existing
        ? await repo.update(existing.id, {
            description: incoming.description ?? null,
            color: incoming.color ?? null,
          })
        : await repo.create({
            name: incoming.name,
            description: incoming.description ?? '',
            marketId: incoming.marketId,
            color: incoming.color ?? '',
          })

      for (const m of incoming.cameraMappings) {
        const camera = await repo.cameraForValidation(m.cameraId)
        if (!camera) continue
        const cameraMarket = camera.booth?.marketId ?? camera.marketId ?? null
        if (cameraMarket && cameraMarket !== region.marketId) continue

        const existingMapping = await repo.activeMapping(region.id, m.cameraId)
        if (existingMapping) {
          await repo.updateMapping(existingMapping.id, {
            mainPolygon: m.mainPolygon,
            exclusionPolygons: m.exclusionPolygons,
          })
        } else {
          await repo.createMapping(region.id, m.cameraId, m.mainPolygon, m.exclusionPolygons)
        }
      }

      if (incoming.boothIds.length) {
        const found = await repo.boothsForValidation([...new Set(incoming.boothIds)])
        const validIds = found.map(b => b.id)
        if (validIds.length) {
          const current = await repo.activeBoothIds(region.id)
          await repo.setBooths(region.id, [...new Set([...current, ...validIds])])
        }
      }

      results.push({
        name: region.name,
        marketId: region.marketId,
        status: existing ? 'updated' : 'created',
      })
    }

    await audit({
      actor,
      action: 'IMPORT',
      entityType: 'Region',
      entityId: 'bulk',
      metadata: { count: results.length },
    })
    return results
  },
}

function round(n: number): number {
  return Math.round(n * 1e4) / 1e4
}
