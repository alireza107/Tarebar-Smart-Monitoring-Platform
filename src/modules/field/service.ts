import { fieldRepository } from './repository'
import type { CreateFieldDto, UpdateFieldDto } from './schema'
import type { Role } from '@/lib/permissions'

export const fieldService = {
  getAll: (userId: string, role: Role) => {
    if (role === 'FIELD_MANAGER') return fieldRepository.findByUserId(userId)
    return fieldRepository.findAll()
  },

  getById: (id: string) => fieldRepository.findById(id),

  create: (data: CreateFieldDto) => fieldRepository.create(data),

  update: (id: string, data: UpdateFieldDto) => fieldRepository.update(id, data),

  delete: (id: string) => fieldRepository.softDelete(id),
}
