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
  Area: ({ name }: { name?: string }) => <div data-testid="area-series">{name}</div>,
  Line: ({ name }: { name?: string }) => <div data-testid="line-series">{name}</div>,
  XAxis: ({ ticks = [], tickFormatter }: { ticks?: number[]; tickFormatter?: (value: number) => string }) => (
    <div
      data-testid="x-axis"
      data-first-tick={tickFormatter ? tickFormatter(ticks[0] ?? 1) : ''}
      data-last-tick={tickFormatter ? tickFormatter(ticks[ticks.length - 1] ?? 1) : ''}
    />
  ),
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => null,
  Tooltip: () => <div data-testid="chart-tooltip" />,
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

const comparisonStore: BudgetStore = {
  ...mockStore,
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
    '2025-07': {
      month: '2025-07',
      csv: 'Date,Category,Amount\n2025-07-01,Groceries,-25\n2025-07-15,Rent,-1500',
      uploadedAt: '',
    },
    '2025-06': {
      month: '2025-06',
      csv: 'Date,Category,Amount\n2025-06-01,Groceries,-75\n2025-06-15,Rent,-1800',
      uploadedAt: '',
    },
  },
}

const currentMonthStore: BudgetStore = {
  ...mockStore,
  csvs: {
    '2026-08': {
      month: '2026-08',
      csv: 'Date,Category,Amount\n2026-08-01,Groceries,-60\n2026-08-10,Rent,-2000\n2026-08-11,Salary,4000',
      uploadedAt: '',
    },
    '2026-07': mockStore.csvs['2026-07'],
  },
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

  it('opens the comparison dropdown from the empty state and updates the selected mode', async () => {
    const user = userEvent.setup()
    mockedLoadBudgetStore.mockResolvedValueOnce(emptyStore)

    renderPeek()

    const trigger = await screen.findByRole('button', { name: /spending comparison mode/i })
    await user.click(trigger)
    await user.click(screen.getByRole('option', { name: 'Last month vs. average month' }))

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(trigger).toHaveTextContent('Last month vs. average month')
  })

  it('falls back to the CTA state when loading the budget store fails', async () => {
    mockedLoadBudgetStore.mockRejectedValueOnce(new Error('boom'))

    renderPeek()

    expect(await screen.findByRole('button', { name: 'Add budget data →' })).toBeInTheDocument()
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

  it('shows current-month wording and the month-day tick labels when the latest month is in progress', async () => {
    mockedLoadBudgetStore.mockResolvedValueOnce(currentMonthStore)

    renderPeek()

    await waitFor(() => expect(screen.getByText('$2,060.00 this month')).toBeInTheDocument())
    expect(screen.getByTestId('x-axis')).toHaveAttribute('data-first-tick', 'Day 1')
    expect(screen.getByTestId('x-axis')).toHaveAttribute('data-last-tick', 'Day 31')
  })

  it('renders the last-year comparison labels when that mode is selected', async () => {
    const user = userEvent.setup()
    mockedLoadBudgetStore.mockResolvedValueOnce(comparisonStore)

    renderPeek()

    await user.click(await screen.findByRole('button', { name: /spending comparison mode/i }))
    await user.click(screen.getByRole('option', { name: 'Last month vs. last year' }))

    expect(await screen.findAllByText('Last year')).toHaveLength(2)
    expect(screen.getAllByText('Last month')).toHaveLength(2)
  })

  it('renders the average-month comparison labels when that mode is selected', async () => {
    const user = userEvent.setup()
    mockedLoadBudgetStore.mockResolvedValueOnce(comparisonStore)

    renderPeek()

    await user.click(await screen.findByRole('button', { name: /spending comparison mode/i }))
    await user.click(screen.getByRole('option', { name: 'Last month vs. average month' }))

    expect(await screen.findAllByText('Average month')).toHaveLength(2)
    expect(screen.getAllByText('Last month')).toHaveLength(2)
  })

  it('renders the yearly comparison labels and subtitle when that mode is selected', async () => {
    const user = userEvent.setup()
    mockedLoadBudgetStore.mockResolvedValueOnce(comparisonStore)

    renderPeek()

    await user.click(await screen.findByRole('button', { name: /spending comparison mode/i }))
    await user.click(screen.getByRole('option', { name: 'This year vs. last year' }))

    expect(await screen.findByText('$4,150.00 this year')).toBeInTheDocument()
    expect(screen.getAllByText('This year')).toHaveLength(2)
    expect(screen.getAllByText('Last year')).toHaveLength(2)
  })
})
