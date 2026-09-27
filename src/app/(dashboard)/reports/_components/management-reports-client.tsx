'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Apple, ArrowLeft, BarChart3, ClipboardCheck, Download, FileChartColumn, Map, ShieldAlert, TimerReset } from 'lucide-react'
import { GlobalFilterBar } from '@/components/management/global-filter-bar'
import { EmptyAnalytics, Panel } from '@/components/management/analytics-ui'
import { fetchManagementOverview } from '@/modules/management-analytics/client'
import type { ManagementFilters } from '@/modules/management-analytics/types'
import { useManagementFilters } from '@/stores/management-filters'

export function ManagementReportsClient() {
  const state = useManagementFilters()
  const filters = useMemo<ManagementFilters>(() => ({ locationType: state.locationType, locationId: state.locationId, placeType: state.placeType, from: state.from, to: state.to, comparison: state.comparison, timeFrom: state.timeFrom, timeTo: state.timeTo }), [state.locationType, state.locationId, state.placeType, state.from, state.to, state.comparison, state.timeFrom, state.timeTo])
  const { data, isLoading, isError } = useQuery({ queryKey: ['management-overview', filters], queryFn: () => fetchManagementOverview(filters) })

  // The report pages read the same global filter store, so the selection made here carries over.
  const recordQuery = useMemo(() => {
    const query = new URLSearchParams({ locationType: state.locationType, from: state.from, to: state.to })
    if (state.locationId) query.set('locationId', state.locationId)
    return query.toString()
  }, [state.locationType, state.locationId, state.from, state.to])

  const templates = [
    { title: 'گزارش تردد و تراکم', description: 'روند، اوج حضور و تغییر دوره‌ای', icon: BarChart3, href: '/traffic-density' },
    { title: 'گزارش صف و خدمت‌رسانی', description: 'زمان انتظار و تحقق SLA در سطح مکان', icon: TimerReset, href: '/queue-service' },
    { title: 'گزارش رفتار مکانی', description: 'الگوهای فعالیت و نقشه حرارتی', icon: Map, href: '/spatial' },
  ]
  const exports = [
    { title: 'سوابق ارزیابی کیفیت میوه', description: 'همه ارزیابی‌های تازگی با عیوب، درجه و توصیه', icon: Apple, path: '/api/fruit-quality-assessments/export' },
    { title: 'سوابق تشخیص حادثه و نظافت', description: 'هر بازه پایش با نتیجه درگیری و وضعیت کف', icon: ShieldAlert, path: '/api/incident-checks/export' },
  ]

  return <div className="space-y-5">
    <div><h2 className="text-lg font-semibold">گزارش‌های مدیریتی</h2><p className="mt-0.5 text-xs text-muted-foreground">گزارش‌های تجمیعی قابل استفاده در سطح میدان، بازار و غرفه</p></div>
    <GlobalFilterBar />

    <Link href="/reports/executive" className="group flex flex-wrap items-center gap-4 rounded-xl border border-primary/30 bg-primary/5 p-5 shadow-sm transition hover:border-primary/60 hover:shadow-md">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><ClipboardCheck className="size-6" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold">گزارش مدیریتی اجرایی</span>
        <span className="mt-1 block text-xs leading-6 text-muted-foreground">کارنامه یک‌صفحه‌ای مکان انتخاب‌شده برای مدیر بازار یا غرفه: تردد، صف، کیفیت محصول، ایمنی و نظافت، مقایسه زیرمجموعه‌ها و اقدام‌های پیشنهادی. قابل چاپ، PDF، CSV و JSON.</span>
      </span>
      <span className="flex items-center gap-1 text-sm font-medium text-primary">تهیه گزارش <ArrowLeft className="size-4 transition group-hover:-translate-x-1" /></span>
    </Link>

    <div className="grid gap-3 sm:grid-cols-3">{templates.map(({ title, description, icon: Icon, href }) => <div key={title} className="rounded-xl border bg-card p-4 shadow-sm">
      <Icon className="size-5 text-primary" /><p className="mt-3 text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <Link href={href} className="mt-4 inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs hover:bg-accent">مشاهده گزارش تفصیلی <ArrowLeft className="size-3" /></Link>
    </div>)}</div>

    <Panel title="خروجی سوابق تحلیل" description="بر اساس مکان و بازه تاریخ انتخاب‌شده در بالا">
      <div className="grid gap-3 sm:grid-cols-2">{exports.map(({ title, description, icon: Icon, path }) => <div key={path} className="flex items-start gap-3 rounded-lg border p-3">
        <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{title}</p><p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          <div className="mt-2 flex gap-2">
            <a href={`${path}?format=csv&${recordQuery}`} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:bg-accent"><Download className="size-3" />CSV</a>
            <a href={`${path}?format=json&${recordQuery}`} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:bg-accent"><Download className="size-3" />JSON</a>
          </div>
        </div>
      </div>)}</div>
    </Panel>

    <Panel title="وضعیت داده گزارش" action={<FileChartColumn className="size-4 text-muted-foreground" />}>{isLoading ? <div className="h-24 animate-pulse rounded-lg bg-muted" /> : isError ? <EmptyAnalytics label="دریافت اطلاعات گزارش با خطا روبه‌رو شد." /> : data?.dataStatus === 'unavailable' ? <EmptyAnalytics label="برای این فیلتر داده تجمیعی تردد و صف ثبت نشده است؛ بخش‌های کیفیت و ایمنی گزارش اجرایی همچنان از سوابق تحلیل ساخته می‌شوند." /> : <p className="text-xs text-emerald-700">داده این بازه آماده تهیه گزارش است.</p>}</Panel>
  </div>
}
