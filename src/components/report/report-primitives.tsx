'use client'

import { Printer } from 'lucide-react'

export const faNumber = (value: number, digits = 0) => value.toLocaleString('fa-IR', { maximumFractionDigits: digits })

export function faDate(value: string | Date, withTime = false) {
  const date = typeof value === 'string' ? new Date(value.length === 10 ? `${value}T12:00:00` : value) : value
  return date.toLocaleString('fa-IR', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' })
}

/** White A4-like sheet on screen; plain page content on paper. */
export function ReportSheet({ children }: { children: React.ReactNode }) {
  return <article className="report-sheet mx-auto max-w-5xl space-y-6 rounded-xl border bg-white p-6 text-slate-900 shadow-sm sm:p-8 print:max-w-none print:space-y-5 print:p-0">{children}</article>
}

export function ReportSection({ title, description, children, pageBreak = false }: { title: string; description?: string; children: React.ReactNode; pageBreak?: boolean }) {
  return <section className={`report-section space-y-3 ${pageBreak ? 'report-page-break' : ''}`}>
    <header className="border-b border-slate-200 pb-2"><h2 className="text-base font-bold text-slate-900">{title}</h2>{description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}</header>
    {children}
  </section>
}

export function ReportStat({ label, value, hint, tone = 'neutral' }: { label: string; value: string; hint?: string; tone?: 'neutral' | 'good' | 'watch' | 'poor' }) {
  const tones = { neutral: 'border-slate-200 bg-slate-50', good: 'border-emerald-200 bg-emerald-50', watch: 'border-amber-200 bg-amber-50', poor: 'border-red-200 bg-red-50' } as const
  return <div className={`rounded-lg border p-3 ${tones[tone]}`}><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 text-lg font-bold text-slate-900" dir="auto">{value}</p>{hint && <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>}</div>
}

export function PrintButton({ label = 'چاپ / ذخیره PDF' }: { label?: string }) {
  return <button type="button" onClick={() => window.print()} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 print:hidden"><Printer className="size-4" />{label}</button>
}

/** Minimal inline bar chart that prints well (no canvas, no external library). */
export function MiniBars({ points, max, unit = '', color = '#10b981' }: { points: Array<{ label: string; value: number | null }>; max?: number; unit?: string; color?: string }) {
  const values = points.map(point => point.value ?? 0)
  const top = Math.max(max ?? 0, ...values, 1)
  if (points.length === 0) return <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">داده‌ای برای نمایش روند وجود ندارد.</p>
  return <div className="flex h-32 items-end gap-1" dir="ltr">{points.map((point, index) => <div key={`${point.label}-${index}`} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${point.label}: ${point.value === null ? '—' : `${point.value}${unit}`}`}>
    <span className="text-[9px] text-slate-500">{point.value === null ? '' : faNumber(point.value, 0)}</span>
    <div className="w-full rounded-t" style={{ height: `${((point.value ?? 0) / top) * 100}%`, minHeight: point.value ? 2 : 0, backgroundColor: color }} />
    <span className="w-full truncate text-center text-[9px] text-slate-500">{point.label}</span>
  </div>)}</div>
}
