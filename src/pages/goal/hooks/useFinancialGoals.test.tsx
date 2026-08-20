import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { useFinancialGoals } from './useFinancialGoals'
import { MemoryFileStore } from '../../../utils/memoryFileStore'
import { FileStoreTestProvider } from '../../../test/fileStoreTestUtils'
import type { FinancialGoal } from '../../../types'

function makeWrapper(store: MemoryFileStore) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <FileStoreTestProvider store={store}>{children}</FileStoreTestProvider>
  )
  Wrapper.displayName = 'Wrapper'
  return Wrapper
}

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

describe('useFinancialGoals hook', () => {
  let store: MemoryFileStore

  beforeEach(() => {
    store = new MemoryFileStore()
  })

  it('returns empty array when nothing stored', async () => {
    const { result } = renderHook(() => useFinancialGoals(), { wrapper: makeWrapper(store) })
    await waitFor(() => expect(result.current.goals).toEqual([]))
  })

  it('loads goals from goals.json on mount', async () => {
    await store.writeJSON('goals.json', { financialGoals: [mockGoal], gwGoals: [] })
    const { result } = renderHook(() => useFinancialGoals(), { wrapper: makeWrapper(store) })
    await waitFor(() => expect(result.current.goals).toHaveLength(1))
    expect(result.current.goals[0].goalName).toBe('Retire Early')
  })

  it('reloads goals when the file store fires a subscriber callback', async () => {
    const { result } = renderHook(() => useFinancialGoals(), { wrapper: makeWrapper(store) })
    await waitFor(() => expect(result.current.goals).toEqual([]))

    const updatedGoal: FinancialGoal = { ...mockGoal, id: 2, goalName: 'College Fund' }
    await act(async () => {
      await store.writeJSON('goals.json', { financialGoals: [updatedGoal], gwGoals: [] })
    })

    await waitFor(() => expect(result.current.goals).toHaveLength(1))
    expect(result.current.goals[0].goalName).toBe('College Fund')
  })

  it('fromSyncRef prevents save effect from re-writing after file-store sync', async () => {
    const { result } = renderHook(() => useFinancialGoals(), { wrapper: makeWrapper(store) })
    await waitFor(() => expect(result.current.goals).toEqual([]))

    // Write new data directly to store — triggers subscriber refresh
    const newGoal: FinancialGoal = { ...mockGoal, id: 4, goalName: 'New Car' }
    await act(async () => {
      await store.writeJSON('goals.json', { financialGoals: [newGoal], gwGoals: [] })
    })

    await waitFor(() => expect(result.current.goals[0].goalName).toBe('New Car'))

    // After the subscriber fires, the file should still only contain the one goal
    // (the hook's save effect should NOT fire again with stale data)
    const stored = await store.readJSON<{ financialGoals: FinancialGoal[] }>('goals.json', { financialGoals: [] })
    expect(stored.financialGoals).toHaveLength(1)
    expect(stored.financialGoals[0].goalName).toBe('New Car')
  })
})

describe('useFinancialGoals CRUD operations', () => {
  let store: MemoryFileStore

  beforeEach(() => {
    store = new MemoryFileStore()
  })

  it('createGoal prepends a new goal to the list', async () => {
    const { result } = renderHook(() => useFinancialGoals(), { wrapper: makeWrapper(store) })
    await waitFor(() => expect(result.current.goals).toEqual([]))

    act(() => {
      result.current.createGoal(mockGoal)
    })
    await waitFor(() => expect(result.current.goals).toHaveLength(1))
    expect(result.current.goals[0].goalName).toBe('Retire Early')
  })

  it('updateGoal replaces the matching goal by id', async () => {
    await store.writeJSON('goals.json', { financialGoals: [mockGoal], gwGoals: [] })
    const { result } = renderHook(() => useFinancialGoals(), { wrapper: makeWrapper(store) })
    await waitFor(() => expect(result.current.goals).toHaveLength(1))

    const updated = { ...mockGoal, goalName: 'Updated' }
    act(() => {
      result.current.updateGoal(1, updated)
    })
    await waitFor(() => expect(result.current.goals[0].goalName).toBe('Updated'))
  })

  it('deleteGoal removes the goal with the given id', async () => {
    const goal2: FinancialGoal = { ...mockGoal, id: 2, goalName: 'B' }
    await store.writeJSON('goals.json', { financialGoals: [mockGoal, goal2], gwGoals: [] })
    const { result } = renderHook(() => useFinancialGoals(), { wrapper: makeWrapper(store) })
    await waitFor(() => expect(result.current.goals).toHaveLength(2))

    act(() => {
      result.current.deleteGoal(1)
    })
    await waitFor(() => expect(result.current.goals).toHaveLength(1))
    expect(result.current.goals[0].goalName).toBe('B')
  })

  it('importGoals replaces all goals with the incoming array', async () => {
    await store.writeJSON('goals.json', { financialGoals: [mockGoal], gwGoals: [] })
    const { result } = renderHook(() => useFinancialGoals(), { wrapper: makeWrapper(store) })
    await waitFor(() => expect(result.current.goals).toHaveLength(1))

    const incoming = [
      { ...mockGoal, id: 5, goalName: 'New1' },
      { ...mockGoal, id: 6, goalName: 'New2' },
    ]
    act(() => {
      result.current.importGoals(incoming)
    })
    await waitFor(() => expect(result.current.goals).toHaveLength(2))
    expect(result.current.goals[0].goalName).toBe('New1')
  })

  it('reorderGoals sorts goals according to the provided id order', async () => {
    const goals = [
      { ...mockGoal, id: 1, goalName: 'A' },
      { ...mockGoal, id: 2, goalName: 'B' },
      { ...mockGoal, id: 3, goalName: 'C' },
    ]
    await store.writeJSON('goals.json', { financialGoals: goals, gwGoals: [] })
    const { result } = renderHook(() => useFinancialGoals(), { wrapper: makeWrapper(store) })
    await waitFor(() => expect(result.current.goals).toHaveLength(3))

    act(() => {
      result.current.reorderGoals([3, 1, 2])
    })
    await waitFor(() => expect(result.current.goals.map(g => g.goalName)).toEqual(['C', 'A', 'B']))
  })

  it('reorderGoals filters out ids that do not match any existing goal', async () => {
    const goals = [
      { ...mockGoal, id: 1, goalName: 'A' },
      { ...mockGoal, id: 2, goalName: 'B' },
    ]
    await store.writeJSON('goals.json', { financialGoals: goals, gwGoals: [] })
    const { result } = renderHook(() => useFinancialGoals(), { wrapper: makeWrapper(store) })
    await waitFor(() => expect(result.current.goals).toHaveLength(2))

    act(() => {
      result.current.reorderGoals([2, 99, 1])
    })
    await waitFor(() => expect(result.current.goals.map(g => g.goalName)).toEqual(['B', 'A']))
  })
})
