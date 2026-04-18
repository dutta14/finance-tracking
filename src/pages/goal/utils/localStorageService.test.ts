import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadGoalsFromStorage, saveGoalsToStorage, migrateGoals } from './localStorageService'
import type { FinancialGoal } from '../../../types'

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
  monthlyExpense2047: 6667,
  inflationRate: 3,
  safeWithdrawalRate: 4,
  growth: 7,
  retirement: '2045-01',
  fiGoal: 2000000,
  progress: 25,
}

beforeEach(() => {
  localStorage.clear()
})

describe('loadGoalsFromStorage', () => {
  it('returns empty array when nothing is stored', () => {
    expect(loadGoalsFromStorage()).toEqual([])
  })

  it('loads goals from financialGoals key', () => {
    localStorage.setItem('financialGoals', JSON.stringify([mockGoal]))
    const result = loadGoalsFromStorage()
    expect(result).toHaveLength(1)
    expect(result[0].goalName).toBe('Retire Early')
  })

  it('migrates legacy planName → goalName fields', () => {
    const legacy = [{ ...mockGoal, planName: 'OldPlan', planCreatedIn: '2024-01', planEndYear: '2049' }]
    // Remove new-style fields
    delete (legacy[0] as any).goalName
    delete (legacy[0] as any).goalCreatedIn
    delete (legacy[0] as any).goalEndYear
    localStorage.setItem('financialGoals', JSON.stringify(legacy))
    const result = loadGoalsFromStorage()
    expect(result[0].goalName).toBe('OldPlan')
    expect(result[0].goalCreatedIn).toBe('2024-01')
    expect(result[0].goalEndYear).toBe('2049')
    expect((result[0] as any).planName).toBeUndefined()
  })

  it('migrates from legacy financialPlans key', () => {
    localStorage.setItem('financialPlans', JSON.stringify([mockGoal]))
    const result = loadGoalsFromStorage()
    expect(result).toHaveLength(1)
    expect(result[0].goalName).toBe('Retire Early')
    // Should have moved data to new key and removed old
    expect(localStorage.getItem('financialGoals')).toBeTruthy()
    expect(localStorage.getItem('financialPlans')).toBeNull()
  })

  it('returns empty array on corrupt JSON', () => {
    localStorage.setItem('financialGoals', '{broken')
    expect(loadGoalsFromStorage()).toEqual([])
  })

  it('returns empty array when stored value is empty array', () => {
    localStorage.setItem('financialGoals', '[]')
    expect(loadGoalsFromStorage()).toEqual([])
  })
})

describe('saveGoalsToStorage', () => {
  it('persists goals to localStorage', () => {
    saveGoalsToStorage([mockGoal])
    const raw = localStorage.getItem('financialGoals')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].goalName).toBe('Retire Early')
  })

  it('handles empty array', () => {
    saveGoalsToStorage([])
    expect(JSON.parse(localStorage.getItem('financialGoals')!)).toEqual([])
  })
})

describe('migrateGoals', () => {
  it('migrates legacy field names', () => {
    const legacy = [{ ...mockGoal, planName: 'Legacy' }] as any[]
    delete legacy[0].goalName
    const result = migrateGoals(legacy)
    expect(result[0].goalName).toBe('Legacy')
  })

  it('calculates fiGoal when zero but has expense and SWR data', () => {
    const goalWithZeroFi = {
      ...mockGoal,
      fiGoal: 0,
      expenseValue2047: 80000,
      safeWithdrawalRate: 4,
    }
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
    // SWR is 0, so condition `safeWithdrawalRate > 0` is false => fiGoal stays 0
    expect(result[0].fiGoal).toBe(0)
  })

  it('handles zero expense (no recalc)', () => {
    const goal = { ...mockGoal, fiGoal: 0, expenseValue2047: 0, safeWithdrawalRate: 4 }
    const result = migrateGoals([goal])
    // expense is 0, condition `expenseValue2047 > 0` is false
    expect(result[0].fiGoal).toBe(0)
  })

  it('returns empty array for empty input', () => {
    expect(migrateGoals([])).toEqual([])
  })
})
