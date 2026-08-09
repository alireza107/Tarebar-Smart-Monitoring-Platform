import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { unauthorized, forbidden, serverError } from '@/lib/api-responses'
import { checkPermission, PermissionError } from '@/lib/permissions'
import type { Role } from '@/lib/permissions'
import { db } from '@/lib/db'
import { reportRepository } from '@/modules/report/repository'
import { cameraService } from '@/modules/camera/service'

async function withRestrictedEvents<T extends object>(base: T, userId: string, role: Role) {
  const cameras = await cameraService.getAll(userId, role)
  const allowed = new Map(cameras.map(camera => [camera.id, camera.name]))
  const analyticsBase = (process.env.VIDEO_ANALYTICS_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '')
  try {
    const response = await fetch(`${analyticsBase}/api/v1/restricted-area-events?limit=200`, {
      signal: AbortSignal.timeout(5_000),
      cache: 'no-store',
    })
    if (!response.ok) return { ...base, restrictedAreaEvents: [] }
    const body = await response.json() as { data?: Array<Record<string, unknown>> }
    const restrictedAreaEvents = (body.data ?? [])
      .filter(event => typeof event.camera_id === 'string' && allowed.has(event.camera_id))
      .map(event => ({ ...event, camera_name: allowed.get(event.camera_id as string)! }))
    return { ...base, restrictedAreaEvents }
  } catch {
    return { ...base, restrictedAreaEvents: [] }
  }
}

export async function GET() {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'report', 'read')

    const role = session.user.role as Role
    const userId = session.user.id

    if (role === 'FIELD_MANAGER') {
      const fieldIds = await db.userScope
        .findMany({ where: { userId, scopeType: 'FIELD' }, select: { fieldId: true } })
        .then(s => s.map(x => x.fieldId).filter((id): id is string => id !== null))

      const marketIds = await db.market
        .findMany({ where: { fieldId: { in: fieldIds }, deletedAt: null }, select: { id: true } })
        .then(m => m.map(x => x.id))

      const [cameraStatus, camerasByField, boothsByMarket] = await Promise.all([
        reportRepository.getCameraStatusSummary(fieldIds, marketIds),
        reportRepository.getCamerasByField(fieldIds),
        reportRepository.getBoothsByMarket(undefined, fieldIds),
      ])

      return NextResponse.json({ data: await withRestrictedEvents({ cameraStatus, camerasByField, boothsByMarket }, userId, role) })
    }

    if (role === 'MARKET_MANAGER') {
      const marketIds = await db.userScope
        .findMany({ where: { userId, scopeType: 'MARKET' }, select: { marketId: true } })
        .then(s => s.map(x => x.marketId).filter((id): id is string => id !== null))

      const [cameraStatus, boothsByMarket] = await Promise.all([
        reportRepository.getCameraStatusSummary(undefined, marketIds),
        reportRepository.getBoothsByMarket(marketIds),
      ])

      return NextResponse.json({ data: await withRestrictedEvents({ cameraStatus, camerasByField: [], boothsByMarket }, userId, role) })
    }

    // ORG_ADMIN
    const [cameraStatus, camerasByField, boothsByMarket] = await Promise.all([
      reportRepository.getCameraStatusSummary(),
      reportRepository.getCamerasByField(),
      reportRepository.getBoothsByMarket(),
    ])

    return NextResponse.json({ data: await withRestrictedEvents({ cameraStatus, camerasByField, boothsByMarket }, userId, role) })
  } catch (e) {
    if (e instanceof PermissionError) return forbidden()
    return serverError()
  }
}
