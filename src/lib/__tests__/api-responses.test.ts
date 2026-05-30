import { describe, it, expect, vi } from 'vitest'

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))

import { unauthorized, forbidden, notFound, validationError, serverError } from '../api-responses'

describe('unauthorized', () => {
  it('returns status 401', () => {
    expect(unauthorized().status).toBe(401)
  })

  it('returns UNAUTHORIZED code', async () => {
    const body = await unauthorized().json()
    expect(body).toMatchObject({ code: 'UNAUTHORIZED' })
  })
})

describe('forbidden', () => {
  it('returns status 403', () => {
    expect(forbidden().status).toBe(403)
  })

  it('returns FORBIDDEN code', async () => {
    const body = await forbidden().json()
    expect(body).toMatchObject({ code: 'FORBIDDEN' })
  })
})

describe('notFound', () => {
  it('returns status 404', () => {
    expect(notFound().status).toBe(404)
  })

  it('returns NOT_FOUND code', async () => {
    const body = await notFound().json()
    expect(body).toMatchObject({ code: 'NOT_FOUND' })
  })

  it('uses default message when none provided', async () => {
    const body = await notFound().json()
    expect(body.error).toBe('Not found')
  })

  it('uses custom message when provided', async () => {
    const body = await notFound('Field not found').json()
    expect(body.error).toBe('Field not found')
  })
})

describe('validationError', () => {
  it('returns status 422', () => {
    const fakeError = { flatten: () => ({ fieldErrors: {}, formErrors: [] }) } as never
    expect(validationError(fakeError).status).toBe(422)
  })

  it('returns VALIDATION_ERROR code', async () => {
    const fakeError = { flatten: () => ({ fieldErrors: { name: ['Required'] }, formErrors: [] }) } as never
    const body = await validationError(fakeError).json()
    expect(body).toMatchObject({ code: 'VALIDATION_ERROR' })
    expect(body.error.fieldErrors.name).toEqual(['Required'])
  })
})

describe('serverError', () => {
  it('returns status 500', () => {
    expect(serverError().status).toBe(500)
  })

  it('returns INTERNAL_ERROR code', async () => {
    const body = await serverError().json()
    expect(body).toMatchObject({ code: 'INTERNAL_ERROR' })
  })

  it('uses default message when none provided', async () => {
    const body = await serverError().json()
    expect(body.error).toBe('Internal server error')
  })

  it('uses custom message when provided', async () => {
    const body = await serverError('Database unavailable').json()
    expect(body.error).toBe('Database unavailable')
  })
})
