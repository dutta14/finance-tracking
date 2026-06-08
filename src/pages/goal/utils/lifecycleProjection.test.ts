import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildLifecycle } from './lifecycleProjection'

describe('lifecycleProjection — buildLifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 1)) // June 2026
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns empty array when endYear is in the past', () => {
    const fiDate = new Date(2030, 5, 1)
    const result = buildLifecycle(100000, 1000, 8, 6, 3, 5000, 2020, fiDate, 6000, 6000)
    expect(result).toHaveLength(0)
  })

  it('produces accumulation rows before fiDate and drawdown rows after', () => {
    const fiDate = new Date(2028, 5, 1) // FI in 2 years
    const result = buildLifecycle(500000, 2000, 8, 6, 3, 8000, 2040, fiDate, 6000, 6000)

    const accRows = result.filter(r => r.phase === 'accumulation')
    const drawRows = result.filter(r => r.phase === 'drawdown')

    expect(accRows.length).toBeGreaterThan(0)
    expect(drawRows.length).toBeGreaterThan(0)

    // Accumulation rows have 0 expense
    accRows.forEach(r => expect(r.expense).toBe(0))

    // Drawdown rows have non-zero expense
    drawRows.forEach(r => expect(r.expense).toBeGreaterThan(0))
  })

  it('accumulation rows show balance growing over time', () => {
    const fiDate = new Date(2030, 5, 1)
    const result = buildLifecycle(100000, 3000, 8, 6, 3, 10000, 2035, fiDate, 6000, 6000)

    const accRows = result.filter(r => r.phase === 'accumulation')
    // Balance should increase during accumulation
    for (let i = 1; i < accRows.length; i++) {
      expect(accRows[i].remaining).toBeGreaterThanOrEqual(accRows[i - 1].remaining)
    }
  })

  it('includes growthRate on each row', () => {
    const fiDate = new Date(2028, 5, 1)
    const result = buildLifecycle(100000, 1000, 8, 6, 3, 5000, 2032, fiDate, 6000, 6000)

    result.forEach(row => {
      expect(row.growthRate).toBeDefined()
      expect(typeof row.growthRate).toBe('number')
    })
  })

  it('caps total rows at 1200', () => {
    const fiDate = new Date(2200, 0, 1) // Very far future FI date
    const result = buildLifecycle(100000, 1000, 8, 6, 3, 5000, 2300, fiDate, 6000, 6000)
    expect(result.length).toBeLessThanOrEqual(1200)
  })
})
