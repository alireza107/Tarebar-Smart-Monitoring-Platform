// Browser-side access to the short-lived service token (see lib/service-token.ts).
// When service authentication is disabled the token is null and every helper
// below degrades to a no-op, so callers never need to branch.

interface CachedToken {
  token: string | null
  expiresAt: number | null
  fetchedAt: number
}

const REFRESH_MARGIN_MS = 90_000
const DISABLED_RECHECK_MS = 5 * 60_000

let cached: CachedToken | null = null
let pending: Promise<string | null> | null = null

function isFresh(entry: CachedToken, now: number): boolean {
  if (entry.token === null || entry.expiresAt === null) return now - entry.fetchedAt < DISABLED_RECHECK_MS
  return entry.expiresAt - now > REFRESH_MARGIN_MS
}

export async function getServiceToken(forceRefresh = false): Promise<string | null> {
  const now = Date.now()
  if (!forceRefresh && cached && isFresh(cached, now)) return cached.token
  pending ??= fetch('/api/service-token', { cache: 'no-store' })
    .then(async response => {
      if (!response.ok) return null
      const body = (await response.json()) as { data?: { token?: string | null; expiresAt?: number | null } }
      cached = { token: body.data?.token ?? null, expiresAt: body.data?.expiresAt ?? null, fetchedAt: Date.now() }
      return cached.token
    })
    .catch(() => null)
    .finally(() => { pending = null })
  return pending
}

export function appendAccessToken(url: string, token: string | null): string {
  if (!token) return url
  return `${url}${url.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`
}

/** URL usable by `<img>`, `<video>`, `EventSource` and download links, which cannot send headers. */
export async function withServiceToken(url: string): Promise<string> {
  return appendAccessToken(url, await getServiceToken())
}

/** `fetch` init carrying the token as a bearer header. */
export async function authorizedInit(init: RequestInit = {}): Promise<RequestInit> {
  const token = await getServiceToken()
  if (!token) return init
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  return { ...init, headers }
}
