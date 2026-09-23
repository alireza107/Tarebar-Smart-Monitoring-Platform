// Client-side file downloads for exports that are built in the browser.
import { toCsv, type CsvValue } from '@/lib/csv'

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Give the browser a moment to start the download before releasing the blob.
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

export function downloadJson(filename: string, value: unknown): void {
  downloadBlob(filename, new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' }))
}

export function downloadCsv(filename: string, headers: string[], rows: CsvValue[][]): void {
  downloadBlob(filename, new Blob([toCsv(headers, rows)], { type: 'text/csv;charset=utf-8' }))
}

/** Timestamp for file names, e.g. `2026-09-19_0042`. */
export function fileStamp(date: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`
}
