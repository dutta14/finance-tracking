import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { render } from '@testing-library/react'
import { BudgetSyncProvider, useBudgetSync } from './BudgetSyncContext'
import { GitHubSyncProvider, useGitHubSyncContext } from './GitHubSyncContext'
import { SettingsProvider } from './SettingsContext'
import { GoalsProvider } from './GoalsContext'
import type { ReactNode } from 'react'

/* ── helpers ─────────────────────────────────────────────────────── */

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>
    <GoalsProvider>
      <GitHubSyncProvider>
        <BudgetSyncProvider>{children}</BudgetSyncProvider>
      </GitHubSyncProvider>
    </GoalsProvider>
  </SettingsProvider>
)

beforeEach(() => {
  localStorage.clear()
})

/* ── tests ───────────────────────────────────────────────────────── */

describe('BudgetSyncContext', () => {
  it('useBudgetSync throws when used outside BudgetSyncProvider', () => {
    expect(() => {
      renderHook(() => useBudgetSync())
    }).toThrow('useBudgetSync must be used within a <BudgetSyncProvider>')
  })

  it('provides context value via hook', () => {
    const { result } = renderHook(() => useBudgetSync(), { wrapper })

    expect(typeof result.current.syncBudgetNow).toBe('function')
    expect(typeof result.current.restoreBudgetFromGitHub).toBe('function')
  })

  /* ── syncBudgetNow when not configured ─────────────────────────── */

  describe('syncBudgetNow when not configured', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('clears budget dirty flag when not configured (skips upload, clears flag)', async () => {
      // When isConfigured is false, syncBudgetNow skips upload and still calls
      // clearDirty('budget'). This is by design: nothing to sync = clear the flag.
      const { result } = renderHook(() => ({ budget: useBudgetSync(), sync: useGitHubSyncContext() }), { wrapper })

      // Advance past the 3-second dirty-ready gate in useGitHubSync
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3100)
      })

      // Mark budget dirty so we can verify it gets cleared
      act(() => {
        result.current.sync.markDirty('budget')
      })

      expect(result.current.sync.dirtyFlags.budget).toBe(true)

      await act(async () => {
        await result.current.budget.syncBudgetNow()
      })

      expect(result.current.sync.dirtyFlags.budget).toBe(false)
    })
  })

  /* ── restoreBudgetFromGitHub when not configured ───────────────── */

  describe('restoreBudgetFromGitHub when not configured', () => {
    it('does not modify localStorage when not configured', async () => {
      const { result } = renderHook(() => useBudgetSync(), { wrapper })

      const before = { ...localStorage }

      await act(async () => {
        await result.current.restoreBudgetFromGitHub()
      })

      // Guard clause returns early — no data written
      expect({ ...localStorage }).toEqual(before)
    })
  })

  /* ── budget-changed event listener ─────────────────────────────── */

  describe('budget-changed event listener', () => {
    it('registers event listener for budget-changed on mount', () => {
      const addSpy = vi.spyOn(window, 'addEventListener')

      render(
        <SettingsProvider>
          <GoalsProvider>
            <GitHubSyncProvider>
              <BudgetSyncProvider>
                <div />
              </BudgetSyncProvider>
            </GitHubSyncProvider>
          </GoalsProvider>
        </SettingsProvider>,
      )

      const budgetCalls = addSpy.mock.calls.filter(([event]) => event === 'budget-changed')
      expect(budgetCalls.length).toBe(1)

      addSpy.mockRestore()
    })

    it('removes budget-changed event listener on unmount', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener')

      const { unmount } = render(
        <SettingsProvider>
          <GoalsProvider>
            <GitHubSyncProvider>
              <BudgetSyncProvider>
                <div />
              </BudgetSyncProvider>
            </GitHubSyncProvider>
          </GoalsProvider>
        </SettingsProvider>,
      )

      unmount()

      const budgetRemoved = removeSpy.mock.calls.filter(([event]) => event === 'budget-changed')
      expect(budgetRemoved.length).toBe(1)

      removeSpy.mockRestore()
    })
  })
})
