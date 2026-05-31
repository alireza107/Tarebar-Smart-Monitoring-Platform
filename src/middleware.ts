import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { canAccessRoute } from '@/lib/nav-permissions'
import type { Role } from '@/lib/permissions'

const PUBLIC_PATHS = ['/login']

export default auth((req: NextRequest & { auth: { user?: { role?: string } } | null }) => {
  const { pathname } = req.nextUrl
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  if (!req.auth && !isPublic) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (req.auth && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Skip API routes — they enforce their own authorization
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  if (req.auth) {
    const role = req.auth.user?.role as Role | undefined
    if (role && !canAccessRoute(role, pathname)) {
      return NextResponse.redirect(new URL('/access-denied', req.url))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}
