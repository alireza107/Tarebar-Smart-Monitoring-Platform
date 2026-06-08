'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Camera, Wifi, WifiOff, HelpCircle, RefreshCw } from 'lucide-react'
import { CameraCard } from './camera-card'
import type { Camera as CameraType, CameraStatus } from '@/modules/camera/types'

const REFETCH_INTERVAL_MS = 30_000

type StatusFilter = CameraStatus | 'ALL'

const filterOptions: { value: StatusFilter; label: string }[] = [
  { value: 'ALL',     label: 'همه' },
  { value: 'ONLINE',  label: 'آنلاین' },
  { value: 'OFFLINE', label: 'آفلاین' },
  { value: 'UNKNOWN', label: 'نامشخص' },
]

async function fetchCameras(): Promise<CameraType[]> {
  const res = await fetch('/api/cameras')
  if (!res.ok) throw new Error('خطا در دریافت دوربین‌ها')
  const json = await res.json()
  return json.data
}

async function fetchCameraHealth(): Promise<Record<string, CameraStatus>> {
  const res = await fetch('/api/cameras/health')
  if (!res.ok) throw new Error('خطا در بررسی وضعیت دوربین‌ها')
  const json = await res.json()
  return json.data
}

export function MonitoringClient() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')

  const {
    data: rawCameras = [],
    isLoading,
    isError,
    dataUpdatedAt,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['monitoring-cameras'],
    queryFn: fetchCameras,
    refetchInterval: REFETCH_INTERVAL_MS,
  })

  // Live status derived from probing each stream URL in real time. We overlay it
  // on the stored status so a reachable stream shows ONLINE without a manual edit.
  const { data: liveStatus = {}, refetch: refetchHealth } = useQuery({
    queryKey: ['monitoring-camera-health'],
    queryFn: fetchCameraHealth,
    refetchInterval: REFETCH_INTERVAL_MS,
  })

  const cameras = rawCameras.map((c) =>
    liveStatus[c.id] ? { ...c, status: liveStatus[c.id] } : c,
  )

  const online  = cameras.filter((c) => c.status === 'ONLINE').length
  const offline = cameras.filter((c) => c.status === 'OFFLINE').length
  const unknown = cameras.filter((c) => c.status === 'UNKNOWN').length
  const total   = cameras.length

  const visible =
    statusFilter === 'ALL'
      ? cameras
      : cameras.filter((c) => c.status === statusFilter)

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('fa-IR')
    : null

  const onlineRatio = total > 0 ? (online / total) * 100 : 0

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground select-none">
            وضعیت دوربین‌ها
          </h2>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground select-none mt-0.5">
              آخرین بروزرسانی: {lastUpdated} · هر ۳۰ ثانیه
            </p>
          )}
        </div>
        <button
          onClick={() => {
            refetch()
            refetchHealth()
          }}
          disabled={isFetching}
          className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
          بروزرسانی
        </button>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatusSummaryCard
          label="کل دوربین‌ها"
          count={total}
          icon={Camera}
          iconClass="text-slate-500"
          bgClass="bg-slate-100"
          valueClass="text-slate-700"
        />
        <StatusSummaryCard
          label="آنلاین"
          count={online}
          icon={Wifi}
          iconClass="text-green-600"
          bgClass="bg-green-100"
          valueClass="text-green-600"
          live
        />
        <StatusSummaryCard
          label="آفلاین"
          count={offline}
          icon={WifiOff}
          iconClass="text-red-500"
          bgClass="bg-red-100"
          valueClass="text-red-600"
        />
        <StatusSummaryCard
          label="نامشخص"
          count={unknown}
          icon={HelpCircle}
          iconClass="text-amber-500"
          bgClass="bg-amber-100"
          valueClass="text-amber-600"
        />
      </div>

      {/* Online ratio bar */}
      {total > 0 && (
        <div className="rounded-xl border bg-card px-5 py-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground select-none">
            <span>نسبت دوربین‌های آنلاین</span>
            <span className="font-semibold text-foreground">
              {online} / {total} ({Math.round(onlineRatio)}٪)
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-700"
              style={{ width: `${onlineRatio}%` }}
            />
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${
              statusFilter === opt.value
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-card border text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {opt.label}
            {opt.value !== 'ALL' && (
              <span className={`mr-1.5 text-xs opacity-70`}>
                ({opt.value === 'ONLINE' ? online : opt.value === 'OFFLINE' ? offline : unknown})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Camera grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <CameraCardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center">
          <WifiOff className="mx-auto h-10 w-10 text-destructive/40 mb-3" />
          <p className="text-sm text-destructive font-medium">خطا در دریافت اطلاعات دوربین‌ها</p>
          <p className="text-xs text-muted-foreground mt-1">لطفاً اتصال شبکه را بررسی کنید</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-12 text-center">
          <Camera className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">دوربینی با این وضعیت یافت نشد</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((camera) => (
            <CameraCard key={camera.id} camera={camera} />
          ))}
        </div>
      )}
    </div>
  )
}

function StatusSummaryCard({
  label,
  count,
  icon: Icon,
  iconClass,
  bgClass,
  valueClass,
  live = false,
}: {
  label: string
  count: number
  icon: React.ComponentType<{ className?: string }>
  iconClass: string
  bgClass: string
  valueClass: string
  live?: boolean
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-md ${bgClass}`}>
          <Icon className={`h-4 w-4 ${iconClass}`} />
        </div>
        {live && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground select-none">{label}</p>
      <p className={`mt-0.5 text-2xl font-bold select-none ${valueClass}`}>{count}</p>
    </div>
  )
}

function CameraCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card overflow-hidden animate-pulse">
      <div className="h-32 bg-muted" />
      <div className="p-4 space-y-2">
        <div className="h-3.5 w-3/4 rounded bg-muted" />
        <div className="h-3 w-1/2 rounded bg-muted" />
      </div>
    </div>
  )
}
