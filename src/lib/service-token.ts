// Short-lived HS256 tokens that let the FastAPI services (video-analytics and
// fruit-pipeline) verify that a request comes from a signed-in platform user.
//
// Enforcement is opt-in: when SERVICE_AUTH_SECRET is unset nothing is minted and
// the services accept anonymous requests exactly as before.
//
// Server-only module (uses node:crypto). Never import it from middleware or
// from client components.
import { createHmac } from 'node:crypto'

// One hour: a <video> or MJPEG <img> keeps requesting the URL it was given for as
// long as it plays, and cannot be handed a new token mid-stream.
export const SERVICE_TOKEN_TTL_SECONDS = 60 * 60
const ISSUER = 'tarebar'

export interface ServiceTokenSubject {
  id: string
  role: string
}

export interface MintedServiceToken {
  token: string
  /** Unix milliseconds. */
  expiresAt: number
}

function secret(): string | null {
  const value = process.env.SERVICE_AUTH_SECRET?.trim()
  return value ? value : null
}

export function serviceAuthEnabled(): boolean {
  return secret() !== null
}

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url')
}

export function mintServiceToken(
  subject: ServiceTokenSubject,
  nowMs: number = Date.now(),
): MintedServiceToken | null {
  const key = secret()
  if (!key) return null
  const issuedAt = Math.floor(nowMs / 1000)
  const expires = issuedAt + SERVICE_TOKEN_TTL_SECONDS
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = base64Url(
    JSON.stringify({ iss: ISSUER, sub: subject.id, role: subject.role, iat: issuedAt, exp: expires }),
  )
  const signature = createHmac('sha256', key).update(`${header}.${payload}`).digest('base64url')
  return { token: `${header}.${payload}.${signature}`, expiresAt: expires * 1000 }
}

/** `Authorization` header for server-side calls to the FastAPI services. */
export function serviceAuthHeaders(subject: ServiceTokenSubject): Record<string, string> {
  const minted = mintServiceToken(subject)
  return minted ? { Authorization: `Bearer ${minted.token}` } : {}
}
