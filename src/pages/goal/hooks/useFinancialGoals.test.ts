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
      } as unknown as FinancialGoal,
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
  let unsub: ReturnType<typeof vi.fn<() => void>>

  beforeEach(() => {
    localStorage.clear()
    capturedCallback = undefined
    unsub = vi.fn(() => undefined)
    subscribeSpy = vi.spyOn(appStorage, 'subscribe').mockImplementation((key, cb) => {
      if (key === 'financialGoals') capturedCallback = cb
      return () => unsub()
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
      } as unknown as FinancialGoal,
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
      } as unknown as FinancialGoal,
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
      } as unknown as FinancialGoal,
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

describe('useFinancialGoals initialization error handling', () => {
  it('returns empty array when loadGoalsFromStorage throws (lines 11-13)', () => {
    // Store corrupt data that will cause loadGoalsFromStorage/migrateGoals to fail
    localStorage.setItem('financialGoals', '{not valid json array!!!}')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() => useFinancialGoals())
    expect(result.current.goals).toEqual([])
    errorSpy.mockRestore()
  })
})

describe('useFinancialGoals CRUD operations', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('createGoal prepends a new goal to the list', () => {
    const { result } = renderHook(() => useFinancialGoals())
    const newGoal = {
      id: 10,
      goalName: 'Retire',
      goalCreatedIn: 2025,
      goalEndYear: 2045,
      currentAge: 30,
      monthlyInvestment: 3000,
      expectedReturn: 7,
      currentSavings: 50000,
    } as unknown as FinancialGoal
    act(() => {
      result.current.createGoal(newGoal)
    })
    expect(result.current.goals).toHaveLength(1)
    expect(result.current.goals[0].goalName).toBe('Retire')
  })

  it('updateGoal replaces the matching goal by id', () => {
    const existing = {
      id: 1,
      goalName: 'Original',
      goalCreatedIn: 2024,
      goalEndYear: 2040,
      currentAge: 35,
      monthlyInvestment: 1000,
      expectedReturn: 6,
      currentSavings: 10000,
    } as unknown as FinancialGoal
    appStorage.setJSON('financialGoals', [existing])
    const { result } = renderHook(() => useFinancialGoals())
    const updated = { ...existing, goalName: 'Updated' } as unknown as FinancialGoal
    act(() => {
      result.current.updateGoal(1, updated)
    })
    expect(result.current.goals[0].goalName).toBe('Updated')
  })

  it('deleteGoal removes the goal with the given id', () => {
    const goals = [
      { id: 1, goalName: 'A' },
      { id: 2, goalName: 'B' },
    ] as unknown as FinancialGoal[]
    appStorage.setJSON('financialGoals', goals)
    const { result } = renderHook(() => useFinancialGoals())
    act(() => {
      result.current.deleteGoal(1)
    })
    expect(result.current.goals).toHaveLength(1)
    expect(result.current.goals[0].goalName).toBe('B')
  })

  it('importGoals replaces all goals with incoming array', () => {
    const initial = [{ id: 1, goalName: 'Old' }] as unknown as FinancialGoal[]
    appStorage.setJSON('financialGoals', initial)
    const { result } = renderHook(() => useFinancialGoals())
    const incoming = [
      { id: 5, goalName: 'New1' },
      { id: 6, goalName: 'New2' },
    ] as unknown as FinancialGoal[]
    act(() => {
      result.current.importGoals(incoming)
    })
    expect(result.current.goals).toHaveLength(2)
    expect(result.current.goals[0].goalName).toBe('New1')
  })

  it('reorderGoals sorts goals according to the provided id order', () => {
    const goals = [
      { id: 1, goalName: 'A' },
      { id: 2, goalName: 'B' },
      { id: 3, goalName: 'C' },
    ] as unknown as FinancialGoal[]
    appStorage.setJSON('financialGoals', goals)
    const { result } = renderHook(() => useFinancialGoals())
    act(() => {
      result.current.reorderGoals([3, 1, 2])
    })
    expect(result.current.goals.map(g => g.goalName)).toEqual(['C', 'A', 'B'])
  })

  it('reorderGoals filters out ids that do not match any existing goal', () => {
    const goals = [
      { id: 1, goalName: 'A' },
      { id: 2, goalName: 'B' },
    ] as unknown as FinancialGoal[]
    appStorage.setJSON('financialGoals', goals)
    const { result } = renderHook(() => useFinancialGoals())
    act(() => {
      result.current.reorderGoals([2, 99, 1])
    })
    expect(result.current.goals.map(g => g.goalName)).toEqual(['B', 'A'])
  })
})

describe('useFinancialGoals initialization error', () => {
  it('returns empty array when loadGoalsFromStorage throws', () => {
    appStorage.setJSON('financialGoals', 'not-an-array' as unknown as FinancialGoal[])
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() => useFinancialGoals())
    expect(result.current.goals).toEqual([])
    vi.restoreAllMocks()
  })
})
