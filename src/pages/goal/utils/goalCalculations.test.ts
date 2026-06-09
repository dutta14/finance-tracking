import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import {
  calculateFV,
  calculateGoalMetrics,
  computeRequiredCorpus,
  getFiTarget,
  projectFIDate,
  projectFIDateWithDrawdown,
  DEFAULT_PRE_FI_GROWTH_RATE,
} from './goalCalculations'
import { parseDate, getMonthsBetween } from './dateHelpers'

describe('calculateFV', () => {
  it('returns presentValue when months is 0', () => {
    expect(calculateFV(0.005, 0, 1000)).toBe(1000)
  })

  it('returns presentValue when rate is 0', () => {
    expect(calculateFV(0, 120, 1000)).toBe(1000)
  })

  it('compounds correctly over 12 months at 1%/month', () => {
    const result = calculateFV(0.01, 12, 1000)
    expect(result).toBeCloseTo(1126.83, 1)
  })

  it('handles large month counts', () => {
    const result = calculateFV(0.005, 360, 1000)
    expect(result).toBeGreaterThan(1000)
    expect(result).toBeCloseTo(6022.58, 0)
  })
})

describe('calculateGoalMetrics', () => {
  const baseParams = {
    annualExpense: 60000,
    birthday: '1990-06-15',
    retirementAge: 65,
    goalCreatedIn: '2025-01',
    inflationRate: 3,
    growthRate: 8,
    goalEndYear: '2080-01',
  }

  it('calculates monthly expense from annual', () => {
    const result = calculateGoalMetrics(
      baseParams.annualExpense,
      baseParams.birthday,
      baseParams.retirementAge,
      baseParams.goalCreatedIn,
      baseParams.inflationRate,
      baseParams.growthRate,
      baseParams.goalEndYear,
      getMonthsBetween,
      parseDate,
    )
    expect(result.monthlyExpenseAtCreation).toBe(5000)
  })

  it('calculates retirement date from birthday + age', () => {
    const result = calculateGoalMetrics(
      baseParams.annualExpense,
      baseParams.birthday,
      baseParams.retirementAge,
      baseParams.goalCreatedIn,
      baseParams.inflationRate,
      baseParams.growthRate,
      baseParams.goalEndYear,
      getMonthsBetween,
      parseDate,
    )
    expect(result.retirementDate.getFullYear()).toBe(2055)
    expect(result.retirementDate.getMonth()).toBe(5) // June
  })

  it('applies inflation to future expenses', () => {
    const result = calculateGoalMetrics(
      baseParams.annualExpense,
      baseParams.birthday,
      baseParams.retirementAge,
      baseParams.goalCreatedIn,
      baseParams.inflationRate,
      baseParams.growthRate,
      baseParams.goalEndYear,
      getMonthsBetween,
      parseDate,
    )
    // 30 years of 3% inflation on $60k, compounded annually: 60000 * 1.03^30 ≈ $145,636
    expect(result.annualExpenseAtRetirement).toBeCloseTo(145636, -2)
  })

  it('calculates FI goal using corpus model', () => {
    const result = calculateGoalMetrics(
      baseParams.annualExpense,
      baseParams.birthday,
      baseParams.retirementAge,
      baseParams.goalCreatedIn,
      baseParams.inflationRate,
      baseParams.growthRate,
      baseParams.goalEndYear,
      getMonthsBetween,
      parseDate,
    )
    // FI goal is computed via computeRequiredCorpus (not SWR)
    expect(result.fiGoal).toBeGreaterThan(0)
  })

  it('calculates FI goal when growth rate is 0', () => {
    const result = calculateGoalMetrics(
      baseParams.annualExpense,
      baseParams.birthday,
      baseParams.retirementAge,
      baseParams.goalCreatedIn,
      baseParams.inflationRate,
      0,
      baseParams.goalEndYear,
      getMonthsBetween,
      parseDate,
    )
    // With 0% growth, need larger corpus to fund retirement expenses
    expect(result.fiGoal).toBeGreaterThan(0)
  })

  it('handles 0 inflation rate', () => {
    const result = calculateGoalMetrics(
      baseParams.annualExpense,
      baseParams.birthday,
      baseParams.retirementAge,
      baseParams.goalCreatedIn,
      0,
      baseParams.growthRate,
      baseParams.goalEndYear,
      getMonthsBetween,
      parseDate,
    )
    expect(result.monthlyExpenseAtRetirement).toBeCloseTo(5000, 1)
    expect(result.annualExpenseAtRetirement).toBeCloseTo(60000, 0)
  })

  it('falls back to a 90-year end-of-life when goalEndYear is missing', () => {
    const result = calculateGoalMetrics(
      baseParams.annualExpense,
      baseParams.birthday,
      baseParams.retirementAge,
      baseParams.goalCreatedIn,
      baseParams.inflationRate,
      baseParams.growthRate,
      '',
      getMonthsBetween,
      parseDate,
    )

    expect(result.fiGoal).toBeGreaterThan(0)
  })
})

