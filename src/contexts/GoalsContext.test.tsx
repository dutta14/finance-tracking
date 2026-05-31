import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { GoalsProvider, useGoals } from './GoalsContext'
import type { ReactNode } from 'react'
import type { FinancialGoal } from '../types'

/* ── helpers ─────────────────────────────────────────────────────── */

const wrapper = ({ children }: { children: ReactNode }) => <GoalsProvider>{children}</GoalsProvider>

function GoalsConsumer() {
  const ctx = useGoals()
  return (
    <div>
      <span data-testid="goalCount">{ctx.goals.length}</span>
      <span data-testid="visibleGoalCount">{ctx.visibleGoals.length}</span>
      <span data-testid="gwGoalCount">{ctx.gwGoals.length}</span>
      <span data-testid="profileName">{ctx.profile.name}</span>
      <span data-testid="pendingDelete">{ctx.pendingDelete ? ctx.pendingDelete.message : 'none'}</span>
      <button
        data-testid="create-goal"
        onClick={() =>
          ctx.createGoal({
            id: 1,
            goalName: 'Test Goal',
            createdAt: new Date().toISOString(),
            birthday: '',
            goalCreatedIn: '',
            goalEndYear: '',
            resetExpenseMonth: false,
            retirementAge: 65,
            expenseMonth: 0,
            expenseValue: 0,
            monthlyExpenseValue: 0,
            expenseValueMar2026: 0,
            expenseValue2047: 0,
            monthlyExpense2047: 0,
            inflationRate: 3,
            safeWithdrawalRate: 4,
            growth: 7,
            retirement: '',
            fiGoal: 0,
            progress: 0,
          } as FinancialGoal)
        }
      />
      <button data-testid="delete-goal-undo" onClick={() => ctx.handleDeleteWithUndo([1])} />
      <button data-testid="undo-delete" onClick={() => ctx.handleUndoDelete()} />
      <button data-testid="dismiss-pending" onClick={() => ctx.dismissPendingDelete()} />
      <button data-testid="delete-goal" onClick={() => ctx.handleDeleteGoal(1)} />
      <button data-testid="update-profile" onClick={() => ctx.updateProfile({ name: 'Drew' })} />
    </div>
  )
}

/* ── setup ───────────────────────────────────────────────────────── */

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

/* ── tests ───────────────────────────────────────────────────────── */

