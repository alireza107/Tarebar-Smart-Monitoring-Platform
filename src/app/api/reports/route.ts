import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { unauthorized, forbidden, serverError } from '@/lib/api-responses'
import { checkPermission, PermissionError } from '@/lib/permissions'
import type { Role } from '@/lib/permissions'
import { db } from '@/lib/db'
import { reportRepository } from '@/modules/report/repository'

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

      return NextResponse.json({ data: { cameraStatus, camerasByField, boothsByMarket } })
    }

    if (role === 'MARKET_MANAGER') {
      const marketIds = await db.userScope
        .findMany({ where: { userId, scopeType: 'MARKET' }, select: { marketId: true } })
        .then(s => s.map(x => x.marketId).filter((id): id is string => id !== null))

      const [cameraStatus, boothsByMarket] = await Promise.all([
        reportRepository.getCameraStatusSummary(undefined, marketIds),
        reportRepository.getBoothsByMarket(marketIds),
      ])

      return NextResponse.json({ data: { cameraStatus, camerasByField: [], boothsByMarket } })
    }

    // ORG_ADMIN
    const [cameraStatus, camerasByField, boothsByMarket] = await Promise.all([
      reportRepository.getCameraStatusSummary(),
      reportRepository.getCamerasByField(),
      reportRepository.getBoothsByMarket(),
    ])

    return NextResponse.json({ data: { cameraStatus, camerasByField, boothsByMarket } })
  } catch (e) {
    if (e instanceof PermissionError) return forbidden()
    return serverError()
  }
}
