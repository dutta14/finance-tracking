import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Transactions, { resetTransactionCache } from './Transactions'
import type { CategoryGroup } from '../budget/types'

const csvMap = {
  august: 'csv-august',
  july: 'csv-july',
}

const baseCategoryGroups: CategoryGroup[] = [
  { id: 'income', name: 'Income', categories: ['Salary', 'Bonus'], type: 'income' },
  { id: 'spending', name: 'Spending', categories: ['Groceries', 'Shopping', 'Dining', 'Transport'] },
  { id: 'removed', name: 'Removed', categories: ['Hidden'] },
]

const baseAugustTransactions = [
  { date: '2026-08-02', category: 'Salary', amount: 2500, description: 'Payroll Deposit' },
  { date: '2026-08-02', category: 'Shopping', amount: -125.55, description: 'Book Store' },
  { date: '2026-08-01', category: 'Groceries', amount: -82.45, description: 'Whole Foods Market' },
]

const baseJulyTransactions = [
  { date: '2026-07-30', category: 'Bonus', amount: 1200, description: 'Performance Bonus' },
  { date: '2026-07-30', category: 'Dining', amount: -45.21, description: 'Dinner Out' },
  { date: '2026-07-29', category: 'Transport', amount: -19.99, description: 'Train Pass' },
]

const saveBudgetStoreSpy = vi.fn()
const saveCSVForMonthSpy = vi.fn()

const store: {
  csvs: Record<string, { month: string; csv: string; uploadedAt: string }>
  configs: Record<string, never>
  years: number[]
  categoryGroups: CategoryGroup[]
} = {
  csvs: {
    '2026-08': { month: '2026-08', csv: csvMap.august, uploadedAt: '2026-08-02T12:00:00.000Z' },
    '2026-07': { month: '2026-07', csv: csvMap.july, uploadedAt: '2026-07-30T12:00:00.000Z' },
  },
  configs: {},
  years: [2026],
  categoryGroups: baseCategoryGroups,
}

const transactionFixtures: Record<
  string,
  Array<{ date: string; category: string; amount: number; description?: string }>
> = {
  [csvMap.august]: [...baseAugustTransactions],
  [csvMap.july]: [...baseJulyTransactions],
}

vi.mock('../budget/utils/budgetStorage', () => ({
  loadBudgetStore: vi.fn(() => store),
  saveBudgetStore: (...args: unknown[]) => saveBudgetStoreSpy(...args),
  saveCSVForMonth: (...args: unknown[]) => saveCSVForMonthSpy(...args),
}))

vi.mock('../budget/utils/csvParser', () => ({
  parseCSV: vi.fn((csv: string) => transactionFixtures[csv] ?? []),
}))

const renderTransactions = (initialEntry = '/transactions') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Transactions />
    </MemoryRouter>,
  )

beforeEach(() => {
  resetTransactionCache()
  saveBudgetStoreSpy.mockReset()
  saveCSVForMonthSpy.mockReset()
  saveBudgetStoreSpy.mockImplementation(nextStore => {
    store.csvs = nextStore.csvs
    store.configs = nextStore.configs
    store.years = nextStore.years
    store.categoryGroups = nextStore.categoryGroups
  })
  saveCSVForMonthSpy.mockImplementation((nextStore, monthKey, csv) => ({
    ...nextStore,
    csvs: {
      ...nextStore.csvs,
      [monthKey]: {
        month: monthKey,
        csv,
        uploadedAt: '2026-08-03T00:00:00.000Z',
      },
    },
  }))
  store.csvs = {
    '2026-08': { month: '2026-08', csv: csvMap.august, uploadedAt: '2026-08-02T12:00:00.000Z' },
    '2026-07': { month: '2026-07', csv: csvMap.july, uploadedAt: '2026-07-30T12:00:00.000Z' },
  }
  store.categoryGroups = baseCategoryGroups.map(group => ({ ...group, categories: [...group.categories] }))
  transactionFixtures[csvMap.august] = [...baseAugustTransactions]
  transactionFixtures[csvMap.july] = [...baseJulyTransactions]
  Object.defineProperty(URL, 'createObjectURL', {
    writable: true,
    value: vi.fn(() => 'blob:transactions'),
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    writable: true,
    value: vi.fn(),
  })
})