describe('GoalsContext', () => {
  it('useGoals throws when used outside GoalsProvider', () => {
    expect(() => {
      renderHook(() => useGoals())
    }).toThrow('useGoals must be used within a <GoalsProvider>')
  })

  it('provides empty defaults when localStorage is empty', () => {
    render(
      <GoalsProvider>
        <GoalsConsumer />
      </GoalsProvider>,
    )

    expect(screen.getByTestId('goalCount').textContent).toBe('0')
    expect(screen.getByTestId('visibleGoalCount').textContent).toBe('0')
    expect(screen.getByTestId('gwGoalCount').textContent).toBe('0')
    expect(screen.getByTestId('profileName').textContent).toBe('')
    expect(screen.getByTestId('pendingDelete').textContent).toBe('none')
  })

  it('createGoal adds a goal', () => {
    render(
      <GoalsProvider>
        <GoalsConsumer />
      </GoalsProvider>,
    )

    act(() => {
      screen.getByTestId('create-goal').click()
    })

    expect(screen.getByTestId('goalCount').textContent).toBe('1')
    expect(screen.getByTestId('visibleGoalCount').textContent).toBe('1')
  })

  it('handleDeleteWithUndo hides goal but does not delete immediately', () => {
    render(
      <GoalsProvider>
        <GoalsConsumer />
      </GoalsProvider>,
    )

    act(() => {
      screen.getByTestId('create-goal').click()
    })
    expect(screen.getByTestId('goalCount').textContent).toBe('1')

    act(() => {
      screen.getByTestId('delete-goal-undo').click()
    })

    // Goal is still in goals (not yet deleted), but hidden from visibleGoals
    expect(screen.getByTestId('goalCount').textContent).toBe('1')
    expect(screen.getByTestId('visibleGoalCount').textContent).toBe('0')
    expect(screen.getByTestId('pendingDelete').textContent).toContain('deleted')
  })

  it('handleUndoDelete restores visibility', () => {
    render(
      <GoalsProvider>
        <GoalsConsumer />
      </GoalsProvider>,
    )

    act(() => {
      screen.getByTestId('create-goal').click()
    })
    act(() => {
      screen.getByTestId('delete-goal-undo').click()
    })
    expect(screen.getByTestId('visibleGoalCount').textContent).toBe('0')

    act(() => {
      screen.getByTestId('undo-delete').click()
    })

    expect(screen.getByTestId('visibleGoalCount').textContent).toBe('1')
    expect(screen.getByTestId('pendingDelete').textContent).toBe('none')
  })

  it('dismissPendingDelete actually deletes the goal', () => {
    render(
      <GoalsProvider>
        <GoalsConsumer />
      </GoalsProvider>,
    )

    act(() => {
      screen.getByTestId('create-goal').click()
    })
    act(() => {
      screen.getByTestId('delete-goal-undo').click()
    })

    act(() => {
      screen.getByTestId('dismiss-pending').click()
    })

    expect(screen.getByTestId('goalCount').textContent).toBe('0')
    expect(screen.getByTestId('pendingDelete').textContent).toBe('none')
  })

  it('pending delete auto-executes after timeout', () => {
    render(
      <GoalsProvider>
        <GoalsConsumer />
      </GoalsProvider>,
    )

    act(() => {
      screen.getByTestId('create-goal').click()
    })
    act(() => {
      screen.getByTestId('delete-goal-undo').click()
    })

    expect(screen.getByTestId('goalCount').textContent).toBe('1')

    act(() => {
      vi.advanceTimersByTime(10_001)
    })

    expect(screen.getByTestId('goalCount').textContent).toBe('0')
  })

  it('updateProfile updates the profile name', () => {
    render(
      <GoalsProvider>
        <GoalsConsumer />
      </GoalsProvider>,
    )

    act(() => {
      screen.getByTestId('update-profile').click()
    })

    expect(screen.getByTestId('profileName').textContent).toBe('Drew')
  })

  it('provides context value via hook', () => {
    const { result } = renderHook(() => useGoals(), { wrapper })

    expect(result.current.goals).toEqual([])
    expect(result.current.gwGoals).toEqual([])
    expect(result.current.profile.name).toBe('')
    expect(result.current.pendingDelete).toBeNull()
    expect(typeof result.current.createGoal).toBe('function')
    expect(typeof result.current.handleDeleteWithUndo).toBe('function')
    expect(typeof result.current.handleCopyGwGoals).toBe('function')
  })

  it('handleDeleteWithUndo finalizes previous pending delete before starting new one', () => {
    const { result } = renderHook(() => useGoals(), { wrapper })

    // Create two goals
    const goal1: FinancialGoal = {
      id: 1,
      goalName: 'First',
      createdAt: new Date().toISOString(),
      birthday: '',
      goalCreatedIn: '',
      goalEndYear: '',
      resetExpenseMonth: false,
      retirementAge: 65,
      expenseMonth: 0,
      expenseValue: 0,
      monthlyExpenseValue: 0,
      expenseValueMar2026: 0,
      expenseValue2047: 0,
      monthlyExpense2047: 0,
      inflationRate: 3,
      safeWithdrawalRate: 4,
      growth: 7,
      retirement: '',
      fiGoal: 0,
      progress: 0,
    } as FinancialGoal
    const goal2: FinancialGoal = { ...goal1, id: 2, goalName: 'Second' }

    act(() => {
      result.current.createGoal(goal1)
      result.current.createGoal(goal2)
    })
    expect(result.current.goals).toHaveLength(2)

    // Start deleting first goal (pending)
    act(() => {
      result.current.handleDeleteWithUndo([1])
    })
    expect(result.current.pendingDelete).not.toBeNull()
    expect(result.current.visibleGoals).toHaveLength(1)

    // Start deleting second goal — should finalize first deletion
    act(() => {
      result.current.handleDeleteWithUndo([2])
    })

    // First goal should be actually deleted now (finalized)
    expect(result.current.goals.find(g => g.id === 1)).toBeUndefined()
    // Second goal still exists (pending undo period)
    expect(result.current.goals.find(g => g.id === 2)).toBeDefined()
    expect(result.current.visibleGoals).toHaveLength(0)
  })

  it('handleDeleteWithUndo uses "Goal" as fallback when goalName is undefined', () => {
    const { result } = renderHook(() => useGoals(), { wrapper })

    const goal: FinancialGoal = {
      id: 1,
      createdAt: new Date().toISOString(),
      birthday: '',
      goalCreatedIn: '',
      goalEndYear: '',
      resetExpenseMonth: false,
      retirementAge: 65,
      expenseMonth: 0,
      expenseValue: 0,
      monthlyExpenseValue: 0,
      expenseValueMar2026: 0,
      expenseValue2047: 0,
      monthlyExpense2047: 0,
      inflationRate: 3,
      safeWithdrawalRate: 4,
      growth: 7,
      retirement: '',
      fiGoal: 0,
      progress: 0,
    } as FinancialGoal

    act(() => {
      result.current.createGoal(goal)
    })
    act(() => {
      result.current.handleDeleteWithUndo([1])
    })

    expect(result.current.pendingDelete?.message).toBe('"Goal" deleted')
  })

  it('handleCopyGwGoals copies gw goals from source plan to new plan', () => {
    const { result } = renderHook(() => useGoals(), { wrapper })

    // Create a gw goal linked to fiGoalId 100
    act(() => {
      result.current.createGwGoal({
        fiGoalId: 100,
        label: 'Sub Goal A',
        disburseAge: 45,
        disburseAmount: 60000,
        growthRate: 7,
        currentSavings: 15000,
      })
    })
    expect(result.current.gwGoals).toHaveLength(1)

    // Copy to new plan id 200
    act(() => {
      result.current.handleCopyGwGoals(100, 200)
    })

    expect(result.current.gwGoals).toHaveLength(2)
    const copied = result.current.gwGoals.find(g => g.fiGoalId === 200)
    expect(copied).toBeDefined()
    expect(copied!.label).toBe('Sub Goal A')
    expect(copied!.currentSavings).toBe(0)
  })

  it('handleCopyGwGoals does nothing when source plan has no gw goals', () => {
    const { result } = renderHook(() => useGoals(), { wrapper })

    act(() => {
      result.current.handleCopyGwGoals(999, 200)
    })

    expect(result.current.gwGoals).toHaveLength(0)
  })

  it('deleteGwGoal removes a gw goal by id', () => {
    const { result } = renderHook(() => useGoals(), { wrapper })

    act(() => {
      result.current.createGwGoal({
        fiGoalId: 100,
        label: 'To Delete',
        disburseAge: 45,
        disburseAmount: 60000,
        growthRate: 7,
        currentSavings: 15000,
      })
    })
    const id = result.current.gwGoals[0].id

    act(() => {
      result.current.deleteGwGoal(id)
    })

    expect(result.current.gwGoals).toHaveLength(0)
  })

  it('handleDeleteWithUndo shows plural message for multiple goals', () => {
    const { result } = renderHook(() => useGoals(), { wrapper })

    act(() => {
      result.current.createGoal({ goalName: 'Plan A' } as Parameters<typeof result.current.createGoal>[0])
    })
    act(() => {
      result.current.createGoal({ goalName: 'Plan B' } as Parameters<typeof result.current.createGoal>[0])
    })

    const ids = result.current.goals.map(g => g.id)
    expect(ids).toHaveLength(2)

    act(() => {
      result.current.handleDeleteWithUndo(ids)
    })

    expect(result.current.pendingDelete).not.toBeNull()
    expect(result.current.pendingDelete!.message).toBe('2 goals deleted')
  })

  it('handleUndoDelete is a no-op when no pending delete exists (line 79 early return)', () => {
    const { result } = renderHook(() => useGoals(), { wrapper })

    expect(result.current.pendingDelete).toBeNull()
    act(() => {
      result.current.handleUndoDelete()
    })
    expect(result.current.pendingDelete).toBeNull()
    expect(result.current.goals).toHaveLength(0)
  })

  it('dismissPendingDelete is a no-op when no pending delete exists (line 103 early return)', () => {
    const { result } = renderHook(() => useGoals(), { wrapper })

    expect(result.current.pendingDelete).toBeNull()
    act(() => {
      result.current.dismissPendingDelete()
    })
    expect(result.current.pendingDelete).toBeNull()
  })
})
