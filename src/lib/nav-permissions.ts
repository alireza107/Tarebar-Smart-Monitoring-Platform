import type { Role } from '@/lib/permissions'

export type NavItem = {
  href: string
  label: string
  roles: Role[]
  group?: 'analytics' | 'management' | 'system'
  hidden?: boolean
}

const ALL_ROLES: Role[] = ['ORG_ADMIN', 'FIELD_MANAGER', 'MARKET_MANAGER']

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'نمای کلی', roles: ALL_ROLES, group: 'analytics' },
  { href: '/live-operations', label: 'عملیات زنده', roles: ALL_ROLES, group: 'analytics' },
  { href: '/live-analytics', label: 'تحلیل زنده دوربین‌ها', roles: ALL_ROLES, group: 'analytics' },
  { href: '/analytics', label: 'تحلیل ویدیوی ضبط‌شده', roles: ALL_ROLES, group: 'analytics' },
  { href: '/traffic-density', label: 'تردد و تراکم', roles: ALL_ROLES, group: 'analytics' },
  { href: '/queue-service', label: 'صف و خدمت‌رسانی', roles: ALL_ROLES, group: 'analytics' },
  { href: '/spatial', label: 'نقشه حرارتی و رفتار مکانی', roles: ALL_ROLES, group: 'analytics' },
  { href: '/events', label: 'رویدادها', roles: ALL_ROLES, group: 'analytics' },
  { href: '/compare-locations', label: 'مقایسه مکان‌ها', roles: ALL_ROLES, group: 'analytics' },
  { href: '/reports', label: 'گزارش‌ها', roles: ALL_ROLES, group: 'analytics' },
  { href: '/locations', label: 'مدیریت نواحی', roles: ALL_ROLES, group: 'management' },
  { href: '/system-health', label: 'سلامت سامانه', roles: ALL_ROLES, group: 'system' },
  { href: '/settings', label: 'مدیریت دسترسی', roles: ['ORG_ADMIN'], group: 'management' },

  // Legacy administration routes stay reachable from Locations/Settings.
  { href: '/fields', label: 'میادین', roles: ['ORG_ADMIN'], hidden: true },
  { href: '/markets', label: 'بازارها', roles: ['ORG_ADMIN', 'FIELD_MANAGER'], hidden: true },
  { href: '/booths', label: 'غرفه‌ها', roles: ALL_ROLES, hidden: true },
  { href: '/booth-categories', label: 'دسته‌بندی غرفه', roles: ALL_ROLES, hidden: true },
  { href: '/users', label: 'کاربران', roles: ['ORG_ADMIN'], hidden: true },
  { href: '/cameras', label: 'دوربین‌ها', roles: ALL_ROLES, hidden: true },
  { href: '/regions', label: 'مناطق', roles: ALL_ROLES, hidden: true },
  { href: '/monitoring', label: 'مانیتورینگ', roles: ALL_ROLES, hidden: true },
]

export function canAccessRoute(role: Role, pathname: string): boolean {
  const item = NAV_ITEMS.find((candidate) => pathname === candidate.href || pathname.startsWith(candidate.href + '/'))
  if (!item) return true
  return item.roles.includes(role)
}
