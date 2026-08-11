'use client'

import type { LucideIcon } from 'lucide-react'
import { ArrowDownLeft, ArrowUpLeft, Minus, Radio } from 'lucide-react'
import type { MetricValue } from '@/modules/management-analytics/types'

export function AnalyticsCard({ title, icon: Icon, metric, suffix = '' }: { title: string; icon: LucideIcon; metric: MetricValue; suffix?: string }) {
  const change = metric.changePercent
  return (
    <article className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight">{metric.value === null ? '—' : metric.value.toLocaleString('fa-IR')}{metric.value !== null && suffix}</p>
        </div>
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4.5" /></span>
      </div>
      <div className={`mt-3 flex items-center gap-1 text-[11px] ${change === null ? 'text-muted-foreground' : change > 0 ? 'text-emerald-600' : change < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
        {change === null ? <Minus className="size-3.5" /> : change > 0 ? <ArrowUpLeft className="size-3.5" /> : <ArrowDownLeft className="size-3.5" />}
        <span>{change === null ? 'داده مقایسه موجود نیست' : `${Math.abs(change).toLocaleString('fa-IR')}٪ نسبت به دوره قبل`}</span>
      </div>
    </article>
  )
}

export function Panel({ title, description, action, children, className = '' }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border bg-card shadow-sm ${className}`}>
      <header className="flex items-start justify-between gap-4 border-b px-4 py-3.5">
        <div><h3 className="text-sm font-semibold">{title}</h3>{description && <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>}</div>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}

export function EmptyAnalytics({ label = 'برای این بازه هنوز داده تجمیعی ثبت نشده است.' }: { label?: string }) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-4 text-center">
      <Radio className="mb-2 size-6 text-muted-foreground/40" />
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
