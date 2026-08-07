import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Transactions, { resetTransactionCache } from './Transactions'
import type { CategoryGroup } from '../budget/types'

const csvMap: Record<string, string> = {
  august: 'csv-august',
  july: 'csv-july',
}

const categoryGroups = [
  { id: 'income', name: 'Income', categories: ['Salary', 'Bonus'], type: 'income' as const },
  { id: 'spending', name: 'Spending', categories: ['Groceries', 'Shopping', 'Dining', 'Transport'] },
  { id: 'removed', name: 'Remove from Budget', categories: ['Hidden'] },
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
  categoryGroups,
}

const transactionFixtures = {
  [csvMap.august]: [...baseAugustTransactions],
  [csvMap.july]: [...baseJulyTransactions],
}

vi.mock('../budget/utils/budgetStorage', () => ({
  loadBudgetStore: vi.fn(() => store),
  getGlobalCategoryGroups: vi.fn(() => store.categoryGroups),
  saveBudgetStore: vi.fn((nextStore: typeof store) => {
    store.csvs = nextStore.csvs
    store.configs = nextStore.configs
    store.years = nextStore.years
    store.categoryGroups = nextStore.categoryGroups
    window.dispatchEvent(new Event('budget-changed'))
  }),
  saveCSVForMonth: vi.fn((nextStore: typeof store, monthKey: string, csv: string) => ({
    ...nextStore,
    csvs: {
      ...nextStore.csvs,
      [monthKey]: {
        month: monthKey,
        csv,
        uploadedAt: '2026-08-03T00:00:00.000Z',
      },
    },
  })),
}))

vi.mock('../budget/utils/csvParser', async () => {
  const actual = await vi.importActual<typeof import('../budget/utils/csvParser')>('../budget/utils/csvParser')

  return {
    ...actual,
    parseCSV: vi.fn(
      (csv: string) => transactionFixtures[csv as keyof typeof transactionFixtures] ?? actual.parseCSV(csv),
    ),
  }
})

const createObjectURL = vi.fn(() => 'blob:transactions')
const revokeObjectURL = vi.fn()

const renderTransactions = (initialEntry = '/transactions') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Transactions />
    </MemoryRouter>,
  )

const openSearchPopover = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: /Search/i }))
  return screen.getByRole('searchbox', { name: 'Search transactions' })
}

beforeEach(() => {
  localStorage.clear()
  resetTransactionCache()
  store.csvs = {
    '2026-08': { month: '2026-08', csv: csvMap.august, uploadedAt: '2026-08-02T12:00:00.000Z' },
    '2026-07': { month: '2026-07', csv: csvMap.july, uploadedAt: '2026-07-30T12:00:00.000Z' },
  }
  store.categoryGroups = categoryGroups.map(group => ({ ...group, categories: [...group.categories] }))
  transactionFixtures[csvMap.august] = [...baseAugustTransactions]
  transactionFixtures[csvMap.july] = [...baseJulyTransactions]
  createObjectURL.mockClear()
  revokeObjectURL.mockClear()
  Object.defineProperty(URL, 'createObjectURL', {
    writable: true,
    value: createObjectURL,
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    writable: true,
    value: revokeObjectURL,
  })
})

