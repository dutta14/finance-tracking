import { describe, it, expect } from 'vitest'
import { calculateFV, calculateGoalMetrics } from './goalCalculations'
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
