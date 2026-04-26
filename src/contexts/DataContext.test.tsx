import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { DataProvider, useData } from './DataContext'
import type { Account, BalanceEntry } from '../pages/data/types'

/* ── helpers ─────────────────────────────────────────────────────── */

const makeAccount = (overrides: Partial<Account> = {}): Account => ({
  id: 1,
  name: 'Checking',
  type: 'liquid',
  owner: 'primary',
  status: 'active',
  goalType: 'gw',
  nature: 'asset',
  allocation: 'cash',
  ...overrides,
})

const makeBalance = (overrides: Partial<BalanceEntry> = {}): BalanceEntry => ({
  id: 1,
  accountId: 1,
  month: '2024-01',
  balance: 1000,
  ...overrides,
})

/** Renders a consumer that exposes context values via data-testid attributes. */
function Consumer({ onData }: { onData?: (d: ReturnType<typeof useData>) => void }) {
  const data = useData()
  onData?.(data)
  return (
    <div>
      <span data-testid="accounts">{JSON.stringify(data.accounts)}</span>
      <span data-testid="balances">{JSON.stringify(data.balances)}</span>
      <span data-testid="allMonths">{JSON.stringify(data.allMonths)}</span>
    </div>
  )
}

function SetterConsumer() {
  const { accounts, balances, setAccounts, setBalances } = useData()
  return (
    <div>
      <span data-testid="accounts">{JSON.stringify(accounts)}</span>
      <span data-testid="balances">{JSON.stringify(balances)}</span>
      <button data-testid="set-accounts" onClick={() => setAccounts([makeAccount()])} />
      <button data-testid="set-balances" onClick={() => setBalances([makeBalance()])} />
    </div>
  )
}

/* ── setup ───────────────────────────────────────────────────────── */

beforeEach(() => {
  localStorage.clear()
})

/* ── tests ───────────────────────────────────────────────────────── */

describe('DataContext', () => {
  it('renders children and provides default empty values when localStorage is empty', () => {
    render(
      <DataProvider>
        <Consumer />
      </DataProvider>,
    )

    expect(JSON.parse(screen.getByTestId('accounts').textContent!)).toEqual([])
    expect(JSON.parse(screen.getByTestId('balances').textContent!)).toEqual([])
    expect(JSON.parse(screen.getByTestId('allMonths').textContent!)).toEqual([])
  })

  it('loads initial accounts and balances from localStorage', () => {
    const acct = [makeAccount()]
    const bal = [makeBalance()]
    localStorage.setItem('data-accounts', JSON.stringify(acct))
    localStorage.setItem('data-balances', JSON.stringify(bal))

    render(
      <DataProvider>
        <Consumer />
      </DataProvider>,
    )

    expect(JSON.parse(screen.getByTestId('accounts').textContent!)).toEqual(acct)
    expect(JSON.parse(screen.getByTestId('balances').textContent!)).toEqual(bal)
  })

  it('setAccounts updates state and writes to localStorage', () => {
    render(
      <DataProvider>
        <SetterConsumer />
      </DataProvider>,
    )

    act(() => {
      screen.getByTestId('set-accounts').click()
    })

    expect(JSON.parse(screen.getByTestId('accounts').textContent!)).toEqual([makeAccount()])
    expect(JSON.parse(localStorage.getItem('data-accounts')!)).toEqual([makeAccount()])
  })

  it('setBalances updates state and writes to localStorage', () => {
    render(
      <DataProvider>
        <SetterConsumer />
      </DataProvider>,
    )

    act(() => {
      screen.getByTestId('set-balances').click()
    })

    expect(JSON.parse(screen.getByTestId('balances').textContent!)).toEqual([makeBalance()])
    expect(JSON.parse(localStorage.getItem('data-balances')!)).toEqual([makeBalance()])
  })

  it('derives allMonths sorted and deduplicated from balances', () => {
    const balances = [
      makeBalance({ id: 1, month: '2024-03' }),
      makeBalance({ id: 2, month: '2024-01' }),
      makeBalance({ id: 3, month: '2024-03' }),
      makeBalance({ id: 4, month: '2024-02' }),
    ]
    localStorage.setItem('data-balances', JSON.stringify(balances))

    render(
      <DataProvider>
        <Consumer />
      </DataProvider>,
    )

    expect(JSON.parse(screen.getByTestId('allMonths').textContent!)).toEqual(['2024-01', '2024-02', '2024-03'])
  })

  it('refreshes when a storage event fires from another tab (accounts)', () => {
    render(
      <DataProvider>
        <Consumer />
      </DataProvider>,
    )

    expect(JSON.parse(screen.getByTestId('accounts').textContent!)).toEqual([])

    const newAccounts = [makeAccount()]
    localStorage.setItem('data-accounts', JSON.stringify(newAccounts))

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'data-accounts', newValue: JSON.stringify(newAccounts) }))
    })

    expect(JSON.parse(screen.getByTestId('accounts').textContent!)).toEqual(newAccounts)
  })

  it('refreshes when a storage event fires from another tab (balances)', () => {
    render(
      <DataProvider>
        <Consumer />
      </DataProvider>,
    )

    const newBalances = [makeBalance({ month: '2025-06' })]
    localStorage.setItem('data-balances', JSON.stringify(newBalances))

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'data-balances', newValue: JSON.stringify(newBalances) }))
    })

    expect(JSON.parse(screen.getByTestId('balances').textContent!)).toEqual(newBalances)
    expect(JSON.parse(screen.getByTestId('allMonths').textContent!)).toEqual(['2025-06'])
  })

  it('refreshes when a custom data-changed event fires', () => {
    render(
      <DataProvider>
        <Consumer />
      </DataProvider>,
    )

    expect(JSON.parse(screen.getByTestId('accounts').textContent!)).toEqual([])

    const acct = [makeAccount()]
    const bal = [makeBalance()]
    localStorage.setItem('data-accounts', JSON.stringify(acct))
    localStorage.setItem('data-balances', JSON.stringify(bal))

    act(() => {
      window.dispatchEvent(new Event('data-changed'))
    })

    expect(JSON.parse(screen.getByTestId('accounts').textContent!)).toEqual(acct)
    expect(JSON.parse(screen.getByTestId('balances').textContent!)).toEqual(bal)
  })

  it('falls back to empty arrays when localStorage has corrupt JSON for accounts', () => {
    localStorage.setItem('data-accounts', '{not valid json!!!')

    render(
      <DataProvider>
        <Consumer />
      </DataProvider>,
    )

    expect(JSON.parse(screen.getByTestId('accounts').textContent!)).toEqual([])
  })

  it('falls back to empty arrays when localStorage has corrupt JSON for balances', () => {
    localStorage.setItem('data-balances', '{{bad}}')

    render(
      <DataProvider>
        <Consumer />
      </DataProvider>,
    )

    expect(JSON.parse(screen.getByTestId('balances').textContent!)).toEqual([])
  })

  it('ignores storage events for unrelated keys', () => {
    const acct = [makeAccount()]
    localStorage.setItem('data-accounts', JSON.stringify(acct))

    render(
      <DataProvider>
        <Consumer />
      </DataProvider>,
    )

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated-key', newValue: 'whatever' }))
    })

    // accounts should remain unchanged
    expect(JSON.parse(screen.getByTestId('accounts').textContent!)).toEqual(acct)
  })
})
