import { db } from '@/lib/db'
import type { Role } from '@/lib/permissions'
import type { LocationHierarchy, LocationOption, ManagementLocationType } from './types'

type Scope = { fieldIds?: string[]; marketIds?: string[] }

async function resolveScope(userId: string, role: Role): Promise<Scope> {
  if (role === 'ORG_ADMIN') return {}
  const scopes = await db.userScope.findMany({
    where: { userId },
    select: { scopeType: true, fieldId: true, marketId: true },
  })
  if (role === 'FIELD_MANAGER') {
    return { fieldIds: scopes.flatMap((scope) => scope.fieldId ? [scope.fieldId] : []) }
  }
  return { marketIds: scopes.flatMap((scope) => scope.marketId ? [scope.marketId] : []) }
}

export const managementAnalyticsRepository = {
  async getLocationHierarchy(userId: string, role: Role): Promise<LocationHierarchy> {
    const scope = await resolveScope(userId, role)
    const marketWhere = scope.marketIds
      ? { id: { in: scope.marketIds }, deletedAt: null }
      : scope.fieldIds
        ? { fieldId: { in: scope.fieldIds }, deletedAt: null }
        : { deletedAt: null }

    const markets = await db.market.findMany({
      where: marketWhere,
      select: {
        id: true,
        name: true,
        fieldId: true,
        field: { select: { id: true, name: true } },
        cameras: { where: { deletedAt: null }, select: { id: true } },
        regions: { where: { deletedAt: null }, select: { id: true } },
        booths: {
          where: { deletedAt: null },
          select: {
            id: true,
            number: true,
            cameras: { where: { deletedAt: null }, select: { id: true } },
            regions: { where: { deletedAt: null }, select: { regionId: true } },
          },
        },
      },
      orderBy: [{ field: { name: 'asc' } }, { name: 'asc' }],
    })

    const visibleFieldIds = role === 'FIELD_MANAGER'
      ? (scope.fieldIds ?? [])
      : [...new Set(markets.map((market) => market.fieldId))]
    const visibleFields = role === 'MARKET_MANAGER'
      ? []
      : await db.field.findMany({
          where: role === 'ORG_ADMIN'
            ? { deletedAt: null }
            : { id: { in: visibleFieldIds }, deletedAt: null },
          select: {
            id: true,
            name: true,
            cameras: { where: { deletedAt: null }, select: { id: true } },
          },
          orderBy: { name: 'asc' },
        })

    const fieldMap = new Map<string, LocationOption>(visibleFields.map((field) => [field.id, {
      id: field.id,
      name: field.name,
      type: 'field' as const,
      parentId: 'organization',
      cameraCount: field.cameras.length,
      zoneCount: 0,
    }]))
    const marketOptions: LocationOption[] = []
    const boothOptions: LocationOption[] = []

    for (const market of markets) {
      const boothCameraCount = market.booths.reduce((sum, booth) => sum + booth.cameras.length, 0)
      const field = fieldMap.get(market.field.id)
      if (field) {
        field.cameraCount += market.cameras.length + boothCameraCount
        field.zoneCount += market.regions.length
      }

      marketOptions.push({
        id: market.id,
        name: market.name,
        type: 'market',
        parentId: market.field.id,
        parentName: market.field.name,
        cameraCount: market.cameras.length + boothCameraCount,
        zoneCount: market.regions.length,
      })

      for (const booth of market.booths) {
        boothOptions.push({
          id: booth.id,
          name: `غرفه ${booth.number}`,
          type: 'booth',
          parentId: market.id,
          parentName: market.name,
          marketId: market.id,
          cameraCount: booth.cameras.length,
          zoneCount: booth.regions.length,
        })
      }
    }

    const fields = [...fieldMap.values()]
    return {
      organization: {
        id: 'organization',
        name: 'کل سازمان',
        type: 'organization',
        parentId: null,
        cameraCount: (role === 'MARKET_MANAGER' ? marketOptions : fields).reduce((sum, location) => sum + location.cameraCount, 0),
        zoneCount: (role === 'MARKET_MANAGER' ? marketOptions : fields).reduce((sum, location) => sum + location.zoneCount, 0),
      },
      fields,
      markets: marketOptions,
      booths: boothOptions,
    }
  },

  async canAccessLocation(userId: string, role: Role, type: ManagementLocationType, id?: string) {
    // "organization" means the caller's complete authorized scope. It is global
    // only for ORG_ADMIN and automatically narrowed by getLocationHierarchy for managers.
    if (type === 'organization') return true
    if (!id) return false
    const hierarchy = await this.getLocationHierarchy(userId, role)
    const group = type === 'field' ? hierarchy.fields : type === 'market' ? hierarchy.markets : hierarchy.booths
    return group.some((location) => location.id === id)
  },
}
