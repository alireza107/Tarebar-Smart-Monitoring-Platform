import { describe, expect, it } from 'vitest'
import { toCsv } from '../csv'

describe('toCsv', () => {
  it('starts with a BOM and uses CRLF line endings', () => {
    const csv = toCsv(['a', 'b'], [[1, 2]])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv.slice(1)).toBe('a,b\r\n1,2\r\n')
  })

  it('quotes commas, quotes and new lines', () => {
    const csv = toCsv(['text'], [['سیب، "قرمز"\nتازه, درجه یک']])
    expect(csv).toContain('"سیب، ""قرمز""\nتازه, درجه یک"')
  })

  it('renders empty cells for null and undefined and ISO strings for dates', () => {
    const csv = toCsv(['a', 'b', 'c'], [[null, undefined, new Date('2026-09-18T00:00:00Z')]])
    expect(csv).toContain(',,2026-09-18T00:00:00.000Z')
  })

  it('neutralises spreadsheet formulas in text cells but keeps negative numbers', () => {
    const csv = toCsv(['a', 'b'], [['=HYPERLINK("x")', -5]])
    expect(csv).toContain(`"'=HYPERLINK(""x"")",-5`)
  })
})
