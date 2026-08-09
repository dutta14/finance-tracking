import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useGoalMetrics } from './useGoalMetrics'
import { useData } from '../../../contexts/DataContext'
import { getBudgetSaveRate } from '../../budget/utils/budgetStorage'
import {
  makeAccount,
  makeBalanceEntry,
  makeGoal as buildGoal,
  makeGwGoal as buildGwGoal,
} from '../../../test/factories'
import { getFiTarget } from '../utils/goalCalculations'
import { calcMonthlySaving, getGwTarget, getRetirementMonth, monthsBetween } from '../utils/goalMath'

vi.mock('../../../contexts/DataContext', () => ({
  useData: vi.fn(),
}))

vi.mock('../../budget/utils/budgetStorage', () => ({
  getBudgetSaveRate: vi.fn(),
}))

const mockedUseData = vi.mocked(useData)
const mockedGetBudgetSaveRate = vi.mocked(getBudgetSaveRate)

const profileBirthday = '1990-06-15'
const latestMonth = '2026-01'

function makeTestGoal(overrides = {}) {
  return buildGoal({
    id: 1,
    goalCreatedIn: '2024-01-01',
    goalEndYear: '2060-01-01',
    retirementAge: 45,
    expenseValue: 60000,
    monthlyExpenseRetirement: 10000,
    ...overrides,
  })
}

function makeFiAccount(id: number, status: 'active' | 'inactive' = 'active') {
  return makeAccount({ id, goalType: 'fi', status, type: 'retirement' })
}

function makeGwAccount(id: number, status: 'active' | 'inactive' = 'active') {
  return makeAccount({ id, goalType: 'gw', status, type: 'liquid' })
}

function makeBalance(accountId: number, balance: number, month = latestMonth) {
  return makeBalanceEntry({ id: accountId * 100, accountId, balance, month })
}

function setMockData({
  accounts = [],
  balances = [],
  allMonths = balances.length ? [...new Set(balances.map(balance => balance.month))].sort() : [],
}: {
  accounts?: ReturnType<typeof makeAccount>[]
  balances?: ReturnType<typeof makeBalanceEntry>[]
  allMonths?: string[]
} = {}) {
  mockedUseData.mockReturnValue({
    accounts,
    balances,
    allMonths,
    setAccounts: vi.fn(),
    setBalances: vi.fn(),
  })
}

