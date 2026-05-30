import { boothCategoryRepository } from './repository'
import type { CreateBoothCategoryDto, UpdateBoothCategoryDto } from './schema'

export const boothCategoryService = {
  getAll: () => boothCategoryRepository.findAll(),

  getById: (id: string) => boothCategoryRepository.findById(id),

  create: (data: CreateBoothCategoryDto) => boothCategoryRepository.create(data),

  update: (id: string, data: UpdateBoothCategoryDto) => boothCategoryRepository.update(id, data),

  delete: (id: string) => boothCategoryRepository.softDelete(id),
}
