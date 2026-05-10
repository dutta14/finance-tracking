import { describe, it, expect } from 'vitest'
import { formatDate, formatRelative } from './utils'

describe('formatRelative', () => {
  it('returns "just now" for less than a minute ago', () => {
    const now = new Date().toISOString()
    expect(formatRelative(now)).toBe('just now')
  })

  it('returns minutes for < 60 minutes', () => {
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60_000).toISOString()
    expect(formatRelative(thirtyMinsAgo)).toBe('30m ago')
  })

  it('returns hours for < 24 hours', () => {
    const fiveHoursAgo = new Date(Date.now() - 5 * 3600_000).toISOString()
    expect(formatRelative(fiveHoursAgo)).toBe('5h ago')
  })

  it('returns days for >= 24 hours', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400_000).toISOString()
    expect(formatRelative(threeDaysAgo)).toBe('3d ago')
  })
})

describe('formatDate', () => {
  it('formats an ISO string to readable date with time', () => {
    const result = formatDate('2025-06-15T14:30:00Z')
    expect(result).toMatch(/^Jun 15, 2025, \d{2}:\d{2}\s(AM|PM)$/)
  })
})
