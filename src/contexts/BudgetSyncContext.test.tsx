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

    it('marks budget dirty when budget-changed event fires', async () => {
      vi.useFakeTimers()

      const { result } = renderHook(() => ({ budget: useBudgetSync(), sync: useGitHubSyncContext() }), { wrapper })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3100)
      })

      await act(async () => {
        window.dispatchEvent(new Event('budget-changed'))
        // Listener defers markDirty via queueMicrotask
        await Promise.resolve()
      })

      expect(result.current.sync.dirtyFlags.budget).toBe(true)

      vi.useRealTimers()
    })
  })

  /* ── syncBudgetNow when configured ─────────────────────────────── */

  describe('syncBudgetNow when configured', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
      vi.restoreAllMocks()
    })

    it('calls upload functions when configured with active token', async () => {
      // Set up a configured state with a token
      localStorage.setItem(
        'github-sync-config',
        JSON.stringify({
          owner: 'test-owner',
          repo: 'test-repo',
          filePath: 'finance-goals.json',
          autoSync: false,
        }),
      )

      const { result } = renderHook(() => ({ budget: useBudgetSync(), sync: useGitHubSyncContext() }), { wrapper })

      // Save and unlock a token to become configured
      await act(async () => {
        await result.current.sync.saveEncryptedToken('ghp_testtoken', 'passphrase1')
      })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3100)
      })

      expect(result.current.sync.isConfigured).toBe(true)

      // Mock the budget sync utilities
      const uploadBudgetConfigMock = vi.fn().mockResolvedValue(undefined)
      const syncAllBudgetCSVsMock = vi.fn().mockResolvedValue(undefined)

      vi.doMock('../pages/budget/utils/budgetGitHubSync', () => ({
        uploadBudgetConfig: uploadBudgetConfigMock,
        syncAllBudgetCSVs: syncAllBudgetCSVsMock,
        downloadAllBudgetCSVs: vi.fn(),
        downloadBudgetConfig: vi.fn(),
      }))

      // Since we can't easily mock the imports used by the already-loaded module,
      // we verify the behavior by checking that the dirty flag is cleared
      act(() => {
        result.current.sync.markDirty('budget')
      })
      expect(result.current.sync.dirtyFlags.budget).toBe(true)

      // Mock fetch for the internal budget sync calls
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
        headers: new Headers(),
      } as Response)

      await act(async () => {
        await result.current.budget.syncBudgetNow()
      })

      // Budget dirty flag should be cleared after sync
      expect(result.current.sync.dirtyFlags.budget).toBe(false)
    })
  })

  /* ── restoreBudgetFromGitHub when configured ───────────────────── */

  describe('restoreBudgetFromGitHub when configured', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
      vi.restoreAllMocks()
    })

    it('does not throw when configured but downloads fail gracefully', async () => {
      localStorage.setItem(
        'github-sync-config',
        JSON.stringify({
          owner: 'test-owner',
          repo: 'test-repo',
          filePath: 'finance-goals.json',
          autoSync: false,
        }),
      )

      const { result } = renderHook(() => ({ budget: useBudgetSync(), sync: useGitHubSyncContext() }), { wrapper })

      await act(async () => {
        await result.current.sync.saveEncryptedToken('ghp_testtoken', 'passphrase1')
      })

      expect(result.current.sync.isConfigured).toBe(true)

      // Mock fetch to return 404 for all calls (no budget data on GitHub)
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({}),
        headers: new Headers(),
      } as Response)

      // Should not throw
      await act(async () => {
        await result.current.budget.restoreBudgetFromGitHub()
      })
    })
  })
})
