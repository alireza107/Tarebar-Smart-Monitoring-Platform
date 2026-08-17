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

  getSnapshot: (id: string) => cameraRepository.getSnapshot(id),

  updateSnapshot: (id: string, dataUrl: string) => cameraRepository.updateSnapshot(id, dataUrl),

  create: (data: CreateCameraDto) => cameraRepository.create(data),

  update: (id: string, data: UpdateCameraDto) => cameraRepository.update(id, data),

  delete: (id: string) => cameraRepository.softDelete(id),

  attachVideoSource: (id: string, data: { streamUrl: string; videoFileName: string }) =>
    cameraRepository.attachVideoSource(id, data),

  detachVideoSource: (id: string) => cameraRepository.detachVideoSource(id),
}
