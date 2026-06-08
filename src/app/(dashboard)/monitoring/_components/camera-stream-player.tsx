'use client'

import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import { Loader2, VideoOff } from 'lucide-react'

interface CameraStreamPlayerProps {
  /** A browser-playable HLS (.m3u8) URL. */
  src: string
}

type PlayerState = 'loading' | 'playing' | 'error'

/**
 * Plays an HLS stream inside a <video> element.
 *
 * Uses the browser's native HLS support when available (Safari/iOS), otherwise
 * falls back to hls.js (Chrome, Firefox, Edge). A fatal error — unreachable
 * stream, CORS, or codec issue — surfaces a "no signal" state instead of a
 * silent black box.
 */
export function CameraStreamPlayer({ src }: CameraStreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [state, setState] = useState<PlayerState>('loading')

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    setState('loading')

    // Native HLS (Safari, iOS) — no hls.js needed.
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      const onLoaded = () => setState('playing')
      const onError = () => setState('error')
      video.addEventListener('loadeddata', onLoaded)
      video.addEventListener('error', onError)
      return () => {
        video.removeEventListener('loadeddata', onLoaded)
        video.removeEventListener('error', onError)
        video.removeAttribute('src')
        video.load()
      }
    }

    if (!Hls.isSupported()) {
      setState('error')
      return
    }

    const hls = new Hls({ lowLatencyMode: true })
    hls.loadSource(src)
    hls.attachMedia(video)
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(() => {
        /* autoplay may be blocked; controls let the user start it */
      })
    })
    hls.on(Hls.Events.FRAG_BUFFERED, () => setState('playing'))
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) setState('error')
    })

    return () => hls.destroy()
  }, [src])

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-slate-950">
      <video
        ref={videoRef}
        controls
        autoPlay
        muted
        playsInline
        className="h-full w-full object-contain"
      />

      {state === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950 text-white/60">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="text-xs">در حال اتصال به استریم…</span>
        </div>
      )}

      {state === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950 text-white/50">
          <VideoOff className="h-9 w-9" />
          <span className="text-xs font-medium">پخش استریم ممکن نشد</span>
          <span dir="ltr" className="max-w-[90%] truncate text-[10px] text-white/30">
            {src}
          </span>
        </div>
      )}
    </div>
  )
}
