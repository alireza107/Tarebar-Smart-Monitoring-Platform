'use client'

import { useQuery } from '@tanstack/react-query'
import { Camera, Wifi, WifiOff, HelpCircle, Store, BarChart3 } from 'lucide-react'
import type { ReportsData } from '@/modules/report/types'

async function fetchReports(): Promise<ReportsData> {
  const res = await fetch('/api/reports')
  if (!res.ok) throw new Error('خطا در دریافت گزارش‌ها')
  const json = await res.json()
  return json.data
}

export function ReportsClient() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports'],
    queryFn: fetchReports,
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <ReportsSkeleton />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-10 text-center">
        <BarChart3 className="mx-auto h-10 w-10 text-destructive/40 mb-3" />
        <p className="text-sm font-medium text-destructive">خطا در دریافت گزارش‌ها</p>
      </div>
    )
  }

  const { cameraStatus, camerasByField, boothsByMarket } = data
  const onlineRatio =
    cameraStatus.total > 0
      ? Math.round((cameraStatus.online / cameraStatus.total) * 100)
      : 0

  return (
    <div className="space-y-8">
      {/* Camera Status */}
      <section className="space-y-4">
        <SectionHeader icon={Camera} title="خلاصه وضعیت دوربین‌ها" />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStatCard
            label="کل"
            value={cameraStatus.total}
            icon={Camera}
            iconBg="bg-slate-100"
            iconColor="text-slate-500"
            valueColor="text-slate-700"
          />
          <MiniStatCard
            label="آنلاین"
            value={cameraStatus.online}
            icon={Wifi}
            iconBg="bg-green-100"
            iconColor="text-green-600"
            valueColor="text-green-600"
          />
          <MiniStatCard
            label="آفلاین"
            value={cameraStatus.offline}
            icon={WifiOff}
            iconBg="bg-red-100"
            iconColor="text-red-500"
            valueColor="text-red-600"
          />
          <MiniStatCard
            label="نامشخص"
            value={cameraStatus.unknown}
            icon={HelpCircle}
            iconBg="bg-amber-100"
            iconColor="text-amber-500"
            valueColor="text-amber-600"
          />
        </div>

        {/* Online health bar */}
        {cameraStatus.total > 0 && (
          <div className="rounded-xl border bg-card px-5 py-4 shadow-sm space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground select-none">
              <span>سلامت شبکه دوربین‌ها</span>
              <span className="font-semibold text-foreground">{onlineRatio}٪ آنلاین</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  onlineRatio >= 80
                    ? 'bg-emerald-500'
                    : onlineRatio >= 50
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${onlineRatio}%` }}
              />
            </div>
          </div>
        )}
      </section>

      {/* Cameras per Field */}
      {camerasByField.length > 0 && (
        <section className="space-y-4">
          <SectionHeader icon={BarChart3} title="دوربین‌ها به تفکیک میدان" />
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-right">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">میدان</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">کل</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-green-600">آنلاین</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-red-500">آفلاین</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-amber-500">نامشخص</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {camerasByField.map((row) => (
                  <tr key={row.fieldId} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{row.fieldName}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{row.total}</td>
                    <td className="px-4 py-3 text-center font-semibold text-green-600">{row.online}</td>
                    <td className="px-4 py-3 text-center font-semibold text-red-500">{row.offline}</td>
                    <td className="px-4 py-3 text-center text-amber-500">{row.unknown}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Booths per Market */}
      <section className="space-y-4">
        <SectionHeader icon={Store} title="غرفه‌ها به تفکیک بازار" />
        {boothsByMarket.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card p-10 text-center">
            <Store className="mx-auto h-10 w-10 text-muted-foreground/25 mb-3" />
            <p className="text-sm text-muted-foreground">داده‌ای یافت نشد</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-right">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">بازار</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">میدان</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">
                    تعداد غرفه
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {boothsByMarket.map((row) => (
                  <tr key={row.marketId} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{row.marketName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.fieldName}</td>
                    <td className="px-4 py-3 text-center font-bold text-primary">
                      {row.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <h2 className="text-sm font-semibold text-foreground select-none">{title}</h2>
    </div>
  )
}

function MiniStatCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  valueColor,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  iconBg: string
  iconColor: string
  valueColor: string
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
      <div className={`mb-2 flex h-7 w-7 items-center justify-center rounded-md ${iconBg}`}>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <p className="text-xs text-muted-foreground select-none">{label}</p>
      <p className={`mt-0.5 text-2xl font-bold select-none ${valueColor}`}>{value}</p>
    </div>
  )
}

function ReportsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-2.5">
        <div className="h-7 w-7 rounded-lg bg-muted" />
        <div className="h-4 w-40 rounded bg-muted" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card px-4 py-3.5 space-y-2">
            <div className="h-7 w-7 rounded-md bg-muted" />
            <div className="h-3 w-12 rounded bg-muted" />
            <div className="h-7 w-10 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}
