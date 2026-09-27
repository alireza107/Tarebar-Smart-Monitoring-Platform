export type CsvValue = string | number | boolean | null | undefined | Date

function cell(value: CsvValue): string {
  if (value === null || value === undefined) return ''
  const text = value instanceof Date ? value.toISOString() : String(value)
  // Neutralise spreadsheet formula injection for text coming from users or models.
  const safe = /^[=+\-@\t\r]/.test(text) && typeof value === 'string' ? `'${text}` : text
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** RFC 4180 CSV with a UTF-8 BOM so Excel opens Persian text correctly. */
export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers, ...rows].map(row => row.map(cell).join(','))
  return `﻿${lines.join('\r\n')}\r\n`
}

export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

export function jsonDownloadResponse(filename: string, value: unknown): Response {
  return new Response(JSON.stringify(value, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
