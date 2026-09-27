'use client'

import { useEffect, useState } from 'react'
import { withServiceToken } from '@/lib/service-token-client'

/**
 * Resolve a URL of the analytics or fruit service into one that carries the
 * service token, for elements that cannot send headers (`<img>`, `<video>`,
 * `EventSource`, plain links).
 *
 * The result stays stable while `url` and `refreshKey` are unchanged: a token
 * only matters when a connection is opened, and swapping the `src` of a running
 * MJPEG stream or event source would needlessly reconnect it. Bump `refreshKey`
 * to obtain a fresh token after a connection was refused.
 */
export function useTokenizedUrl(url: string | null | undefined, refreshKey = 0): string | null {
  const [resolved, setResolved] = useState<{ source: string; value: string } | null>(null)

  useEffect(() => {
    if (!url) return
    let cancelled = false
    withServiceToken(url).then(value => {
      if (!cancelled) setResolved({ source: `${url}#${refreshKey}`, value })
    })
    return () => { cancelled = true }
  }, [url, refreshKey])

  return url && resolved?.source === `${url}#${refreshKey}` ? resolved.value : null
}
