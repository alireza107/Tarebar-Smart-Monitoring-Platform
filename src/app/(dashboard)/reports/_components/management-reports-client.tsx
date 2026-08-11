'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, FileChartColumn, Map, TimerReset } from 'lucide-react'
import { GlobalFilterBar } from '@/components/management/global-filter-bar'
import { EmptyAnalytics, Panel } from '@/components/management/analytics-ui'
import { fetchManagementOverview } from '@/modules/management-analytics/client'
import type { ManagementFilters } from '@/modules/management-analytics/types'
import { useManagementFilters } from '@/stores/management-filters'

export function ManagementReportsClient() {
  const state = useManagementFilters()
  const filters = useMemo<ManagementFilters>(() => ({ locationType: state.locationType, locationId: state.locationId, placeType: state.placeType, from: state.from, to: state.to, comparison: state.comparison, timeFrom: state.timeFrom, timeTo: state.timeTo }), [state.locationType, state.locationId, state.placeType, state.from, state.to, state.comparison, state.timeFrom, state.timeTo])
  const { data, isLoading, isError } = useQuery({ queryKey: ['management-overview', filters], queryFn: () => fetchManagementOverview(filters) })
  const templates = [{ title: 'گزارش تردد و تراکم', description: 'روند، اوج حضور و تغییر دوره‌ای', icon: BarChart3 }, { title: 'گزارش صف و خدمت‌رسانی', description: 'زمان انتظار و تحقق SLA در سطح مکان', icon: TimerReset }, { title: 'گزارش رفتار مکانی', description: 'الگوهای فعالیت و نقشه حرارتی', icon: Map }]
  return <div className="space-y-5"><div><h2 className="text-lg font-semibold">گزارش‌های مدیریتی</h2><p className="mt-0.5 text-xs text-muted-foreground">گزارش‌های تجمیعی قابل استفاده در سطح میدان، بازار و غرفه</p></div><GlobalFilterBar /><div className="grid gap-3 sm:grid-cols-3">{templates.map(({ title, description, icon: Icon }) => <div key={title} className="rounded-xl border bg-card p-4 shadow-sm"><Icon className="size-5 text-primary" /><p className="mt-3 text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p><button disabled={!data || data.dataStatus === 'unavailable'} className="mt-4 rounded-lg border px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40">آماده‌سازی گزارش</button></div>)}</div><Panel title="وضعیت داده گزارش" action={<FileChartColumn className="size-4 text-muted-foreground" />}>{isLoading ? <div className="h-24 animate-pulse rounded-lg bg-muted" /> : isError ? <EmptyAnalytics label="دریافت اطلاعات گزارش با خطا روبه‌رو شد." /> : data?.dataStatus === 'unavailable' ? <EmptyAnalytics label="پس از اتصال انبار تحلیلی، خروجی گزارش برای این فیلتر فعال می‌شود." /> : <p className="text-xs text-emerald-700">داده این بازه آماده تهیه گزارش است.</p>}</Panel></div>
}
