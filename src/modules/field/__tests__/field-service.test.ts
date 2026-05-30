import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../repository', () => ({
  fieldRepository: {
    findAll:      vi.fn(),
    findById:     vi.fn(),
    findByUserId: vi.fn(),
    create:       vi.fn(),
    update:       vi.fn(),
    softDelete:   vi.fn(),
  },
}))

import { fieldService } from '../service'
import { fieldRepository } from '../repository'

const repo = vi.mocked(fieldRepository)

const mockField = {
  id: 'f1',
  name: 'میدان تهران',
  address: 'تهران، خیابان آزادی',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fieldService.getAll', () => {
  it('calls findAll for ORG_ADMIN', async () => {
    repo.findAll.mockResolvedValue([mockField])
    const result = await fieldService.getAll('u1', 'ORG_ADMIN')
    expect(repo.findAll).toHaveBeenCalledOnce()
    expect(repo.findByUserId).not.toHaveBeenCalled()
    expect(result).toEqual([mockField])
  })

  it('calls findByUserId for FIELD_MANAGER', async () => {
    repo.findByUserId.mockResolvedValue([mockField])
    const result = await fieldService.getAll('u2', 'FIELD_MANAGER')
    expect(repo.findByUserId).toHaveBeenCalledWith('u2')
    expect(repo.findAll).not.toHaveBeenCalled()
    expect(result).toEqual([mockField])
  })

  it('calls findAll for MARKET_MANAGER', async () => {
    repo.findAll.mockResolvedValue([])
    await fieldService.getAll('u3', 'MARKET_MANAGER')
    expect(repo.findAll).toHaveBeenCalledOnce()
  })
})

describe('fieldService.getById', () => {
  it('delegates to repository', async () => {
    repo.findById.mockResolvedValue(mockField)
    const result = await fieldService.getById('f1')
    expect(repo.findById).toHaveBeenCalledWith('f1')
    expect(result).toEqual(mockField)
  })

  it('returns null when not found', async () => {
    repo.findById.mockResolvedValue(null)
    const result = await fieldService.getById('missing')
    expect(result).toBeNull()
  })
})

describe('fieldService.create', () => {
  it('delegates to repository with input data', async () => {
    const dto = { name: 'میدان شیراز', address: 'شیراز، بلوار مدرس' }
    repo.create.mockResolvedValue({ ...mockField, ...dto })
    const result = await fieldService.create(dto)
    expect(repo.create).toHaveBeenCalledWith(dto)
    expect(result.name).toBe(dto.name)
  })
})

describe('fieldService.update', () => {
  it('delegates to repository with id and data', async () => {
    const dto = { name: 'میدان تهران ویرایش‌شده' }
    repo.update.mockResolvedValue({ ...mockField, ...dto })
    const result = await fieldService.update('f1', dto)
    expect(repo.update).toHaveBeenCalledWith('f1', dto)
    expect(result.name).toBe(dto.name)
  })
})

describe('fieldService.delete', () => {
  it('calls softDelete with the given id', async () => {
    repo.softDelete.mockResolvedValue({ ...mockField, deletedAt: new Date() })
    await fieldService.delete('f1')
    expect(repo.softDelete).toHaveBeenCalledWith('f1')
  })
})
