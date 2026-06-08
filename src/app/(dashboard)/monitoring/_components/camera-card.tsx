'use client'

import { useState } from 'react'
import { Camera, MapPin, ExternalLink, VideoOff, Play } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { CameraStreamPlayer } from './camera-stream-player'
import { CameraSnapshot } from './camera-snapshot'
import { deriveHlsUrl } from '@/modules/camera/stream'
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

export function CameraCard({ camera }: CameraCardProps) {
  const [open, setOpen] = useState(false)
  const status = STATUS_CONFIG[camera.status] ?? STATUS_CONFIG.UNKNOWN
  const isOnline = camera.status === 'ONLINE'

  const hlsUrl = deriveHlsUrl(camera.streamUrl)
  // Only an online camera with a playable stream can be opened in the viewer.
  const canPlay = isOnline && !!hlsUrl

  const PreviewInner = (
    <>
      {/* Last frame grabbed from the live stream, behind the overlays */}
      {canPlay && hlsUrl && <CameraSnapshot src={hlsUrl} />}

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
      </div>

      {/* Live stream viewer */}
      {canPlay && hlsUrl && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-2xl lg:max-w-3xl">
            <DialogHeader>
              <DialogTitle className="text-right">{camera.name}</DialogTitle>
              <DialogDescription className="text-right">
                {locationLabel(camera)} · پخش زنده
              </DialogDescription>
            </DialogHeader>
            {open && <CameraStreamPlayer src={hlsUrl} />}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
