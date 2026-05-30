import { marketRepository } from './repository'
import type { CreateMarketDto, UpdateMarketDto } from './schema'
import type { Role } from '@/lib/permissions'

export const marketService = {
  getAll: async (userId: string, role: Role) => {
    if (role === 'FIELD_MANAGER') {
      const fieldIds = await marketRepository.getUserFieldIds(userId)
      return marketRepository.findByFieldIds(fieldIds)
    }
    if (role === 'MARKET_MANAGER') {
      const marketIds = await marketRepository.getUserMarketIds(userId)
      return marketRepository.findByIds(marketIds)
    }
    return marketRepository.findAll()
  },

  getById: (id: string) => marketRepository.findById(id),

  create: (data: CreateMarketDto) => marketRepository.create(data),

  update: (id: string, data: UpdateMarketDto) => marketRepository.update(id, data),

  delete: (id: string) => marketRepository.softDelete(id),
}
