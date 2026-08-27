import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ComponentProps, ReactNode } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { BudgetStore } from '../budget/types'
import type { FileStore } from '../../utils/fileStoreTypes'
import SpendingPeek from './SpendingPeek'

/* ─── Mock dependencies ─── */

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ComposedChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Area: () => null,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}))

vi.mock('../budget/utils/budgetStorage', () => ({
  loadBudgetStore: vi.fn(),
  getIncomeGroups: vi.fn(),
}))

vi.mock('../budget/utils/csvParser', () => ({
  parseCSV: vi.fn(),
}))

vi.mock('../data/types', () => ({
  formatMonth: vi.fn(),
}))

vi.mock('../../styles/Home.css', () => ({}))

import { loadBudgetStore, getIncomeGroups } from '../budget/utils/budgetStorage'
import { parseCSV } from '../budget/utils/csvParser'
import { formatMonth } from '../data/types'

const mockedLoadBudgetStore = vi.mocked(loadBudgetStore)
const mockedGetIncomeGroups = vi.mocked(getIncomeGroups)
const mockedParseCSV = vi.mocked(parseCSV)
const mockedFormatMonth = vi.mocked(formatMonth)

const mockStore: BudgetStore = {
  csvs: {
    '2026-07': {
      month: '2026-07',
      csv: 'Date,Category,Amount\n2026-07-01,Groceries,-50\n2026-07-15,Rent,-2000',
      uploadedAt: '',
    },
    '2026-06': {
      month: '2026-06',
      csv: 'Date,Category,Amount\n2026-06-01,Groceries,-100\n2026-06-15,Rent,-2000',
      uploadedAt: '',
    },
  },
  configs: {},
  years: [2026],
  categoryGroups: [
    { id: 'housing', name: 'Housing', categories: ['Rent'] },
    { id: 'food', name: 'Food', categories: ['Groceries'] },
    { id: 'others', name: 'Others', categories: [] },
    { id: 'removed', name: 'Remove from Budget', categories: [] },
    { id: 'income-others', name: 'Others', categories: ['Salary'], type: 'income' },
  ],
}

const emptyStore: BudgetStore = {
  ...mockStore,
  csvs: {},
}

const mockFileStore = {} as FileStore
const mockNavigate = vi.fn()

function renderPeek(props: Partial<ComponentProps<typeof SpendingPeek>> = {}) {
  return render(
    <SpendingPeek fileStore={mockFileStore} hasBudgetData budgetDataLoaded onNavigate={mockNavigate} {...props} />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-08-15T00:00:00Z'))

  mockedLoadBudgetStore.mockResolvedValue(mockStore)
  mockedGetIncomeGroups.mockReturnValue([
    { id: 'income-others', name: 'Others', categories: ['Salary'], type: 'income' },
  ])
  mockedParseCSV.mockImplementation((csv: string) => {
    const lines = csv.trim().split('\n').slice(1)
    return lines.map(line => {
      const [date, category, amount] = line.split(',')
      return { date, category, amount: parseFloat(amount) }
    })
  })
  mockedFormatMonth.mockImplementation((key: string) => {
    const [year, month] = key.split('-')
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${names[parseInt(month, 10) - 1]} ${year}`
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('SpendingPeek', () => {
  it('shows a loading state with a disabled dropdown trigger', () => {
    mockedLoadBudgetStore.mockReturnValueOnce(new Promise(() => {}))
    renderPeek({ budgetDataLoaded: false })

    expect(screen.getByText('Loading spending…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /last month vs\. prior month/i })).toBeDisabled()
  })

  it('shows an add budget data CTA when no budget data is available', async () => {
    const user = userEvent.setup()
    renderPeek({ hasBudgetData: false })

    await waitFor(() => expect(screen.getByRole('button', { name: 'Add budget data →' })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Add budget data →' }))
    expect(mockNavigate).toHaveBeenCalledTimes(1)
  })

  it('shows the empty state when the budget store has no CSV data', async () => {
    mockedLoadBudgetStore.mockResolvedValueOnce(emptyStore)

    renderPeek()

    await waitFor(() => expect(screen.getByRole('button', { name: 'Add budget data →' })).toBeInTheDocument())
    expect(screen.getByText(/upload budget csvs to see how your spending accumulates/i)).toBeInTheDocument()
  })

  it('renders the spending chart and budget link when store data exists', async () => {
    renderPeek()

    await waitFor(() => expect(screen.getByRole('heading', { level: 3, name: /spending/i })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'View Budget →' })).toBeInTheDocument()
  })

  it('opens the dropdown menu on click and shows four options', async () => {
    const user = userEvent.setup()
    renderPeek()

    await waitFor(() => expect(screen.getByRole('button', { name: /spending comparison mode/i })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /spending comparison mode/i }))

    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(4)
  })

  it('selects a dropdown mode and closes the menu', async () => {
    const user = userEvent.setup()
    renderPeek()

    await waitFor(() => expect(screen.getByRole('button', { name: /spending comparison mode/i })).toBeInTheDocument())

    const trigger = screen.getByRole('button', { name: /spending comparison mode/i })
    await user.click(trigger)
    await user.click(screen.getByRole('option', { name: 'This year vs. last year' }))

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(trigger).toHaveTextContent('This year vs. last year')
  })

  it('closes the dropdown when clicking outside', async () => {
    const user = userEvent.setup()
    renderPeek()

    await waitFor(() => expect(screen.getByRole('button', { name: /spending comparison mode/i })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /spending comparison mode/i }))
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)

    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
  })

  it('calls onNavigate when clicking the View Budget link', async () => {
    const user = userEvent.setup()
    renderPeek()

    await waitFor(() => expect(screen.getByRole('button', { name: 'View Budget →' })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'View Budget →' }))
    expect(mockNavigate).toHaveBeenCalledTimes(1)
  })

  it('shows the subtitle with the spending total', async () => {
    renderPeek()

    await waitFor(() => expect(screen.getByText('$2,050.00 last month')).toBeInTheDocument())
  })
})