describe('DEFAULT_PRE_FI_GROWTH_RATE', () => {
  it('is 8 percent', () => {
    expect(DEFAULT_PRE_FI_GROWTH_RATE).toBe(8)
  })
})

describe('computeRequiredCorpus', () => {
  it('returns 0 when the end of life is not after the FI date', () => {
    expect(computeRequiredCorpus(new Date(2050, 0, 1), new Date(2050, 0, 1), new Date(2060, 0, 1), 5000, 3, 8, 6)).toBe(
      0,
    )
  })
})

describe('getFiTarget', () => {
  it('falls back to the default inflation rate when the goal inflation rate is 0', () => {
    const zeroInflationTarget = getFiTarget(
      {
        fiGoal: 1_000_000,
        birthday: '1990-01-15',
        goalEndYear: '2080-01',
        retirementAge: 60,
        monthlyExpense2047: 5000,
        inflationRate: 0,
      },
      '1990-01-15',
      8,
    )
    const defaultInflationTarget = getFiTarget(
      {
        fiGoal: 1_000_000,
        birthday: '1990-01-15',
        goalEndYear: '2080-01',
        retirementAge: 60,
        monthlyExpense2047: 5000,
        inflationRate: 3,
      },
      '1990-01-15',
      8,
    )

    expect(zeroInflationTarget).toBe(defaultInflationTarget)
  })
})

describe('projectFIDate', () => {
  it('returns projected date and months when savings can reach fiGoal', () => {
    const result = projectFIDate(100_000, 500_000, 50_000, 8)
    expect(result).not.toBeNull()
    expect(result!.months).toBe(67)
  })

  it('returns months: 0 and current date when net worth already exceeds fiGoal', () => {
    const result = projectFIDate(1_000_000, 500_000, 50_000, 8)
    expect(result).not.toBeNull()
    expect(result!.months).toBe(0)
  })

  it('returns months: 0 when net worth exactly equals fiGoal', () => {
    const result = projectFIDate(500_000, 500_000, 50_000, 8)
    expect(result).not.toBeNull()
    expect(result!.months).toBe(0)
  })

  it('returns null when fiGoal is 0', () => {
    expect(projectFIDate(100_000, 0, 50_000, 8)).toBeNull()
  })

  it('returns null when fiGoal is negative', () => {
    expect(projectFIDate(100_000, -100, 50_000, 8)).toBeNull()
  })

  it('returns null when annualSavings is 0 and net worth is below fiGoal', () => {
    expect(projectFIDate(100_000, 500_000, 0, 8)).toBeNull()
  })

  it('returns null when annualSavings is negative and net worth is below fiGoal', () => {
    expect(projectFIDate(100_000, 500_000, -10_000, 8)).toBeNull()
  })

  it('handles 0% growth rate with linear accumulation', () => {
    // $100k saved per year → $8333.33/month. After 60 months: $499999.99 (fp), so 61 months needed
    const result = projectFIDate(0, 500_000, 100_000, 0)
    expect(result).not.toBeNull()
    expect(result!.months).toBe(61)
  })

  it('projects a date in the future relative to now', () => {
    const result = projectFIDate(100_000, 1_000_000, 60_000, 8)
    expect(result).not.toBeNull()
    expect(result!.date.getTime()).toBeGreaterThan(Date.now())
  })

  it('returns null when goal is unreachable within 100 years', () => {
    // Tiny savings, enormous goal, no growth
    const result = projectFIDate(0, 1e15, 100, 0)
    expect(result).toBeNull()
  })

  it('reaches the 1200-month cap and returns null for extreme goals', () => {
    // $0 current, $200k goal, $1200/yr savings, 0% growth
    // At $100/month that takes 2000 months (>1200 cap) → null
    const result = projectFIDate(0, 200_000, 1_200, 0)
    expect(result).toBeNull()
  })

  it('compounding reduces months needed compared to linear savings', () => {
    const withGrowth = projectFIDate(0, 1_000_000, 50_000, 8)
    const noGrowth = projectFIDate(0, 1_000_000, 50_000, 0)
    expect(withGrowth).not.toBeNull()
    expect(noGrowth).not.toBeNull()
    expect(withGrowth!.months).toBeLessThan(noGrowth!.months)
  })

  it('higher growth rate reaches goal faster', () => {
    const low = projectFIDate(100_000, 1_000_000, 50_000, 4)
    const high = projectFIDate(100_000, 1_000_000, 50_000, 10)
    expect(low).not.toBeNull()
    expect(high).not.toBeNull()
    expect(high!.months).toBeLessThan(low!.months)
  })

  it('projected date month is offset correctly from today', () => {
    // Use values that produce exact integer months: $120k/yr at 0% growth, $0 start, $120k goal → 12 months
    const result = projectFIDate(0, 120_000, 120_000, 0)
    expect(result).not.toBeNull()
    const now = new Date()
    const expectedYear = now.getFullYear() + Math.floor((now.getMonth() + result!.months) / 12)
    const expectedMonth = (now.getMonth() + result!.months) % 12
    expect(result!.date.getFullYear()).toBe(expectedYear)
    expect(result!.date.getMonth()).toBe(expectedMonth)
  })
})

