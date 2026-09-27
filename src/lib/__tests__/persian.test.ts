import { describe, expect, it } from 'vitest'
import { boothLabel, toPersianDigits } from '@/lib/persian'

describe('boothLabel', () => {
  it('writes the booth number with Persian digits', () => {
    expect(boothLabel('12')).toBe('غرفه ۱۲')
    expect(boothLabel(7)).toBe('غرفه ۷')
  })

  it('keeps letters and separators of a booth code', () => {
    expect(boothLabel('A-105')).toBe('غرفه A-۱۰۵')
    expect(toPersianDigits('2026/09')).toBe('۲۰۲۶/۰۹')
  })
})
