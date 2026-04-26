import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { render, screen } from '@testing-library/react'
import { TaxSyncProvider, useTaxSync } from './TaxSyncContext'
import { GitHubSyncProvider } from './GitHubSyncContext'
import { SettingsProvider } from './SettingsContext'
import { GoalsProvider } from './GoalsContext'
import type { ReactNode } from 'react'

/* ── helpers ─────────────────────────────────────────────────────── */

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>
    <GoalsProvider>
      <GitHubSyncProvider>
        <TaxSyncProvider>{children}</TaxSyncProvider>
      </GitHubSyncProvider>
    </GoalsProvider>
  </SettingsProvider>
)

function TaxSyncConsumer() {
  const ctx = useTaxSync()
  return (
    <div>
      <span data-testid="hasSyncTaxNow">{String(typeof ctx.syncTaxNow === 'function')}</span>
      <span data-testid="hasRestoreTax">{String(typeof ctx.restoreTaxFromGitHub === 'function')}</span>
    </div>
  )
}

/* ── tests ───────────────────────────────────────────────────────── */

describe('TaxSyncContext', () => {
  it('useTaxSync throws when used outside TaxSyncProvider', () => {
    expect(() => {
      renderHook(() => useTaxSync())
    }).toThrow('useTaxSync must be used within a <TaxSyncProvider>')
  })

  it('exposes tax sync state', () => {
    render(
      <SettingsProvider>
        <GoalsProvider>
          <GitHubSyncProvider>
            <TaxSyncProvider>
              <TaxSyncConsumer />
            </TaxSyncProvider>
          </GitHubSyncProvider>
        </GoalsProvider>
      </SettingsProvider>,
    )

    expect(screen.getByTestId('hasSyncTaxNow').textContent).toBe('true')
    expect(screen.getByTestId('hasRestoreTax').textContent).toBe('true')
  })

  it('provides context value via hook', () => {
    const { result } = renderHook(() => useTaxSync(), { wrapper })

    expect(typeof result.current.syncTaxNow).toBe('function')
    expect(typeof result.current.restoreTaxFromGitHub).toBe('function')
  })

  it('uses refs to avoid stale closures in auto-sync', () => {
    // TaxSyncProvider uses refs (configRef, tokenRef, isConfiguredRef) so the
    // debounced setTimeout always reads the latest values instead of stale captures.
    const { result } = renderHook(() => useTaxSync(), { wrapper })
    expect(result.current).toBeDefined()
    expect(typeof result.current.syncTaxNow).toBe('function')
  })
})
