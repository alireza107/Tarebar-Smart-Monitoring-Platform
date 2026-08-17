'use client'

import { useEffect, useState } from 'react'
import { Loader2, RefreshCw, VideoOff } from 'lucide-react'

interface CameraLivePreviewProps {
  cameraId: string
  cameraName?: string
}

export function CameraLivePreview({ cameraId, cameraName }: CameraLivePreviewProps) {
  const [status, setStatus] = useState<'loading' | 'live' | 'error'>('loading')
  const [generation, setGeneration] = useState(0)

  useEffect(() => {
    setStatus('loading')
  }, [cameraId, generation])

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
      {status !== 'error' && (
        // MJPEG from the analytics RTSP reader — the same path used after analysis starts.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${cameraId}-${generation}`}
          src={`/api/cameras/${cameraId}/preview-stream`}
          alt={cameraName ? `پیش‌نمایش زنده ${cameraName}` : 'پیش‌نمایش زنده دوربین'}
          className="size-full object-contain"
          onLoad={() => setStatus('live')}
          onError={() => setStatus('error')}
        />
      )}

      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-white/70">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="text-xs">در حال اتصال به دوربین…</span>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/60">
          <VideoOff className="h-9 w-9" />
          <span className="text-xs font-medium">پیش‌نمایش زنده در دسترس نیست</span>
          <button
            type="button"
            onClick={() => setGeneration(value => value + 1)}
            className="flex items-center gap-1 rounded border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10"
          >
            <RefreshCw className="h-3 w-3" /> تلاش دوباره
          </button>
        </div>
      )}
    </div>
  )
}
