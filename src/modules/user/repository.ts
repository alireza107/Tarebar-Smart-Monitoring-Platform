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
} as const

export const userRepository = {
  findAll: () =>
    db.user.findMany({ where: { deletedAt: null }, select, orderBy: { createdAt: 'desc' } }),

  findById: (id: string) =>
    db.user.findFirst({ where: { id, deletedAt: null }, select }),

  findByUsername: (username: string) =>
    db.user.findFirst({ where: { username, deletedAt: null }, select: { id: true } }),

  create: (data: Omit<CreateUserDto, 'password'> & { password: string }) =>
    db.user.create({ data, select }),

  update: (id: string, data: Omit<UpdateUserDto, 'password'> & { password?: string }) =>
    db.user.update({ where: { id }, data, select }),

  softDelete: (id: string) =>
    db.user.update({ where: { id }, data: { deletedAt: new Date() } }),
}
