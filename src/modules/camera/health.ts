import net from 'node:net'
import type { CameraStatus } from './types'

// How long we wait for a stream host to respond before we declare it offline.
// Kept short so a page-load probe of many cameras stays snappy.
const PROBE_TIMEOUT_MS = 4_000

const DEFAULT_PORTS: Record<string, number> = {
  'rtsp:': 554,
  'rtsps:': 322,
  'http:': 80,
  'https:': 443,
}

interface StreamTarget {
  host: string
  port: number
}

/**
 * Extract the host/port we should probe from a stream URL. Returns null when the
 * URL is missing, malformed, or uses a protocol we don't know how to reach.
 */
function parseStreamTarget(streamUrl: string | null): StreamTarget | null {
  if (!streamUrl) return null
  try {
    const url = new URL(streamUrl)
    const defaultPort = DEFAULT_PORTS[url.protocol]
    if (!defaultPort && !url.port) return null
    const port = url.port ? Number(url.port) : defaultPort
    if (!url.hostname || !Number.isFinite(port)) return null
    return { host: url.hostname, port }
  } catch {
    return null
  }
}

/**
 * Probe a specific RTSP stream by performing an RTSP DESCRIBE handshake.
 *
 * A plain TCP connect only proves the RTSP *server* is listening — with
 * MediaMTX (and most servers) that port stays open even when no camera is
 * publishing, so it would report ONLINE forever. DESCRIBE instead asks about
 * the specific path:
 *   - 200 OK            → a publisher is live on this path        → ONLINE
 *   - 401/403           → server up but auth required (can't tell) → ONLINE
 *   - 404 / other 4xx-5xx → no active stream on this path         → OFFLINE
 *   - refused / timeout  → server unreachable                     → OFFLINE
 */
function probeRtspStream(streamUrl: string, target: StreamTarget): Promise<CameraStatus> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    let settled = false
    let buffer = ''

    const finish = (status: CameraStatus) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(status)
    }

    socket.setTimeout(PROBE_TIMEOUT_MS)
    socket.once('timeout', () => finish('OFFLINE'))
    socket.once('error', () => finish('OFFLINE'))
    // Server accepted the connection but never sent an RTSP status line.
    socket.once('close', () => finish('OFFLINE'))

    socket.connect(target.port, target.host, () => {
      const request =
        `DESCRIBE ${streamUrl} RTSP/1.0\r\n` +
        `CSeq: 1\r\n` +
        `Accept: application/sdp\r\n` +
        `User-Agent: TarebarMonitor\r\n` +
        `\r\n`
      socket.write(request)
    })

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8')
      const newlineIndex = buffer.indexOf('\r\n')
      if (newlineIndex === -1) return // status line not fully received yet

      const statusLine = buffer.slice(0, newlineIndex)
      const match = /^RTSP\/\d\.\d\s+(\d{3})/.exec(statusLine)
      if (!match) {
        finish('OFFLINE')
        return
      }

      const code = Number(match[1])
      if (code === 200 || code === 401 || code === 403) finish('ONLINE')
      else finish('OFFLINE')
    })
  })
}

/**
 * Fallback liveness check for non-RTSP streams (e.g. HTTP/HLS): a stream host is
 * considered ONLINE if it accepts a TCP connection on the stream port.
 */
function probeTcpReachable(target: StreamTarget): Promise<CameraStatus> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    let settled = false

    const finish = (status: CameraStatus) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(status)
    }

    socket.setTimeout(PROBE_TIMEOUT_MS)
    socket.once('connect', () => finish('ONLINE'))
    socket.once('timeout', () => finish('OFFLINE'))
    socket.once('error', () => finish('OFFLINE'))
    socket.connect(target.port, target.host)
  })
}

/**
 * Resolve the live status of a single camera from its stream URL.
 * - No / unparseable stream URL → UNKNOWN
 * - RTSP path has a live publisher → ONLINE, otherwise OFFLINE (DESCRIBE)
 * - Non-RTSP host reachable → ONLINE, otherwise OFFLINE (TCP)
 */
export async function probeCameraStatus(streamUrl: string | null): Promise<CameraStatus> {
  const target = parseStreamTarget(streamUrl)
  if (!streamUrl || !target) return 'UNKNOWN'

  const isRtsp = streamUrl.startsWith('rtsp://') || streamUrl.startsWith('rtsps://')
  return isRtsp
    ? probeRtspStream(streamUrl, target)
    : probeTcpReachable(target)
}

/** Probe many cameras concurrently, returning a map of camera id → live status. */
export async function probeCameraStatuses(
  cameras: { id: string; streamUrl: string | null }[],
): Promise<Record<string, CameraStatus>> {
  const entries = await Promise.all(
    cameras.map(async (c) => [c.id, await probeCameraStatus(c.streamUrl)] as const),
  )
  return Object.fromEntries(entries)
}
