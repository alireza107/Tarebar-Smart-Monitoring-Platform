import { cameraRepository } from './repository'
import type { CreateCameraDto, UpdateCameraDto } from './schema'
import type { Role } from '@/lib/permissions'

export const cameraService = {
  getAll: async (userId: string, role: Role) => {
    if (role === 'FIELD_MANAGER') {
      const fieldIds = await cameraRepository.getUserFieldIds(userId)
      return cameraRepository.findByFieldIds(fieldIds)
    }
    if (role === 'MARKET_MANAGER') {
      const marketIds = await cameraRepository.getUserMarketIds(userId)
      return cameraRepository.findByMarketIds(marketIds)
    }
    return cameraRepository.findAll()
  },

  getById: (id: string) => cameraRepository.findById(id),

  create: (data: CreateCameraDto) => cameraRepository.create(data),

  update: (id: string, data: UpdateCameraDto) => cameraRepository.update(id, data),

  delete: (id: string) => cameraRepository.softDelete(id),
}
