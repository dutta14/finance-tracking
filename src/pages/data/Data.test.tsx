import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Data from './Data'
import type { Account, BalanceEntry } from './types'

const handleDataChangeSpy = vi.fn()
const mockSetAccounts = vi.fn()
const mockSetBalances = vi.fn()

const testBalances: BalanceEntry[] = [
  { id: 1, accountId: 1, month: '2024-01', balance: 5000 },
  { id: 2, accountId: 2, month: '2024-01', balance: 50000 },
]

vi.mock('../../contexts/GoalsContext', () => ({
  useGoals: () => ({
    profile: { name: '', currency: 'USD', locale: 'en-US', dateFormat: 'MMM YYYY' },
  }),
}))

vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    allowCsvImport: false,
  }),
}))

vi.mock('../../contexts/GitHubSyncContext', () => ({
  useGitHubSyncContext: () => ({
    handleDataChange: (...args: unknown[]) => handleDataChangeSpy(...args),
  }),
}))

vi.mock('../../contexts/DataContext', () => ({
  useData: () => ({
    accounts: [
      {
        id: 1,
        name: 'Checking',
        type: 'liquid',
        owner: 'primary',
        status: 'active',
        goalType: 'gw',
        nature: 'asset',
        allocation: 'cash',
      },
      {
        id: 2,
        name: '401k',
        type: 'retirement',
        owner: 'primary',
        status: 'active',
        goalType: 'fi',
        nature: 'asset',
        allocation: 'us-stock',
      },
    ],
    balances: [
      { id: 1, accountId: 1, month: '2024-01', balance: 5000 },
      { id: 2, accountId: 2, month: '2024-01', balance: 50000 },
    ],
    setAccounts: (...args: unknown[]) => mockSetAccounts(...args),
    setBalances: (...args: unknown[]) => mockSetBalances(...args),
  }),
}))

function renderData(initialRoute = '/net-worth') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/net-worth/*" element={<Data />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  handleDataChangeSpy.mockClear()
  mockSetAccounts.mockClear()
  mockSetBalances.mockClear()
  localStorage.clear()
})

describe('Data save race condition fix', () => {
  it('handleDeleteAccount passes consistent accounts and balances to onDataChange', () => {
    renderData()

    // Open accounts modal
    const viewAccountsBtn = screen.getByText(/View Accounts/i)
    fireEvent.click(viewAccountsBtn)

    // Find and click delete for account id=1
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    expect(deleteButtons.length).toBeGreaterThan(0)
    fireEvent.click(deleteButtons[0])

    // handleDeleteAccount calls saveBoth which passes both values together.
    // Verify onDataChange receives consistent data:
    // deleted account's balances should also be removed.
    expect(handleDataChangeSpy).toHaveBeenCalled()
    const lastCall = handleDataChangeSpy.mock.calls[handleDataChangeSpy.mock.calls.length - 1]
    const [passedAccounts, passedBalances] = lastCall as [Account[], BalanceEntry[]]

    // Account 1 was deleted, so its balance entries should be removed
    const accountIds = new Set(passedAccounts.map((a: Account) => a.id))
    for (const b of passedBalances) {
      expect(accountIds.has(b.accountId)).toBe(true)
    }
  })

  it('saveAccounts passes current balances (via ref) to onDataChange', () => {
    renderData()

    // Open accounts modal — toggling account status triggers saveAccounts
    const viewAccountsBtn = screen.getByText(/View Accounts/i)
    fireEvent.click(viewAccountsBtn)

    // Find a toggle button (status toggle) and click it
    const toggleButtons = screen.queryAllByRole('button', { name: /deactivate|activate/i })
    if (toggleButtons.length > 0) {
      fireEvent.click(toggleButtons[0])

      // saveAccounts should use balancesRef.current, not stale balances
      expect(handleDataChangeSpy).toHaveBeenCalled()
      const lastCall = handleDataChangeSpy.mock.calls[handleDataChangeSpy.mock.calls.length - 1]
      const [, passedBalances] = lastCall as [Account[], BalanceEntry[]]
      expect(passedBalances).toEqual(testBalances)
    }
  })

  it('sequential saveAccounts then saveBalances in same tick passes consistent data to onDataChange', () => {
    const { container } = renderData()

    // Switch to spreadsheet view so month rows (with delete buttons) are rendered
    fireEvent.click(screen.getByRole('tab', { name: /spreadsheet/i }))

    // Click the delete-month icon for Jan 2024 to open the confirmation dialog
    fireEvent.click(screen.getByTitle('Delete Jan 2024'))

    // Open accounts modal (Data re-renders, but BalanceSpreadsheet keeps pendingDeleteMonth state)
    fireEvent.click(screen.getByText(/View Accounts/i))

    // Show the add-account form inside the modal
    fireEvent.click(screen.getByText('+ Add Account'))

    // Fill in the account name and submit the form → triggers handleAddAccount → saveAccounts
    fireEvent.change(screen.getByPlaceholderText('e.g. Chase Checking'), {
      target: { value: 'New Savings' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add Account' }))

    // saveAccounts ran: accounts = [Checking, 401k, New Savings], accountsRef.current updated
    expect(handleDataChangeSpy).toHaveBeenCalledTimes(1)
    const firstCall = handleDataChangeSpy.mock.calls[0] as [Account[], BalanceEntry[]]
    expect(firstCall[0]).toHaveLength(3)

    // Now confirm the month deletion → triggers handleDeleteMonth → saveBalances
    // BalanceSpreadsheet's confirmation dialog is still in the DOM (its internal state persisted)
    const confirmDeleteBtn = container.querySelector('.data-confirm-delete') as HTMLElement
    fireEvent.click(confirmDeleteBtn)

    // saveBalances reads accountsRef.current — which the ref fix kept at 3 accounts
    expect(handleDataChangeSpy).toHaveBeenCalledTimes(2)
    const secondCall = handleDataChangeSpy.mock.calls[1] as [Account[], BalanceEntry[]]
    const [passedAccounts, passedBalances] = secondCall

    // KEY: Without the ref fix, passedAccounts would be stale (2 accounts from the
    // closure) because React hasn't re-rendered between the two saves.
    // With refs, accountsRef.current carries the fresh 3-account array.
    expect(passedAccounts).toHaveLength(3)
    expect(passedAccounts.find(a => a.name === 'New Savings')).toBeDefined()

    // All balances were for month 2024-01, so filtering that month yields empty
    expect(passedBalances).toEqual([])
  })
})
