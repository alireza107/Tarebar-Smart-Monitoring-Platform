'use client'

import { useQuery } from '@tanstack/react-query'

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

const widgets: { key: keyof DashboardStats; label: string; colorClass: string }[] = [
  { key: 'fields',  label: 'میادین',        colorClass: 'text-blue-600' },
  { key: 'markets', label: 'بازارها',        colorClass: 'text-indigo-600' },
  { key: 'booths',  label: 'غرفه‌ها',        colorClass: 'text-purple-600' },
  { key: 'cameras', label: 'دوربین‌ها',      colorClass: 'text-gray-700' },
  { key: 'online',  label: 'دوربین آنلاین',  colorClass: 'text-green-600' },
  { key: 'offline', label: 'دوربین آفلاین',  colorClass: 'text-red-600' },
]

export function DashboardClient() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchStats,
    refetchInterval: 60_000,
  })

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">داشبورد</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {widgets.map(({ key, label, colorClass }) => {
          const value = data?.[key]
          return (
            <StatCard
              key={key}
              label={label}
              value={value === null ? '—' : isLoading ? '...' : isError ? '!' : String(value)}
              colorClass={colorClass}
            />
          )
        })}
      </div>
    </div>
  )
}

function StatCard({ label, value, colorClass }: { label: string; value: string; colorClass: string }) {
  return (
    <div className="rounded-lg border bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${colorClass}`}>{value}</p>
    </div>
  )
}
