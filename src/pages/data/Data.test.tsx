import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Data from './Data'
import type { Account, BalanceEntry } from './types'
import { makeAccount, makeBalanceEntry } from '../../test/factories'

/* ─── Configurable mock state ─── */

const handleDataChangeSpy = vi.fn()
const mockSetAccounts = vi.fn()
const mockSetBalances = vi.fn()

let mockAccounts: Account[] = []
let mockBalances: BalanceEntry[] = []
let mockAllowCsvImport = false

vi.mock('../../contexts/GoalsContext', () => ({
  useGoals: () => ({
    profile: { name: '', currency: 'USD', locale: 'en-US', dateFormat: 'MMM YYYY' },
  }),
}))

vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    allowCsvImport: mockAllowCsvImport,
  }),
}))

vi.mock('../../contexts/GitHubSyncContext', () => ({
  useGitHubSyncContext: () => ({
    handleDataChange: (...args: unknown[]) => handleDataChangeSpy(...args),
  }),
}))

vi.mock('../../contexts/DataContext', () => ({
  useData: () => ({
    accounts: mockAccounts,
    balances: mockBalances,
    setAccounts: (...args: unknown[]) => mockSetAccounts(...args),
    setBalances: (...args: unknown[]) => mockSetBalances(...args),
  }),
}))

vi.mock('../allocation/Allocation', () => ({
  default: () => <div data-testid="allocation-page">Allocation Tab</div>,
}))
vi.mock('../tools/components/SavingsGrowthTracker', () => ({
  default: () => <div data-testid="growth-page">Growth Tracker Tab</div>,
}))

vi.mock('recharts', async () => {
  const Orig = await vi.importActual<Record<string, unknown>>('recharts')
  return {
    ...Orig,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
  }
})

const exportCsvSpy = vi.fn()
vi.mock('./csvExport', () => ({
  exportCsv: (...args: unknown[]) => exportCsvSpy(...args),
}))

/* ─── Helpers ─── */

const twoAccounts: Account[] = [
  makeAccount({
    id: 1,
    name: 'Checking',
    type: 'liquid',
    owner: 'primary',
    status: 'active',
    goalType: 'gw',
    nature: 'asset',
    allocation: 'cash',
  }),
  makeAccount({
    id: 2,
    name: '401k',
    type: 'retirement',
    owner: 'primary',
    status: 'active',
    goalType: 'fi',
    nature: 'asset',
    allocation: 'us-stock',
  }),
]

const twoBalances: BalanceEntry[] = [
  makeBalanceEntry({ id: 1, accountId: 1, month: '2024-01', balance: 5000 }),
  makeBalanceEntry({ id: 2, accountId: 2, month: '2024-01', balance: 50000 }),
]

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
  exportCsvSpy.mockClear()
  localStorage.clear()
  mockAccounts = []
  mockBalances = []
  mockAllowCsvImport = false
})

/* ═══════════════════════════════════════════════════════════════
   Existing: Data save race condition fix
   ═══════════════════════════════════════════════════════════════ */

describe('Data save race condition fix', () => {
  beforeEach(() => {
    mockAccounts = [...twoAccounts]
    mockBalances = [...twoBalances]
  })

  it('handleDeleteAccount passes consistent accounts and balances to onDataChange', async () => {
    const user = userEvent.setup()
    renderData()
    const viewAccountsBtn = screen.getByText(/View Accounts/i)
    await user.click(viewAccountsBtn)
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    expect(deleteButtons.length).toBeGreaterThan(0)
    await user.click(deleteButtons[0])
    expect(handleDataChangeSpy).toHaveBeenCalled()
    const lastCall = handleDataChangeSpy.mock.calls[handleDataChangeSpy.mock.calls.length - 1]
    const [passedAccounts, passedBalances] = lastCall as [Account[], BalanceEntry[]]
    const accountIds = new Set(passedAccounts.map((a: Account) => a.id))
    for (const b of passedBalances) {
      expect(accountIds.has(b.accountId)).toBe(true)
    }
  })

  it('saveAccounts passes current balances (via ref) to onDataChange', async () => {
    const user = userEvent.setup()
    renderData()
    const viewAccountsBtn = screen.getByText(/View Accounts/i)
    await user.click(viewAccountsBtn)
    const toggleButtons = screen.queryAllByRole('button', { name: /deactivate|activate/i })
    if (toggleButtons.length > 0) {
      await user.click(toggleButtons[0])
      expect(handleDataChangeSpy).toHaveBeenCalled()
      const lastCall = handleDataChangeSpy.mock.calls[handleDataChangeSpy.mock.calls.length - 1]
      const [, passedBalances] = lastCall as [Account[], BalanceEntry[]]
      expect(passedBalances).toEqual(twoBalances)
    }
  })

  it('sequential saveAccounts then saveBalances in same tick passes consistent data to onDataChange', async () => {
    const user = userEvent.setup()
    const { container } = renderData()
    await user.click(screen.getByRole('tab', { name: /spreadsheet/i }))
    await user.click(screen.getByTitle('Delete Jan 2024'))
    await user.click(screen.getByText(/View Accounts/i))
    await user.click(screen.getByText('+ Add Account'))
    await user.type(screen.getByPlaceholderText('e.g. Chase Checking'), 'New Savings')
    await user.click(screen.getByRole('button', { name: 'Add Account' }))
    expect(handleDataChangeSpy).toHaveBeenCalledTimes(1)
    const firstCall = handleDataChangeSpy.mock.calls[0] as [Account[], BalanceEntry[]]
    expect(firstCall[0]).toHaveLength(3)
    const confirmDeleteBtn = container.querySelector('.data-confirm-delete') as HTMLElement
    await user.click(confirmDeleteBtn)
    expect(handleDataChangeSpy).toHaveBeenCalledTimes(2)
    const secondCall = handleDataChangeSpy.mock.calls[1] as [Account[], BalanceEntry[]]
    const [passedAccounts, passedBalances] = secondCall
    expect(passedAccounts).toHaveLength(3)
    expect(passedAccounts.find(a => a.name === 'New Savings')).toBeDefined()
    expect(passedBalances).toEqual([])
  })
})

