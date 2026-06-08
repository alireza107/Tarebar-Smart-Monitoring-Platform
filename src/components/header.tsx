'use client'

import { signOut, useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':        'داشبورد',
  '/fields':           'مدیریت میادین',
  '/markets':          'مدیریت بازارها',
  '/booths':           'مدیریت غرفه‌ها',
  '/booth-categories': 'دسته‌بندی غرفه',
  '/users':            'مدیریت کاربران',
  '/cameras':          'مدیریت دوربین‌ها',
  '/monitoring':       'مانیتورینگ زنده',
  '/reports':          'گزارش‌ها و تحلیل',
  '/settings':         'تنظیمات سیستم',
}

function getPageTitle(pathname: string): string {
  for (const [path, title] of Object.entries(PAGE_TITLES)) {
    if (pathname === path || pathname.startsWith(path + '/')) return title
  }
  return 'پلتفرم هوشمند تره‌بار'
}

function getInitials(name?: string | null): string {
  if (!name) return '؟'
  const parts = name.trim().split(/\s+/)
  return parts.length > 1
    ? parts[0].charAt(0) + parts[1].charAt(0)
    : parts[0].charAt(0)
}

export function Header() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const pageTitle = getPageTitle(pathname)

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card/80 backdrop-blur-sm px-6 gap-4">
      <h1 className="text-base font-semibold text-foreground select-none">{pageTitle}</h1>

      <div className="flex items-center gap-2">
        {/* Notification placeholder */}
        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title="اعلان‌ها"
        >
          <Bell className="h-4 w-4" />
        </button>

        <div className="h-5 w-px bg-border mx-1" />

        {/* User */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-semibold select-none">
            {getInitials(session?.user?.name)}
          </div>
          <span className="hidden sm:block text-sm text-foreground/75 select-none">
            {session?.user?.name}
          </span>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded select-none"
        >
          خروج
        </button>
      </div>
    </header>
  )
}
