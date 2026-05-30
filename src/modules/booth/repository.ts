import { db } from '@/lib/db'
import type { CreateBoothDto, UpdateBoothDto } from './schema'

const include = {
  market: { select: { id: true, name: true, fieldId: true } },
  category: { select: { id: true, name: true } },
} as const

export const boothRepository = {
  findAll: () =>
    db.booth.findMany({ where: { deletedAt: null }, include, orderBy: { createdAt: 'desc' } }),

  findByMarketIds: (marketIds: string[]) =>
    db.booth.findMany({
      where: { marketId: { in: marketIds }, deletedAt: null },
      include,
      orderBy: { createdAt: 'desc' },
    }),

  findById: (id: string) =>
    db.booth.findFirst({ where: { id, deletedAt: null }, include }),

  create: (data: CreateBoothDto) => db.booth.create({ data, include }),

  update: (id: string, data: UpdateBoothDto) =>
    db.booth.update({ where: { id }, data, include }),

  softDelete: (id: string) =>
    db.booth.update({ where: { id }, data: { deletedAt: new Date() } }),

  getUserFieldIds: (userId: string) =>
    db.userScope.findMany({ where: { userId, scopeType: 'FIELD' }, select: { fieldId: true } })
      .then(scopes => scopes.map(s => s.fieldId).filter((id): id is string => id !== null)),

  getUserMarketIds: (userId: string) =>
    db.userScope.findMany({ where: { userId, scopeType: 'MARKET' }, select: { marketId: true } })
      .then(scopes => scopes.map(s => s.marketId).filter((id): id is string => id !== null)),

  getMarketIdsByFieldIds: (fieldIds: string[]) =>
    db.market.findMany({ where: { fieldId: { in: fieldIds }, deletedAt: null }, select: { id: true } })
      .then(markets => markets.map(m => m.id)),
}
