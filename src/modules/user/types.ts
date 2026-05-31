import type { Role } from '@/lib/permissions'

export interface UserScopeRecord {
  id: string
  scopeType: 'FIELD' | 'MARKET'
  fieldId: string | null
  marketId: string | null
  field: { id: string; name: string } | null
  market: { id: string; name: string } | null
}

export interface User {
  id: string
  username: string
  name: string
  email: string | null
  role: Role
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  scopes: UserScopeRecord[]
}
