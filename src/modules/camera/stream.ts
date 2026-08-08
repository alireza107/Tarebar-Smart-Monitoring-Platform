// Browser playback URLs derived from the normalized RTSP camera contract.
// The RTSP host is often a Docker-only hostname, therefore public WebRTC/HLS
// bases are environment-driven instead of being inferred from that host.

const DEFAULT_WEBRTC_PORT = 8889
const DEFAULT_HLS_PORT = 8888

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function mediaMtxBase(
  configured: string | undefined,
  streamUrl: URL,
  port: number,
): string {
  if (configured) return trimTrailingSlash(configured)
  const protocol = streamUrl.protocol === 'rtsps:' ? 'https:' : 'http:'
  return `${protocol}//${streamUrl.hostname}:${port}`
}

export interface CameraPlaybackUrls {
  whep: string
  hls: string
}

/** Return the path inside MediaMTX, without a leading or trailing slash. */
export function streamPath(streamUrl: string | null | undefined): string | null {
  if (!streamUrl) return null
  try {
    const parsed = new URL(streamUrl)
    const path = parsed.pathname.replace(/^\/+|\/+$/g, '')
    return path || null
  } catch {
    return null
  }
}

/**
 * Resolve low-latency WebRTC/WHEP and fallback HLS URLs for an RTSP URL.
 * Public bases let browser traffic use a LAN/public host while backend and CV
 * containers keep using `rtsp://mediamtx:8554/<path>`.
 */
export function derivePlaybackUrls(
  streamUrl: string | null | undefined,
): CameraPlaybackUrls | null {
  if (!streamUrl) return null
  try {
    const parsed = new URL(streamUrl)
    if (parsed.protocol !== 'rtsp:' && parsed.protocol !== 'rtsps:') return null
    const path = streamPath(streamUrl)
    if (!path) return null
    const webrtcBase = mediaMtxBase(
      process.env.NEXT_PUBLIC_MEDIAMTX_WEBRTC_URL,
      parsed,
      DEFAULT_WEBRTC_PORT,
    )
    const hlsBase = mediaMtxBase(
      process.env.NEXT_PUBLIC_MEDIAMTX_HLS_URL,
      parsed,
      DEFAULT_HLS_PORT,
    )
    return {
      whep: `${webrtcBase}/${path}/whep`,
      hls: `${hlsBase}/${path}/index.m3u8`,
    }
  } catch {
    return null
  }
}

/**
 * Translate a locally-addressed MediaMTX URL to the Docker-internal base used
 * by the analytics service. Real camera RTSP URLs are returned unchanged.
 */
export function deriveAnalyticsRtspUrl(streamUrl: string): string {
  try {
    const parsed = new URL(streamUrl)
    const isLocalMediaMtx =
      parsed.protocol === 'rtsp:' &&
      (parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname === 'mediamtx') &&
      (parsed.port === '8554' || parsed.port === '')
    const internalBase = process.env.MEDIAMTX_RTSP_URL?.replace(/\/+$/, '')
    const path = streamPath(streamUrl)
    return isLocalMediaMtx && internalBase && path
      ? `${internalBase}/${path}`
      : streamUrl
  } catch {
    return streamUrl
  }
}

/**
 * Derive a browser-playable HLS (.m3u8) URL from a camera stream URL.
 *
 * - rtsp(s)://host:8554/path  → http://host:8888/path/index.m3u8  (MediaMTX HLS)
 * - an http(s) .m3u8 URL      → returned unchanged (already playable)
 * - missing / unparseable URL → null
 */
export function deriveHlsUrl(streamUrl: string | null | undefined): string | null {
  if (!streamUrl) return null
  try {
    const url = new URL(streamUrl)

    // Already an HLS playlist — play it directly.
    if (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.pathname.endsWith('.m3u8')
    ) {
      return streamUrl
    }

    if (url.protocol === 'rtsp:' || url.protocol === 'rtsps:') {
      return derivePlaybackUrls(streamUrl)?.hls ?? null
    }

    return null
  } catch {
    return null
  }
}
