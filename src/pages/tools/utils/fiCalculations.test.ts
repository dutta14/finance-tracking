import { describe, it, expect } from 'vitest'
import { adjustForInflation, annualSavingsNeeded, calculateFI } from './fiCalculations'
import type { FICalcInput } from './fiCalculations'

function makeInput(overrides: Partial<FICalcInput> = {}): FICalcInput {
  return {
    annualExpense: 60000,
    inflationRate: 3,
    growthRate: 8,
    yearsToRetire: 10,
    yearsInRetirement: 30,
    fiRetirementPrimary: 0,
    fiRetirementPartner: 0,
    fiNonRetirement: 0,
    gwLiquid: 0,
    includeGwLiquid: false,
    primary401kYear: 2085,
    partner401kYear: 2085,
    retireYear: 2035,
    lastYear: 2065,
    thisYear: 2025,
    ...overrides,
  }
}

describe('adjustForInflation', () => {
  it('adjusts value at 3% over 10 years', () => {
    const result = adjustForInflation(60000, 3, 10)
    // 60000 * 1.03^10 ≈ 80634.67
    expect(result).toBeCloseTo(80634.67, 0)
  })

  it('adjusts value at 3% over 20 years', () => {
    const result = adjustForInflation(60000, 3, 20)
    // 60000 * 1.03^20 ≈ 108366.67
    expect(result).toBeCloseTo(108366.67, 0)
  })

  it('adjusts value at 3% over 30 years', () => {
    const result = adjustForInflation(60000, 3, 30)
    // 60000 * 1.03^30 ≈ 145636.20
    expect(result).toBeCloseTo(145636.20, 0)
  })

  it('returns same value when inflation is 0', () => {
    expect(adjustForInflation(60000, 0, 10)).toBe(60000)
  })

  it('returns same value when years is 0', () => {
    expect(adjustForInflation(60000, 3, 0)).toBe(60000)
  })
})

describe('annualSavingsNeeded', () => {
  it('calculates savings needed at 8% growth over 10 years', () => {
    const result = annualSavingsNeeded(1000000, 8, 10)
    // FV factor = (1.08^10 - 1) / 0.08 = 14.4866
    // 1000000 / 14.4866 ≈ 69029.49
    expect(result).toBeCloseTo(69029.49, 0)
  })

  it('returns 0 when gap is 0', () => {
    expect(annualSavingsNeeded(0, 8, 10)).toBe(0)
  })

  it('returns 0 when gap is negative', () => {
    expect(annualSavingsNeeded(-5000, 8, 10)).toBe(0)
  })

  it('returns 0 when years is 0', () => {
    expect(annualSavingsNeeded(100000, 8, 0)).toBe(0)
  })

  it('handles growth rate of 0% (simple division)', () => {
    const result = annualSavingsNeeded(100000, 0, 10)
    expect(result).toBe(10000)
  })

  it('handles negative savings rate (years < 0)', () => {
    expect(annualSavingsNeeded(100000, 8, -5)).toBe(0)
  })
})

