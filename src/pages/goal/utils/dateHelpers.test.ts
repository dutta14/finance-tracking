import { describe, it, expect } from 'vitest'
import { parseDate, formatMonthYear, getMonthsBetween } from './dateHelpers'

describe('parseDate', () => {
  it('parses a standard YYYY-MM-DD string', () => {
    const d = parseDate('2025-06-15')
    expect(d.getFullYear()).toBe(2025)
    expect(d.getMonth()).toBe(5) // 0-indexed
    expect(d.getDate()).toBe(15)
  })

  it('parses first day of year', () => {
    const d = parseDate('2000-01-01')
    expect(d.getFullYear()).toBe(2000)
    expect(d.getMonth()).toBe(0)
    expect(d.getDate()).toBe(1)
  })

  it('parses last day of year', () => {
    const d = parseDate('2024-12-31')
    expect(d.getFullYear()).toBe(2024)
    expect(d.getMonth()).toBe(11)
    expect(d.getDate()).toBe(31)
  })
})

describe('formatMonthYear', () => {
  it('formats a date as "Mmm YYYY"', () => {
    expect(formatMonthYear('2025-06-15')).toBe('Jun 2025')
  })

  it('formats January correctly', () => {
    expect(formatMonthYear('2020-01-01')).toBe('Jan 2020')
  })

  it('formats December correctly', () => {
    expect(formatMonthYear('2024-12-25')).toBe('Dec 2024')
  })
})

describe('getMonthsBetween', () => {
  it('returns 12 for exactly one year apart (same day)', () => {
    const start = new Date(2024, 0, 15) // Jan 15
    const end = new Date(2025, 0, 15)   // Jan 15
    expect(getMonthsBetween(start, end)).toBe(12)
  })

  it('returns 0 for same month same day', () => {
    const d = new Date(2025, 5, 10)
    expect(getMonthsBetween(d, d)).toBe(0)
  })

  it('subtracts 1 when start day > end day (DATEDIF behavior)', () => {
    const start = new Date(2025, 0, 31) // Jan 31
    const end = new Date(2025, 2, 15)   // Mar 15
    // 2 months difference, but 31 > 15, so 1
    expect(getMonthsBetween(start, end)).toBe(1)
  })

  it('does not subtract when start day <= end day', () => {
    const start = new Date(2025, 0, 10) // Jan 10
    const end = new Date(2025, 2, 15)   // Mar 15
    expect(getMonthsBetween(start, end)).toBe(2)
  })

  it('handles multi-year spans', () => {
    const start = new Date(2020, 0, 1)
    const end = new Date(2025, 6, 1) // Jul 2025
    expect(getMonthsBetween(start, end)).toBe(66)
  })

  it('returns negative for end before start', () => {
    const start = new Date(2025, 6, 1)
    const end = new Date(2025, 0, 1)
    expect(getMonthsBetween(start, end)).toBe(-6)
  })
})
