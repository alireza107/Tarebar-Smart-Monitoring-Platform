// Business days follow Tehran local time. `toISOString()` would switch to the
// next/previous day for several hours around midnight (UTC+3:30).
export const BUSINESS_TIME_ZONE = 'Asia/Tehran'

const businessDateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** `YYYY-MM-DD` of the given instant in the business time zone. */
export function businessDate(date: Date = new Date()): string {
  return businessDateFormat.format(date)
}

/** Add whole days to a `YYYY-MM-DD` value, staying in calendar arithmetic. */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/**
 * Shift a `YYYY-MM-DD` value by whole months, clamping the day to the last day
 * of the target month (31 March − 1 month = 28/29 February, not 3 March).
 */
export function addMonths(isoDate: string, months: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  const day = date.getUTCDate()
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return target.toISOString().slice(0, 10)
}

/** Inclusive number of days between two `YYYY-MM-DD` values. */
export function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00Z`).getTime()
  const end = new Date(`${to}T00:00:00Z`).getTime()
  return Math.round((end - start) / 86_400_000) + 1
}

export type ComparisonMode = 'previous_period' | 'previous_week' | 'previous_month' | 'none'

/** The comparison window that belongs to a reporting window. */
export function comparisonRange(
  from: string,
  to: string,
  comparison: ComparisonMode,
): { from: string; to: string } | null {
  if (comparison === 'none') return null
  if (comparison === 'previous_week') return { from: addDays(from, -7), to: addDays(to, -7) }
  if (comparison === 'previous_month') return { from: addMonths(from, -1), to: addMonths(to, -1) }
  const days = daysBetween(from, to)
  const previousTo = addDays(from, -1)
  return { from: addDays(previousTo, -(days - 1)), to: previousTo }
}

/** UTC instants that bound `[from 00:00, to+1 00:00)` in the business time zone. */
export function businessRangeToUtc(from: string, to: string): { start: Date; end: Date } {
  return { start: businessMidnightUtc(from), end: businessMidnightUtc(addDays(to, 1)) }
}

function businessMidnightUtc(isoDate: string): Date {
  // Tehran has used a fixed UTC+03:30 offset since DST was abolished in 2022.
  // Resolve the offset through Intl so a future rule change is still honoured.
  const guess = new Date(`${isoDate}T00:00:00Z`)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(guess)
  const get = (type: string) => Number(parts.find(part => part.type === type)?.value ?? 0)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'))
  const offsetMs = asUtc - guess.getTime()
  return new Date(guess.getTime() - offsetMs)
}
