import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { render, screen } from '@testing-library/react'
import { BudgetSyncProvider, useBudgetSync } from './BudgetSyncContext'
import { GitHubSyncProvider } from './GitHubSyncContext'
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

function BudgetSyncConsumer() {
  const ctx = useBudgetSync()
  return (
    <div>
      <span data-testid="hasSyncBudgetNow">{String(typeof ctx.syncBudgetNow === 'function')}</span>
      <span data-testid="hasRestoreBudget">{String(typeof ctx.restoreBudgetFromGitHub === 'function')}</span>
    </div>
  )
}

/* ── tests ───────────────────────────────────────────────────────── */

describe('BudgetSyncContext', () => {
  it('useBudgetSync throws when used outside BudgetSyncProvider', () => {
    expect(() => {
      renderHook(() => useBudgetSync())
    }).toThrow('useBudgetSync must be used within a <BudgetSyncProvider>')
  })

  it('exposes budget sync state', () => {
    render(
      <SettingsProvider>
        <GoalsProvider>
          <GitHubSyncProvider>
            <BudgetSyncProvider>
              <BudgetSyncConsumer />
            </BudgetSyncProvider>
          </GitHubSyncProvider>
        </GoalsProvider>
      </SettingsProvider>,
    )

    expect(screen.getByTestId('hasSyncBudgetNow').textContent).toBe('true')
    expect(screen.getByTestId('hasRestoreBudget').textContent).toBe('true')
  })

  it('provides context value via hook', () => {
    const { result } = renderHook(() => useBudgetSync(), { wrapper })

    expect(typeof result.current.syncBudgetNow).toBe('function')
    expect(typeof result.current.restoreBudgetFromGitHub).toBe('function')
  })
})
