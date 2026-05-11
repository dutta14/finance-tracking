import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useGwGoals } from './useGwGoals'
import { appStorage } from '../../../utils/appStorage'
import type { GwGoal } from '../../../types'

beforeEach(() => {
  localStorage.clear()
})

describe('useGwGoals hook', () => {
  it('loads goals from gw-goals key', () => {
    const goals: GwGoal[] = [
      {
        id: 1,
        fiGoalId: 100,
        label: 'House',
        createdAt: '2025-01-01',
        disburseAge: 40,
        disburseAmount: 50000,
        growthRate: 7,
        currentSavings: 10000,
      },
    ]
    appStorage.setJSON('gw-goals', goals)
    const { result } = renderHook(() => useGwGoals())
    expect(result.current.gwGoals).toHaveLength(1)
    expect(result.current.gwGoals[0].label).toBe('House')
  })

  it('migrates legacy gw-plans key with fiPlanId → fiGoalId', () => {
    const legacy = [
      {
        id: 1,
        fiPlanId: 100,
        label: 'Car',
        createdAt: '2025-01-01',
        disburseAge: 35,
        disburseAmount: 30000,
        growthRate: 5,
        currentSavings: 5000,
      },
    ]
    localStorage.setItem('gw-plans', JSON.stringify(legacy))
    const { result } = renderHook(() => useGwGoals())
    expect(result.current.gwGoals).toHaveLength(1)
    expect(result.current.gwGoals[0].fiGoalId).toBe(100)
    expect((result.current.gwGoals[0] as unknown as Record<string, unknown>).fiPlanId).toBeUndefined()
    // Legacy key should be removed after migration
    expect(localStorage.getItem('gw-plans')).toBeNull()
  })

  it('returns empty array when nothing stored', () => {
    const { result } = renderHook(() => useGwGoals())
    expect(result.current.gwGoals).toEqual([])
  })
})

describe('GwGoal field migration logic', () => {
  // Test the migration pattern directly since it's the same as in localStorageService
  const migrateGwFields = (items: Record<string, unknown>[]): GwGoal[] =>
    items.map(item => {
      const migrated = { ...item }
      if ('fiPlanId' in migrated) {
        migrated.fiGoalId = migrated.fiPlanId
        delete migrated.fiPlanId
      }
      return migrated as unknown as GwGoal
    })

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
