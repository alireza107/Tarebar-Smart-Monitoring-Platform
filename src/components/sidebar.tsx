'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard',        label: 'داشبورد' },
  { href: '/fields',           label: 'میادین' },
  { href: '/markets',          label: 'بازارها' },
  { href: '/booths',           label: 'غرفه‌ها' },
  { href: '/booth-categories', label: 'دسته‌بندی غرفه' },
  { href: '/users',            label: 'کاربران' },
  { href: '/cameras',          label: 'دوربین‌ها' },
  { href: '/monitoring',       label: 'مانیتورینگ' },
  { href: '/reports',          label: 'گزارش‌ها' },
  { href: '/settings',         label: 'تنظیمات' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-56 flex-col border-l bg-white">
      <div className="flex h-14 items-center border-b px-4">
        <span className="font-bold text-gray-800">تره‌بار هوشمند</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => {
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
