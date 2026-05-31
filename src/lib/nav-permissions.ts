import type { Role } from '@/lib/permissions'

export type NavItem = {
  href: string
  label: string
  roles: Role[]
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'داشبورد',
    roles: ['ORG_ADMIN', 'FIELD_MANAGER', 'MARKET_MANAGER'],
  },
  {
    href: '/fields',
    label: 'میادین',
    roles: ['ORG_ADMIN'],
  },
  {
    href: '/markets',
    label: 'بازارها',
    roles: ['ORG_ADMIN', 'FIELD_MANAGER'],
  },
  {
    href: '/booths',
    label: 'غرفه‌ها',
    roles: ['ORG_ADMIN', 'FIELD_MANAGER', 'MARKET_MANAGER'],
  },
  {
    href: '/booth-categories',
    label: 'دسته‌بندی غرفه',
    roles: ['ORG_ADMIN', 'FIELD_MANAGER', 'MARKET_MANAGER'],
  },
  {
    href: '/users',
    label: 'کاربران',
    roles: ['ORG_ADMIN'],
  },
  {
    href: '/cameras',
    label: 'دوربین‌ها',
    roles: ['ORG_ADMIN', 'FIELD_MANAGER', 'MARKET_MANAGER'],
  },
  {
    href: '/monitoring',
    label: 'مانیتورینگ',
    roles: ['ORG_ADMIN', 'FIELD_MANAGER', 'MARKET_MANAGER'],
  },
  {
    href: '/reports',
    label: 'گزارش‌ها',
    roles: ['ORG_ADMIN', 'FIELD_MANAGER', 'MARKET_MANAGER'],
  },
  {
    href: '/settings',
    label: 'تنظیمات',
    roles: ['ORG_ADMIN'],
  },
]

export function canAccessRoute(role: Role, pathname: string): boolean {
  const item = NAV_ITEMS.find(
    (i) => pathname === i.href || pathname.startsWith(i.href + '/'),
  )
  if (!item) return true
  return item.roles.includes(role)
}
