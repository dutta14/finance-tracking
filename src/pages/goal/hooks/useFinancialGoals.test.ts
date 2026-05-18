import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFinancialGoals } from './useFinancialGoals'
import { appStorage } from '../../../utils/appStorage'
import type { FinancialGoal } from '../../../types'

beforeEach(() => {
  localStorage.clear()
})

describe('useFinancialGoals hook', () => {
  it('returns empty array when nothing stored', () => {
    const { result } = renderHook(() => useFinancialGoals())
    expect(result.current.goals).toEqual([])
  })

  it('loads goals from storage on mount', () => {
    const goals: FinancialGoal[] = [
      {
        id: 1,
        goalName: 'Retire Early',
        goalCreatedIn: 2024,
        goalEndYear: 2040,
        currentAge: 35,
        monthlyInvestment: 5000,
        expectedReturn: 8,
        currentSavings: 100000,
      } as FinancialGoal,
    ]
    appStorage.setJSON('financialGoals', goals)
    const { result } = renderHook(() => useFinancialGoals())
    expect(result.current.goals).toHaveLength(1)
    expect(result.current.goals[0].goalName).toBe('Retire Early')
  })
})

describe('useFinancialGoals cross-tab sync', () => {
  let subscribeSpy: ReturnType<typeof vi.spyOn>
  let capturedCallback: ((value: string | null) => void) | undefined
  let unsub: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    capturedCallback = undefined
    unsub = vi.fn()
    subscribeSpy = vi.spyOn(appStorage, 'subscribe').mockImplementation((key, cb) => {
      if (key === 'financialGoals') capturedCallback = cb
      return unsub
    })
  })

  afterEach(() => {
    subscribeSpy.mockRestore()
  })

  it('subscribes to financialGoals on mount', () => {
    renderHook(() => useFinancialGoals())
    expect(subscribeSpy).toHaveBeenCalledWith('financialGoals', expect.any(Function))
  })

  it('reloads goals when subscriber callback fires', () => {
    const { result } = renderHook(() => useFinancialGoals())
    expect(result.current.goals).toEqual([])

    const updatedGoals: FinancialGoal[] = [
      {
        id: 2,
        goalName: 'College Fund',
        goalCreatedIn: 2025,
        goalEndYear: 2043,
        currentAge: 30,
        monthlyInvestment: 2000,
        expectedReturn: 7,
        currentSavings: 50000,
      } as FinancialGoal,
    ]
    appStorage.setJSON('financialGoals', updatedGoals)

    act(() => {
      capturedCallback!(null)
    })

    expect(result.current.goals).toHaveLength(1)
    expect(result.current.goals[0].goalName).toBe('College Fund')
  })

  it('fromSyncRef prevents save effect from re-writing after sync', () => {
    const setJSONSpy = vi.spyOn(appStorage, 'setJSON')
    // We need to also spy on getString to return data when callback fires
    const goals: FinancialGoal[] = [
      {
        id: 3,
        goalName: 'Vacation',
        goalCreatedIn: 2025,
        goalEndYear: 2026,
        currentAge: 35,
        monthlyInvestment: 1000,
        expectedReturn: 5,
        currentSavings: 5000,
      } as FinancialGoal,
    ]
    appStorage.setJSON('financialGoals', goals)

    const { result } = renderHook(() => useFinancialGoals())
    // Clear the spy calls from initial render/save
    setJSONSpy.mockClear()

    // Simulate cross-tab sync — the callback sets fromSyncRef = true
    const newGoals: FinancialGoal[] = [
      {
        id: 4,
        goalName: 'New Car',
        goalCreatedIn: 2025,
        goalEndYear: 2027,
        currentAge: 35,
        monthlyInvestment: 3000,
        expectedReturn: 6,
        currentSavings: 20000,
      } as FinancialGoal,
    ]
    appStorage.setJSON('financialGoals', newGoals)

    act(() => {
      capturedCallback!(null)
    })

    // The state was updated
    expect(result.current.goals[0].goalName).toBe('New Car')
    // But the save effect should NOT have re-written (fromSyncRef guard)
    // saveGoalsToStorage calls appStorage.setJSON('financialGoals', ...)
    // The only setJSON call should be our manual one above, not from the save effect
    const saveCalls = setJSONSpy.mock.calls.filter(c => c[0] === 'financialGoals')
    // Only the manual call from our test setup, none from the save effect
    expect(saveCalls).toHaveLength(1)

    setJSONSpy.mockRestore()
  })

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useFinancialGoals())
    expect(unsub).not.toHaveBeenCalled()
    unmount()
    expect(unsub).toHaveBeenCalled()
  })
})
