import { db } from '@/lib/db'
import type { CameraStatusSummary, CamerasByFieldRow, BoothsByMarketRow } from './types'

export const reportRepository = {
  getCameraStatusSummary: async (fieldIds?: string[], marketIds?: string[]): Promise<CameraStatusSummary> => {
    const where = buildCameraWhere(fieldIds, marketIds)
    const [online, offline, unknown, total] = await Promise.all([
      db.camera.count({ where: { ...where, status: 'ONLINE' } }),
      db.camera.count({ where: { ...where, status: 'OFFLINE' } }),
      db.camera.count({ where: { ...where, status: 'UNKNOWN' } }),
      db.camera.count({ where }),
    ])
    return { online, offline, unknown, total }
  },

  getCamerasByField: async (fieldIds?: string[]): Promise<CamerasByFieldRow[]> => {
    const fieldWhere = fieldIds ? { id: { in: fieldIds }, deletedAt: null } : { deletedAt: null }
    const fields = await db.field.findMany({
      where: fieldWhere,
      select: {
        id: true,
        name: true,
        cameras: {
          where: { deletedAt: null },
          select: { status: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    return fields.map(f => ({
      fieldId: f.id,
      fieldName: f.name,
      total:   f.cameras.length,
      online:  f.cameras.filter(c => c.status === 'ONLINE').length,
      offline: f.cameras.filter(c => c.status === 'OFFLINE').length,
      unknown: f.cameras.filter(c => c.status === 'UNKNOWN').length,
    }))
  },

  getBoothsByMarket: async (marketIds?: string[], fieldIds?: string[]): Promise<BoothsByMarketRow[]> => {
    const marketWhere = marketIds
      ? { id: { in: marketIds }, deletedAt: null }
      : fieldIds
      ? { fieldId: { in: fieldIds }, deletedAt: null }
      : { deletedAt: null }

    const markets = await db.market.findMany({
      where: marketWhere,
      select: {
        id: true,
        name: true,
        field: { select: { name: true } },
        _count: { select: { booths: { where: { deletedAt: null } } } },
      },
      orderBy: { name: 'asc' },
    })

    return markets.map(m => ({
      marketId:   m.id,
      marketName: m.name,
      fieldName:  m.field.name,
      total:      m._count.booths,
    }))
  },
}

function buildCameraWhere(fieldIds?: string[], marketIds?: string[]) {
  const base = { deletedAt: null as null }
  if (!fieldIds && !marketIds) return base
  return {
    ...base,
    OR: [
      ...(fieldIds  ? [{ fieldId:  { in: fieldIds  } }] : []),
      ...(marketIds ? [{ marketId: { in: marketIds } }] : []),
    ],
  }
}
