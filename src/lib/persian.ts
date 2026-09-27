const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

/** Latin digits inside a label that is read as Persian text. Safe on the client. */
export function toPersianDigits(value: string | number): string {
  return String(value).replace(/\d/g, digit => PERSIAN_DIGITS[Number(digit)])
}

/** "غرفه ۱۲": booth numbers are stored with Latin digits but read inside Persian text. */
export function boothLabel(number: string | number): string {
  return `غرفه ${toPersianDigits(number)}`
}
