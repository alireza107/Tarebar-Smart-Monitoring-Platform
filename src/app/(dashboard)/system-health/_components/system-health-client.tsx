'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Activity, ArrowLeft, Apple, Database, RadioTower, RefreshCw, Server, Video } from 'lucide-react'

type Status = 'ok' | 'degraded' | 'down'
interface ServiceHealth { key: string; label: string; status: Status; detail: string; latencyMs: number | null }
interface SystemHealth { checkedAt: string; overall: Status; services: ServiceHealth[] }

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  web: Server, database: Database, 'video-analytics': Video, fleet: Activity, 'fruit-pipeline': Apple, mediamtx: RadioTower,
}
const TONE: Record<Status, { dot: string; badge: string; label: string }> = {
  ok: { dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700', label: 'سالم' },
  degraded: { dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700', label: 'نیازمند توجه' },
  down: { dot: 'bg-red-500', badge: 'bg-red-100 text-red-700', label: 'قطع' },
}

async function fetchHealth(): Promise<SystemHealth> {
  const response = await fetch('/api/system/health', { cache: 'no-store' })
  if (!response.ok) throw new Error('دریافت وضعیت سامانه ممکن نشد')
  return ((await response.json()) as { data: SystemHealth }).data
}

export function SystemHealthClient() {
  const { data, isLoading, isError, isFetching, refetch } = useQuery({ queryKey: ['system-health'], queryFn: fetchHealth, refetchInterval: 30_000 })

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-semibold">سلامت سامانه</h2><p className="mt-0.5 text-xs text-muted-foreground">وضعیت زنده سرویس‌های جمع‌آوری، پردازش و نگهداری داده؛ هر ۳۰ ثانیه به‌روز می‌شود</p></div>
      <div className="flex items-center gap-3">
        {data && <span className={`rounded-full px-3 py-1 text-xs font-semibold ${TONE[data.overall].badge}`}>وضعیت کلی: {TONE[data.overall].label}</span>}
        <button type="button" onClick={() => void refetch()} className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs hover:bg-accent"><RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />بررسی دوباره</button>
      </div>
    </div>

    {isError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">دریافت وضعیت سامانه ممکن نشد.</div>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {isLoading && Array.from({ length: 6 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-xl bg-muted" />)}
      {data?.services.map(service => {
        const Icon = ICONS[service.key] ?? Server
        const tone = TONE[service.status]
        return <div key={service.key} className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between"><span className={`flex size-9 items-center justify-center rounded-lg ${tone.badge}`}><Icon className="size-4" /></span><span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className={`size-2 rounded-full ${tone.dot}`} />{tone.label}</span></div>
          <p className="mt-3 text-sm font-semibold">{service.label}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{service.detail}</p>
          {service.latencyMs !== null && service.key !== 'web' && <p className="mt-1 text-[11px] text-muted-foreground/70" dir="ltr">{service.latencyMs} ms</p>}
        </div>
      })}
    </div>
    {data && <p className="text-[11px] text-muted-foreground">آخرین بررسی: {new Date(data.checkedAt).toLocaleTimeString('fa-IR')}</p>}
    <div className="rounded-xl border bg-card p-4 text-xs leading-6 text-muted-foreground">وضعیت تک‌تک دوربین‌ها در «عملیات زنده» و پوشش داده هر مکان در «گزارش مدیریتی اجرایی» دیده می‌شود. <Link href="/cameras" className="mr-1 inline-flex items-center gap-1 text-primary">دارایی‌های دوربین <ArrowLeft className="size-3" /></Link></div>
  </div>
}
