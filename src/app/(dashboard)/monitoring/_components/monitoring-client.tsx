'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { CameraCard } from './camera-card'
import type { Camera, CameraStatus } from '@/modules/camera/types'

const REFETCH_INTERVAL_MS = 30_000

type StatusFilter = CameraStatus | 'ALL'

const filterOptions: { value: StatusFilter; label: string }[] = [
  { value: 'ALL',     label: 'همه' },
  { value: 'ONLINE',  label: 'آنلاین' },
  { value: 'OFFLINE', label: 'آفلاین' },
  { value: 'UNKNOWN', label: 'نامشخص' },
]

async function fetchCameras(): Promise<Camera[]> {
  const res = await fetch('/api/cameras')
  if (!res.ok) throw new Error('خطا در دریافت دوربین‌ها')
  const json = await res.json()
  return json.data
}

export function MonitoringClient() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')

  const { data: cameras = [], isLoading, isError, dataUpdatedAt } = useQuery({
    queryKey: ['monitoring-cameras'],
    queryFn: fetchCameras,
    refetchInterval: REFETCH_INTERVAL_MS,
  })

  const online  = cameras.filter(c => c.status === 'ONLINE').length
  const offline = cameras.filter(c => c.status === 'OFFLINE').length
  const unknown = cameras.filter(c => c.status === 'UNKNOWN').length

  const visible = statusFilter === 'ALL'
    ? cameras
    : cameras.filter(c => c.status === statusFilter)

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('fa-IR')
    : null

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">مانیتورینگ دوربین‌ها</h1>
        {lastUpdated && (
          <span className="text-xs text-gray-400">
            آخرین بروزرسانی: {lastUpdated} · هر ۳۰ ثانیه
          </span>
        )}
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="کل دوربین‌ها" count={cameras.length} colorClass="text-gray-700" />
        <SummaryCard label="آنلاین"        count={online}          colorClass="text-green-600" />
        <SummaryCard label="آفلاین"        count={offline}         colorClass="text-red-600" />
        <SummaryCard label="نامشخص"        count={unknown}         colorClass="text-gray-400" />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        {filterOptions.map(opt => (
          <Button
            key={opt.value}
            size="sm"
            variant={statusFilter === opt.value ? 'default' : 'outline'}
            onClick={() => setStatusFilter(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">در حال بارگذاری...</p>
      ) : isError ? (
        <p className="text-sm text-red-500">خطا در دریافت اطلاعات دوربین‌ها.</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-gray-500">دوربینی با این وضعیت یافت نشد.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map(camera => (
            <CameraCard key={camera.id} camera={camera} />
          ))}
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, count, colorClass }: { label: string; count: number; colorClass: string }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${colorClass}`}>{count}</p>
    </div>
  )
}
