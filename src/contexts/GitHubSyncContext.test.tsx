import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { render, screen } from '@testing-library/react'
import { GitHubSyncProvider, useGitHubSyncContext } from './GitHubSyncContext'
import { SettingsProvider } from './SettingsContext'
import { GoalsProvider } from './GoalsContext'
import type { ReactNode } from 'react'

/* ── helpers ─────────────────────────────────────────────────────── */

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>
    <GoalsProvider>
      <GitHubSyncProvider>{children}</GitHubSyncProvider>
    </GoalsProvider>
  </SettingsProvider>
)

function SyncConsumer() {
  const ctx = useGitHubSyncContext()
  return (
    <div>
      <span data-testid="syncStatus">{ctx.syncStatus}</span>
      <span data-testid="isConfigured">{String(ctx.isConfigured)}</span>
      <span data-testid="hasPendingChanges">{String(ctx.hasPendingChanges)}</span>
      <span data-testid="hasHandleSyncNow">{String(typeof ctx.handleSyncNow === 'function')}</span>
      <span data-testid="hasHandleDataChange">{String(typeof ctx.handleDataChange === 'function')}</span>
      <span data-testid="hasApplyRestoredSnapshot">{String(typeof ctx.applyRestoredSnapshot === 'function')}</span>
    </div>
  )
}

/* ── tests ───────────────────────────────────────────────────────── */

describe('GitHubSyncContext', () => {
  it('useGitHubSyncContext throws when used outside GitHubSyncProvider', () => {
    expect(() => {
      renderHook(() => useGitHubSyncContext())
    }).toThrow('useGitHubSyncContext must be used within a <GitHubSyncProvider>')
  })

  it('provides default sync state', () => {
    render(
      <SettingsProvider>
        <GoalsProvider>
          <GitHubSyncProvider>
            <SyncConsumer />
          </GitHubSyncProvider>
        </GoalsProvider>
      </SettingsProvider>,
    )

    expect(screen.getByTestId('syncStatus').textContent).toBe('idle')
    expect(screen.getByTestId('isConfigured').textContent).toBe('false')
    expect(screen.getByTestId('hasPendingChanges').textContent).toBe('false')
  })

  it('exposes handleSyncNow, handleDataChange, and applyRestoredSnapshot functions', () => {
    render(
      <SettingsProvider>
        <GoalsProvider>
          <GitHubSyncProvider>
            <SyncConsumer />
          </GitHubSyncProvider>
        </GoalsProvider>
      </SettingsProvider>,
    )

    expect(screen.getByTestId('hasHandleSyncNow').textContent).toBe('true')
    expect(screen.getByTestId('hasHandleDataChange').textContent).toBe('true')
    expect(screen.getByTestId('hasApplyRestoredSnapshot').textContent).toBe('true')
  })

  it('provides full context value via hook', () => {
    const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

    expect(result.current.syncStatus).toBe('idle')
    expect(result.current.isConfigured).toBe(false)
    expect(result.current.hasPendingChanges).toBe(false)
    expect(result.current.lastSyncAt).toBeNull()
    expect(result.current.lastError).toBeNull()
    expect(result.current.history).toEqual([])
    expect(result.current.hasStoredToken).toBe(false)
    expect(result.current.tokenUnlocked).toBe(false)
    expect(typeof result.current.fetchHistory).toBe('function')
    expect(typeof result.current.testConnection).toBe('function')
    expect(typeof result.current.restoreLatest).toBe('function')
    expect(typeof result.current.restoreFromCommit).toBe('function')
  })

  /* ── Bug 1 regression: ghDataToSync memoization ────────────────── */

  describe('ghDataToSync memoization (regression)', () => {
    it('ghDataToSync does not include volatile exportedAt field that breaks memoization', () => {
      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      const data = result.current.ghDataToSync as Record<string, unknown>
      expect(data).not.toHaveProperty('exportedAt')
    })

    it('ghDataToSync does not include localStorage-derived goalViewMode or homeCardOrder fields', () => {
      localStorage.setItem('goal-view-mode', 'grid')
      localStorage.setItem('home-card-order', 'custom')

      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      const data = result.current.ghDataToSync as Record<string, unknown>
      const settings = (data.settings ?? {}) as Record<string, unknown>

      expect(data).not.toHaveProperty('goalViewMode')
      expect(data).not.toHaveProperty('homeCardOrder')
      expect(settings).not.toHaveProperty('goalViewMode')
      expect(settings).not.toHaveProperty('homeCardOrder')

      localStorage.removeItem('goal-view-mode')
      localStorage.removeItem('home-card-order')
    })

    it('ghDataToSync returns a referentially stable object when dependencies have not changed', () => {
      const { result, rerender } = renderHook(() => useGitHubSyncContext(), { wrapper })

      const first = result.current.ghDataToSync
      rerender()
      const second = result.current.ghDataToSync

      expect(first).toBe(second)
    })
  })
})
