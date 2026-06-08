'use client'

import { useEffect, useState } from 'react'
import Hls from 'hls.js'

export interface CameraSnapshotState {
  /** A captured JPEG data URL of the last decoded frame, or null. */
  frame: string | null
  /** True when the stream could not be reached or the frame was unreadable. */
  errored: boolean
}

/**
 * Grabs the last decoded frame from a live HLS stream as a JPEG data URL.
 *
 * Rather than keeping the stream playing, we attach it to a hidden <video>, wait
 * for a real presented frame, paint it onto a canvas, then tear the connection
 * down. Pass a falsy `src` to capture nothing (e.g. an offline camera).
 *
 * Two details that matter for getting an actual picture (not black):
 *  - The <video> is appended to the DOM (positioned off-screen). A fully
 *    detached/`display:none` video is not composited, so drawImage yields black.
 *  - We capture on requestVideoFrameCallback once a frame has actually been
 *    *presented*, skipping the initial empty frame.
 *
 * Drawing cross-origin video to a canvas requires the stream to be CORS-clean —
 * MediaMTX serves HLS with permissive CORS by default, so toDataURL succeeds.
 */
export function useCameraSnapshot(src: string | null | undefined): CameraSnapshotState {
  const [frame, setFrame] = useState<string | null>(null)
  const [errored, setErrored] = useState(false)

  useEffect(() => {
    setFrame(null)
    setErrored(false)
    if (!src) return

    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.crossOrigin = 'anonymous'
    // Keep it on the page but out of sight so the browser actually decodes and
    // composites frames (a detached/display:none video draws black).
    video.style.cssText =
      'position:fixed;left:-10000px;top:0;width:2px;height:2px;opacity:0;pointer-events:none'
    document.body.appendChild(video)

    const canvas = document.createElement('canvas')
    let hls: Hls | null = null
    let cancelled = false

    const cleanup = () => {
      video.pause()
      video.removeAttribute('src')
      video.load()
      video.remove()
      if (hls) {
        hls.destroy()
        hls = null
      }
    }

    const fail = () => {
      if (cancelled) return
      setErrored(true)
      cleanup()
    }

    const draw = () => {
      const w = video.videoWidth
      const h = video.videoHeight
      if (!w || !h) return false

      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        fail()
        return true
      }

      try {
        ctx.drawImage(video, 0, 0, w, h)
        setFrame(canvas.toDataURL('image/jpeg', 0.8))
      } catch {
        // Canvas tainted by a non-CORS stream — can't read the pixels back.
        setErrored(true)
      }
      cleanup()
      return true
    }

    const hasFrameCallback =
      'requestVideoFrameCallback' in HTMLVideoElement.prototype

    const startCapture = () => {
      if (cancelled) return
      if (hasFrameCallback) {
        const onFrame = (_now: number, metadata: VideoFrameCallbackMetadata) => {
          if (cancelled) return
          // Wait for a genuinely presented frame; the first one can be empty.
          if (metadata.presentedFrames >= 2 && draw()) return
          video.requestVideoFrameCallback(onFrame)
        }
        video.requestVideoFrameCallback(onFrame)
      } else {
        // Fallback: nudge past the first frame, then capture.
        video.addEventListener('seeked', () => draw(), { once: true })
        video.currentTime = 0.1
      }
    }

    video.addEventListener(
      'canplay',
      () => {
        video.play().catch(() => {})
        startCapture()
      },
      { once: true },
    )
    video.addEventListener('error', fail, { once: true })

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
    } else if (Hls.isSupported()) {
      hls = new Hls()
      hls.loadSource(src)
      hls.attachMedia(video)
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) fail()
      })
    } else {
      setErrored(true)
    }

    return () => {
      cancelled = true
      cleanup()
    }
  }, [src])

  return { frame, errored }
}
