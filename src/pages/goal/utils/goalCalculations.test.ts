import { describe, it, expect } from 'vitest'
import { calculateFV, calculateGoalMetrics, projectFIDate, DEFAULT_PRE_FI_GROWTH_RATE } from './goalCalculations'
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
    safeWithdrawalRate: 4,
  }

  it('calculates monthly expense from annual', () => {
    const result = calculateGoalMetrics(
      baseParams.annualExpense,
      baseParams.birthday,
      baseParams.retirementAge,
      baseParams.goalCreatedIn,
      baseParams.inflationRate,
      baseParams.safeWithdrawalRate,
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
      baseParams.safeWithdrawalRate,
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
      baseParams.safeWithdrawalRate,
      getMonthsBetween,
      parseDate,
    )
    // After ~30 years of 3% inflation, expenses should roughly double
    expect(result.annualExpenseAtRetirement).toBeGreaterThan(baseParams.annualExpense)
    expect(result.monthlyExpenseAtRetirement).toBeGreaterThan(baseParams.annualExpense / 12)
  })

  it('calculates FI goal using safe withdrawal rate', () => {
    const result = calculateGoalMetrics(
      baseParams.annualExpense,
      baseParams.birthday,
      baseParams.retirementAge,
      baseParams.goalCreatedIn,
      baseParams.inflationRate,
      baseParams.safeWithdrawalRate,
      getMonthsBetween,
      parseDate,
    )
    // FI goal = annualExpenseAtRetirement / 0.04
    expect(result.fiGoal).toBe(result.annualExpenseAtRetirement / 0.04)
  })

  it('returns 0 FI goal when withdrawal rate is 0', () => {
    const result = calculateGoalMetrics(
      baseParams.annualExpense,
      baseParams.birthday,
      baseParams.retirementAge,
      baseParams.goalCreatedIn,
      baseParams.inflationRate,
      0,
      getMonthsBetween,
      parseDate,
    )
    expect(result.fiGoal).toBe(0)
  })

  it('handles 0 inflation rate', () => {
    const result = calculateGoalMetrics(
      baseParams.annualExpense,
      baseParams.birthday,
      baseParams.retirementAge,
      baseParams.goalCreatedIn,
      0,
      baseParams.safeWithdrawalRate,
      getMonthsBetween,
      parseDate,
    )
    // No inflation means expenses stay the same
    expect(result.monthlyExpenseAtRetirement).toBeCloseTo(5000, 1)
    expect(result.annualExpenseAtRetirement).toBeCloseTo(60000, 0)
  })
})

describe('DEFAULT_PRE_FI_GROWTH_RATE', () => {
  it('is 8 percent', () => {
    expect(DEFAULT_PRE_FI_GROWTH_RATE).toBe(8)
  })
})

describe('projectFIDate', () => {
  it('returns projected date and months when savings can reach fiGoal', () => {
    const result = projectFIDate(100_000, 500_000, 50_000, 8)
    expect(result).not.toBeNull()
    expect(result!.months).toBeGreaterThan(0)
    expect(result!.date).toBeInstanceOf(Date)
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
    // Need 1 trillion, saving $1/year at 0% growth → 1 trillion years
    const result = projectFIDate(0, 1_000_000_000_000, 1, 0)
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
