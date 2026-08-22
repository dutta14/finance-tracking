import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { adjustForInflation, calculateFI, monthlySavingsNeeded } from './fiCalculations'
import type { FICalcInput } from './fiCalculations'

const thisYear = new Date().getFullYear()

function makeInput(overrides: Partial<FICalcInput> = {}): FICalcInput {
  return {
    annualExpense: 60000,
    inflationRate: 3,
    growthRate: 8,
    postBoundaryGrowth: 6,
    boundaryYear: thisYear + 60,
    yearsToRetire: 10,
    yearsInRetirement: 30,
    fiRetirementPrimary: 0,
    fiRetirementPartner: 0,
    fiNonRetirement: 0,
    gwLiquid: 0,
    includeGwLiquid: false,
    primary401kYear: thisYear + 60,
    primary401kMonth: 1,
    partner401kYear: thisYear + 60,
    partner401kMonth: 1,
    retireYear: thisYear + 10,
    lastYear: thisYear + 40,
    thisYear,
    ...overrides,
  }
}

describe('adjustForInflation', () => {
  it('adjusts value at 3% over 10 years with monthly compounding', () => {
    expect(adjustForInflation(60000, 3, 10)).toBeCloseTo(80961.21, 2)
  })

  it('adjusts value at 3% over 20 years with monthly compounding', () => {
    expect(adjustForInflation(60000, 3, 20)).toBeCloseTo(109245.3, 1)
  })

  it('adjusts value at 3% over 30 years with monthly compounding', () => {
    expect(adjustForInflation(60000, 3, 30)).toBeCloseTo(147410.53, 1)
  })

  it('returns same value when inflation is 0', () => {
    expect(adjustForInflation(60000, 0, 10)).toBe(60000)
  })

  it('returns same value when years is 0', () => {
    expect(adjustForInflation(60000, 3, 0)).toBe(60000)
  })
})

describe('monthlySavingsNeeded', () => {
  it('calculates savings needed at 8% growth over 120 months', () => {
    expect(monthlySavingsNeeded(1000000, 8, 120)).toBeCloseTo(5466.09, 2)
  })

  it('returns 0 when gap is 0', () => {
    expect(monthlySavingsNeeded(0, 8, 120)).toBe(0)
  })

  it('returns 0 when gap is negative', () => {
    expect(monthlySavingsNeeded(-5000, 8, 120)).toBe(0)
  })

  it('returns 0 when months is 0', () => {
    expect(monthlySavingsNeeded(100000, 8, 0)).toBe(0)
  })

  it('handles growth rate of 0% with simple monthly division', () => {
    expect(monthlySavingsNeeded(100000, 0, 120)).toBeCloseTo(833.33, 2)
  })

  it('handles negative savings horizon', () => {
    expect(monthlySavingsNeeded(100000, 8, -5)).toBe(0)
  })
})

