'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { NAV_ITEMS } from '@/lib/nav-permissions'
import type { Role } from '@/lib/permissions'
import {
  LayoutDashboard,
  MapPin,
  Store,
  ShoppingBag,
  Tag,
  Users,
  Camera,
  Monitor,
  BarChart3,
  Settings,
  Shapes,
} from 'lucide-react'

const NAV_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  '/dashboard':        LayoutDashboard,
  '/fields':           MapPin,
  '/markets':          Store,
  '/booths':           ShoppingBag,
  '/booth-categories': Tag,
  '/users':            Users,
  '/cameras':          Camera,
  '/regions':          Shapes,
  '/monitoring':       Monitor,
  '/reports':          BarChart3,
  '/settings':         Settings,
}

const NAV_GROUPS = [
  { label: 'عملیات',  hrefs: ['/dashboard', '/monitoring', '/reports'] },
  { label: 'مدیریت',  hrefs: ['/fields', '/markets', '/booths', '/booth-categories'] },
  { label: 'سیستم',   hrefs: ['/users', '/cameras', '/regions', '/settings'] },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = session?.user?.role as Role | undefined

  const visibleItems = role
    ? NAV_ITEMS.filter((item) => item.roles.includes(role))
    : []

  return (
    <aside className="flex h-screen w-60 flex-col bg-sidebar border-l border-sidebar-border">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 px-4 border-b border-sidebar-border shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/30">
          <Monitor className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="flex flex-col gap-0.5 leading-none">
          <span className="text-sm font-bold text-sidebar-foreground">تره‌بار هوشمند</span>
          <span className="text-[10px] text-sidebar-foreground/35 tracking-wide">Smart Monitoring</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {NAV_GROUPS.map((group) => {
          const items = visibleItems.filter((i) => group.hrefs.includes(i.href))
          if (items.length === 0) return null
          return (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30 select-none">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active =
                    pathname === item.href || pathname.startsWith(item.href + '/')
                  const Icon = NAV_ICONS[item.href] ?? LayoutDashboard
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150 ${
                          active
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                            : 'text-sidebar-foreground/55 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                        }`}
                      >
                        <Icon
                          className={`h-4 w-4 shrink-0 transition-colors ${
                            active ? 'text-emerald-400' : ''
                          }`}
                        />
                        <span className="flex-1">{item.label}</span>
                        {active && (
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      {/* System status */}
      <div className="shrink-0 border-t border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs text-sidebar-foreground/45 select-none">سیستم فعال</span>
        </div>
      </div>
    </aside>
  )
}
