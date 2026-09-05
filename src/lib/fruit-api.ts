export const FRUIT_API_BASE = (
  process.env.NEXT_PUBLIC_FRUIT_PIPELINE_API_URL ?? 'http://localhost:8010'
).replace(/\/$/, '')

export async function fruitApiJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${FRUIT_API_BASE}${path}`, init)
  } catch {
    throw new Error(`سرویس تحلیل میوه در ${FRUIT_API_BASE} در دسترس نیست`)
  }
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(typeof body?.detail === 'string' ? body.detail : 'خطا در سرویس تحلیل میوه')
  }
  return body as T
}

export function fruitArtifactUrl(path: string): string {
  return path.startsWith('http') ? path : `${FRUIT_API_BASE}${path}`
}
