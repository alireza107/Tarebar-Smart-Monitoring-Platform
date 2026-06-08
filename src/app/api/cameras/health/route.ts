import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { unauthorized, forbidden, serverError } from '@/lib/api-responses'
import { checkPermission, PermissionError } from '@/lib/permissions'
import { cameraService } from '@/modules/camera/service'
import { probeCameraStatuses } from '@/modules/camera/health'
import type { Role } from '@/lib/permissions'

// Liveness probing opens raw TCP sockets, so this must run on the Node.js runtime
// (not Edge) and must never be statically cached.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Returns the live status of every camera the caller can see, derived by probing
 * each camera's stream URL in real time rather than the stored status column.
 */
export async function GET() {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'camera', 'read')
    const cameras = await cameraService.getAll(session.user.id, session.user.role as Role)
    const statuses = await probeCameraStatuses(cameras)
    return NextResponse.json({ data: statuses })
  } catch (e) {
    if (e instanceof PermissionError) return forbidden()
    return serverError()
  }
}
