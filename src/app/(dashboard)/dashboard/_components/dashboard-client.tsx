'use client'

import { useQuery } from '@tanstack/react-query'
import { MapPin, Store, ShoppingBag, Camera, Wifi, WifiOff } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface DashboardStats {
  fields: number | null
  markets: number
  booths: number
  cameras: number
  online: number
  offline: number
}

async function fetchStats(): Promise<DashboardStats> {
  const res = await fetch('/api/dashboard/stats')
  if (!res.ok) throw new Error('خطا در دریافت آمار')
  const json = await res.json()
  return json.data
}

interface WidgetConfig {
  key: keyof DashboardStats
  label: string
  icon: LucideIcon
  iconBg: string
  iconColor: string
  valueColor: string
  borderColor: string
}

const widgets: WidgetConfig[] = [
  {
    key: 'fields',
    label: 'میادین',
    icon: MapPin,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    valueColor: 'text-emerald-700',
    borderColor: 'border-emerald-400',
  },
  {
    key: 'markets',
    label: 'بازارها',
    icon: Store,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    valueColor: 'text-blue-700',
    borderColor: 'border-blue-400',
  },
  {
    key: 'booths',
    label: 'غرفه‌ها',
    icon: ShoppingBag,
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
    valueColor: 'text-violet-700',
    borderColor: 'border-violet-400',
  },
  {
    key: 'cameras',
    label: 'کل دوربین‌ها',
    icon: Camera,
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-500',
    valueColor: 'text-slate-700',
    borderColor: 'border-slate-400',
  },
  {
    key: 'online',
    label: 'دوربین آنلاین',
    icon: Wifi,
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    valueColor: 'text-green-600',
    borderColor: 'border-green-400',
  },
  {
    key: 'offline',
    label: 'دوربین آفلاین',
    icon: WifiOff,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-500',
    valueColor: 'text-red-600',
    borderColor: 'border-red-400',
  },
]

export function DashboardClient() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchStats,
    refetchInterval: 60_000,
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground select-none">نمای کلی سیستم</h2>
        <p className="text-sm text-muted-foreground select-none mt-0.5">
          وضعیت لحظه‌ای زیرساخت‌های میدانی · بروزرسانی هر ۶۰ ثانیه
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {isLoading
          ? widgets.map((w) => <SkeletonCard key={w.key} />)
          : widgets.map((config) => {
              const raw = data?.[config.key]
              const value = isError
                ? '—'
                : raw === null
                ? '—'
                : String(raw)
              return <StatCard key={config.key} config={config} value={value} />
            })}
      </div>
    </div>
  )
}

function StatCard({ config, value }: { config: WidgetConfig; value: string }) {
  const { label, icon: Icon, iconBg, iconColor, valueColor, borderColor } = config
  return (
    <div
      className={`relative overflow-hidden rounded-xl border-r-4 bg-card px-5 py-4 shadow-sm ${borderColor}`}
    >
      {/* Watermark icon */}
      <div className="pointer-events-none absolute -left-3 -top-3 opacity-[0.04]">
        <Icon className="h-20 w-20" />
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground select-none">{label}</p>
          <p className={`text-3xl font-bold tracking-tight select-none ${valueColor}`}>
            {value}
          </p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border bg-card px-5 py-4 shadow-sm animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2 flex-1">
          <div className="h-3 w-20 rounded bg-muted" />
          <div className="h-8 w-12 rounded bg-muted" />
        </div>
        <div className="h-10 w-10 rounded-lg bg-muted shrink-0" />
      </div>
    </div>
  )
}
