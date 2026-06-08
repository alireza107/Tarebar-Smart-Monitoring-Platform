// Browser-playable stream URL derivation.
//
// Browsers cannot play an rtsp:// URL in a <video> element. MediaMTX (the common
// rtsp-simple-server, default RTSP port 8554) re-publishes the same stream over
// HLS on port 8888 at `http://<host>:8888/<path>/index.m3u8`. We derive that HLS
// URL from the stored RTSP stream URL so the monitoring page can play it with hls.js.
//
// This module is pure and dependency-free so it is safe to import on the client.

// Default HLS port exposed by MediaMTX.
const MEDIAMTX_HLS_PORT = 8888

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
      const path = url.pathname.replace(/^\/+|\/+$/g, '')
      if (!path) return null
      return `http://${url.hostname}:${MEDIAMTX_HLS_PORT}/${path}/index.m3u8`
    }

    return null
  } catch {
    return null
  }
}
