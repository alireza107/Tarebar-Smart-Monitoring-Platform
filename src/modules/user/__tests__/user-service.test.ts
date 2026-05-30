import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('bcryptjs', () => ({
  default: {
    hash:    vi.fn(async (plain: string) => `hashed:${plain}`),
    compare: vi.fn(async () => true),
  },
}))

vi.mock('../repository', () => ({
  userRepository: {
    findAll:        vi.fn(),
    findById:       vi.fn(),
    findByUsername: vi.fn(),
    create:         vi.fn(),
    update:         vi.fn(),
    softDelete:     vi.fn(),
  },
}))

import { userService, UsernameConflictError } from '../service'
import { userRepository } from '../repository'
import bcrypt from 'bcryptjs'

const repo   = vi.mocked(userRepository)
const mockBcrypt = vi.mocked(bcrypt)

const mockUser = {
  id:        'u1',
  username:  'testuser',
  name:      'کاربر آزمایشی',
  password:  'hashed:Secret@123',
  role:      'FIELD_MANAGER' as const,
  isActive:  true,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('userService.getAll', () => {
  it('returns all users from repository', async () => {
    repo.findAll.mockResolvedValue([mockUser])
    const result = await userService.getAll()
    expect(repo.findAll).toHaveBeenCalledOnce()
    expect(result).toEqual([mockUser])
  })
})

describe('userService.getById', () => {
  it('returns the user when found', async () => {
    repo.findById.mockResolvedValue(mockUser)
    const result = await userService.getById('u1')
    expect(repo.findById).toHaveBeenCalledWith('u1')
    expect(result).toEqual(mockUser)
  })

  it('returns null when user does not exist', async () => {
    repo.findById.mockResolvedValue(null)
    expect(await userService.getById('missing')).toBeNull()
  })
})

describe('userService.create', () => {
  it('hashes the password before saving', async () => {
    repo.findByUsername.mockResolvedValue(null)
    repo.create.mockResolvedValue(mockUser)

    await userService.create({ username: 'testuser', name: 'کاربر', password: 'Secret@123', role: 'FIELD_MANAGER' })

    expect(mockBcrypt.hash).toHaveBeenCalledWith('Secret@123', 10)
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ password: 'hashed:Secret@123' }),
    )
  })

  it('does not store the plain-text password', async () => {
    repo.findByUsername.mockResolvedValue(null)
    repo.create.mockResolvedValue(mockUser)

    await userService.create({ username: 'testuser', name: 'کاربر', password: 'Secret@123', role: 'FIELD_MANAGER' })

    const callArg = repo.create.mock.calls[0][0] as Record<string, unknown>
    expect(callArg.password).not.toBe('Secret@123')
  })

  it('throws UsernameConflictError when username is taken', async () => {
    repo.findByUsername.mockResolvedValue(mockUser)

    await expect(
      userService.create({ username: 'testuser', name: 'دیگری', password: 'Pass@1234', role: 'MARKET_MANAGER' }),
    ).rejects.toThrow(UsernameConflictError)

    expect(repo.create).not.toHaveBeenCalled()
  })
})

describe('userService.update', () => {
  it('hashes the new password when provided', async () => {
    repo.update.mockResolvedValue(mockUser)

    await userService.update('u1', { password: 'NewPass@99' })

    expect(mockBcrypt.hash).toHaveBeenCalledWith('NewPass@99', 10)
    expect(repo.update).toHaveBeenCalledWith('u1', expect.objectContaining({ password: 'hashed:NewPass@99' }))
  })

  it('does not touch password when not provided', async () => {
    repo.update.mockResolvedValue(mockUser)

    await userService.update('u1', { name: 'نام جدید' })

    expect(mockBcrypt.hash).not.toHaveBeenCalled()
    const callArg = repo.update.mock.calls[0][1] as Record<string, unknown>
    expect(callArg.password).toBeUndefined()
  })
})

describe('userService.delete', () => {
  it('calls softDelete with the given id', async () => {
    repo.softDelete.mockResolvedValue({ ...mockUser, deletedAt: new Date() })
    await userService.delete('u1')
    expect(repo.softDelete).toHaveBeenCalledWith('u1')
  })
})

describe('UsernameConflictError', () => {
  it('is an instance of Error with correct name', () => {
    const err = new UsernameConflictError()
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('UsernameConflictError')
  })
})
