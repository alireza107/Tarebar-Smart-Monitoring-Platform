import bcrypt from 'bcryptjs'
import { userRepository } from './repository'
import type { CreateUserDto, UpdateUserDto } from './schema'

export class UsernameConflictError extends Error {
  constructor() {
    super('نام کاربری قبلاً استفاده شده است')
    this.name = 'UsernameConflictError'
  }
}

export const userService = {
  getAll: () => userRepository.findAll(),

  getById: (id: string) => userRepository.findById(id),

  create: async (data: CreateUserDto) => {
    const existing = await userRepository.findByUsername(data.username)
    if (existing) throw new UsernameConflictError()

    const { password, ...rest } = data
    const hashedPassword = await bcrypt.hash(password, 10)
    return userRepository.create({ ...rest, password: hashedPassword })
  },

  update: async (id: string, data: UpdateUserDto) => {
    const { password, ...rest } = data
    const updateData: typeof rest & { password?: string } = { ...rest }

    if (password) {
      updateData.password = await bcrypt.hash(password, 10)
    }

    return userRepository.update(id, updateData)
  },

  delete: (id: string) => userRepository.softDelete(id),
}
