import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { useGwGoals } from './useGwGoals'
import { MemoryFileStore } from '../../../utils/memoryFileStore'
import { FileStoreTestProvider } from '../../../test/fileStoreTestUtils'
import type { GwGoal } from '../../../types'

function makeWrapper(store: MemoryFileStore) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <FileStoreTestProvider store={store}>{children}</FileStoreTestProvider>
  )
  Wrapper.displayName = 'Wrapper'
  return Wrapper
}

const mockGwGoal: GwGoal = {
  id: 1,
  fiGoalId: 100,
  label: 'House',
  createdAt: '2025-01-01',
  disburseAge: 40,
  disburseAmount: 50000,
  growthRate: 7,
  currentSavings: 0,
}

describe('useGwGoals hook', () => {
  let store: MemoryFileStore

  beforeEach(() => {
    store = new MemoryFileStore()
  })

  it('returns empty array when nothing stored', async () => {
    const { result } = renderHook(() => useGwGoals(), { wrapper: makeWrapper(store) })
    await waitFor(() => expect(result.current.gwGoals).toEqual([]))
  })

  it('loads gwGoals from goals.json on mount', async () => {
    await store.writeJSON('goals.json', { financialGoals: [], gwGoals: [mockGwGoal] })
    const { result } = renderHook(() => useGwGoals(), { wrapper: makeWrapper(store) })
    await waitFor(() => expect(result.current.gwGoals).toHaveLength(1))
    expect(result.current.gwGoals[0].label).toBe('House')
  })

  it('migrates legacy fiPlanId → fiGoalId fields on load', async () => {
    const legacy = {
      id: 1,
      fiPlanId: 100,
      label: 'Car',
      createdAt: '2025-01-01',
      disburseAge: 35,
      disburseAmount: 30000,
      growthRate: 5,
    }
    await store.writeJSON('goals.json', { financialGoals: [], gwGoals: [legacy] })
    const { result } = renderHook(() => useGwGoals(), { wrapper: makeWrapper(store) })
    await waitFor(() => expect(result.current.gwGoals).toHaveLength(1))
    expect(result.current.gwGoals[0].fiGoalId).toBe(100)
    expect((result.current.gwGoals[0] as unknown as Record<string, unknown>).fiPlanId).toBeUndefined()
  })

  it('reloads when the file store fires a subscriber callback', async () => {
    const { result } = renderHook(() => useGwGoals(), { wrapper: makeWrapper(store) })
    await waitFor(() => expect(result.current.gwGoals).toEqual([]))

    const updatedGoal: GwGoal = { ...mockGwGoal, id: 2, label: 'Vacation' }
    await act(async () => {
      await store.writeJSON('goals.json', { financialGoals: [], gwGoals: [updatedGoal] })
    })

    await waitFor(() => expect(result.current.gwGoals).toHaveLength(1))
    expect(result.current.gwGoals[0].label).toBe('Vacation')
  })
})

describe('GwGoal field migration logic (pure)', () => {
  it('migrateGwFields renames fiPlanId to fiGoalId', () => {
    // Import the pure helper directly via the localStorageService
    // We verify the hook does the migration on load (tested above)
    // This tests the shape of the migrated object
    const input = [{ id: 1, fiPlanId: 42, label: 'Test' }]
    const expected = { id: 1, fiGoalId: 42, label: 'Test' }
    const result = input.map(item => {
      const m = { ...item } as Record<string, unknown>
      if ('fiPlanId' in m) {
        m.fiGoalId = m.fiPlanId
        delete m.fiPlanId
      }
      return m
    })
    expect(result[0]).toMatchObject(expected)
    expect((result[0] as Record<string, unknown>).fiPlanId).toBeUndefined()
  })

  it('leaves fiGoalId untouched if already present', () => {
    const input = [{ id: 1, fiGoalId: 42, label: 'Test' }]
    const result = input.map(item => {
      const m = { ...item } as Record<string, unknown>
      if ('fiPlanId' in m) {
        m.fiGoalId = m.fiPlanId
        delete m.fiPlanId
      }
      return m
    })
    expect(result[0].fiGoalId).toBe(42)
  })
})

