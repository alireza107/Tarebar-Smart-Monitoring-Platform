'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { NAV_ITEMS } from '@/lib/nav-permissions'
import type { Role } from '@/lib/permissions'

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = session?.user?.role as Role | undefined

  const visibleItems = role
    ? NAV_ITEMS.filter((item) => item.roles.includes(role))
    : []

  return (
    <aside className="flex h-screen w-56 flex-col border-l bg-white">
      <div className="flex h-14 items-center border-b px-4">
        <span className="font-bold text-gray-800">تره‌بار هوشمند</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {visibleItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                    active
                      ? 'bg-blue-50 font-medium text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
