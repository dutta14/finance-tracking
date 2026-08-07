import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Data from './Data'
import type { Account, BalanceEntry } from './types'
import type { ReactNode } from 'react'

const handleDataChangeSpy = vi.fn()
const mockSetAccounts = vi.fn()
const mockSetBalances = vi.fn()
const parseCsvImportSpy = vi.fn()

let mockAccounts: Account[] = []
let mockBalances: BalanceEntry[] = []
let mockAllowCsvImport = false

const profile = {
  name: 'Tester',
  currency: 'USD',
  locale: 'en-US',
  dateFormat: 'MMM YYYY',
}

vi.mock('../../contexts/GoalsContext', () => ({
  useGoals: () => ({ profile }),
}))

vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => ({ allowCsvImport: mockAllowCsvImport }),
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

vi.mock('./csvImport', () => ({
  parseCsvImport: (...args: unknown[]) => parseCsvImportSpy(...args),
}))

vi.mock('./csvExport', () => ({
  exportCsv: vi.fn(),
}))

vi.mock('./BalanceCharts', () => ({
  default: () => <div>Charts View</div>,
}))

vi.mock('./BalanceDetails', () => ({
  default: ({ onSaveMonth }: { onSaveMonth: (month: string, values: Record<string, number>) => void }) => (
    <div>
      <button onClick={() => onSaveMonth('2026-08', { '1': 9100, '3': 3300, abc: 200, '2': 400 })}>
        Save mixed month
      </button>
    </div>
  ),
}))

vi.mock('./BalanceSpreadsheet', () => ({
  default: ({
    toolbarActions,
    inlineEntry,
    onInlineEntryChange,
    onSaveInlineEntry,
  }: {
    toolbarActions: ReactNode
    inlineEntry: { month: string; values: Record<number, string> } | null
    onInlineEntryChange: (entry: { month: string; values: Record<number, string> } | null) => void
    onSaveInlineEntry: () => void
  }) => (
    <div>
      {toolbarActions}
      <div data-testid="inline-entry-state">{JSON.stringify(inlineEntry)}</div>
      <button onClick={() => onInlineEntryChange(null)}>Clear inline entry</button>
      <button
        onClick={() =>
          onInlineEntryChange({
            month: '2026-10',
            values: { 1: '   ', 2: '2000', 3: '$1,500' },
          })
        }
      >
        Set mixed inline entry
      </button>
      <button onClick={onSaveInlineEntry}>Save inline entry</button>
    </div>
  ),
}))

vi.mock('./AccountsModal', () => ({
  default: ({
    inline,
    onToggleStatus,
    onRenameGroup,
  }: {
    inline?: boolean
    onToggleStatus: (id: number) => void
    onRenameGroup: (oldName: string, newName: string) => void
  }) => (
    <div data-testid={inline ? 'inline-accounts-modal' : 'modal-accounts-modal'}>
      <button onClick={() => onToggleStatus(1)}>Toggle first status</button>
      <button onClick={() => onToggleStatus(2)}>Toggle second status</button>
      <button onClick={() => onRenameGroup('Legacy', 'Renamed')}>Rename Legacy group</button>
    </div>
  ),
}))

vi.mock('../allocation/Allocation', () => ({
  default: ({ tab }: { tab: 'breakdown' | 'ratios' }) => <div>Allocation {tab}</div>,
}))

vi.mock('../tools/components/SavingsGrowthTracker', () => ({
  default: () => <div>Growth Tracker</div>,
}))

