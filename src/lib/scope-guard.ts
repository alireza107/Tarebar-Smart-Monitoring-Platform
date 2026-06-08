import { db } from '@/lib/db'
import type { Role } from '@/lib/permissions'

export class ScopeError extends Error {
  constructor() {
    super('Forbidden: resource outside your assigned scope')
    this.name = 'ScopeError'
  }
}

async function getUserFieldIds(userId: string): Promise<string[]> {
  const scopes = await db.userScope.findMany({
    where: { userId, scopeType: 'FIELD' },
    select: { fieldId: true },
  })
  return scopes.map(s => s.fieldId).filter((id): id is string => id !== null)
}

async function getUserMarketIds(userId: string): Promise<string[]> {
  const scopes = await db.userScope.findMany({
    where: { userId, scopeType: 'MARKET' },
    select: { marketId: true },
  })
  return scopes.map(s => s.marketId).filter((id): id is string => id !== null)
}

/** Asserts that a fieldId belongs to FIELD_MANAGER's assigned field. ORG_ADMIN always passes. */
export async function assertFieldScope(userId: string, role: Role, fieldId: string): Promise<void> {
  if (role === 'ORG_ADMIN') return
  if (role === 'FIELD_MANAGER') {
    const fieldIds = await getUserFieldIds(userId)
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
    const fieldIds = await getUserFieldIds(userId)
    if (!fieldIds.includes(market.fieldId)) throw new ScopeError()
    return
  }

  if (role === 'MARKET_MANAGER') {
    const marketIds = await getUserMarketIds(userId)
    if (!marketIds.includes(marketId)) throw new ScopeError()
    return
  }

  throw new ScopeError()
}

/**
 * Asserts that a camera's assigned location (field/market/booth) is within the user's scope.
 * Only relevant for FIELD_MANAGER. Cameras with no location always pass.
 */
export async function assertCameraScope(
  userId: string,
  role: Role,
  camera: { fieldId?: string | null; marketId?: string | null; boothId?: string | null },
): Promise<void> {
  if (role === 'ORG_ADMIN') return
  if (role !== 'FIELD_MANAGER') throw new ScopeError()

  // Unassigned camera — no location to validate
  if (!camera.fieldId && !camera.marketId && !camera.boothId) return

  const fieldIds = await getUserFieldIds(userId)

  if (camera.fieldId) {
    if (!fieldIds.includes(camera.fieldId)) throw new ScopeError()
    return
  }

  if (camera.marketId) {
    const market = await db.market.findFirst({
      where: { id: camera.marketId },
      select: { fieldId: true },
    })
    if (!market || !fieldIds.includes(market.fieldId)) throw new ScopeError()
    return
  }

  if (camera.boothId) {
    const booth = await db.booth.findFirst({
      where: { id: camera.boothId },
      include: { market: { select: { fieldId: true } } },
    })
    if (!booth || !fieldIds.includes(booth.market.fieldId)) throw new ScopeError()
    return
  }
}

/**
 * Asserts that a Region is within the user's scope.
 * A Region is anchored to a Market, so its scope is exactly the Market's scope.
 */
export async function assertRegionScope(userId: string, role: Role, marketId: string): Promise<void> {
  await assertMarketScope(userId, role, marketId)
}
