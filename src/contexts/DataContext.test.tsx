import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { DataProvider, useData } from './DataContext'
import { FileStoreTestProvider } from '../test/fileStoreTestUtils'
import { MemoryFileStore } from '../utils/memoryFileStore'
import type { Account, BalanceEntry } from '../pages/data/types'
import { ReactNode } from 'react'

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
      <button
        data-testid="set-accounts"
        onClick={() => setAccounts([makeAccount()])}
      />
      <button
        data-testid="set-balances"
        onClick={() =>
          setBalances([{ id: 1, accountId: 1, month: '2024-01', balance: 1000 }])
        }
      />
    </div>
  )
}

function renderWithStore(ui: ReactNode, store: MemoryFileStore) {
  return render(
    <FileStoreTestProvider store={store}>
      <DataProvider>{ui}</DataProvider>
    </FileStoreTestProvider>,
  )
}

/* ── setup ───────────────────────────────────────────────────────── */

let store: MemoryFileStore

beforeEach(() => {
  store = new MemoryFileStore()
})

/* ── tests ───────────────────────────────────────────────────────── */

describe('DataContext', () => {
  it('renders children and provides default empty values when file store is empty', async () => {
    renderWithStore(<Consumer />, store)

    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('accounts').textContent!)).toEqual([])
      expect(JSON.parse(screen.getByTestId('balances').textContent!)).toEqual([])
      expect(JSON.parse(screen.getByTestId('allMonths').textContent!)).toEqual([])
    })
  })

  it('loads initial accounts and balances from file store', async () => {
    const acct = [makeAccount()]
    await store.writeJSON('accounts.json', acct)
    await store.writeCSV('balances/2024.csv', [
      ['month', 'accountId', 'balance'],
      ['2024-01', '1', '1000'],
    ])

    renderWithStore(<Consumer />, store)

    await waitFor(() => {
      const accounts = JSON.parse(screen.getByTestId('accounts').textContent!)
      expect(accounts).toHaveLength(1)
      expect(accounts[0].name).toBe('Checking')
    })

    const balances: BalanceEntry[] = JSON.parse(screen.getByTestId('balances').textContent!)
    expect(balances).toHaveLength(1)
    expect(balances[0].accountId).toBe(1)
    expect(balances[0].month).toBe('2024-01')
    expect(balances[0].balance).toBe(1000)
  })

  it('setAccounts updates state and writes to accounts.json', async () => {
    renderWithStore(<SetterConsumer />, store)
    await waitFor(() => expect(JSON.parse(screen.getByTestId('accounts').textContent!)).toEqual([]))

    act(() => {
      screen.getByTestId('set-accounts').click()
    })

    await waitFor(() => {
      const accounts = JSON.parse(screen.getByTestId('accounts').textContent!)
      expect(accounts).toHaveLength(1)
      expect(accounts[0].name).toBe('Checking')
    })

    // Also verify it was persisted to the file store
    await waitFor(async () => {
      const stored = await store.readJSON<Account[]>('accounts.json', [])
      expect(stored).toHaveLength(1)
    })
  })

  it('setBalances updates state and writes to balances CSV files', async () => {
    renderWithStore(<SetterConsumer />, store)
    await waitFor(() => expect(JSON.parse(screen.getByTestId('balances').textContent!)).toEqual([]))

    act(() => {
      screen.getByTestId('set-balances').click()
    })

    await waitFor(() => {
      const balances: BalanceEntry[] = JSON.parse(screen.getByTestId('balances').textContent!)
      expect(balances).toHaveLength(1)
      expect(balances[0].accountId).toBe(1)
    })

    // Verify CSV was written
    await waitFor(async () => {
      const exists = await store.exists('balances/2024.csv')
      expect(exists).toBe(true)
    })
  })

  it('derives allMonths sorted and deduplicated from balances', async () => {
    await store.writeCSV('balances/2024.csv', [
      ['month', 'accountId', 'balance'],
      ['2024-03', '1', '3000'],
      ['2024-01', '1', '1000'],
      ['2024-03', '1', '3000'], // duplicate month
      ['2024-02', '1', '2000'],
    ])

    renderWithStore(<Consumer />, store)

    await waitFor(() => {
      const allMonths = JSON.parse(screen.getByTestId('allMonths').textContent!)
      expect(allMonths).toEqual(['2024-01', '2024-02', '2024-03'])
    })
  })

  it('refreshes accounts when file store subscriber callback fires', async () => {
    renderWithStore(<Consumer />, store)
    await waitFor(() => expect(JSON.parse(screen.getByTestId('accounts').textContent!)).toEqual([]))

    const newAccounts = [makeAccount()]
    await act(async () => {
      await store.writeJSON('accounts.json', newAccounts)
    })

    await waitFor(() => {
      const accounts = JSON.parse(screen.getByTestId('accounts').textContent!)
      expect(accounts).toHaveLength(1)
      expect(accounts[0].name).toBe('Checking')
    })
  })

  it('refreshes when a custom data-changed event fires', async () => {
    renderWithStore(<Consumer />, store)
    await waitFor(() => expect(JSON.parse(screen.getByTestId('accounts').textContent!)).toEqual([]))

    const acct = [makeAccount()]
    await store.writeJSON('accounts.json', acct)

    act(() => {
      window.dispatchEvent(new Event('data-changed'))
    })

    await waitFor(() => {
      const accounts = JSON.parse(screen.getByTestId('accounts').textContent!)
      expect(accounts).toHaveLength(1)
    })
  })

  it('ignores balance rows with invalid data', async () => {
    await store.writeCSV('balances/2024.csv', [
      ['month', 'accountId', 'balance'],
      ['2024-01', 'notanumber', '1000'],
      ['2024-02', '1', 'notanumber'],
      ['2024-03', '1', '500'],
    ])

    renderWithStore(<Consumer />, store)

    await waitFor(() => {
      const balances: BalanceEntry[] = JSON.parse(screen.getByTestId('balances').textContent!)
      expect(balances).toHaveLength(1)
      expect(balances[0].month).toBe('2024-03')
      expect(balances[0].balance).toBe(500)
    })
  })
})
