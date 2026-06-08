import type { Session } from 'next-auth'

export type Role = 'ORG_ADMIN' | 'FIELD_MANAGER' | 'MARKET_MANAGER'
export type Resource = 'field' | 'market' | 'booth' | 'booth_category' | 'user' | 'camera' | 'report' | 'region'
export type Action = 'create' | 'read' | 'update' | 'delete'

type PermissionMatrix = Record<Role, Record<Resource, Action[]>>

const matrix: PermissionMatrix = {
  ORG_ADMIN: {
    field:          ['create', 'read', 'update', 'delete'],
    market:         ['create', 'read', 'update', 'delete'],
    booth:          ['create', 'read', 'update', 'delete'],
    booth_category: ['create', 'read', 'update', 'delete'],
    user:           ['create', 'read', 'update', 'delete'],
    camera:         ['create', 'read', 'update', 'delete'],
    report:         ['create', 'read', 'update', 'delete'],
    region:         ['create', 'read', 'update', 'delete'],
  },
  FIELD_MANAGER: {
    field:          ['read'],
    market:         ['create', 'read', 'update', 'delete'],
    booth:          ['create', 'read', 'update', 'delete'],
    booth_category: ['create', 'read', 'update', 'delete'],
    user:           ['read'],
    camera:         ['create', 'read', 'update', 'delete'],
    report:         ['read'],
    region:         ['create', 'read', 'update', 'delete'],
  },
  MARKET_MANAGER: {
    field:          [],
    market:         ['read'],
    booth:          ['create', 'read', 'update', 'delete'],
    booth_category: ['read'],
    user:           ['read'],
    camera:         ['read'],
    report:         ['read'],
    region:         ['create', 'read', 'update', 'delete'],
  },
}

export function hasPermission(role: Role, resource: Resource, action: Action): boolean {
  return matrix[role][resource].includes(action)
}

export function checkPermission(session: Session, resource: Resource, action: Action): void {
  const role = session.user.role as Role
  if (!hasPermission(role, resource, action)) {
    throw new PermissionError()
  }
}

export class PermissionError extends Error {
  constructor() {
    super('Forbidden')
    this.name = 'PermissionError'
  }
}
