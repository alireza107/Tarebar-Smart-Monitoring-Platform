import { db } from '@/lib/db'
import type { CreateBoothCategoryDto, UpdateBoothCategoryDto } from './schema'

export const boothCategoryRepository = {
  findAll: () =>
    db.boothCategory.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }),

  findById: (id: string) =>
    db.boothCategory.findFirst({ where: { id, deletedAt: null } }),

  create: (data: CreateBoothCategoryDto) => db.boothCategory.create({ data }),

  update: (id: string, data: UpdateBoothCategoryDto) =>
    db.boothCategory.update({ where: { id }, data }),

  softDelete: (id: string) =>
    db.boothCategory.update({ where: { id }, data: { deletedAt: new Date() } }),
}
