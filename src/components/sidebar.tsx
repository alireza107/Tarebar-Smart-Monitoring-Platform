'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { NAV_ITEMS } from '@/lib/nav-permissions'
import type { Role } from '@/lib/permissions'
import {
  Activity, BarChart3, BellRing, BrainCircuit, Building2, ChartNoAxesCombined,
  Film, GitCompareArrows, HeartPulse, LayoutDashboard, Map, Monitor, Settings,
  TimerReset,
} from 'lucide-react'

const NAV_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  '/dashboard': LayoutDashboard,
  '/live-operations': Monitor,
  '/live-analytics': BrainCircuit,
  '/analytics': Film,
  '/traffic-density': ChartNoAxesCombined,
  '/queue-service': TimerReset,
  '/spatial': Map,
  '/events': BellRing,
  '/compare-locations': GitCompareArrows,
  '/reports': BarChart3,
  '/locations': Building2,
  '/system-health': HeartPulse,
  '/settings': Settings,
}

const GROUPS = [
  { id: 'analytics', label: 'تحلیل و عملیات' },
  { id: 'management', label: 'مدیریت ساختار' },
  { id: 'system', label: 'سامانه' },
] as const

export function useVisibleNavigation() {
  const { data: session } = useSession()
  const role = session?.user?.role as Role | undefined
  return role ? NAV_ITEMS.filter((item) => !item.hidden && item.roles.includes(role)) : []
}

export function Sidebar() {
  const pathname = usePathname()
  const visibleItems = useVisibleNavigation()
  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-l border-sidebar-border bg-sidebar md:flex">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/30"><Activity className="size-4 text-emerald-400" /></div>
        <div className="leading-none"><span className="block text-sm font-bold text-sidebar-foreground">تره‌بار هوشمند</span><span className="mt-1 block text-[10px] text-sidebar-foreground/35">Location Intelligence</span></div>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {GROUPS.map((group) => {
          const items = visibleItems.filter((item) => item.group === group.id)
          if (items.length === 0) return null
          return <div key={group.id}><p className="mb-1.5 px-3 text-[10px] font-semibold text-sidebar-foreground/30">{group.label}</p><ul className="space-y-0.5">{items.map((item) => <NavigationItem key={item.href} item={item} active={pathname === item.href || pathname.startsWith(`${item.href}/`)} />)}</ul></div>
        })}
      </nav>
      <div className="shrink-0 border-t border-sidebar-border px-4 py-3"><div className="flex items-center gap-2"><span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-emerald-500" /></span><span className="text-xs text-sidebar-foreground/45">سامانه فعال</span></div></div>
    </aside>
  )
}

function NavigationItem({ item, active }: { item: (typeof NAV_ITEMS)[number]; active: boolean }) {
  const Icon = NAV_ICONS[item.href] ?? LayoutDashboard
  return <li><Link href={item.href} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition ${active ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground' : 'text-sidebar-foreground/55 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'}`}><Icon className={`size-4 shrink-0 ${active ? 'text-emerald-400' : ''}`} /><span className="flex-1">{item.label}</span>{active && <span className="size-1.5 rounded-full bg-emerald-400" />}</Link></li>
}
