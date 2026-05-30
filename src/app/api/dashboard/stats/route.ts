import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { unauthorized, forbidden, serverError } from '@/lib/api-responses'
import { checkPermission, PermissionError } from '@/lib/permissions'
import type { Role } from '@/lib/permissions'
import { db } from '@/lib/db'

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

      const [fields, markets, booths, cameras, online, offline] = await Promise.all([
        db.field.count({ where: { id: { in: fieldIds }, deletedAt: null } }),
        db.market.count({ where: { fieldId: { in: fieldIds }, deletedAt: null } }),
        db.booth.count({ where: { market: { fieldId: { in: fieldIds } }, deletedAt: null } }),
        db.camera.count({ where: { OR: [{ fieldId: { in: fieldIds } }, { marketId: { in: marketIds } }], deletedAt: null } }),
        db.camera.count({ where: { OR: [{ fieldId: { in: fieldIds } }, { marketId: { in: marketIds } }], status: 'ONLINE', deletedAt: null } }),
        db.camera.count({ where: { OR: [{ fieldId: { in: fieldIds } }, { marketId: { in: marketIds } }], status: 'OFFLINE', deletedAt: null } }),
      ])

      return NextResponse.json({ data: { fields, markets, booths, cameras, online, offline } })
    }

    if (role === 'MARKET_MANAGER') {
      const marketIds = await db.userScope
        .findMany({ where: { userId, scopeType: 'MARKET' }, select: { marketId: true } })
        .then(s => s.map(x => x.marketId).filter((id): id is string => id !== null))

      const [markets, booths, cameras, online, offline] = await Promise.all([
        db.market.count({ where: { id: { in: marketIds }, deletedAt: null } }),
        db.booth.count({ where: { marketId: { in: marketIds }, deletedAt: null } }),
        db.camera.count({ where: { marketId: { in: marketIds }, deletedAt: null } }),
        db.camera.count({ where: { marketId: { in: marketIds }, status: 'ONLINE', deletedAt: null } }),
        db.camera.count({ where: { marketId: { in: marketIds }, status: 'OFFLINE', deletedAt: null } }),
      ])

      return NextResponse.json({ data: { fields: null, markets, booths, cameras, online, offline } })
    }

    // ORG_ADMIN — all counts
    const [fields, markets, booths, cameras, online, offline] = await Promise.all([
      db.field.count({ where: { deletedAt: null } }),
      db.market.count({ where: { deletedAt: null } }),
      db.booth.count({ where: { deletedAt: null } }),
      db.camera.count({ where: { deletedAt: null } }),
      db.camera.count({ where: { status: 'ONLINE', deletedAt: null } }),
      db.camera.count({ where: { status: 'OFFLINE', deletedAt: null } }),
    ])

    return NextResponse.json({ data: { fields, markets, booths, cameras, online, offline } })
  } catch (e) {
    if (e instanceof PermissionError) return forbidden()
    return serverError()
  }
}
