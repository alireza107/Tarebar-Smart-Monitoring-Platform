import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { forbidden, serverError, unauthorized } from '@/lib/api-responses'
import { checkPermission, PermissionError } from '@/lib/permissions'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'report', 'read')

    const analyticsBase = process.env.VIDEO_ANALYTICS_API_URL?.replace(/\/+$/, '')
    if (!analyticsBase) {
      return NextResponse.json({ data: { enabled: false, fps: 0.5, cameras: 0, running: 0, workers: [] } })
    }
    const analyticsKey = process.env.ANALYTICS_READ_KEY
    const response = await fetch(`${analyticsBase}/api/v1/fleet/status`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
      headers: analyticsKey ? { 'X-Analytics-Key': analyticsKey } : undefined,
    })
    if (!response.ok) {
      return NextResponse.json({ data: { enabled: false, fps: 0.5, cameras: 0, running: 0, workers: [] } })
    }
    const body: unknown = await response.json()
    const data = body && typeof body === 'object' && 'data' in body ? (body as { data: unknown }).data : body
    return NextResponse.json({ data })
  } catch (error) {
    if (error instanceof PermissionError) return forbidden()
    return serverError()
  }
}