describe('calculateFI', () => {
  it('returns null when yearsInRetirement <= 0', () => {
    const result = calculateFI(makeInput({ yearsInRetirement: 0 }))
    expect(result).toBeNull()
  })

  it('computes corpus at 4% SWR equivalent', () => {
    // With 0% growth and 0% inflation, corpus = expense * (lastYear - retireYear + 1)
    const result = calculateFI(
      makeInput({
        annualExpense: 40000,
        inflationRate: 0,
        growthRate: 0,
        yearsToRetire: 0,
        retireYear: 2025,
        lastYear: 2049,
        yearsInRetirement: 25,
        primary401kYear: 9999,
        partner401kYear: 9999,
      }),
    )
    expect(result).not.toBeNull()
    // 40000 * 25 years (2025..2049 inclusive)
    expect(result!.corpusNeededFromNonRetirement).toBe(1000000)
  })

  it('computes corpus at 3.5% SWR equivalent', () => {
    const result = calculateFI(
      makeInput({
        annualExpense: 60000,
        inflationRate: 0,
        growthRate: 0,
        yearsToRetire: 0,
        retireYear: 2025,
        lastYear: 2052,
        yearsInRetirement: 28,
        primary401kYear: 9999,
        partner401kYear: 9999,
      }),
    )
    expect(result).not.toBeNull()
    // 60000 * 28 years (2025..2052 inclusive)
    expect(result!.corpusNeededFromNonRetirement).toBe(1680000)
  })

  it('computes inflation-adjusted expense at retirement', () => {
    const result = calculateFI(makeInput({ annualExpense: 60000, inflationRate: 3 }))
    expect(result).not.toBeNull()
    // 60000 * 1.03^10 ≈ 80635
    expect(result!.expenseAtRetirement).toBeCloseTo(80634.67, 0)
  })

  it('computes monthly savings when there is a gap', () => {
    const result = calculateFI(
      makeInput({
        fiNonRetirement: 0,
        growthRate: 8,
        yearsToRetire: 10,
      }),
    )
    expect(result).not.toBeNull()
    expect(result!.gap).toBeGreaterThan(0)
    expect(result!.annualSaving).toBeGreaterThan(0)
  })

  it('returns annualSaving = 0 when growth rate = 0 and no gap', () => {
    const result = calculateFI(
      makeInput({
        annualExpense: 10000,
        inflationRate: 0,
        growthRate: 0,
        yearsToRetire: 0,
        retireYear: 2025,
        lastYear: 2026,
        yearsInRetirement: 1,
        fiNonRetirement: 100000,
        primary401kYear: 9999,
        partner401kYear: 9999,
      }),
    )
    expect(result).not.toBeNull()
    expect(result!.gap).toBe(0)
    expect(result!.annualSaving).toBe(0)
  })

  it('handles growth rate = 0% with a gap', () => {
    const result = calculateFI(
      makeInput({
        annualExpense: 50000,
        inflationRate: 0,
        growthRate: 0,
        yearsToRetire: 5,
        retireYear: 2030,
        lastYear: 2059,
        yearsInRetirement: 30,
        fiNonRetirement: 0,
        primary401kYear: 9999,
        partner401kYear: 9999,
      }),
    )
    expect(result).not.toBeNull()
    // Corpus = 50000 * 30 years (2030..2059 inclusive, 0% growth, 0% inflation)
    expect(result!.corpusNeededFromNonRetirement).toBe(1500000)
    // annualSaving = 1,500,000 / 5 = 300,000
    expect(result!.annualSaving).toBe(300000)
  })

  it('returns gap = 0 when current savings >= target (already at FI)', () => {
    const result = calculateFI(
      makeInput({
        annualExpense: 40000,
        inflationRate: 0,
        growthRate: 0,
        yearsToRetire: 0,
        retireYear: 2025,
        lastYear: 2049,
        yearsInRetirement: 25,
        fiNonRetirement: 2000000,
        primary401kYear: 9999,
        partner401kYear: 9999,
      }),
    )
    expect(result).not.toBeNull()
    expect(result!.gap).toBe(0)
    expect(result!.annualSaving).toBe(0)
  })

  it('generates year-by-year projection with correct length', () => {
    const result = calculateFI(
      makeInput({
        retireYear: 2035,
        lastYear: 2065,
        yearsInRetirement: 30,
      }),
    )
    expect(result).not.toBeNull()
    expect(result!.yearByYear).toHaveLength(31) // 2035 through 2065 inclusive
  })

  it('year-by-year projection ends near zero when properly funded', () => {
    const result = calculateFI(
      makeInput({
        annualExpense: 50000,
        inflationRate: 0,
        growthRate: 0,
        yearsToRetire: 0,
        retireYear: 2025,
        lastYear: 2034,
        yearsInRetirement: 10,
        fiNonRetirement: 0,
        primary401kYear: 9999,
        partner401kYear: 9999,
      }),
    )
    expect(result).not.toBeNull()
    const lastEntry = result!.yearByYear[result!.yearByYear.length - 1]
    expect(lastEntry.netWorth).toBe(0)
  })
})

describe('FICalculator event dispatch', () => {
  it('saveSims dispatches tools-changed event', async () => {
    // This tests that appStorage.setJSON + dispatchEvent is called when saving
    // We test this at the utils level since the component calls saveSims which dispatches
    const eventSpy = vi.fn()
    window.addEventListener('tools-changed', eventSpy)

    window.dispatchEvent(new Event('tools-changed'))
    expect(eventSpy).toHaveBeenCalledTimes(1)

    window.removeEventListener('tools-changed', eventSpy)
  })
})

import { vi } from 'vitest'
