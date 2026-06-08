import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { unauthorized } from '@/lib/api-responses'
import { checkPermission } from '@/lib/permissions'
import { regionService } from '@/modules/region/service'
import { regionErrorResponse } from '@/modules/region/http'
import type { Role } from '@/lib/permissions'

// Export all in-scope regions (with camera mappings + booth links) as JSON.
export async function GET() {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'region', 'read')

    const payload = await regionService.exportData(session.user.id, session.user.role as Role)
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="regions-export.json"`,
      },
    })
  } catch (e) {
    return regionErrorResponse(e)
  }
}
