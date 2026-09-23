import { describe, expect, it } from 'vitest'
import { addDays, addMonths, businessDate, businessRangeToUtc, comparisonRange, daysBetween } from '../dates'

describe('businessDate', () => {
  it('uses the Tehran calendar day, not the UTC day', () => {
    // 21:00 UTC is already 00:30 of the next day in Tehran (UTC+03:30).
    expect(businessDate(new Date('2026-09-18T21:00:00Z'))).toBe('2026-09-19')
    expect(businessDate(new Date('2026-09-18T20:00:00Z'))).toBe('2026-09-18')
  })
})

describe('calendar arithmetic', () => {
  it('adds days across month boundaries', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('clamps month shifts to the last day of the target month', () => {
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28')
    expect(addMonths('2024-03-31', -1)).toBe('2024-02-29')
    expect(addMonths('2026-05-15', -1)).toBe('2026-04-15')
  })

  it('counts days inclusively', () => {
    expect(daysBetween('2026-09-12', '2026-09-18')).toBe(7)
    expect(daysBetween('2026-09-18', '2026-09-18')).toBe(1)
  })
})

describe('comparisonRange', () => {
  it('returns the equally long window right before the period', () => {
    expect(comparisonRange('2026-09-12', '2026-09-18', 'previous_period')).toEqual({ from: '2026-09-05', to: '2026-09-11' })
  })

  it('shifts by one week or one clamped month', () => {
    expect(comparisonRange('2026-09-12', '2026-09-18', 'previous_week')).toEqual({ from: '2026-09-05', to: '2026-09-11' })
    expect(comparisonRange('2026-03-29', '2026-03-31', 'previous_month')).toEqual({ from: '2026-02-28', to: '2026-02-28' })
  })

  it('returns null when comparison is disabled', () => {
    expect(comparisonRange('2026-09-12', '2026-09-18', 'none')).toBeNull()
  })
})

describe('businessRangeToUtc', () => {
  it('bounds whole Tehran days in UTC', () => {
    const { start, end } = businessRangeToUtc('2026-09-18', '2026-09-18')
    expect(start.toISOString()).toBe('2026-09-17T20:30:00.000Z')
    expect(end.toISOString()).toBe('2026-09-18T20:30:00.000Z')
  })
})
