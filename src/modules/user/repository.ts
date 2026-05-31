import { db } from '@/lib/db'
import type { CreateUserDto, UpdateUserDto } from './schema'

const select = {
  id: true,
  username: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  scopes: {
    select: {
      id: true,
      scopeType: true,
      fieldId: true,
      marketId: true,
      field: { select: { id: true, name: true } },
      market: { select: { id: true, name: true } },
    },
  },
} as const

type CreateData = Omit<CreateUserDto, 'password' | 'fieldId' | 'marketId'> & { password: string }
type UpdateData = Omit<UpdateUserDto, 'fieldId' | 'marketId'> & { password?: string }

export const userRepository = {
  findAll: () =>
    db.user.findMany({ where: { deletedAt: null }, select, orderBy: { createdAt: 'desc' } }),

  findById: (id: string) =>
    db.user.findFirst({ where: { id, deletedAt: null }, select }),

  findByUsername: (username: string) =>
    db.user.findFirst({ where: { username, deletedAt: null }, select: { id: true } }),

  create: (data: CreateData) =>
    db.user.create({ data, select }),

  update: (id: string, data: UpdateData) =>
    db.user.update({ where: { id }, data, select }),

  softDelete: (id: string) =>
    db.user.update({ where: { id }, data: { deletedAt: new Date() } }),

  /** Deletes all existing scopes for a user and creates the correct one based on role. */
  replaceScope: async (userId: string, role: string, fieldId?: string, marketId?: string) => {
    await db.userScope.deleteMany({ where: { userId } })
    if (role === 'FIELD_MANAGER' && fieldId) {
      await db.userScope.create({ data: { userId, scopeType: 'FIELD', fieldId } })
    } else if (role === 'MARKET_MANAGER' && marketId) {
      await db.userScope.create({ data: { userId, scopeType: 'MARKET', marketId } })
    }
  },
}
