import { describe, it, expect } from 'vitest'
import { hasPermission, checkPermission, PermissionError } from '../permissions'
import type { Session } from 'next-auth'

// ---------------------------------------------------------------------------
// hasPermission
// ---------------------------------------------------------------------------

describe('hasPermission — ORG_ADMIN', () => {
  const resources = ['field', 'market', 'booth', 'booth_category', 'user', 'camera', 'report'] as const
  const actions   = ['create', 'read', 'update', 'delete'] as const

  it('has full CRUD on every resource', () => {
    for (const resource of resources) {
      for (const action of actions) {
        expect(hasPermission('ORG_ADMIN', resource, action)).toBe(true)
      }
    }
  })
})

describe('hasPermission — FIELD_MANAGER', () => {
  it('can only read fields (no write)', () => {
    expect(hasPermission('FIELD_MANAGER', 'field', 'read')).toBe(true)
    expect(hasPermission('FIELD_MANAGER', 'field', 'create')).toBe(false)
    expect(hasPermission('FIELD_MANAGER', 'field', 'update')).toBe(false)
    expect(hasPermission('FIELD_MANAGER', 'field', 'delete')).toBe(false)
  })

  it('has CRUD on markets', () => {
    expect(hasPermission('FIELD_MANAGER', 'market', 'create')).toBe(true)
    expect(hasPermission('FIELD_MANAGER', 'market', 'read')).toBe(true)
    expect(hasPermission('FIELD_MANAGER', 'market', 'update')).toBe(true)
    expect(hasPermission('FIELD_MANAGER', 'market', 'delete')).toBe(true)
  })

  it('has CRUD on booths', () => {
    expect(hasPermission('FIELD_MANAGER', 'booth', 'create')).toBe(true)
    expect(hasPermission('FIELD_MANAGER', 'booth', 'read')).toBe(true)
    expect(hasPermission('FIELD_MANAGER', 'booth', 'update')).toBe(true)
    expect(hasPermission('FIELD_MANAGER', 'booth', 'delete')).toBe(true)
  })

  it('has CRUD on booth_category', () => {
    expect(hasPermission('FIELD_MANAGER', 'booth_category', 'create')).toBe(true)
    expect(hasPermission('FIELD_MANAGER', 'booth_category', 'read')).toBe(true)
    expect(hasPermission('FIELD_MANAGER', 'booth_category', 'update')).toBe(true)
    expect(hasPermission('FIELD_MANAGER', 'booth_category', 'delete')).toBe(true)
  })

  it('can only read users', () => {
    expect(hasPermission('FIELD_MANAGER', 'user', 'read')).toBe(true)
    expect(hasPermission('FIELD_MANAGER', 'user', 'create')).toBe(false)
    expect(hasPermission('FIELD_MANAGER', 'user', 'update')).toBe(false)
    expect(hasPermission('FIELD_MANAGER', 'user', 'delete')).toBe(false)
  })

  it('has CRUD on cameras', () => {
    expect(hasPermission('FIELD_MANAGER', 'camera', 'create')).toBe(true)
    expect(hasPermission('FIELD_MANAGER', 'camera', 'read')).toBe(true)
    expect(hasPermission('FIELD_MANAGER', 'camera', 'update')).toBe(true)
    expect(hasPermission('FIELD_MANAGER', 'camera', 'delete')).toBe(true)
  })

  it('can only read reports', () => {
    expect(hasPermission('FIELD_MANAGER', 'report', 'read')).toBe(true)
    expect(hasPermission('FIELD_MANAGER', 'report', 'create')).toBe(false)
    expect(hasPermission('FIELD_MANAGER', 'report', 'delete')).toBe(false)
  })
})

