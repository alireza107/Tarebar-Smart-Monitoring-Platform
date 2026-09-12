export const FRUIT_API_BASE = (
  process.env.NEXT_PUBLIC_FRUIT_PIPELINE_API_URL ?? 'http://localhost:8010'
).replace(/\/$/, '')

// FastAPI's own detail field is a string, but its automatic pydantic
// validation errors (422) return `detail` as an array of {loc, msg, type}
// objects. Surface that message instead of masking it with a generic error.
function extractDetailMessage(detail: unknown): string | null {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const messages = detail
      .map(item => {
        if (typeof item?.msg !== 'string') return null
        const loc = Array.isArray(item.loc) ? item.loc.join('.') : null
        return loc ? `${loc}: ${item.msg}` : item.msg
      })
      .filter((msg): msg is string => Boolean(msg))
    if (messages.length > 0) return messages.join('؛ ')
  }
  return null
}

export async function fruitApiJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${FRUIT_API_BASE}${path}`, init)
  } catch {
    throw new Error(`سرویس تحلیل میوه در ${FRUIT_API_BASE} در دسترس نیست`)
  }
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(extractDetailMessage(body?.detail) ?? 'خطا در سرویس تحلیل میوه')
  }
  return body as T
}

export function fruitArtifactUrl(path: string): string {
  return path.startsWith('http') ? path : `${FRUIT_API_BASE}${path}`
}
