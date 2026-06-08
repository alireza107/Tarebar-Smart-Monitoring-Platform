'use client'

import { Camera, Loader2 } from 'lucide-react'
import { useCameraSnapshot } from '@/modules/camera/use-camera-snapshot'

interface CameraSnapshotProps {
  /** A browser-playable HLS (.m3u8) URL. */
  src: string
}

/**
 * Shows the last frame grabbed from a live stream as a still preview, filling
 * its positioned parent. While the frame loads a spinner is shown; on failure
 * it falls back to a camera icon. The capture logic lives in useCameraSnapshot.
 */
export function CameraSnapshot({ src }: CameraSnapshotProps) {
  const { frame, errored } = useCameraSnapshot(src)

  if (frame) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={frame}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
    )
  }

  return (
    <div className="flex flex-col items-center gap-2 text-white/20">
      {errored ? (
        <Camera className="h-10 w-10" />
      ) : (
        <Loader2 className="h-8 w-8 animate-spin" />
      )}
    </div>
  )
}
