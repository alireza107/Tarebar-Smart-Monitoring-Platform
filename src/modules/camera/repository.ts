import { db } from '@/lib/db'
import type { CreateCameraDto, UpdateCameraDto } from './schema'

const include = {
  field:  { select: { id: true, name: true } },
  market: { select: { id: true, name: true } },
  booth:  { select: { id: true, number: true } },
} as const

export const cameraRepository = {
  findAll: () =>
    db.camera.findMany({ where: { deletedAt: null }, include, orderBy: { createdAt: 'desc' } }),

  findByFieldIds: (fieldIds: string[]) =>
    db.camera.findMany({
      where: { fieldId: { in: fieldIds }, deletedAt: null },
      include,
      orderBy: { createdAt: 'desc' },
    }),

  findByMarketIds: (marketIds: string[]) =>
    db.camera.findMany({
      where: { marketId: { in: marketIds }, deletedAt: null },
      include,
      orderBy: { createdAt: 'desc' },
    }),

  findById: (id: string) =>
    db.camera.findFirst({ where: { id, deletedAt: null }, include }),

  create: (data: CreateCameraDto) =>
    db.camera.create({
      data: { ...data, streamUrl: data.streamUrl || null },
      include,
    }),

  update: (id: string, data: UpdateCameraDto) =>
    db.camera.update({
      where: { id },
      data: {
        ...data,
        streamUrl: data.streamUrl === '' ? null : data.streamUrl,
      },
      include,
    }),

  softDelete: (id: string) =>
    db.camera.update({ where: { id }, data: { deletedAt: new Date() } }),

  getUserFieldIds: (userId: string) =>
    db.userScope
      .findMany({ where: { userId, scopeType: 'FIELD' }, select: { fieldId: true } })
      .then(scopes => scopes.map(s => s.fieldId).filter((id): id is string => id !== null)),

  getUserMarketIds: (userId: string) =>
    db.userScope
      .findMany({ where: { userId, scopeType: 'MARKET' }, select: { marketId: true } })
      .then(scopes => scopes.map(s => s.marketId).filter((id): id is string => id !== null)),
}
