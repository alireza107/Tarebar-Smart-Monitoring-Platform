import { db } from '@/lib/db'
import { boothLabel } from '@/lib/persian'

/** Location ids of a record after walking booth → market → field. */
export interface ResolvedLocation {
  fieldId: string | null
  marketId: string | null
  boothId: string | null
}

export interface LocationRef {
  fieldId?: string | null
  marketId?: string | null
  boothId?: string | null
}

/**
 * Resolve the complete location chain of a camera (or any record carrying the
 * same three nullable foreign keys). A camera attached to a booth also belongs
 * to that booth's market and field, even though only `boothId` is stored.
 */
export async function resolveLocation(ref: LocationRef): Promise<ResolvedLocation> {
  if (ref.boothId) {
    const booth = await db.booth.findFirst({
      where: { id: ref.boothId },
      select: { id: true, marketId: true, market: { select: { fieldId: true } } },
    })
    if (booth) {
      return { boothId: booth.id, marketId: booth.marketId, fieldId: booth.market.fieldId }
    }
  }
  if (ref.marketId) {
    const market = await db.market.findFirst({
      where: { id: ref.marketId },
      select: { id: true, fieldId: true },
    })
    if (market) return { boothId: null, marketId: market.id, fieldId: market.fieldId }
  }
  return { boothId: null, marketId: null, fieldId: ref.fieldId ?? null }
}

/** Human-readable names for a resolved location, used by reports and exports. */
export async function describeLocation(location: ResolvedLocation): Promise<{
  fieldName: string | null
  marketName: string | null
  boothName: string | null
}> {
  const [field, market, booth] = await Promise.all([
    location.fieldId
      ? db.field.findFirst({ where: { id: location.fieldId }, select: { name: true } })
      : null,
    location.marketId
      ? db.market.findFirst({ where: { id: location.marketId }, select: { name: true } })
      : null,
    location.boothId
      ? db.booth.findFirst({ where: { id: location.boothId }, select: { number: true } })
      : null,
  ])
  return {
    fieldName: field?.name ?? null,
    marketName: market?.name ?? null,
    boothName: booth ? boothLabel(booth.number) : null,
  }
}
