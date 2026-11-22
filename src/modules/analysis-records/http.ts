import type { Session } from 'next-auth'
import type { Role } from '@/lib/permissions'
import { assertLocationScope } from '@/lib/scope-guard'
import { recordQuerySchema, type RecordQuery } from './schema'
import { managementAnalyticsRepository } from '@/modules/management-analytics/repository'

export function parseRecordQuery(url: URL) {
  return recordQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()))
}

/** A location filter may only name a location inside the caller's scope. */
export async function canQueryLocation(session: Session, query: RecordQuery): Promise<boolean> {
  return managementAnalyticsRepository.canAccessLocation(
    session.user.id,
    session.user.role as Role,
    query.locationType,
    query.locationId,
  )
}

/** Location an uploaded analysis is filed under; throws ScopeError outside the caller's scope. */
export async function resolveUploadTarget(
  session: Session,
  locationType?: 'field' | 'market' | 'booth',
  locationId?: string,
) {
  if (!locationType || !locationId) return {}
  const target = {
    fieldId: locationType === 'field' ? locationId : null,
    marketId: locationType === 'market' ? locationId : null,
    boothId: locationType === 'booth' ? locationId : null,
  }
  await assertLocationScope(session.user.id, session.user.role as Role, target)
  return target
}