describe('calculateFI', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(thisYear, 0, 1))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null when yearsInRetirement <= 0', () => {
    expect(calculateFI(makeInput({ yearsInRetirement: 0 }))).toBeNull()
  })

  it('computes corpus with zero growth and zero inflation over 25 retirement years', () => {
    const result = calculateFI(
      makeInput({
        annualExpense: 40000,
        inflationRate: 0,
        growthRate: 0,
        yearsToRetire: 0,
        retireYear: thisYear,
        lastYear: thisYear + 24,
        yearsInRetirement: 25,
        primary401kYear: 9999,
        partner401kYear: 9999,
      }),
    )

    expect(result).not.toBeNull()
    expect(result!.corpusNeededFromNonRetirement).toBeCloseTo(1000000, 0)
  })

  it('computes corpus with zero growth and zero inflation over 28 retirement years', () => {
    const result = calculateFI(
      makeInput({
        annualExpense: 60000,
        inflationRate: 0,
        growthRate: 0,
        yearsToRetire: 0,
        retireYear: thisYear,
        lastYear: thisYear + 27,
        yearsInRetirement: 28,
        primary401kYear: 9999,
        partner401kYear: 9999,
      }),
    )

    expect(result).not.toBeNull()
    expect(result!.corpusNeededFromNonRetirement).toBeCloseTo(1680000, 0)
  })

  it('computes monthly expense at retirement with monthly inflation', () => {
    const result = calculateFI(makeInput({ annualExpense: 60000, inflationRate: 3 }))

    expect(result).not.toBeNull()
    expect(result!.monthlyExpenseAtRetirement).toBeCloseTo(6746.77, 2)
  })

  it('computes monthly savings when there is a gap', () => {
    const result = calculateFI(makeInput({ fiNonRetirement: 0, growthRate: 8, yearsToRetire: 10 }))

    expect(result).not.toBeNull()
    expect(result!.gap).toBeGreaterThan(0)
    expect(result!.monthlySaving).toBeGreaterThan(0)
  })

  it('returns monthlySaving = 0 when there is no gap', () => {
    const result = calculateFI(
      makeInput({
        annualExpense: 10000,
        inflationRate: 0,
        growthRate: 0,
        yearsToRetire: 0,
        retireYear: thisYear,
        lastYear: thisYear + 1,
        yearsInRetirement: 1,
        fiNonRetirement: 100000,
        primary401kYear: 9999,
        partner401kYear: 9999,
      }),
    )

    expect(result).not.toBeNull()
    expect(result!.gap).toBe(0)
    expect(result!.monthlySaving).toBe(0)
  })

  it('handles growth rate = 0% with a gap using monthly savings', () => {
    const result = calculateFI(
      makeInput({
        annualExpense: 50000,
        inflationRate: 0,
        growthRate: 0,
        yearsToRetire: 5,
        retireYear: thisYear + 5,
        lastYear: thisYear + 34,
        yearsInRetirement: 30,
        fiNonRetirement: 0,
        primary401kYear: 9999,
        partner401kYear: 9999,
      }),
    )

    expect(result).not.toBeNull()
    expect(result!.corpusNeededFromNonRetirement).toBeCloseTo(1500000, 0)
    expect(result!.monthlySaving).toBeCloseTo(25000, 0)
  })

  it('returns gap = 0 when current savings already cover the target', () => {
    const result = calculateFI(
      makeInput({
        annualExpense: 40000,
        inflationRate: 0,
        growthRate: 0,
        yearsToRetire: 0,
        retireYear: thisYear,
        lastYear: thisYear + 24,
        yearsInRetirement: 25,
        fiNonRetirement: 2000000,
        primary401kYear: 9999,
        partner401kYear: 9999,
      }),
    )

    expect(result).not.toBeNull()
    expect(result!.gap).toBe(0)
    expect(result!.monthlySaving).toBe(0)
  })

  it('generates a month-by-month projection with the expected length', () => {
    const result = calculateFI(
      makeInput({
        retireYear: thisYear + 10,
        lastYear: thisYear + 40,
        yearsInRetirement: 30,
      }),
    )

    expect(result).not.toBeNull()
    expect(result!.monthByMonth).toHaveLength(492)
    expect(result!.monthByMonth[0]).toMatchObject({
      month: `Jan ${thisYear}`,
      phase: 'saving',
      expense: 0,
    })
    expect(result!.monthByMonth.find(row => row.month === `Jan ${thisYear + 10}`)?.phase).toBe('drawdown')
  })

  it('ends the month-by-month projection near zero when properly funded', () => {
    const result = calculateFI(
      makeInput({
        annualExpense: 50000,
        inflationRate: 0,
        growthRate: 0,
        yearsToRetire: 0,
        retireYear: thisYear,
        lastYear: thisYear + 9,
        yearsInRetirement: 10,
        fiNonRetirement: 500000,
        primary401kYear: 9999,
        partner401kYear: 9999,
      }),
    )

    expect(result).not.toBeNull()
    expect(result!.monthByMonth.at(-1)?.netWorth).toBe(0)
  })

  it('adds 401(k) injections in January of the access year', () => {
    const primary401kYear = thisYear + 12
    const result = calculateFI(
      makeInput({
        fiRetirementPrimary: 100000,
        primary401kYear,
        primaryName: 'Primary',
        partner401kYear: 9999,
      }),
    )

    expect(result).not.toBeNull()
    expect(result!.primary401kAtAccess).toBeGreaterThan(100000)
    expect(result!.monthByMonth.find(row => row.month === `Jan ${primary401kYear}`)?.injection).toBe('Primary 401(k)')
  })
})

describe('FICalculator event dispatch', () => {
  let eventSpy: EventListener & ReturnType<typeof vi.fn>

  beforeEach(() => {
    eventSpy = vi.fn() as EventListener & ReturnType<typeof vi.fn>
  })

  it('fires tools-changed when dispatched', () => {
    window.addEventListener('tools-changed', eventSpy)

    window.dispatchEvent(new Event('tools-changed'))

    expect(eventSpy).toHaveBeenCalledTimes(1)

    window.removeEventListener('tools-changed', eventSpy)
  })
})
