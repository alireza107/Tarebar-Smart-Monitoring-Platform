'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { ArrowLeft, Building2, Camera, MapPin, Shapes, Store } from 'lucide-react'
import { fetchManagementLocations } from '@/modules/management-analytics/client'
import type { LocationOption } from '@/modules/management-analytics/types'

export function LocationsClient() {
  const { data: session } = useSession()
  const query = useQuery({ queryKey: ['management-locations'], queryFn: fetchManagementLocations, staleTime: 5 * 60_000 })
  if (query.isLoading) return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-xl bg-muted" />)}</div>
  if (query.isError || !query.data) return <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center text-sm text-destructive">دریافت ساختار مکان‌ها با خطا روبه‌رو شد.</div>
  const { fields, markets, booths } = query.data
  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">ساختار مکان‌ها</h2><p className="mt-0.5 text-xs text-muted-foreground">سازمان ← میدان ← بازار ← غرفه/ناحیه ← zone ← دوربین</p></div><div className="flex flex-wrap gap-2 text-xs">{session?.user.role === 'ORG_ADMIN' && <Link href="/fields" className="rounded-lg border bg-card px-3 py-2 hover:bg-accent">مدیریت میادین</Link>} {session?.user.role !== 'MARKET_MANAGER' && <Link href="/markets" className="rounded-lg border bg-card px-3 py-2 hover:bg-accent">مدیریت بازارها</Link>}<Link href="/booths" className="rounded-lg border bg-card px-3 py-2 hover:bg-accent">مدیریت غرفه‌ها</Link><Link href="/regions" className="rounded-lg border bg-card px-3 py-2 hover:bg-accent">مدیریت zoneها</Link></div></div>
    <LocationLevel title="میادین" icon={MapPin} locations={fields} empty="میدانی در محدوده دسترسی شما تعریف نشده است." />
    <LocationLevel title="بازارها" icon={Store} locations={markets} empty="بازاری در محدوده دسترسی شما تعریف نشده است." />
    <LocationLevel title="غرفه‌ها و نواحی کسب‌وکار" icon={Building2} locations={booths} empty="غرفه‌ای در محدوده دسترسی شما تعریف نشده است." />
    <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-xs leading-6 text-muted-foreground"><Shapes className="ml-2 inline size-4" />zoneها با موجودیت «منطقه» فعلی نگهداری می‌شوند و دوربین‌ها برگ‌های عملیاتی هر zone هستند. KPIهای مدیریتی فقط در سه سطح میدان، بازار و غرفه تجمیع می‌شوند.</div>
  </div>
}

function LocationLevel({ title, icon: Icon, locations, empty }: { title: string; icon: React.ComponentType<{ className?: string }>; locations: LocationOption[]; empty: string }) {
  return <section className="space-y-3"><div className="flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></span><h3 className="text-sm font-semibold">{title}</h3><span className="text-[11px] text-muted-foreground">{locations.length.toLocaleString('fa-IR')}</span></div>{locations.length === 0 ? <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">{empty}</div> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{locations.map((location) => <Link key={`${location.type}-${location.id}`} href={`/locations/${location.type}/${location.id}`} className="group rounded-xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{location.name}</p>{location.parentName && <p className="mt-1 text-[11px] text-muted-foreground">{location.parentName}</p>}</div><ArrowLeft className="size-4 text-muted-foreground transition group-hover:-translate-x-1 group-hover:text-primary" /></div><div className="mt-4 flex gap-4 border-t pt-3 text-[11px] text-muted-foreground"><span className="flex items-center gap-1"><Shapes className="size-3.5" />{location.zoneCount.toLocaleString('fa-IR')} zone</span><span className="flex items-center gap-1"><Camera className="size-3.5" />{location.cameraCount.toLocaleString('fa-IR')} دوربین عملیاتی</span></div></Link>)}</div>}</section>
}

