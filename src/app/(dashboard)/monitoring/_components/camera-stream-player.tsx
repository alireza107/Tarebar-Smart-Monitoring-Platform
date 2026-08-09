'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import { Loader2, RefreshCw, VideoOff } from 'lucide-react'

interface CameraStreamPlayerProps {
  /** MediaMTX WHEP endpoint; preferred for low-latency playback. */
  whepSrc: string
  /** MediaMTX HLS playlist used when WebRTC cannot connect. */
  hlsSrc: string
  /** Hide native controls and transport badge when used as a drawing background. */
  chrome?: boolean
  /** Notified whenever the connection state changes, e.g. to drive a fallback background. */
  onStateChange?: (state: PlayerState) => void
}

export type PlayerState = 'connecting' | 'webrtc' | 'hls' | 'error'
const WEBRTC_TIMEOUT_MS = 10_000
const RETRY_DELAYS_MS = [1_000, 2_000, 5_000]

function waitForIceGathering(peer: RTCPeerConnection): Promise<void> {
  if (peer.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise((resolve) => {
    const onChange = () => {
      if (peer.iceGatheringState !== 'complete') return
      peer.removeEventListener('icegatheringstatechange', onChange)
      resolve()
    }
    peer.addEventListener('icegatheringstatechange', onChange)
  })
}

/**
 * WebRTC-first MediaMTX player with bounded reconnects and an HLS fallback.
 * WHEP is negotiated directly so player errors are visible to the dashboard.
 */
export function CameraStreamPlayer({ whepSrc, hlsSrc, chrome = true, onStateChange }: CameraStreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [state, setState] = useState<PlayerState>('connecting')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    onStateChange?.(state)
  }, [state, onStateChange])

  const retry = useCallback(() => {
    setState('connecting')
    setAttempt((value) => value + 1)
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let active = true
    let sessionUrl: string | null = null
    let fallbackHls: Hls | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    const peer = new RTCPeerConnection()

    const cleanupWebRtc = () => {
      peer.close()
      if (sessionUrl) {
        fetch(sessionUrl, { method: 'DELETE' }).catch(() => undefined)
      }
    }

    const startHlsFallback = () => {
      if (!active) return
      cleanupWebRtc()
      video.srcObject = null
      setState('connecting')

      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = hlsSrc
        video.onloadeddata = () => active && setState('hls')
        video.onerror = () => active && setState('error')
        video.play().catch(() => undefined)
        return
      }

      if (!Hls.isSupported()) {
        setState('error')
        return
      }
      fallbackHls = new Hls({ lowLatencyMode: true })
      fallbackHls.loadSource(hlsSrc)
      fallbackHls.attachMedia(video)
      fallbackHls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => undefined))
      fallbackHls.on(Hls.Events.FRAG_BUFFERED, () => active && setState('hls'))
      fallbackHls.on(Hls.Events.ERROR, (_event, data) => {
        if (active && data.fatal) setState('error')
      })
    }

    const scheduleFailure = () => {
      if (!active) return
      const delay = RETRY_DELAYS_MS[attempt]
      if (delay === undefined) {
        startHlsFallback()
        return
      }
      retryTimer = setTimeout(retry, delay)
    }

    async function connect() {
      setState('connecting')
      peer.addTransceiver('video', { direction: 'recvonly' })
      peer.addTransceiver('audio', { direction: 'recvonly' })
      peer.ontrack = (event) => {
        const currentVideo = videoRef.current
        if (!active || !currentVideo) return
        currentVideo.srcObject = event.streams[0]
        currentVideo.play().catch(() => undefined)
        setState('webrtc')
      }
      peer.onconnectionstatechange = () => {
        if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected') {
          scheduleFailure()
        }
      }

      try {
        const offer = await peer.createOffer()
        await peer.setLocalDescription(offer)
        await Promise.race([
          waitForIceGathering(peer),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error('WebRTC ICE timeout')), WEBRTC_TIMEOUT_MS),
          ),
        ])
        if (!active || !peer.localDescription) return
        const response = await fetch(whepSrc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/sdp' },
          body: peer.localDescription.sdp,
          signal: AbortSignal.timeout(WEBRTC_TIMEOUT_MS),
        })
        if (!response.ok) throw new Error(`WHEP returned ${response.status}`)
        const location = response.headers.get('Location')
        if (location) sessionUrl = new URL(location, whepSrc).toString()
        await peer.setRemoteDescription({ type: 'answer', sdp: await response.text() })
      } catch {
        scheduleFailure()
      }
    }

    connect()

    return () => {
      active = false
      if (retryTimer) clearTimeout(retryTimer)
      fallbackHls?.destroy()
      cleanupWebRtc()
      video.onloadeddata = null
      video.onerror = null
      video.srcObject = null
      video.removeAttribute('src')
      video.load()
    }
  }, [attempt, hlsSrc, retry, whepSrc])

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-slate-950">
      <video ref={videoRef} controls={chrome} autoPlay muted playsInline className="h-full w-full object-contain" />

      {chrome && (state === 'webrtc' || state === 'hls') && (
        <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-1 text-[10px] text-white">
          {state === 'webrtc' ? 'WebRTC · کم‌تأخیر' : 'HLS · اتصال جایگزین'}
        </span>
      )}

      {state === 'connecting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950 text-white/60">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="text-xs">در حال اتصال به استریم…</span>
        </div>
      )}

      {state === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 text-white/50">
          <VideoOff className="h-9 w-9" />
          <span className="text-xs font-medium">استریم در دسترس نیست</span>
          {chrome && <button type="button" onClick={retry} className="flex items-center gap-1 rounded border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10">
            <RefreshCw className="h-3 w-3" /> تلاش دوباره
          </button>}
        </div>
      )}
    </div>
  )
}