describe('useGoalMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T00:00:00Z'))
    localStorage.clear()
    setMockData()
    mockedGetBudgetSaveRate.mockReturnValue(null)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns an empty map when goals is empty', () => {
    const { result } = renderHook(() => useGoalMetrics([], [], profileBirthday))

    expect(result.current).toBeInstanceOf(Map)
    expect(result.current.size).toBe(0)
  })

  it('computes fiTarget correctly for a goal with expenseValue', () => {
    const goal = makeTestGoal()
    const expectedFiTarget = getFiTarget(goal, profileBirthday, 8, 6, 60, 3)

    const { result } = renderHook(() => useGoalMetrics([goal], [], profileBirthday))
    const metrics = result.current.get(goal.id)

    expect(metrics).toBeDefined()
    expect(metrics?.fiTarget).toBeCloseTo(expectedFiTarget, 6)
    expect(metrics?.retirementYear).toBe(2035)
    expect(metrics?.retirementMonth).toBe(6)
  })

  it('returns fiProgress as the percentage of fiTotal over fiTarget', () => {
    const goal = makeTestGoal()
    const fiTarget = getFiTarget(goal, profileBirthday, 8, 6, 60, 3)

    setMockData({
      accounts: [makeFiAccount(1), makeFiAccount(2, 'inactive')],
      balances: [makeBalance(1, fiTarget * 0.25), makeBalance(2, fiTarget)],
    })

    const { result } = renderHook(() => useGoalMetrics([goal], [], profileBirthday))

    expect(result.current.get(goal.id)?.fiProgress).toBeCloseTo(25, 6)
  })

  it('returns no-goal state when fiTarget is 0', () => {
    const goal = makeTestGoal({ expenseValue: 0, monthlyExpenseRetirement: 0 })

    const { result } = renderHook(() => useGoalMetrics([goal], [], profileBirthday))
    const metrics = result.current.get(goal.id)

    expect(metrics?.fiTarget).toBe(0)
    expect(metrics?.projectedState).toBe('no-goal')
    expect(metrics?.projectedFIDate).toBeNull()
    expect(metrics?.projectedFILabel).toBeNull()
  })

  it('returns reached state when fiTotal is at least fiTarget', () => {
    const goal = makeTestGoal()
    const fiTarget = getFiTarget(goal, profileBirthday, 8, 6, 60, 3)

    setMockData({
      accounts: [makeFiAccount(1)],
      balances: [makeBalance(1, fiTarget + 1000)],
    })

    const { result } = renderHook(() => useGoalMetrics([goal], [], profileBirthday))
    const metrics = result.current.get(goal.id)

    expect(metrics?.fiProgress).toBe(100)
    expect(metrics?.projectedState).toBe('reached')
    expect(metrics?.projectedFILabel).toBe('🎉 Goal reached!')
  })

  it('returns no-budget state when budget save rate is unavailable', () => {
    const goal = makeTestGoal()
    const fiTarget = getFiTarget(goal, profileBirthday, 8, 6, 60, 3)

    setMockData({
      accounts: [makeFiAccount(1)],
      balances: [makeBalance(1, fiTarget * 0.1)],
    })
    mockedGetBudgetSaveRate.mockReturnValue(null)

    const { result } = renderHook(() => useGoalMetrics([goal], [], profileBirthday))
    const metrics = result.current.get(goal.id)

    expect(metrics?.projectedState).toBe('no-budget')
    expect(metrics?.projectedFILabel).toBe('Add budget data →')
  })

  it('returns not-reachable state when annual savings is zero or negative', () => {
    const goal = makeTestGoal()

    setMockData({
      accounts: [makeFiAccount(1)],
      balances: [makeBalance(1, 1000)],
    })
    mockedGetBudgetSaveRate.mockReturnValue({ annualSavings: 0, saveRate: 0, monthsOfData: 6 })

    const { result } = renderHook(() => useGoalMetrics([goal], [], profileBirthday))
    const metrics = result.current.get(goal.id)

    expect(metrics?.projectedState).toBe('not-reachable')
    expect(metrics?.projectedFILabel).toBe('Not reachable at current rate')
  })

  it('returns projected state with a valid date when budget data exists', () => {
    const goal = makeTestGoal({ expenseValue: 12000, goalEndYear: '2090-01-01', retirementAge: 60 })

    setMockData({
      accounts: [makeFiAccount(1)],
      balances: [makeBalance(1, 10000)],
    })
    mockedGetBudgetSaveRate.mockReturnValue({ annualSavings: 30000, saveRate: 25, monthsOfData: 12 })

    const { result } = renderHook(() => useGoalMetrics([goal], [], profileBirthday))
    const metrics = result.current.get(goal.id)

    expect(metrics?.projectedState).toBe('projected')
    expect(metrics?.projectedFIDate).toBeInstanceOf(Date)
    expect(metrics?.projectedFIDate?.getTime()).toBeGreaterThan(new Date('2026-01-15T00:00:00Z').getTime())
    expect(metrics?.projectedFILabel).toBe(
      metrics?.projectedFIDate?.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    )
  })

  it('computes gwTotal correctly for a goal with GW goals', () => {
    const goal = makeTestGoal()
    const gwGoals = [buildGwGoal({ fiGoalId: goal.id, disburseAge: 50, disburseAmount: 100000, growthRate: 6 })]
    const expectedGwTarget = getGwTarget(goal, gwGoals, profileBirthday, 3)

    setMockData({
      accounts: [makeGwAccount(2)],
      balances: [makeBalance(2, expectedGwTarget * 0.5)],
    })

    const { result } = renderHook(() => useGoalMetrics([goal], gwGoals, profileBirthday))
    const metrics = result.current.get(goal.id)

    expect(metrics?.gwTotal).toBeCloseTo(expectedGwTarget, 6)
    expect(metrics?.gwProgress).toBeCloseTo(50, 6)
  })

  it('returns gwMonthly as 0 when gwTarget is 0', () => {
    const goal = makeTestGoal()

    setMockData({
      accounts: [makeGwAccount(2)],
      balances: [makeBalance(2, 5000)],
    })

    const { result } = renderHook(() => useGoalMetrics([goal], [], profileBirthday))

    expect(result.current.get(goal.id)?.gwTotal).toBe(0)
    expect(result.current.get(goal.id)?.gwMonthly).toBe(0)
  })

  it('reads growth settings from localStorage', () => {
    const goal = makeTestGoal()
    const gwGoals = [buildGwGoal({ fiGoalId: goal.id, disburseAge: 50, disburseAmount: 90000, growthRate: 5 })]
    const settings = {
      preBoundaryGrowth: 10,
      postBoundaryGrowth: 4,
      ageBoundary: 55,
      gwGrowth: 9,
      inflation: 5,
    }

    localStorage.setItem('goal-growth-settings', JSON.stringify(settings))
    setMockData({
      accounts: [makeFiAccount(1), makeGwAccount(2)],
      balances: [makeBalance(1, 25000), makeBalance(2, 2000)],
    })

    const { result } = renderHook(() => useGoalMetrics([goal], gwGoals, profileBirthday))
    const metrics = result.current.get(goal.id)
    const expectedFiTarget = getFiTarget(goal, profileBirthday, 10, 4, 55, 5)
    const expectedGwTarget = getGwTarget(goal, gwGoals, profileBirthday, 5)
    const monthsToRetirement = monthsBetween(latestMonth, getRetirementMonth(profileBirthday, goal.retirementAge))
    const expectedGwMonthly = calcMonthlySaving(2000, expectedGwTarget, 9, monthsToRetirement)

    expect(metrics?.fiTarget).toBeCloseTo(expectedFiTarget, 6)
    expect(metrics?.gwTotal).toBeCloseTo(expectedGwTarget, 6)
    expect(metrics?.gwMonthly).toBeCloseTo(expectedGwMonthly, 6)
  })

  it('uses default growth settings when localStorage is empty', () => {
    const goal = makeTestGoal()
    const gwGoals = [buildGwGoal({ fiGoalId: goal.id, disburseAge: 50, disburseAmount: 90000, growthRate: 5 })]

    setMockData({
      accounts: [makeGwAccount(2)],
      balances: [makeBalance(2, 2000)],
    })

    const { result } = renderHook(() => useGoalMetrics([goal], gwGoals, profileBirthday))
    const metrics = result.current.get(goal.id)
    const expectedFiTarget = getFiTarget(goal, profileBirthday, 8, 6, 60, 3)
    const expectedGwTarget = getGwTarget(goal, gwGoals, profileBirthday, 3)
    const monthsToRetirement = monthsBetween(latestMonth, getRetirementMonth(profileBirthday, goal.retirementAge))
    const expectedGwMonthly = calcMonthlySaving(2000, expectedGwTarget, 8, monthsToRetirement)

    expect(metrics?.fiTarget).toBeCloseTo(expectedFiTarget, 6)
    expect(metrics?.gwTotal).toBeCloseTo(expectedGwTarget, 6)
    expect(metrics?.gwMonthly).toBeCloseTo(expectedGwMonthly, 6)
  })

  it('returns not-reachable when gwMonthly exceeds annual savings', () => {
    // Large GW goal that eats all savings
    const goal = makeTestGoal()
    const gwGoals = [
      buildGwGoal({ id: 1, fiGoalId: 1, disburseAge: 50, disburseAmount: 50_000_000, growthRate: 8 }),
    ]
    setMockData({
      accounts: [makeFiAccount(1), makeGwAccount(2)],
      balances: [makeBalance(1, 100_000), makeBalance(2, 1000, latestMonth)],
    })
    mockedGetBudgetSaveRate.mockReturnValue({ annualSavings: 10_000, saveRate: 10, monthsOfData: 12 })

    const { result } = renderHook(() => useGoalMetrics([goal], gwGoals, profileBirthday))
    const metrics = result.current.get(goal.id)
    expect(metrics?.projectedState).toBe('not-reachable')
  })

  it('uses expenseValue fallback when monthlyExpenseRetirement is 0', () => {
    const goal = makeTestGoal({ monthlyExpenseRetirement: 0, expenseValue: 48000 })
    setMockData({
      accounts: [makeFiAccount(1)],
      balances: [makeBalance(1, 100_000)],
    })
    mockedGetBudgetSaveRate.mockReturnValue({ annualSavings: 60_000, saveRate: 40, monthsOfData: 12 })

    const { result } = renderHook(() => useGoalMetrics([goal], [], profileBirthday))
    const metrics = result.current.get(goal.id)
    // Should still produce a projection (uses expenseValue/12 as monthly expense)
    expect(metrics?.projectedState).toBe('projected')
    expect(metrics?.projectedFIDate).not.toBeNull()
  })

  it('returns reached when fiTotal equals fiTarget after projection (months=0)', () => {
    // Set fiTotal very high so projection says already reached
    const goal = makeTestGoal({ expenseValue: 1000, monthlyExpenseRetirement: 100 })
    setMockData({
      accounts: [makeFiAccount(1)],
      balances: [makeBalance(1, 50_000_000)],
    })
    mockedGetBudgetSaveRate.mockReturnValue({ annualSavings: 60_000, saveRate: 40, monthsOfData: 12 })

    const { result } = renderHook(() => useGoalMetrics([goal], [], profileBirthday))
    const metrics = result.current.get(goal.id)
    // fiTotal > fiTarget so it hits the early 'reached' check
    expect(metrics?.projectedState).toBe('reached')
  })

  it('falls back to projectFIDate when goalEndYear is missing', () => {
    const goal = makeTestGoal({ goalEndYear: '', monthlyExpenseRetirement: 0, expenseValue: 60000 })
    setMockData({
      accounts: [makeFiAccount(1)],
      balances: [makeBalance(1, 100_000)],
    })
    mockedGetBudgetSaveRate.mockReturnValue({ annualSavings: 60_000, saveRate: 40, monthsOfData: 12 })

    const { result } = renderHook(() => useGoalMetrics([goal], [], profileBirthday))
    const metrics = result.current.get(goal.id)
    // Without goalEndYear, getFiTarget returns 0 → no-goal
    expect(metrics?.projectedState).toBe('no-goal')
  })
})