const renderData = (initialRoute = '/net-worth/dashboard') =>
  render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/net-worth/*" element={<Data />} />
      </Routes>
    </MemoryRouter>,
  )

beforeEach(() => {
  handleDataChangeSpy.mockClear()
  mockSetAccounts.mockClear()
  mockSetBalances.mockClear()
  parseCsvImportSpy.mockReset()
  mockAllowCsvImport = false
  mockAccounts = [
    {
      id: 1,
      name: 'Checking',
      type: 'liquid',
      owner: 'primary',
      status: 'active',
      goalType: 'gw',
      nature: 'asset',
      allocation: 'cash',
      group: 'Legacy',
    },
    {
      id: 2,
      name: 'Archived 401k',
      type: 'retirement',
      owner: 'primary',
      status: 'inactive',
      goalType: 'fi',
      nature: 'asset',
      allocation: 'us-stock',
      group: 'Legacy',
    },
    {
      id: 3,
      name: 'Brokerage',
      type: 'non-retirement',
      owner: 'partner',
      status: 'active',
      goalType: 'fi',
      nature: 'asset',
      allocation: 'intl-stock' as const,
      group: 'Investing',
    },
  ]
  mockBalances = [
    { id: 1, accountId: 1, month: '2026-09', balance: 5000 },
    { id: 2, accountId: 2, month: '2026-09', balance: 12000 },
    { id: 3, accountId: 3, month: '2026-08', balance: 1400 },
    { id: 4, accountId: 1, month: '2026-08', balance: 7000 },
  ]
})

describe('Data branch coverage', () => {
  it('activates nested allocation and growth tabs for ratios and income routes', async () => {
    const user = userEvent.setup()

    const { unmount } = renderData('/net-worth/allocation/ratios')
    expect(await screen.findByRole('button', { name: 'My Allocation' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Loading…')
    await waitFor(() => {
      expect(screen.getByText('Allocation ratios')).toBeInTheDocument()
    })

    unmount()
    renderData('/net-worth/growth/income')

    expect(await screen.findByRole('button', { name: 'Income' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => {
      expect(screen.getByText('Growth Tracker')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Savings' }))
    expect(screen.getByRole('button', { name: 'Savings' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('supports ArrowLeft navigation and ignores unsupported data-view keys', async () => {
    const user = userEvent.setup()
    renderData('/net-worth/dashboard/details')

    const detailsTab = screen.getByRole('tab', { name: 'Details' })
    detailsTab.focus()

    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'Charts' })).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{PageDown}')
    expect(screen.getByRole('tab', { name: 'Charts' })).toHaveAttribute('aria-selected', 'true')
  })

  it('toggles active and inactive statuses through the inline accounts view', async () => {
    const user = userEvent.setup()
    renderData('/net-worth/dashboard/manage')

    await user.click(screen.getByRole('button', { name: 'Toggle first status' }))
    await user.click(screen.getByRole('button', { name: 'Toggle second status' }))

    const firstSavedAccounts = mockSetAccounts.mock.calls[0][0] as Account[]
    const secondSavedAccounts = mockSetAccounts.mock.calls[1][0] as Account[]

    expect(firstSavedAccounts.find(account => account.id === 1)?.status).toBe('inactive')
    expect(secondSavedAccounts.find(account => account.id === 2)?.status).toBe('active')
  })

  it('renames only matching groups in the inline accounts view', async () => {
    const user = userEvent.setup()
    renderData('/net-worth/dashboard/manage')

    await user.click(screen.getByRole('button', { name: 'Rename Legacy group' }))

    const savedAccounts = mockSetAccounts.mock.calls[0][0] as Account[]
    expect(savedAccounts.find(account => account.id === 1)?.group).toBe('Renamed')
    expect(savedAccounts.find(account => account.id === 2)?.group).toBe('Renamed')
    expect(savedAccounts.find(account => account.id === 3)?.group).toBe('Investing')
  })

  it('updates and appends month balances while skipping invalid and inactive accounts', async () => {
    const user = userEvent.setup()
    renderData('/net-worth/dashboard/details')

    await user.click(screen.getByRole('button', { name: 'Save mixed month' }))

    const savedBalances = mockSetBalances.mock.calls[0][0] as BalanceEntry[]
    expect(savedBalances.find(entry => entry.accountId === 1 && entry.month === '2026-08')?.balance).toBe(9100)
    expect(savedBalances.find(entry => entry.accountId === 3 && entry.month === '2026-08')?.balance).toBe(3300)
    expect(savedBalances.some(entry => entry.accountId === 2 && entry.month === '2026-08')).toBe(false)
  })

  it('returns early when saving without an inline entry and skips blank inline values', async () => {
    const user = userEvent.setup()
    renderData('/net-worth/dashboard/spreadsheet')

    await user.click(screen.getByRole('button', { name: 'Save inline entry' }))
    expect(mockSetBalances).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Set mixed inline entry' }))
    await user.click(screen.getByRole('button', { name: 'Save inline entry' }))

    const savedBalances = mockSetBalances.mock.calls[0][0] as BalanceEntry[]
    const newOctoberEntries = savedBalances.filter(entry => entry.month === '2026-10')

    expect(newOctoberEntries).toHaveLength(1)
    expect(newOctoberEntries[0]).toMatchObject({ accountId: 3, balance: 1500 })
  })

  it('copies last-month values for missing balances as empty strings', async () => {
    const user = userEvent.setup()
    renderData('/net-worth/dashboard/spreadsheet')

    await user.click(screen.getByRole('button', { name: 'Copy balances from last month' }))

    expect(screen.getByTestId('inline-entry-state')).toHaveTextContent('"1":"5000"')
    expect(screen.getByTestId('inline-entry-state')).toHaveTextContent('"3":""')
  })

  it('ignores CSV imports whose FileReader event has no result', () => {
    mockAllowCsvImport = true
    const originalFileReader = globalThis.FileReader

    globalThis.FileReader = class MockFileReader {
      onload: ((event: ProgressEvent<FileReader>) => void) | null = null

      readAsText() {
        this.onload?.({ target: null } as unknown as ProgressEvent<FileReader>)
      }
    } as unknown as typeof FileReader

    renderData('/net-worth/dashboard')

    const fileInput = screen.getByLabelText('Import CSV file')
    fireEvent.change(fileInput, {
      target: { files: [new File(['unused'], 'balances.csv', { type: 'text/csv' })] },
    })

    expect(parseCsvImportSpy).not.toHaveBeenCalled()
    expect(mockSetAccounts).not.toHaveBeenCalled()
    expect(mockSetBalances).not.toHaveBeenCalled()

    globalThis.FileReader = originalFileReader
  })
})
