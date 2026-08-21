import { describe, it, expect } from 'vitest'
import {
  loadGoalsFile,
  saveGoalsFile,
  saveGoalsPart,
  migrateGoals,
  migrateGwFields,
  GOALS_PATH,
} from './localStorageService'
import { MemoryFileStore } from '../../../utils/memoryFileStore'
import type { FinancialGoal, GwGoal } from '../../../types'

const mockGoal: FinancialGoal = {
  id: 1,
  goalName: 'Retire Early',
  createdAt: '2025-01-01',
  birthday: '1990-01-01',
  goalCreatedIn: '2025-01',
  goalEndYear: '2050',
  resetExpenseMonth: false,
  retirementAge: 55,
  expenseMonth: 3,
  expenseValue: 50000,
  monthlyExpenseValue: 4167,
  expenseValueMar2026: 52000,
  expenseValue2047: 80000,
  monthlyExpenseRetirement: 6667,
  safeWithdrawalRate: 4,
  growth: 7,
  retirement: '2045-01',
  fiGoal: 2000000,
  progress: 25,
}

describe('loadGoalsFile', () => {
  it('returns empty arrays when nothing stored', async () => {
    const store = new MemoryFileStore()
    const result = await loadGoalsFile(store)
    expect(result.financialGoals).toEqual([])
    expect(result.gwGoals).toEqual([])
  })

  it('loads goals from goals.json', async () => {
    const store = new MemoryFileStore()
    await store.writeJSON(GOALS_PATH, { financialGoals: [mockGoal], gwGoals: [] })
    const result = await loadGoalsFile(store)
    expect(result.financialGoals).toHaveLength(1)
    expect(result.financialGoals[0].goalName).toBe('Retire Early')
  })

  it('returns empty arrays when stored value has non-array financialGoals', async () => {
    const store = new MemoryFileStore()
    await store.writeJSON(GOALS_PATH, { financialGoals: null, gwGoals: null })
    const result = await loadGoalsFile(store)
    expect(result.financialGoals).toEqual([])
    expect(result.gwGoals).toEqual([])
  })

  it('returns empty arrays when stored value is empty object', async () => {
    const store = new MemoryFileStore()
    await store.writeJSON(GOALS_PATH, {})
    const result = await loadGoalsFile(store)
    expect(result.financialGoals).toEqual([])
    expect(result.gwGoals).toEqual([])
  })
})

describe('saveGoalsFile', () => {
  it('persists goals to goals.json', async () => {
    const store = new MemoryFileStore()
    await saveGoalsFile(store, [mockGoal], [])
    const raw = await store.readJSON<{ financialGoals: FinancialGoal[] }>(GOALS_PATH, { financialGoals: [] })
    expect(raw.financialGoals).toHaveLength(1)
    expect(raw.financialGoals[0].goalName).toBe('Retire Early')
  })

  it('handles empty arrays', async () => {
    const store = new MemoryFileStore()
    await saveGoalsFile(store, [], [])
    const raw = await store.readJSON<{ financialGoals: FinancialGoal[]; gwGoals: GwGoal[] }>(GOALS_PATH, {
      financialGoals: [],
      gwGoals: [],
    })
    expect(raw.financialGoals).toEqual([])
    expect(raw.gwGoals).toEqual([])
  })
})

describe('saveGoalsPart', () => {
  it('merges partial update into goals.json without dropping the other half', async () => {
    const gwGoal: GwGoal = {
      id: 1,
      fiGoalId: 1,
      label: 'House',
      createdAt: '2025-01-01',
      disburseAge: 40,
      disburseAmount: 50000,
      growthRate: 7,
      currentSavings: 0,
    }
    const store = new MemoryFileStore()
    await store.writeJSON(GOALS_PATH, { financialGoals: [mockGoal], gwGoals: [gwGoal] })

    await saveGoalsPart(store, { financialGoals: [] })
    const result = await loadGoalsFile(store)
    expect(result.financialGoals).toEqual([])
    expect(result.gwGoals).toHaveLength(1)
    expect(result.gwGoals[0].label).toBe('House')
  })
})

describe('migrateGoals', () => {
  it('migrates legacy planName → goalName fields', () => {
    const legacyEntry = { ...mockGoal, planName: 'OldPlan', planCreatedIn: '2024-01', planEndYear: '2049' } as Record<
      string,
      unknown
    >
    delete legacyEntry.goalName
    delete legacyEntry.goalCreatedIn
    delete legacyEntry.goalEndYear
    const result = migrateGoals([legacyEntry] as unknown as FinancialGoal[])
    expect(result[0].goalName).toBe('OldPlan')
    expect(result[0].goalCreatedIn).toBe('2024-01')
    expect(result[0].goalEndYear).toBe('2049')
    expect((result[0] as unknown as Record<string, unknown>).planName).toBeUndefined()
  })

  it('calculates fiGoal when zero but has expense and SWR data', () => {
    const goalWithZeroFi = { ...mockGoal, fiGoal: 0, expenseValue2047: 80000, safeWithdrawalRate: 4 }
    const result = migrateGoals([goalWithZeroFi])
    // 80000 / 0.04 = 2000000
    expect(result[0].fiGoal).toBe(2000000)
  })

  it('does not recalculate fiGoal when it is already set', () => {
    const result = migrateGoals([mockGoal])
    expect(result[0].fiGoal).toBe(2000000)
  })

  it('handles zero SWR gracefully (no division by zero recalc)', () => {
    const goal = { ...mockGoal, fiGoal: 0, expenseValue2047: 80000, safeWithdrawalRate: 0 }
    const result = migrateGoals([goal])
    expect(result[0].fiGoal).toBe(0)
  })

  it('handles zero expense (no recalc)', () => {
    const goal = { ...mockGoal, fiGoal: 0, expenseValue2047: 0, safeWithdrawalRate: 4 }
    const result = migrateGoals([goal])
    expect(result[0].fiGoal).toBe(0)
  })

  it('returns empty array for empty input', () => {
    expect(migrateGoals([])).toEqual([])
  })
})

describe('migrateGwFields', () => {
  it('renames fiPlanId to fiGoalId', () => {
    const input = [{ id: 1, fiPlanId: 42, label: 'Test' }]
    const result = migrateGwFields(input)
    expect(result[0].fiGoalId).toBe(42)
    expect((result[0] as unknown as Record<string, unknown>).fiPlanId).toBeUndefined()
  })

  it('leaves fiGoalId untouched if already present', () => {
    const input = [{ id: 1, fiGoalId: 42, label: 'Test' }]
    const result = migrateGwFields(input)
    expect(result[0].fiGoalId).toBe(42)
  })

  it('handles empty array', () => {
    expect(migrateGwFields([])).toEqual([])
  })
})
