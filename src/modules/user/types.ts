import type { Role } from '@/lib/permissions'

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
}
