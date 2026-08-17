'use client'

import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { Bell, Menu } from 'lucide-react'
import { useVisibleNavigation } from './sidebar'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'نمای کلی', '/live-operations': 'عملیات زنده', '/live-analytics': 'تحلیل زنده دوربین‌ها',
  '/analytics': 'تحلیل ویدیوی ضبط‌شده', '/traffic-density': 'تردد و تراکم',
  '/queue-service': 'صف و خدمت‌رسانی', '/spatial': 'نقشه حرارتی و رفتار مکانی', '/events': 'رویدادها',
  '/compare-locations': 'مقایسه مکان‌ها', '/reports': 'گزارش‌ها', '/locations': 'مدیریت نواحی',
  '/system-health': 'سلامت سامانه', '/settings': 'مدیریت دسترسی', '/fields': 'مدیریت میادین',
  '/markets': 'مدیریت بازارها', '/booths': 'مدیریت غرفه‌ها', '/cameras': 'مدیریت دوربین‌ها',
  '/regions': 'مدیریت نواحی', '/monitoring': 'مانیتورینگ زنده', '/users': 'مدیریت کاربران',
}

function getPageTitle(pathname: string) { return Object.entries(PAGE_TITLES).find(([path]) => pathname === path || pathname.startsWith(`${path}/`))?.[1] ?? 'پلتفرم هوشمند تره‌بار' }
function getInitials(name?: string | null) { const parts = name?.trim().split(/\s+/) ?? []; return parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0]?.[0] ?? '؟' }

export function Header() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const items = useVisibleNavigation()
  return <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b bg-card/80 px-3 backdrop-blur-sm sm:px-6">
    <div className="flex items-center gap-2">
      <details className="relative md:hidden"><summary className="flex size-8 cursor-pointer list-none items-center justify-center rounded-lg hover:bg-accent"><Menu className="size-4" /></summary><nav className="absolute right-0 top-10 z-50 w-64 rounded-xl border bg-card p-2 shadow-xl"><ul className="max-h-[70vh] space-y-1 overflow-y-auto">{items.map((item) => <li key={item.href}><Link href={item.href} className={`block rounded-lg px-3 py-2 text-xs ${pathname.startsWith(item.href) ? 'bg-primary/10 text-primary' : 'hover:bg-accent'}`}>{item.label}</Link></li>)}</ul></nav></details>
      <h1 className="text-sm font-semibold sm:text-base">{getPageTitle(pathname)}</h1>
    </div>
    <div className="flex items-center gap-2"><button className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent" title="اعلان‌ها"><Bell className="size-4" /></button><div className="h-5 w-px bg-border" /><div className="flex items-center gap-2"><div className="flex size-7 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">{getInitials(session?.user?.name)}</div><span className="hidden text-sm text-foreground/75 lg:block">{session?.user?.name}</span></div><button onClick={() => signOut({ callbackUrl: '/login' })} className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-destructive">خروج</button></div>
  </header>
}
