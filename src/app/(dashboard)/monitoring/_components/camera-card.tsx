'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  BrainCircuit,
  Camera,
  Flame,
  MapPin,
  ExternalLink,
  ScanSearch,
  Users,
  VideoOff,
  Play,
  Route,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CameraStreamPlayer } from './camera-stream-player'
import { CameraSnapshot } from './camera-snapshot'
import { derivePlaybackUrls } from '@/modules/camera/stream'
import type { Camera as CameraType } from '@/modules/camera/types'

const STATUS_CONFIG: Record<
  string,
  { label: string; dot: string; badge: string; ring: string }
> = {
  ONLINE: {
    label: 'آنلاین',
    dot: 'bg-green-500',
    badge: 'bg-green-100 text-green-700',
    ring: 'ring-green-500/20',
  },
  OFFLINE: {
    label: 'آفلاین',
    dot: 'bg-red-500',
    badge: 'bg-red-100 text-red-700',
    ring: 'ring-red-500/20',
  },
  UNKNOWN: {
    label: 'نامشخص',
    dot: 'bg-amber-400',
    badge: 'bg-amber-100 text-amber-700',
    ring: 'ring-amber-500/20',
  },
}

function locationLabel(camera: CameraType): string {
  if (camera.booth)  return `غرفه ${camera.booth.number}`
  if (camera.market) return camera.market.name
  if (camera.field)  return camera.field.name
  return '—'
}

interface CameraCardProps {
  camera: CameraType
}

const LIVE_ANALYTICS = [
  {
    id: 'detection',
    label: 'تشخیص افراد',
    description: 'تشخیص افراد و نمایش کادر دور هر فرد',
    icon: ScanSearch,
  },
  {
    id: 'tracking',
    label: 'ردیابی افراد',
    description: 'ردیابی افراد با شناسه و مسیر حرکت',
    icon: Route,
  },
  {
    id: 'people_counting',
    label: 'شمارش افراد',
    description: 'تعداد فعلی و مجموع افراد یکتا',
    icon: Users,
  },
  {
    id: 'heatmap',
    label: 'نقشه حرارتی',
    description: 'نمایش زنده تراکم و زمان توقف افراد',
    icon: Flame,
  },
  {
    id: 'configured_queue',
    label: 'تحلیل خط صف',
    description: 'تعداد و میانگین سرعت افراد در صف تعریف‌شده',
    icon: BrainCircuit,
  },
  {
    id: 'restricted_area',
    label: 'ناحیه ممنوعه',
    description: 'تشخیص ورود و خروج از مناطق ثبت‌شده این دوربین',
    icon: MapPin,
  },
] as const

type LiveAnalyticsId = (typeof LIVE_ANALYTICS)[number]['id']

