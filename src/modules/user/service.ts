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

    const { password, fieldId, marketId, ...rest } = data
    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await userRepository.create({ ...rest, password: hashedPassword })
    await userRepository.replaceScope(user.id, rest.role, fieldId, marketId)
    return userRepository.findById(user.id)
  },

  update: async (id: string, data: UpdateUserDto) => {
    const { password, fieldId, marketId, role, ...rest } = data
    const updateData: Record<string, unknown> = { ...rest }

    if (password) updateData.password = await bcrypt.hash(password, 10)
    if (role) updateData.role = role

    await userRepository.update(id, updateData)

    // Update scope when role or scope assignment changes
    if (role !== undefined || fieldId !== undefined || marketId !== undefined) {
      let effectiveRole = role
      if (!effectiveRole) {
        const current = await userRepository.findById(id)
        effectiveRole = current?.role
      }
      if (effectiveRole) {
        await userRepository.replaceScope(id, effectiveRole, fieldId, marketId)
      }
    }

    return userRepository.findById(id)
  },

  delete: (id: string) => userRepository.softDelete(id),
}
