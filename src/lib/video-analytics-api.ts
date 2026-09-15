export const VIDEO_ANALYTICS_API_BASE = (
  process.env.NEXT_PUBLIC_VIDEO_ANALYTICS_API_URL ?? 'http://localhost:8000'
).replace(/\/$/, '')

export async function videoAnalyticsApiJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${VIDEO_ANALYTICS_API_BASE}${path}`, init)
  } catch {
    throw new Error(`سرویس تحلیل ویدیو در ${VIDEO_ANALYTICS_API_BASE} در دسترس نیست`)
  }
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = body?.detail?.detail ?? body?.detail ?? body?.error
    throw new Error(typeof detail === 'string' ? detail : 'خطا در سرویس درک ویدیو')
  }
  return body as T
}
