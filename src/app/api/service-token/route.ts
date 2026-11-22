import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { unauthorized } from '@/lib/api-responses'
import { mintServiceToken } from '@/lib/service-token'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Short-lived token the browser attaches to its direct calls to the analytics
 * and fruit services. `token` is null when service authentication is disabled.
 */
export async function GET() {
  const session = await auth()
  if (!session) return unauthorized()
  const minted = mintServiceToken({ id: session.user.id, role: session.user.role })
  return NextResponse.json(
    { data: { token: minted?.token ?? null, expiresAt: minted?.expiresAt ?? null } },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
