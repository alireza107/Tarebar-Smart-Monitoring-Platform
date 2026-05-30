import { boothRepository } from './repository'
import type { CreateBoothDto, UpdateBoothDto } from './schema'
import type { Role } from '@/lib/permissions'

export const boothService = {
  getAll: async (userId: string, role: Role) => {
    if (role === 'FIELD_MANAGER') {
      const fieldIds = await boothRepository.getUserFieldIds(userId)
      const marketIds = await boothRepository.getMarketIdsByFieldIds(fieldIds)
      return boothRepository.findByMarketIds(marketIds)
    }
    if (role === 'MARKET_MANAGER') {
      const marketIds = await boothRepository.getUserMarketIds(userId)
      return boothRepository.findByMarketIds(marketIds)
    }
    return boothRepository.findAll()
  },

  getById: (id: string) => boothRepository.findById(id),

  create: (data: CreateBoothDto) => boothRepository.create(data),

  update: (id: string, data: UpdateBoothDto) => boothRepository.update(id, data),

  delete: (id: string) => boothRepository.softDelete(id),
}