describe('Transactions branch coverage', () => {
  it('renders From and Until date summaries from independent URL params', async () => {
    const { unmount } = renderTransactions('/transactions?from=2026-08-01')
    expect(await screen.findByRole('button', { name: /Date/i })).toHaveTextContent('From Aug 1')

    unmount()
    resetTransactionCache()
    renderTransactions('/transactions?to=2026-07-30')

    expect(await screen.findByRole('button', { name: /Date/i })).toHaveTextContent('Until Jul 30')
  })

  it('closes the search panel when the trigger is clicked while it is already open', async () => {
    const user = userEvent.setup()
    renderTransactions()

    const searchButton = await screen.findByRole('button', { name: /Search/i })
    await user.click(searchButton)
    expect(screen.getByRole('searchbox', { name: 'Search transactions' })).toBeInTheDocument()

    await user.click(searchButton)
    expect(screen.queryByRole('searchbox', { name: 'Search transactions' })).not.toBeInTheDocument()
  })

  it('toggles all categories off and back on from the all-categories checkbox', async () => {
    const user = userEvent.setup()
    renderTransactions()

    await screen.findByText('Book Store')
    await user.click(screen.getByRole('button', { name: /^Category/i }))
    await user.click(screen.getByLabelText('All Categories'))
    expect(screen.getByText('None')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'No matching transactions' })).toBeInTheDocument()

    await user.click(screen.getByLabelText('All Categories'))
    expect(screen.getByRole('button', { name: /Category.*All Categories/i })).toBeInTheDocument()
    expect(screen.getByText('Book Store')).toBeInTheDocument()
  })

  it('supports section toggles and filter-search empty states', async () => {
    const user = userEvent.setup()
    renderTransactions()

    await screen.findByText('Book Store')
    await user.click(screen.getByRole('button', { name: /^Category/i }))
    await user.click(screen.getByLabelText('Expense'))

    expect(screen.queryByText('Book Store')).not.toBeInTheDocument()
    expect(screen.getByText('Payroll Deposit')).toBeInTheDocument()
    expect(screen.getByText('2 selected')).toBeInTheDocument()

    await user.type(screen.getByRole('searchbox', { name: 'Search categories' }), 'zzz')
    expect(screen.getByText('No matching categories')).toBeInTheDocument()
    expect(screen.queryByLabelText('All Categories')).not.toBeInTheDocument()
  })

  it('toggles an individual category group from its group checkbox', async () => {
    const user = userEvent.setup()
    renderTransactions()

    await screen.findByText('Book Store')
    await user.click(screen.getByRole('button', { name: /^Category/i }))
    await user.click(screen.getByLabelText('Spending'))

    expect(screen.queryByText('Book Store')).not.toBeInTheDocument()
    expect(screen.queryByText('Whole Foods Market')).not.toBeInTheDocument()
    expect(screen.getByText('Payroll Deposit')).toBeInTheDocument()
  })

  it('adds a category group back when it is toggled from an unselected state', async () => {
    const user = userEvent.setup()
    renderTransactions()

    await screen.findByText('Book Store')
    await user.click(screen.getByRole('button', { name: /^Category/i }))
    await user.click(screen.getByLabelText('All Categories'))
    await user.click(screen.getByLabelText('Spending'))

    expect(screen.getByText('Book Store')).toBeInTheDocument()
    expect(screen.getByText('Whole Foods Market')).toBeInTheDocument()
    expect(screen.queryByText('Payroll Deposit')).not.toBeInTheDocument()
  })

  it('executes category sort branches in both directions', async () => {
    const user = userEvent.setup()
    renderTransactions()

    await user.click(await screen.findByRole('button', { name: /Sort/i }))
    await user.click(screen.getByRole('button', { name: 'Category Z–A' }))

    let augustRows = within(
      screen.getByRole('heading', { name: 'August 2, 2026' }).closest('.txn-group') as HTMLElement,
    )
      .getAllByRole('listitem')
      .map(row => row.textContent)
    expect(augustRows[0]).toContain('Shopping')

    await user.click(screen.getByRole('button', { name: /Sort/i }))
    await user.click(screen.getByRole('button', { name: 'Category A–Z' }))

    augustRows = within(screen.getByRole('heading', { name: 'August 2, 2026' }).closest('.txn-group') as HTMLElement)
      .getAllByRole('listitem')
      .map(row => row.textContent)
    expect(augustRows[0]).toContain('Salary')
  })

  it('treats removed transactions as filtered results with zero active summary totals', async () => {
    const user = userEvent.setup()
    transactionFixtures[csvMap.august] = [
      ...baseAugustTransactions,
      { date: '2026-08-03', category: 'Hidden', amount: -50, description: 'Skipped Expense' },
    ]

    renderTransactions()

    await screen.findByText('Book Store')
    await user.click(screen.getByRole('button', { name: /^Category/i }))
    await user.click(screen.getByLabelText('All Categories'))
    await user.click(screen.getByLabelText('Hidden'))

    expect(screen.getByText('1 transaction')).toBeInTheDocument()
    expect(screen.getByText('Skipped Expense')).toBeInTheDocument()
    expect(screen.getByText('Total transactions').nextElementSibling).toHaveTextContent('0')
    expect(screen.getByText('Largest transaction').nextElementSibling).toHaveTextContent('—')
    expect(
      within(screen.getByRole('heading', { name: 'August 3, 2026' }).closest('.txn-group') as HTMLElement).getByText(
        '$0.00',
      ),
    ).toBeInTheDocument()
  })

  it('leaves the download URL empty when createObjectURL is unavailable', async () => {
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: undefined,
    })

    renderTransactions()

    await screen.findByText('Book Store')
    const downloadLink = document.querySelector('.txn-download-link') as HTMLAnchorElement | null
    expect(downloadLink).not.toBeNull()
    expect(downloadLink?.getAttribute('href') ?? '').toBe('')
  })

  it('clears draft date inputs and closes the date panel on cancel', async () => {
    const user = userEvent.setup()
    renderTransactions()

    await screen.findByText('Book Store')
    await user.click(screen.getByRole('button', { name: /Date/i }))

    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-08-01' } })
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-08-02' } })
    const dateDialog = screen.getByRole('dialog', { name: 'Date range picker' })
    await user.click(within(dateDialog).getAllByRole('button', { name: 'Clear' }).at(-1) as HTMLButtonElement)

    expect(screen.getByLabelText('Start date')).toHaveValue('')
    expect(screen.getByLabelText('End date')).toHaveValue('')

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog', { name: 'Date range picker' })).not.toBeInTheDocument()
  })

  it('applies date presets and clears start and end fields individually', async () => {
    const user = userEvent.setup()
    renderTransactions()

    await screen.findByText('Book Store')
    await user.click(screen.getByRole('button', { name: /Date/i }))
    const dateDialog = screen.getByRole('dialog', { name: 'Date range picker' })

    await user.click(within(dateDialog).getByRole('button', { name: 'Last 7 days' }))
    expect(screen.getByLabelText('Start date')).not.toHaveValue('')
    expect(screen.getByLabelText('End date')).not.toHaveValue('')

    await user.click(within(dateDialog).getAllByRole('button', { name: 'Clear' })[0])
    expect(screen.getByLabelText('Start date')).toHaveValue('')

    await user.click(within(dateDialog).getAllByRole('button', { name: 'Clear' })[0])
    expect(screen.getByLabelText('End date')).toHaveValue('')
  })

  it('closes the category editor without saving when the current category is chosen again', async () => {
    const user = userEvent.setup()
    renderTransactions()

    await user.click(await screen.findByRole('button', { name: 'Edit category for Book Store' }))
    await user.click(screen.getByRole('button', { name: 'Shopping' }))

    expect(saveCSVForMonthSpy).not.toHaveBeenCalled()
    expect(saveBudgetStoreSpy).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'Edit category for Book Store' })).not.toBeInTheDocument()
  })

  it('does not persist a reassignment when the transaction month CSV is missing', async () => {
    const user = userEvent.setup()
    renderTransactions()

    await user.click(await screen.findByRole('button', { name: 'Edit category for Book Store' }))
    delete store.csvs['2026-08']
    await user.click(screen.getByRole('button', { name: 'Dining' }))

    expect(saveCSVForMonthSpy).not.toHaveBeenCalled()
    expect(saveBudgetStoreSpy).not.toHaveBeenCalled()
  })

  it('does not persist a reassignment when no matching parsed transaction is found', async () => {
    const user = userEvent.setup()
    renderTransactions()

    await user.click(await screen.findByRole('button', { name: 'Edit category for Book Store' }))
    transactionFixtures[csvMap.august] = [
      { date: '2026-08-04', category: 'Salary', amount: 2500, description: 'Different Row' },
    ]
    await user.click(screen.getByRole('button', { name: 'Dining' }))

    expect(saveCSVForMonthSpy).not.toHaveBeenCalled()
    expect(saveBudgetStoreSpy).not.toHaveBeenCalled()
  })

  it('shows an empty state inside the category editor when its search has no matches', async () => {
    const user = userEvent.setup()
    renderTransactions()

    await user.click(await screen.findByRole('button', { name: 'Edit category for Book Store' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search categories' }), 'zzz')

    expect(screen.getByText('No matching categories')).toBeInTheDocument()
  })

  it('closes filter, date, and sort panels when clicking outside them', async () => {
    const user = userEvent.setup()
    renderTransactions()

    await user.click((await screen.findByText('All Categories')).closest('button') as HTMLButtonElement)
    fireEvent.mouseDown(screen.getByRole('heading', { name: 'Transactions' }))
    await waitFor(() => {
      expect(screen.queryByRole('group', { name: 'Category filters' })).not.toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Date/i }))
    fireEvent.mouseDown(screen.getByRole('heading', { name: 'Transactions' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Date range picker' })).not.toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Sort/i }))
    fireEvent.mouseDown(screen.getByRole('heading', { name: 'Transactions' }))
    await waitFor(() => {
      expect(screen.queryByRole('listbox', { name: 'Sort options' })).not.toBeInTheDocument()
    })
  })
})
