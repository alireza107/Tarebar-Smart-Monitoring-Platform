import net from 'node:net'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { forbidden, serverError, unauthorized } from '@/lib/api-responses'
import { db } from '@/lib/db'
import { checkPermission, PermissionError } from '@/lib/permissions'
import { serviceAuthHeaders } from '@/lib/service-token'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Status = 'ok' | 'degraded' | 'down'
interface ServiceHealth {
  key: string
  label: string
  status: Status
  detail: string
  latencyMs: number | null
}

const TIMEOUT_MS = 4_000

async function timed<T>(work: () => Promise<T>): Promise<{ value: T | null; latencyMs: number; error: unknown }> {
  const started = performance.now()
  try {
    const value = await work()
    return { value, latencyMs: Math.round(performance.now() - started), error: null }
  } catch (error) {
    return { value: null, latencyMs: Math.round(performance.now() - started), error }
  }
}

async function getJson(url: string, headers: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS), headers })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return (await response.json()) as Record<string, unknown>
}

function tcpReachable(host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket()
    socket.setTimeout(TIMEOUT_MS)
    socket.once('connect', () => { socket.destroy(); resolve() })
    socket.once('timeout', () => { socket.destroy(); reject(new Error('timeout')) })
    socket.once('error', error => { socket.destroy(); reject(error) })
    socket.connect(port, host)
  })
}

/** Live status of every service the dashboard depends on. */
export async function GET() {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'report', 'read')

    const analyticsBase = (process.env.VIDEO_ANALYTICS_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '')
    const fruitBase = (process.env.FRUIT_PIPELINE_API_URL ?? 'http://localhost:8010').replace(/\/+$/, '')
    const rtsp = new URL(process.env.MEDIAMTX_RTSP_URL ?? 'rtsp://localhost:8554')
    const token = serviceAuthHeaders(session.user)

    const [database, analytics, fleet, fruit, media] = await Promise.all([
      timed(() => db.$queryRaw`SELECT 1`),
      timed(() => getJson(`${analyticsBase}/health`)),
      timed(() => getJson(`${analyticsBase}/api/v1/fleet/status`, token)),
      timed(() => getJson(`${fruitBase}/health`)),
      timed(() => tcpReachable(rtsp.hostname, Number(rtsp.port || 8554))),
    ])

    const services: ServiceHealth[] = [
      { key: 'web', label: 'سرویس وب', status: 'ok', detail: 'در حال پاسخ‌گویی', latencyMs: 0 },
      {
        key: 'database', label: 'پایگاه داده عملیاتی',
        status: database.error ? 'down' : 'ok',
        detail: database.error ? 'اتصال برقرار نشد' : 'متصل',
        latencyMs: database.latencyMs,
      },
    ]

    const store = analytics.value?.analyticsStore === true
    services.push({
      key: 'video-analytics', label: 'سرویس تحلیل ویدیو',
      status: analytics.error ? 'down' : store ? 'ok' : 'degraded',
      detail: analytics.error ? 'در دسترس نیست' : store ? 'فعال؛ انبار تحلیلی متصل' : 'فعال؛ انبار تحلیلی در دسترس نیست (مهاجرت پایگاه داده اجرا شده است؟)',
      latencyMs: analytics.latencyMs,
    })

    const fleetData = (fleet.value?.data ?? null) as { enabled?: boolean; cameras?: number; running?: number; lastError?: string | null } | null
    services.push({
      key: 'fleet', label: 'پایش پیوسته دوربین‌ها',
      status: fleet.error || !fleetData ? 'down' : !fleetData.enabled ? 'degraded' : fleetData.lastError ? 'degraded' : (fleetData.cameras ?? 0) > (fleetData.running ?? 0) ? 'degraded' : 'ok',
      detail: fleet.error || !fleetData
        ? 'وضعیت دریافت نشد'
        : !fleetData.enabled
          ? 'غیرفعال است'
          : `${(fleetData.running ?? 0).toLocaleString('fa-IR')} از ${(fleetData.cameras ?? 0).toLocaleString('fa-IR')} دوربین در حال پردازش${fleetData.lastError ? ' · آخرین خطا ثبت شده است' : ''}`,
      latencyMs: fleet.latencyMs,
    })

    const models = (fruit.value?.models ?? {}) as { detector?: boolean; sam?: boolean }
    services.push({
      key: 'fruit-pipeline', label: 'سرویس تحلیل میوه',
      status: fruit.error ? 'down' : fruit.value?.models_ready ? 'ok' : 'degraded',
      detail: fruit.error ? 'در دسترس نیست' : fruit.value?.models_ready ? 'فعال؛ مدل‌ها آماده‌اند' : `فعال؛ مدل ${models.sam ? '' : 'SAM '}${models.detector ? '' : 'YOLO '}هنوز بارگیری نشده است`.replace(/\s+/g, ' '),
      latencyMs: fruit.latencyMs,
    })

    services.push({
      key: 'mediamtx', label: 'درگاه استریم (MediaMTX)',
      status: media.error ? 'down' : 'ok',
      detail: media.error ? 'درگاه RTSP در دسترس نیست' : 'درگاه RTSP پاسخ می‌دهد',
      latencyMs: media.latencyMs,
    })

    const overall: Status = services.some(item => item.status === 'down') ? 'down' : services.some(item => item.status === 'degraded') ? 'degraded' : 'ok'
    return NextResponse.json({ data: { checkedAt: new Date().toISOString(), overall, services } }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof PermissionError) return forbidden()
    return serverError()
  }
}
