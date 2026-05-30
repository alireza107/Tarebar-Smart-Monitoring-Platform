import { db } from '@/lib/db'
import type { CreateFieldDto, UpdateFieldDto } from './schema'

export const fieldRepository = {
  findAll: () =>
    db.field.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' } }),

  findById: (id: string) =>
    db.field.findFirst({ where: { id, deletedAt: null } }),

  findByUserId: (userId: string) =>
    db.userScope.findMany({
      where: { userId, scopeType: 'FIELD' },
      include: { field: true },
    }).then(scopes =>
      scopes.map(s => s.field).filter((f): f is NonNullable<typeof f> => f !== null && f.deletedAt === null)
    ),

  create: (data: CreateFieldDto) => db.field.create({ data }),

  update: (id: string, data: UpdateFieldDto) =>
    db.field.update({ where: { id }, data }),

  softDelete: (id: string) =>
    db.field.update({ where: { id }, data: { deletedAt: new Date() } }),
}