export function CameraCard({ camera }: CameraCardProps) {
  const [open, setOpen] = useState(false)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [selectedAnalytics, setSelectedAnalytics] =
    useState<LiveAnalyticsId>('people_counting')
  const status = STATUS_CONFIG[camera.status] ?? STATUS_CONFIG.UNKNOWN
  const isOnline = camera.status === 'ONLINE'

  const playbackUrls = derivePlaybackUrls(camera.streamUrl)
  // Only an online camera with a playable stream can be opened in the viewer.
  const canPlay = isOnline && !!playbackUrls
  const hasRestrictedArea = Boolean(
    camera.regions?.some(mapping => mapping.region.type === 'RESTRICTED_AREA'),
  )
  const hasQueue = Boolean(
    camera.regions?.some(mapping => mapping.region.type === 'QUEUE'),
  )
  const startAnalytics = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/cameras/${camera.id}/analytics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // At the default 30 FPS / stride 10 this is roughly a ten-minute live
        // session and prevents one accidental click from occupying the single
        // analytics worker and growing an output file forever.
        body: JSON.stringify({ applicationId: selectedAnalytics, maxFrames: 1_800 }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        const detail = body?.detail?.detail ?? body?.detail ?? body?.error
        throw new Error(typeof detail === 'string' ? detail : 'سرویس تحلیل تصویر در دسترس نیست')
      }
    },
    onSuccess: () => {
      setAnalyticsOpen(false)
      const task = LIVE_ANALYTICS.find(item => item.id === selectedAnalytics)
      toast.success(`تحلیل «${task?.label ?? selectedAnalytics}» شروع شد`)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const PreviewInner = (
    <>
      {/* Last frame grabbed from the live stream, behind the overlays */}
      {canPlay && playbackUrls && <CameraSnapshot src={playbackUrls.hls} />}

      {/* Scanline texture */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 3px)',
        }}
      />

      {/* Status indicator */}
      <div className="absolute top-2.5 right-2.5">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur-sm ${status.badge} bg-opacity-90`}
        >
          {isOnline ? (
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${status.dot}`} />
            </span>
          ) : (
            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
          )}
          {status.label}
        </span>
      </div>

      {/* Camera icon / no-signal — the live snapshot replaces this when playable */}
      {!canPlay && (
        <div className="flex flex-col items-center gap-2 text-white/20">
          {isOnline ? (
            <Camera className="h-10 w-10" />
          ) : (
            <VideoOff className="h-10 w-10" />
          )}
          <span className="text-[10px] font-medium tracking-wide">
            {isOnline ? 'در حال پخش' : 'سیگنال قطع'}
          </span>
        </div>
      )}

      {/* Play affordance on hover for a playable camera */}
      {canPlay && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-lg">
            <Play className="h-5 w-5 translate-x-px fill-current" />
          </span>
        </div>
      )}
    </>
  )

  return (
    <div
      className={`flex flex-col rounded-xl border bg-card shadow-sm overflow-hidden ring-1 ${status.ring} transition-shadow hover:shadow-md`}
    >
      {/* Stream preview area — clickable to open the live viewer when playable */}
      <div className="group relative h-32 overflow-hidden bg-slate-950/90">
        {canPlay ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex h-full w-full items-center justify-center"
            aria-label={`مشاهده استریم ${camera.name}`}
          >
            {PreviewInner}
          </button>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            {PreviewInner}
          </div>
        )}

        {/* Stream link overlay */}
        {camera.streamUrl && (
          <a
            href={camera.streamUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-2 left-2 z-10 flex items-center gap-1 rounded px-1.5 py-0.5 bg-black/40 backdrop-blur-sm text-white/60 hover:text-white text-[10px] transition-colors"
            dir="ltr"
          >
            <ExternalLink className="h-2.5 w-2.5" />
            باز کردن
          </a>
        )}
      </div>

      {/* Card body */}
      <div className="flex flex-col gap-2 p-3.5">
        <p className="font-medium text-sm text-foreground leading-snug select-none">
          {camera.name}
        </p>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground select-none">
          <MapPin className="h-3 w-3 shrink-0" />
          <span>{locationLabel(camera)}</span>
        </div>
        {!camera.streamUrl && (
          <p className="text-[10px] text-muted-foreground/50 select-none">بدون آدرس استریم</p>
        )}
        {canPlay && (
          <button
            type="button"
            disabled={startAnalytics.isPending}
            onClick={() => setAnalyticsOpen(true)}
            className="mt-1 flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <BrainCircuit className="h-3.5 w-3.5" />
            انتخاب تحلیل زنده
          </button>
        )}
      </div>

      {/* Live stream viewer */}
      {canPlay && playbackUrls && (
        <Dialog open={analyticsOpen} onOpenChange={setAnalyticsOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="text-right">تحلیل زنده {camera.name}</DialogTitle>
              <DialogDescription className="text-right leading-6">
                تحلیل موردنظر را انتخاب کنید. هر بار یک خروجی زنده پردازش می‌شود و نتیجه در صفحه
                تحلیل ویدیو نمایش داده خواهد شد.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-2 sm:grid-cols-2">
              {LIVE_ANALYTICS.filter(task =>
                (task.id !== 'restricted_area' || hasRestrictedArea) &&
                (task.id !== 'configured_queue' || hasQueue),
              ).map(task => {
                const Icon = task.icon
                const selected = selectedAnalytics === task.id
                return (
                  <button
                    key={task.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setSelectedAnalytics(task.id)}
                    className={`flex items-start gap-3 rounded-lg border p-3 text-right transition-colors ${
                      selected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                        : 'hover:bg-accent'
                    }`}
                  >
                    <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md ${selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      <Icon className="size-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{task.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        {task.description}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-800">
              ناحیه ممنوعه و صف تعریف‌شده پس از ثبت محدوده‌های دوربین در بخش مناطق قابل فعال‌سازی هستند.
            </div>

            <DialogFooter>
              <Button
                type="button"
                onClick={() => startAnalytics.mutate()}
                disabled={startAnalytics.isPending}
              >
                <BrainCircuit />
                {startAnalytics.isPending ? 'در حال اتصال…' : 'فعال‌سازی تحلیل انتخاب‌شده'}
              </Button>
              <Button type="button" variant="outline" render={<Link href="/live-analytics/people" />}>
                مشاهده خروجی‌ها
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {canPlay && playbackUrls && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-2xl lg:max-w-3xl">
            <DialogHeader>
              <DialogTitle className="text-right">{camera.name}</DialogTitle>
              <DialogDescription className="text-right">
                {locationLabel(camera)} · پخش زنده
              </DialogDescription>
            </DialogHeader>
            {open && (
              <CameraStreamPlayer
                whepSrc={playbackUrls.whep}
                hlsSrc={playbackUrls.hls}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
