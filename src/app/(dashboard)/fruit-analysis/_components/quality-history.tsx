'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Download, History, Printer } from 'lucide-react'
import type { QualityAssessmentRecord } from '@/modules/analysis-records/types'
import { labelTone } from './quality-result-view'
import { boothLabel } from '@/lib/persian'

async function fetchHistory(cameraId?: string): Promise<{ data: QualityAssessmentRecord[]; meta: { total: number } }> {
  const query = new URLSearchParams({ limit: '10' })
  if (cameraId) query.set('cameraId', cameraId)
  const response = await fetch(`/api/fruit-quality-assessments?${query}`)
  if (!response.ok) throw new Error('خطا در دریافت سوابق ارزیابی')
  return response.json()
}

/** Latest stored assessments with links to the printable report and the bulk exports. */
export function QualityHistory({ cameraId }: { cameraId?: string }) {
  const history = useQuery({ queryKey: ['fruit-quality-history', cameraId ?? 'all'], queryFn: () => fetchHistory(cameraId) })
  const rows = history.data?.data ?? []
  const exportQuery = cameraId ? `&cameraId=${encodeURIComponent(cameraId)}` : ''

  return <section className="rounded-xl border bg-card p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2"><History className="size-5 text-primary" /><div><h2 className="font-semibold">سوابق ارزیابی کیفیت</h2><p className="text-[11px] text-muted-foreground">{history.data ? `${history.data.meta.total.toLocaleString('fa-IR')} ارزیابی ثبت‌شده در محدوده دسترسی شما` : 'آخرین ارزیابی‌های ثبت‌شده'}</p></div></div>
      <div className="flex gap-2">
        <a href={`/api/fruit-quality-assessments/export?format=csv${exportQuery}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-accent"><Download className="size-3.5" />همه سوابق (CSV)</a>
        <a href={`/api/fruit-quality-assessments/export?format=json${exportQuery}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-accent"><Download className="size-3.5" />JSON</a>
      </div>
    </div>
    <div className="mt-4 overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="border-b text-right text-xs text-muted-foreground"><th className="p-2">زمان</th><th className="p-2">منبع</th><th className="p-2">مکان</th><th className="p-2">کیفیت</th><th className="p-2">امتیاز</th><th className="p-2">فاسد</th><th className="p-2" /></tr></thead>
      <tbody>{rows.map(row => <tr key={row.id} className="border-b last:border-0">
        <td className="whitespace-nowrap p-2">{new Date(row.createdAt).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' })}</td>
        <td className="p-2">{row.camera?.name ?? row.fileName ?? (row.source === 'LIVE' ? 'دوربین' : 'فایل')}</td>
        <td className="p-2 text-muted-foreground">{row.booth ? boothLabel(row.booth.number) : row.market?.name ?? row.field?.name ?? '—'}</td>
        <td className="p-2"><span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${labelTone(row.label)}`}>{row.label}</span></td>
        <td className="p-2 font-semibold">{row.freshnessScore.toLocaleString('fa-IR')}</td>
        <td className="p-2">{row.rottenPercent.toLocaleString('fa-IR')}٪</td>
        <td className="p-2 text-left"><Link href={`/reports/quality/${row.id}`} target="_blank" className="inline-flex items-center gap-1 text-xs text-primary"><Printer className="size-3.5" />گزارش</Link></td>
      </tr>)}</tbody>
    </table>{!history.isLoading && rows.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">هنوز ارزیابی‌ای ثبت نشده است.</p>}{history.isError && <p className="py-4 text-center text-sm text-red-600">دریافت سوابق ممکن نشد.</p>}</div>
  </section>
}