describe('calculateGoalMetrics — negative inflation (deflation)', () => {
  it('reduces future expenses when inflation is negative', () => {
    const result = calculateGoalMetrics(
      60000,
      '1990-06-15',
      65,
      '2025-01',
      -2,
      8,
      '2080-01',
      getMonthsBetween,
      parseDate,
    )
    expect(result.annualExpenseAtRetirement).toBeLessThan(60000)
    expect(result.fiGoal).toBeLessThan(60000 / 0.04)
  })
})

describe('projectFIDateWithDrawdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 1))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null when annualSavings <= 0 and currentNetWorth <= 0', () => {
    expect(projectFIDateWithDrawdown(0, 0, 8, 6, 4000, 3, new Date(2080, 11, 1))).toBeNull()
  })

  it('returns a result when the balance grows to meet the required corpus', () => {
    const result = projectFIDateWithDrawdown(300_000, 120_000, 8, 6, 1500, 2, new Date(2065, 11, 1))

    expect(result).not.toBeNull()
    expect(result!.months).toBeGreaterThan(0)
    expect(result!.requiredCorpus).toBeGreaterThan(0)
    expect(result!.date.getTime()).toBeGreaterThan(new Date(2026, 5, 1).getTime())
  })

  it('handles the age boundary by switching to the post-boundary growth rate', () => {
    const noBoundary = projectFIDateWithDrawdown(200_000, 60_000, 12, 2, 1000, 2, new Date(2060, 11, 1))
    const withBoundary = projectFIDateWithDrawdown(
      200_000,
      60_000,
      12,
      2,
      1000,
      2,
      new Date(2060, 11, 1),
      new Date(2026, 7, 1),
    )

    expect(noBoundary).not.toBeNull()
    expect(withBoundary).not.toBeNull()
    expect(withBoundary!.months).toBeGreaterThanOrEqual(noBoundary!.months)
  })

  it('returns null when FI is unreachable within 1200 months', { timeout: 15_000 }, () => {
    const result = projectFIDateWithDrawdown(0, 12, 0, 0, 100_000, 3, new Date(2200, 11, 1))

    expect(result).toBeNull()
  })

  it('returns a zero-corpus result once the candidate date reaches end of life', () => {
    const result = projectFIDateWithDrawdown(1000, 12, 0, 0, 100_000, 3, new Date(2026, 6, 1))

    expect(result).not.toBeNull()
    expect(result!.requiredCorpus).toBe(0)
  })
})