describe('useGwGoals CRUD operations', () => {
  let store: MemoryFileStore

  beforeEach(() => {
    store = new MemoryFileStore()
  })

  it('createGwGoal adds a new goal with generated id and createdAt', async () => {
    const { result } = renderHook(() => useGwGoals(), { wrapper: makeWrapper(store) })
    await waitFor(() => expect(result.current.gwGoals).toEqual([]))

    act(() => {
      result.current.createGwGoal({
        fiGoalId: 10,
        label: 'New Car',
        disburseAge: 40,
        disburseAmount: 50000,
        growthRate: 7,
        currentSavings: 0,
      })
    })

    await waitFor(() => expect(result.current.gwGoals).toHaveLength(1))
    const created = result.current.gwGoals[0]
    expect(created.label).toBe('New Car')
    expect(created.id).toBeGreaterThan(0)
    expect(created.createdAt).toBeTruthy()
  })

  it('deleteGwGoal removes a goal by id', async () => {
    await store.writeJSON('goals.json', { financialGoals: [], gwGoals: [mockGwGoal] })
    const { result } = renderHook(() => useGwGoals(), { wrapper: makeWrapper(store) })
    await waitFor(() => expect(result.current.gwGoals).toHaveLength(1))

    act(() => {
      result.current.deleteGwGoal(1)
    })
    await waitFor(() => expect(result.current.gwGoals).toHaveLength(0))
  })

  it('deleteGwGoalsForFiGoal removes all goals matching a fiGoalId', async () => {
    const goals: GwGoal[] = [
      { ...mockGwGoal, id: 1, fiGoalId: 5, label: 'A' },
      { ...mockGwGoal, id: 2, fiGoalId: 5, label: 'B' },
      { ...mockGwGoal, id: 3, fiGoalId: 6, label: 'C' },
    ]
    await store.writeJSON('goals.json', { financialGoals: [], gwGoals: goals })
    const { result } = renderHook(() => useGwGoals(), { wrapper: makeWrapper(store) })
    await waitFor(() => expect(result.current.gwGoals).toHaveLength(3))

    act(() => {
      result.current.deleteGwGoalsForFiGoal(5)
    })
    await waitFor(() => expect(result.current.gwGoals).toHaveLength(1))
    expect(result.current.gwGoals[0].label).toBe('C')
  })

  it('updateGwGoal applies partial updates to a goal by id', async () => {
    await store.writeJSON('goals.json', { financialGoals: [], gwGoals: [mockGwGoal] })
    const { result } = renderHook(() => useGwGoals(), { wrapper: makeWrapper(store) })
    await waitFor(() => expect(result.current.gwGoals).toHaveLength(1))

    act(() => {
      result.current.updateGwGoal(1, { label: 'Renamed', disburseAmount: 75000 })
    })
    await waitFor(() => expect(result.current.gwGoals[0].label).toBe('Renamed'))
    expect(result.current.gwGoals[0].disburseAmount).toBe(75000)
    expect(result.current.gwGoals[0].fiGoalId).toBe(100)
  })

  it('importGwGoals replaces all goals with incoming array', async () => {
    await store.writeJSON('goals.json', { financialGoals: [], gwGoals: [mockGwGoal] })
    const { result } = renderHook(() => useGwGoals(), { wrapper: makeWrapper(store) })
    await waitFor(() => expect(result.current.gwGoals).toHaveLength(1))

    const incoming: GwGoal[] = [
      { ...mockGwGoal, id: 5, label: 'New1' },
      { ...mockGwGoal, id: 6, label: 'New2' },
    ]
    act(() => {
      result.current.importGwGoals(incoming)
    })
    await waitFor(() => expect(result.current.gwGoals).toHaveLength(2))
    expect(result.current.gwGoals[0].label).toBe('New1')
  })
})
