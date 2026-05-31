'use client'

import { useSession } from 'next-auth/react'
import { hasPermission } from '@/lib/permissions'
import type { Role, Resource, Action } from '@/lib/permissions'

export function usePermissions() {
  const { data: session } = useSession()
  const role = (session?.user?.role as Role) ?? null

  function can(resource: Resource, action: Action): boolean {
    if (!role) return false
    return hasPermission(role, resource, action)
  }

  return { role, can }
}
