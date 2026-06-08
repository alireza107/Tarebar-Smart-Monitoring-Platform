import { NextResponse } from 'next/server'
import type { ZodError } from 'zod'

export const unauthorized = () =>
  NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

export const forbidden = () =>
  NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

export const notFound = (message = 'Not found') =>
  NextResponse.json({ error: message, code: 'NOT_FOUND' }, { status: 404 })

export const validationError = (error: ZodError) =>
  NextResponse.json({ error: error.flatten(), code: 'VALIDATION_ERROR' }, { status: 422 })

export const conflict = (message = 'Conflict') =>
  NextResponse.json({ error: message, code: 'CONFLICT' }, { status: 409 })

export const badRequest = (message = 'Bad request') =>
  NextResponse.json({ error: message, code: 'BAD_REQUEST' }, { status: 400 })

export const serverError = (message = 'Internal server error') =>
  NextResponse.json({ error: message, code: 'INTERNAL_ERROR' }, { status: 500 })