/* ═══════════════════════════════════════════════════════════════
   SI-19: Data Page Integration
   ═══════════════════════════════════════════════════════════════ */

describe('Data page integration', () => {
  // --- Tab routing ---

  it('renders the Accounts tab as active by default', () => {
    mockAccounts = [...twoAccounts]
    mockBalances = [...twoBalances]
    renderData()
    const accountsTab = screen.getByRole('link', { name: 'Accounts' })
    expect(accountsTab).toHaveClass('active')
  })

  it('renders the Charts view as the default data view within accounts', () => {
    mockAccounts = [...twoAccounts]
    mockBalances = [...twoBalances]
    renderData()
    const chartsTab = screen.getByRole('tab', { name: /charts/i })
    expect(chartsTab).toHaveAttribute('aria-selected', 'true')
  })

  it('renders the Allocation tab when navigated to /net-worth/allocation', async () => {
    mockAccounts = [...twoAccounts]
    mockBalances = [...twoBalances]
    renderData('/net-worth/allocation')
    await waitFor(() => {
      expect(screen.getByTestId('allocation-page')).toBeInTheDocument()
    })
  })

  // --- AccountsModal ---

  it('opens AccountsModal when "View Accounts" button is clicked', async () => {
    const user = userEvent.setup()
    mockAccounts = [...twoAccounts]
    mockBalances = [...twoBalances]
    renderData()
    await user.click(screen.getByText(/View Accounts/i))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Accounts' })).toBeInTheDocument()
  })

  it('adds a new account via AccountsModal and updates both accounts and balances state', async () => {
    const user = userEvent.setup()
    mockAccounts = [...twoAccounts]
    mockBalances = [...twoBalances]
    renderData()

    await user.click(screen.getByText(/View Accounts/i))
    await user.click(screen.getByText('+ Add Account'))
    await user.type(screen.getByPlaceholderText('e.g. Chase Checking'), 'Brokerage')
    await user.click(screen.getByRole('button', { name: 'Add Account' }))

    expect(mockSetAccounts).toHaveBeenCalledTimes(1)
    const savedAccounts = mockSetAccounts.mock.calls[0][0] as Account[]
    expect(savedAccounts).toHaveLength(3)
    expect(savedAccounts[2].name).toBe('Brokerage')
    expect(savedAccounts[2].id).toBe(3)
    expect(handleDataChangeSpy).toHaveBeenCalledTimes(1)
  })

  it('updates an existing account and calls saveAccounts to persist', async () => {
    const user = userEvent.setup()
    mockAccounts = [...twoAccounts]
    mockBalances = [...twoBalances]
    renderData()

    await user.click(screen.getByText(/View Accounts/i))
    const editButtons = screen.getAllByRole('button', { name: /edit/i })
    await user.click(editButtons[0])

    const nameInput = screen.getByDisplayValue('Checking')
    await user.clear(nameInput)
    await user.type(nameInput, 'Updated Checking')
    await user.click(screen.getByRole('button', { name: 'Update' }))

    expect(mockSetAccounts).toHaveBeenCalled()
    expect(handleDataChangeSpy).toHaveBeenCalled()
  })

  it('bulk-updates multiple accounts and persists all changes', async () => {
    mockAccounts = [...twoAccounts]
    mockBalances = [...twoBalances]
    const { container } = renderData()
    const user = userEvent.setup()

    await user.click(screen.getByText(/View Accounts/i))

    // Hold Meta and click first account to start multi-select
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('Checking'))
    await user.keyboard('{/Meta}')

    // First selection triggers checkboxes — select second account
    const checkboxes = screen.getAllByRole('checkbox')
    const unchecked = checkboxes.filter(cb => !(cb as HTMLInputElement).checked)
    if (unchecked.length > 0) {
      await user.click(unchecked[0])
    }

    expect(screen.getByText(/selected/)).toBeInTheDocument()

    // Use a bulk bar dropdown to apply update (find selects inside bulk bar)
    const bulkBarSelects = container.querySelectorAll('.data-bulk-bar select')
    expect(bulkBarSelects.length).toBeGreaterThan(0)
    // Use the Status select (index varies by layout — find by option content)
    const statusSelect = Array.from(bulkBarSelects).find(sel =>
      Array.from(sel.querySelectorAll('option')).some(opt => opt.textContent === 'Inactive'),
    )
    expect(statusSelect).toBeTruthy()
    fireEvent.change(statusSelect!, { target: { value: 'inactive' } })

    expect(mockSetAccounts).toHaveBeenCalled()
    expect(handleDataChangeSpy).toHaveBeenCalled()
  })

  it('deletes an account and removes its balance entries', async () => {
    const user = userEvent.setup()
    mockAccounts = [...twoAccounts]
    mockBalances = [...twoBalances]
    renderData()

    await user.click(screen.getByText(/View Accounts/i))
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    await user.click(deleteButtons[0])

    expect(mockSetAccounts).toHaveBeenCalledTimes(1)
    expect(mockSetBalances).toHaveBeenCalledTimes(1)
    const savedAccounts = mockSetAccounts.mock.calls[0][0] as Account[]
    const savedBalances = mockSetBalances.mock.calls[0][0] as BalanceEntry[]
    expect(savedAccounts).toHaveLength(1)
    expect(savedAccounts[0].id).toBe(2)
    expect(savedBalances.every(b => b.accountId !== 1)).toBe(true)
  })

  // --- CSV import/export ---

  it('imports accounts from CSV file via FileReader', () => {
    mockAllowCsvImport = true
    mockAccounts = []
    mockBalances = []

    const csvContent = ',Fidelity,Fidelity\n,401k,Brokerage\n2024-01,50000,10000'

    // Replace FileReader with a mock that triggers onload synchronously
    const OrigFileReader = globalThis.FileReader
    globalThis.FileReader = class MockFileReader {
      onload: ((ev: ProgressEvent<FileReader>) => void) | null = null
      readAsText() {
        if (this.onload) {
          this.onload({ target: { result: csvContent } } as unknown as ProgressEvent<FileReader>)
        }
      }
    } as unknown as typeof FileReader

    renderData()

    const fileInput = screen.getByLabelText('Import CSV file')
    const file = new File([csvContent], 'data.csv', { type: 'text/csv' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    expect(mockSetAccounts).toHaveBeenCalledTimes(1)
    expect(mockSetBalances).toHaveBeenCalledTimes(1)
    const importedAccounts = mockSetAccounts.mock.calls[0][0] as Account[]
    expect(importedAccounts.some(a => a.name === '401k')).toBe(true)
    expect(importedAccounts.some(a => a.name === 'Brokerage')).toBe(true)

    globalThis.FileReader = OrigFileReader
  })

  it('exports accounts to CSV file with correct column format', async () => {
    const user = userEvent.setup()
    mockAllowCsvImport = true
    mockAccounts = [...twoAccounts]
    mockBalances = [...twoBalances]
    renderData()

    await user.click(screen.getByText('Export CSV'))

    expect(exportCsvSpy).toHaveBeenCalledTimes(1)
    expect(exportCsvSpy).toHaveBeenCalledWith(mockAccounts, mockBalances)
  })

  // --- Inline balance entry ---

  it('handles inline balance entry edit and persists via saveBalances', async () => {
    const user = userEvent.setup()
    mockAccounts = [...twoAccounts]
    mockBalances = [...twoBalances]
    renderData()

    await user.click(screen.getByRole('tab', { name: /spreadsheet/i }))
    await user.click(screen.getByText('+ Add Entry'))

    const inlineInputs = screen.getAllByPlaceholderText('—')
    expect(inlineInputs).toHaveLength(2)

    await user.type(inlineInputs[0], '7500')
    await user.click(screen.getByTitle('Save'))

    expect(mockSetBalances).toHaveBeenCalledTimes(1)
    const savedBalances = mockSetBalances.mock.calls[0][0] as BalanceEntry[]
    expect(savedBalances).toHaveLength(twoBalances.length + 1)
    expect(savedBalances.some(b => b.balance === 7500)).toBe(true)
  })

  // --- Delete month ---

  it('deletes a month of balance entries across all accounts when deleteMonth is called', async () => {
    const user = userEvent.setup()
    mockAccounts = [...twoAccounts]
    mockBalances = [...twoBalances]
    const { container } = renderData()

    await user.click(screen.getByRole('tab', { name: /spreadsheet/i }))
    await user.click(screen.getByTitle('Delete Jan 2024'))

    const confirmBtn = container.querySelector('.data-confirm-delete') as HTMLElement
    expect(confirmBtn).toBeTruthy()
    await user.click(confirmBtn)

    expect(mockSetBalances).toHaveBeenCalledTimes(1)
    const savedBalances = mockSetBalances.mock.calls[0][0] as BalanceEntry[]
    expect(savedBalances.every(b => b.month !== '2024-01')).toBe(true)
  })
})
