import { describe, it, expect, vi, beforeEach } from 'vitest'
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
})
