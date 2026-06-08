import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { unauthorized, validationError } from '@/lib/api-responses'
import { checkPermission } from '@/lib/permissions'
import { assertRegionScope } from '@/lib/scope-guard'
import { regionService } from '@/modules/region/service'
import { importRegionsSchema } from '@/modules/region/schema'
import { regionErrorResponse } from '@/modules/region/http'
import type { Role } from '@/lib/permissions'

// Bulk import/upsert regions. Requires create permission and scope over every
// referenced market.
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'region', 'create')

    const body = await req.json()
    const parsed = importRegionsSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)

    const role = session.user.role as Role
    const marketIds = [...new Set(parsed.data.regions.map(r => r.marketId))]
    for (const marketId of marketIds) {
      await assertRegionScope(session.user.id, role, marketId)
    }

    const results = await regionService.importData(parsed.data, {
      id: session.user.id,
      name: session.user.name,
    })
    return NextResponse.json({ data: results }, { status: 200 })
  } catch (e) {
    return regionErrorResponse(e)
  }
}