describe('hasPermission — MARKET_MANAGER', () => {
  it('has no field permissions', () => {
    expect(hasPermission('MARKET_MANAGER', 'field', 'read')).toBe(false)
    expect(hasPermission('MARKET_MANAGER', 'field', 'create')).toBe(false)
    expect(hasPermission('MARKET_MANAGER', 'field', 'update')).toBe(false)
    expect(hasPermission('MARKET_MANAGER', 'field', 'delete')).toBe(false)
  })

  it('can only read markets', () => {
    expect(hasPermission('MARKET_MANAGER', 'market', 'read')).toBe(true)
    expect(hasPermission('MARKET_MANAGER', 'market', 'create')).toBe(false)
    expect(hasPermission('MARKET_MANAGER', 'market', 'update')).toBe(false)
    expect(hasPermission('MARKET_MANAGER', 'market', 'delete')).toBe(false)
  })

  it('has CRUD on booths', () => {
    expect(hasPermission('MARKET_MANAGER', 'booth', 'create')).toBe(true)
    expect(hasPermission('MARKET_MANAGER', 'booth', 'read')).toBe(true)
    expect(hasPermission('MARKET_MANAGER', 'booth', 'update')).toBe(true)
    expect(hasPermission('MARKET_MANAGER', 'booth', 'delete')).toBe(true)
  })

  it('can only read booth_category', () => {
    expect(hasPermission('MARKET_MANAGER', 'booth_category', 'read')).toBe(true)
    expect(hasPermission('MARKET_MANAGER', 'booth_category', 'create')).toBe(false)
    expect(hasPermission('MARKET_MANAGER', 'booth_category', 'update')).toBe(false)
    expect(hasPermission('MARKET_MANAGER', 'booth_category', 'delete')).toBe(false)
  })

  it('can only read users', () => {
    expect(hasPermission('MARKET_MANAGER', 'user', 'read')).toBe(true)
    expect(hasPermission('MARKET_MANAGER', 'user', 'create')).toBe(false)
  })

  it('can only read cameras', () => {
    expect(hasPermission('MARKET_MANAGER', 'camera', 'read')).toBe(true)
    expect(hasPermission('MARKET_MANAGER', 'camera', 'create')).toBe(false)
    expect(hasPermission('MARKET_MANAGER', 'camera', 'update')).toBe(false)
    expect(hasPermission('MARKET_MANAGER', 'camera', 'delete')).toBe(false)
  })

  it('can only read reports', () => {
    expect(hasPermission('MARKET_MANAGER', 'report', 'read')).toBe(true)
    expect(hasPermission('MARKET_MANAGER', 'report', 'create')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// checkPermission
// ---------------------------------------------------------------------------

describe('checkPermission', () => {
  const makeSession = (role: string): Session => ({
    user: { id: 'u1', role, name: 'Test User', email: 'test@example.com' },
    expires: '9999-01-01T00:00:00.000Z',
  })

  it('does not throw when permission is granted', () => {
    expect(() => checkPermission(makeSession('ORG_ADMIN'), 'field', 'create')).not.toThrow()
    expect(() => checkPermission(makeSession('FIELD_MANAGER'), 'market', 'create')).not.toThrow()
    expect(() => checkPermission(makeSession('MARKET_MANAGER'), 'booth', 'delete')).not.toThrow()
  })

  it('throws PermissionError when permission is denied', () => {
    expect(() => checkPermission(makeSession('MARKET_MANAGER'), 'field', 'read')).toThrow(PermissionError)
    expect(() => checkPermission(makeSession('FIELD_MANAGER'), 'field', 'create')).toThrow(PermissionError)
    expect(() => checkPermission(makeSession('MARKET_MANAGER'), 'camera', 'create')).toThrow(PermissionError)
  })
})

// ---------------------------------------------------------------------------
// PermissionError
// ---------------------------------------------------------------------------

describe('PermissionError', () => {
  it('is an instance of Error', () => {
    expect(new PermissionError()).toBeInstanceOf(Error)
  })

  it('has name "PermissionError" and message "Forbidden"', () => {
    const err = new PermissionError()
    expect(err.name).toBe('PermissionError')
    expect(err.message).toBe('Forbidden')
  })
})
