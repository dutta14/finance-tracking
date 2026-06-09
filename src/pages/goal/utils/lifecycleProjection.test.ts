import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildLifecycle, buildProjectedLifecycle, buildPlannedProjection } from './lifecycleProjection'

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

describe('lifecycleProjection — projected and planned helpers', () => {
  const mockGoal = {
    id: 1,
    goalName: 'Test',
    createdAt: '2024-01-01',
    birthday: '1990-06-15',
    goalCreatedIn: '2024-01',
    goalEndYear: '2060-01-01',
    resetExpenseMonth: false,
    retirementAge: 45,
    expenseMonth: 5000,
    expenseValue: 60000,
    monthlyExpenseValue: 5000,
    expenseValueMar2026: 65000,
    expenseValue2047: 120000,
    monthlyExpense2047: 10000,
    safeWithdrawalRate: 3,
    growth: 7,
    retirement: 'Jun 2035',
    fiGoal: 3000000,
    progress: 25,
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 1))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('buildProjectedLifecycle uses inflationOverride instead of the goal inflation rate', () => {
    const withOverride = buildProjectedLifecycle(mockGoal, mockGoal.birthday, 6000000, 0, 6000, 6000, 8, 6, 60)
    const withoutOverride = buildProjectedLifecycle(
      mockGoal,
      mockGoal.birthday,
      6000000,
      0,
      6000,
      6000,
      8,
      6,
      60,
      undefined,
      2,
    )

    const overrideDrawdownRows = withoutOverride.filter(row => row.phase === 'drawdown')
    const defaultDrawdownRows = withOverride.filter(row => row.phase === 'drawdown')

    expect(overrideDrawdownRows.length).toBeGreaterThan(0)
    expect(defaultDrawdownRows.length).toBeGreaterThan(0)
    expect(overrideDrawdownRows[overrideDrawdownRows.length - 1].expense).toBeLessThan(
      defaultDrawdownRows[defaultDrawdownRows.length - 1].expense,
    )
  })

  it('buildPlannedProjection uses inflationOverride when computing the planned contribution and drawdown rows', () => {
    const lowInflationProjection = buildPlannedProjection(
      mockGoal,
      mockGoal.birthday,
      100000,
      6000,
      6000,
      undefined,
      8,
      6,
      60,
      undefined,
      2,
    )
    const highInflationProjection = buildPlannedProjection(
      mockGoal,
      mockGoal.birthday,
      100000,
      6000,
      6000,
      undefined,
      8,
      6,
      60,
      undefined,
      6,
    )

    expect(lowInflationProjection[0].contribNonRet!).toBeLessThan(highInflationProjection[0].contribNonRet!)

    const lowInflationDrawdownRows = lowInflationProjection.filter(row => row.phase === 'drawdown')
    const highInflationDrawdownRows = highInflationProjection.filter(row => row.phase === 'drawdown')

    expect(lowInflationDrawdownRows[lowInflationDrawdownRows.length - 1].expense).toBeLessThan(
      highInflationDrawdownRows[highInflationDrawdownRows.length - 1].expense,
    )
  })

  it('keeps retirement buckets locked until their exact access month and unlocks them on that month', () => {
    const result = buildProjectedLifecycle(
      mockGoal,
      mockGoal.birthday,
      6000000,
      0,
      6000,
      6000,
      8,
      6,
      60,
      {
        retirementPrimary: 2500000,
        retirementPartner: 1500000,
        nonRetirement: 2000000,
        primaryAccessDate: new Date(2050, 5, 1),
      },
      2,
    )

    const may2050Row = result.find(row => row.month === 'May 2050')
    const june2050Row = result.find(row => row.month === 'Jun 2050')

    expect(may2050Row?.primaryLocked).toBe(true)
    expect(june2050Row?.primaryLocked).toBe(false)
  })

  it('tracks primary and partner lock states independently when their access dates differ', () => {
    const result = buildProjectedLifecycle(
      mockGoal,
      mockGoal.birthday,
      6000000,
      0,
      6000,
      6000,
      8,
      6,
      60,
      {
        retirementPrimary: 2500000,
        retirementPartner: 1500000,
        nonRetirement: 2000000,
        primaryAccessDate: new Date(2049, 5, 1),
        partnerAccessDate: new Date(2052, 5, 1),
      },
      2,
    )

    const primaryUnlockIndex = result.findIndex(
      (row, index) => index > 0 && result[index - 1].primaryLocked && !row.primaryLocked,
    )
    const partnerUnlockIndex = result.findIndex(
      (row, index) => index > 0 && result[index - 1].partnerLocked && !row.partnerLocked,
    )

    expect(primaryUnlockIndex).toBeGreaterThan(-1)
    expect(partnerUnlockIndex).toBeGreaterThan(primaryUnlockIndex)
    expect(result[primaryUnlockIndex].primaryLocked).toBe(false)
    expect(result[primaryUnlockIndex].partnerLocked).toBe(true)
    expect(result[partnerUnlockIndex].partnerLocked).toBe(false)
  })
})
