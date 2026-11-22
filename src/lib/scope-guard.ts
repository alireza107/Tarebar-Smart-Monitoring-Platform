import { db } from '@/lib/db'
import { resolveLocation, type LocationRef } from '@/lib/location'
import type { Role } from '@/lib/permissions'

export class ScopeError extends Error {
  constructor() {
    super('Forbidden: resource outside your assigned scope')
    this.name = 'ScopeError'
  }
}

export interface UserScopeIds {
  fieldIds: string[]
  marketIds: string[]
}

/** Field and market ids a user is assigned to through UserScope rows. */
export async function getUserScopeIds(userId: string): Promise<UserScopeIds> {
  const scopes = await db.userScope.findMany({
    where: { userId },
    select: { scopeType: true, fieldId: true, marketId: true },
  })
  return {
    fieldIds: scopes.flatMap(s => (s.scopeType === 'FIELD' && s.fieldId ? [s.fieldId] : [])),
    marketIds: scopes.flatMap(s => (s.scopeType === 'MARKET' && s.marketId ? [s.marketId] : [])),
  }
}

/** Asserts that a fieldId belongs to FIELD_MANAGER's assigned field. ORG_ADMIN always passes. */
export async function assertFieldScope(userId: string, role: Role, fieldId: string): Promise<void> {
  if (role === 'ORG_ADMIN') return
  if (role === 'FIELD_MANAGER') {
    const { fieldIds } = await getUserScopeIds(userId)
    if (!fieldIds.includes(fieldId)) throw new ScopeError()
    return
  }
  throw new ScopeError()
}

/**
 * Asserts that a marketId is within the user's scope.
 * FIELD_MANAGER: market's fieldId must be in their assigned field(s).
 * MARKET_MANAGER: market must be directly in their assigned market(s).
 * ORG_ADMIN: always passes.
 */
export async function assertMarketScope(userId: string, role: Role, marketId: string): Promise<void> {
  if (role === 'ORG_ADMIN') return

  if (role === 'FIELD_MANAGER') {
    const market = await db.market.findFirst({
      where: { id: marketId, deletedAt: null },
      select: { fieldId: true },
    })
    if (!market) throw new ScopeError()
    const { fieldIds } = await getUserScopeIds(userId)
    if (!fieldIds.includes(market.fieldId)) throw new ScopeError()
    return
  }

  if (role === 'MARKET_MANAGER') {
    const { marketIds } = await getUserScopeIds(userId)
    if (!marketIds.includes(marketId)) throw new ScopeError()
    return
  }

  throw new ScopeError()
}

/**
 * Asserts that a location (field / market / booth ids of a camera or a report
 * record) is within the user's scope. The location is resolved through
 * booth → market → field first, so a booth camera is in scope for the manager of
 * its market and of its field.
 *
 * - ORG_ADMIN: always passes.
 * - FIELD_MANAGER: the resolved field must be assigned. A record with no
 *   location at all passes (it is not tied to anybody else's scope).
 * - MARKET_MANAGER: the resolved market must be assigned. Field-level and
 *   unassigned records are outside a market manager's scope.
 */
export async function assertLocationScope(
  userId: string,
  role: Role,
  ref: LocationRef,
): Promise<void> {
  if (role === 'ORG_ADMIN') return

  const hasLocation = Boolean(ref.fieldId || ref.marketId || ref.boothId)
  const location = await resolveLocation(ref)
  const scope = await getUserScopeIds(userId)

  if (role === 'FIELD_MANAGER') {
    if (!hasLocation) return
    if (!location.fieldId || !scope.fieldIds.includes(location.fieldId)) throw new ScopeError()
    return
  }

  if (role === 'MARKET_MANAGER') {
    if (!location.marketId || !scope.marketIds.includes(location.marketId)) throw new ScopeError()
    return
  }

  throw new ScopeError()
}

/**
 * Asserts that a camera's assigned location is within the user's scope.
 * Kept as a named export because every camera route uses it.
 */
export async function assertCameraScope(
  userId: string,
  role: Role,
  camera: LocationRef,
): Promise<void> {
  await assertLocationScope(userId, role, camera)
}

/**
 * Asserts that a Region is within the user's scope.
 * A Region is anchored to a Market, so its scope is exactly the Market's scope.
 */
export async function assertRegionScope(userId: string, role: Role, marketId: string): Promise<void> {
  await assertMarketScope(userId, role, marketId)
}
