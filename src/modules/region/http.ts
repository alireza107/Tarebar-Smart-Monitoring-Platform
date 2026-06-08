import { NextResponse } from 'next/server'
import { badRequest, conflict, forbidden, notFound, serverError } from '@/lib/api-responses'
import { PermissionError } from '@/lib/permissions'
import { ScopeError } from '@/lib/scope-guard'
import { RegionServiceError } from './service'

/** Map any thrown error from a region route into the right HTTP response. */
export function regionErrorResponse(e: unknown): NextResponse {
  if (e instanceof PermissionError || e instanceof ScopeError) return forbidden()
  if (e instanceof RegionServiceError) {
    if (e.kind === 'conflict') return conflict(e.message)
    if (e.kind === 'not_found') return notFound(e.message)
    return badRequest(e.message)
  }
  return serverError()
}
