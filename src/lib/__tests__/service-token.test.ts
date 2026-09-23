import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { mintServiceToken, serviceAuthEnabled, serviceAuthHeaders, SERVICE_TOKEN_TTL_SECONDS } from '../service-token'

const original = process.env.SERVICE_AUTH_SECRET
afterEach(() => {
  if (original === undefined) delete process.env.SERVICE_AUTH_SECRET
  else process.env.SERVICE_AUTH_SECRET = original
})

describe('service token', () => {
  it('is disabled when no secret is configured', () => {
    delete process.env.SERVICE_AUTH_SECRET
    expect(serviceAuthEnabled()).toBe(false)
    expect(mintServiceToken({ id: 'u1', role: 'ORG_ADMIN' })).toBeNull()
    expect(serviceAuthHeaders({ id: 'u1', role: 'ORG_ADMIN' })).toEqual({})
  })

  it('mints an unpadded HS256 compact token the Python services can verify', () => {
    process.env.SERVICE_AUTH_SECRET = 'test-secret'
    const now = Date.UTC(2026, 8, 18, 12, 0, 0)
    const minted = mintServiceToken({ id: 'user-1', role: 'MARKET_MANAGER' }, now)!
    const [header, payload, signature] = minted.token.split('.')
    expect(minted.token).not.toContain('=')
    expect(JSON.parse(Buffer.from(header, 'base64url').toString())).toEqual({ alg: 'HS256', typ: 'JWT' })
    expect(JSON.parse(Buffer.from(payload, 'base64url').toString())).toEqual({
      iss: 'tarebar', sub: 'user-1', role: 'MARKET_MANAGER', iat: now / 1000, exp: now / 1000 + SERVICE_TOKEN_TTL_SECONDS,
    })
    expect(signature).toBe(createHmac('sha256', 'test-secret').update(`${header}.${payload}`).digest('base64url'))
    expect(minted.expiresAt).toBe(now + SERVICE_TOKEN_TTL_SECONDS * 1000)
    expect(serviceAuthHeaders({ id: 'user-1', role: 'MARKET_MANAGER' }).Authorization).toMatch(/^Bearer /)
  })
})