describe('Transactions', () => {
  it('renders grouped transactions with daily totals, result count, and a download link', async () => {
    renderTransactions()

    expect(await screen.findByRole('heading', { name: 'Transactions' })).toBeInTheDocument()
    expect(screen.getByText('6 transactions')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'August 2, 2026' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'July 30, 2026' })).toBeInTheDocument()
    expect(screen.getByText('Book Store')).toBeInTheDocument()
    expect(screen.getByText('+$2,374.45')).toBeInTheDocument()

    const downloadLink = screen.getByRole('link', { name: 'Download CSV' })
    expect(downloadLink).toHaveAttribute('href', 'blob:transactions')
    expect(downloadLink).toHaveAttribute('download')
  })

  it('filters transactions by search across description, category, and amount', async () => {
    const user = userEvent.setup()
    renderTransactions()

    const searchInput = await openSearchPopover(user)
    await user.type(searchInput, 'bonus')
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    expect(screen.getByText('Performance Bonus')).toBeInTheDocument()
    expect(screen.queryByText('Book Store')).not.toBeInTheDocument()
    expect(screen.getByText('1 transaction')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Search/i }))
    const updatedSearchInput = screen.getByRole('searchbox', { name: 'Search transactions' })
    await user.clear(updatedSearchInput)
    await user.type(updatedSearchInput, '82.45')
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    expect(screen.getByText('Whole Foods Market')).toBeInTheDocument()
    expect(screen.queryByText('Performance Bonus')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Search/i }))
    const amountSearchInput = screen.getByRole('searchbox', { name: 'Search transactions' })
    await user.clear(amountSearchInput)
    await user.type(amountSearchInput, 'grocer')
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    expect(screen.getByText('Whole Foods Market')).toBeInTheDocument()
    expect(screen.queryByText('Performance Bonus')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Search/i })).toHaveTextContent('grocer')
  })

  it('filters transactions by inclusive date range', async () => {
    const user = userEvent.setup()
    renderTransactions()

    await user.click(await screen.findByRole('button', { name: /Date/i }))
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-08-01' } })
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-08-02' } })
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() => {
      expect(screen.getByText('Payroll Deposit')).toBeInTheDocument()
      expect(screen.getByText('Whole Foods Market')).toBeInTheDocument()
      expect(screen.queryByText('Performance Bonus')).not.toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'July 30, 2026' })).not.toBeInTheDocument()
    })
  })

  it('filters transactions by selected categories', async () => {
    const user = userEvent.setup()
    renderTransactions()

    await user.click((await screen.findByText('All Categories')).closest('button') as HTMLButtonElement)
    await user.click(screen.getByLabelText('Salary'))

    expect(screen.queryByText('Payroll Deposit')).not.toBeInTheDocument()
    expect(screen.getByText('Book Store')).toBeInTheDocument()
    expect(screen.getByText('Performance Bonus')).toBeInTheDocument()
  })

  it('preselects categories from the URL query param', async () => {
    renderTransactions('/transactions?categories=Groceries%2CDining')

    expect(await screen.findByRole('heading', { name: 'Transactions' })).toBeInTheDocument()
    expect(await screen.findByText('2 transactions')).toBeInTheDocument()
    expect(screen.getByText('2 selected')).toBeInTheDocument()
    expect(screen.getByText('Whole Foods Market')).toBeInTheDocument()
    expect(screen.getByText('Dinner Out')).toBeInTheDocument()
    expect(screen.queryByText('Payroll Deposit')).not.toBeInTheDocument()
    expect(screen.queryByText('Book Store')).not.toBeInTheDocument()
    expect(screen.queryByText('Train Pass')).not.toBeInTheDocument()
  })

  it('shows positive-only categories under Income even when expense Others also lists them', async () => {
    const user = userEvent.setup()
    store.categoryGroups = [
      { id: 'income', name: 'Income', categories: ['Salary', 'Bonus'], type: 'income' },
      { id: 'spending', name: 'Spending', categories: ['Groceries', 'Shopping', 'Dining', 'Transport'] },
      { id: 'others', name: 'Others', categories: [] },
      { id: 'removed', name: 'Remove from Budget', categories: ['Hidden'] },
      { id: 'capital-income', name: 'Capital Income', categories: ['Capital Gains', 'Dividends'], type: 'income' },
    ]
    transactionFixtures[csvMap.august] = [
      ...baseAugustTransactions,
      { date: '2026-08-03', category: 'Capital Gains', amount: 500, description: 'Brokerage Gain' },
    ]
    transactionFixtures[csvMap.july] = [
      ...baseJulyTransactions,
      { date: '2026-07-28', category: 'Dividends', amount: 125, description: 'Dividend Payout' },
    ]

    renderTransactions()

    await user.click((await screen.findByText('All Categories')).closest('button') as HTMLButtonElement)

    const filterPanel = screen.getByRole('group', { name: 'Category filters' })
    const incomeGroup = within(filterPanel).getByText('Capital Income').closest('.txn-filter-group')

    expect(incomeGroup).toBeTruthy()
    expect(within(incomeGroup as HTMLElement).getByLabelText('Capital Gains')).toBeInTheDocument()
    expect(within(incomeGroup as HTMLElement).getByLabelText('Dividends')).toBeInTheDocument()
  })

  it('sorts transactions within a date group by lowest amount first', async () => {
    const user = userEvent.setup()
    renderTransactions()

    await user.click(await screen.findByRole('button', { name: /Sort/i }))
    await user.click(screen.getByRole('button', { name: 'Lowest amount' }))

    const augustGroup = screen.getByRole('heading', { name: 'August 2, 2026' }).closest('.txn-group')
    expect(augustGroup).toBeTruthy()

    const rows = within(augustGroup as HTMLElement).getAllByRole('listitem')
    expect(within(rows[0]).getByText('Book Store')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Payroll Deposit')).toBeInTheDocument()
  })

  it('shows oldest date groups first when sorting by oldest first', async () => {
    const user = userEvent.setup()
    renderTransactions()

    await user.click(await screen.findByRole('button', { name: /Sort/i }))
    await user.click(screen.getByRole('button', { name: 'Oldest first' }))

    const groups = screen.getAllByRole('heading', { level: 2 }).map(node => node.textContent)
    expect(groups.slice(0, 4)).toEqual(['July 29, 2026', 'July 30, 2026', 'August 1, 2026', 'August 2, 2026'])
  })

  it('shows summary stats computed from filtered transactions', async () => {
    const user = userEvent.setup()
    renderTransactions()

    await user.type(await openSearchPopover(user), 'train')
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    const summary = screen.getByRole('heading', { name: 'Summary' }).closest('.txn-summary-card')
    expect(summary).toBeTruthy()

    expect(within(summary as HTMLElement).getByText('1')).toBeInTheDocument()
    expect(within(summary as HTMLElement).getAllByText('$19.99').length).toBeGreaterThanOrEqual(3)
    expect(within(summary as HTMLElement).getAllByText('July 29, 2026')).toHaveLength(2)
    expect(within(summary as HTMLElement).getByText('$0.00')).toBeInTheDocument()
    expect(within(summary as HTMLElement).queryByText('+$2,500.00')).not.toBeInTheDocument()
  })

  it('renders each row as description, category, and amount columns', async () => {
    renderTransactions()

    const row = (await screen.findByText('Book Store')).closest('.txn-row')
    expect(row).toBeTruthy()
    expect(row?.querySelector('.txn-row-content')).toBeNull()
    expect(within(row as HTMLElement).getByText('Shopping')).toBeInTheDocument()
    expect(within(row as HTMLElement).getByText('-$125.55')).toBeInTheDocument()
  })

  it('shows the no-transactions empty state when there is no stored data', async () => {
    store.csvs = {}
    renderTransactions()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'No transactions yet' })).toBeInTheDocument()
    })
    expect(screen.getByText('Import a monthly CSV on the Budget page to see transactions here.')).toBeInTheDocument()
  })

  it('shows a filter-empty state and clears filters when requested', async () => {
    const user = userEvent.setup()
    renderTransactions()

    await user.type(await openSearchPopover(user), 'missing merchant')
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'No matching transactions' })).toBeInTheDocument()
    })
    expect(screen.getByText('Try a different search or clear your filters.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))

    expect(screen.getByText('Book Store')).toBeInTheDocument()
    expect(screen.getByText('6 transactions')).toBeInTheDocument()
  })

  it('cancels draft search changes and allows clearing the search input', async () => {
    const user = userEvent.setup()
    renderTransactions()

    const searchInput = await openSearchPopover(user)
    await user.type(searchInput, 'bonus')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText('6 transactions')).toBeInTheDocument()
    expect(screen.queryByRole('searchbox', { name: 'Search transactions' })).not.toBeInTheDocument()

    const reopenedSearchInput = await openSearchPopover(user)
    expect(reopenedSearchInput).toHaveValue('')
    await user.type(reopenedSearchInput, 'train')
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.queryByRole('searchbox', { name: 'Search transactions' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Search/i })).not.toHaveTextContent('train')

    const clearedSearchInput = await openSearchPopover(user)
    expect(clearedSearchInput).toHaveValue('')
  })

  it('uses the PM fallback when description is empty', async () => {
    transactionFixtures[csvMap.august][0] = {
      ...transactionFixtures[csvMap.august][0],
      description: ' ',
    }
    renderTransactions()

    expect(await screen.findByText('No description')).toBeInTheDocument()
  })

  it('reassigns a transaction category from the inline editor and persists the updated CSV', async () => {
    const user = userEvent.setup()
    renderTransactions()

    await user.click(await screen.findByRole('button', { name: 'Edit category for Book Store' }))

    expect(screen.getByRole('dialog', { name: 'Edit category for Book Store' })).toBeInTheDocument()
    expect(screen.getByText('Spending')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Dining' }))

    await waitFor(() => {
      expect(screen.getAllByText('Dining').length).toBeGreaterThan(0)
    })
    expect(screen.queryByText('Shopping')).not.toBeInTheDocument()
    expect(store.csvs['2026-08'].csv).toContain('"2026-08-02","Dining","-125.55","Book Store"')
  })

  it('closes the inline category editor when clicking outside', async () => {
    const user = userEvent.setup()
    renderTransactions()

    await user.click(await screen.findByRole('button', { name: 'Edit category for Book Store' }))
    expect(screen.getByRole('dialog', { name: 'Edit category for Book Store' })).toBeInTheDocument()

    await user.click(screen.getByRole('heading', { name: 'Transactions' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Edit category for Book Store' })).not.toBeInTheDocument()
    })
  })
})
