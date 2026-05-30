import { db } from '@/lib/db'
import type { CreateMarketDto, UpdateMarketDto } from './schema'

const include = { field: { select: { id: true, name: true } } } as const

export const marketRepository = {
  findAll: () =>
    db.market.findMany({ where: { deletedAt: null }, include, orderBy: { createdAt: 'desc' } }),

  findByFieldIds: (fieldIds: string[]) =>
    db.market.findMany({
      where: { fieldId: { in: fieldIds }, deletedAt: null },
      include,
      orderBy: { createdAt: 'desc' },
    }),

  findByIds: (ids: string[]) =>
    db.market.findMany({
      where: { id: { in: ids }, deletedAt: null },
      include,
      orderBy: { createdAt: 'desc' },
    }),

  findById: (id: string) =>
    db.market.findFirst({ where: { id, deletedAt: null }, include }),

  create: (data: CreateMarketDto) => db.market.create({ data, include }),

  update: (id: string, data: UpdateMarketDto) =>
    db.market.update({ where: { id }, data, include }),

  softDelete: (id: string) =>
    db.market.update({ where: { id }, data: { deletedAt: new Date() } }),

  getUserFieldIds: (userId: string) =>
    db.userScope.findMany({ where: { userId, scopeType: 'FIELD' }, select: { fieldId: true } })
      .then(scopes => scopes.map(s => s.fieldId).filter((id): id is string => id !== null)),

  getUserMarketIds: (userId: string) =>
    db.userScope.findMany({ where: { userId, scopeType: 'MARKET' }, select: { marketId: true } })
      .then(scopes => scopes.map(s => s.marketId).filter((id): id is string => id !== null)),
}
