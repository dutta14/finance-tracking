import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BalanceCharts from './BalanceCharts'
import { makeAccount } from '../../test/factories'
import type { Account, BalanceEntry } from './types'

vi.mock('recharts', async () => {
  const OrigModule = await vi.importActual<Record<string, unknown>>('recharts')
  return {
    ...OrigModule,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
  }
})

function buildBalanceMap(entries: { accountId: number; month: string; balance: number }[]) {
  const map = new Map<string, number>()
  for (const e of entries) map.set(`${e.accountId}:${e.month}`, e.balance)
  return map
}

const fiAcct = makeAccount({ id: 1, name: '401k', goalType: 'fi', type: 'retirement', nature: 'asset' })
const gwAcct = makeAccount({ id: 2, name: 'Checking', goalType: 'gw', type: 'liquid', nature: 'asset' })
const liabilityAcct = makeAccount({ id: 3, name: 'Mortgage', goalType: 'gw', type: 'illiquid', nature: 'liability' })

const months = ['2024-03', '2024-02', '2024-01']
const entries = [
  { accountId: 1, month: '2024-01', balance: 5000 },
  { accountId: 2, month: '2024-01', balance: 1000 },
  { accountId: 3, month: '2024-01', balance: -3000 },
  { accountId: 1, month: '2024-02', balance: 5500 },
  { accountId: 2, month: '2024-02', balance: 1200 },
  { accountId: 3, month: '2024-02', balance: -2800 },
  { accountId: 1, month: '2024-03', balance: 6000 },
  { accountId: 2, month: '2024-03', balance: 1500 },
  { accountId: 3, month: '2024-03', balance: -2500 },
]
const balanceMap = buildBalanceMap(entries)
const accounts: Account[] = [fiAcct, gwAcct, liabilityAcct]
const balances: BalanceEntry[] = entries.map((e, i) => ({ id: i + 1, ...e }))

function makeProps(overrides: Partial<React.ComponentProps<typeof BalanceCharts>> = {}) {
  return {
    accounts,
    balances,
    allMonths: months,
    balanceMap,
    ...overrides,
  }
}

describe('BalanceCharts', () => {
  it('renders chart type picker with all three options', () => {
    render(<BalanceCharts {...makeProps()} />)
    expect(screen.getByRole('button', { name: 'FI vs GW' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Net Worth' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Assets vs Liabilities' })).toBeInTheDocument()
  })

  it('renders the chart container when data is present', () => {
    render(<BalanceCharts {...makeProps()} />)
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
  })

  it('shows empty message when no data matches the selected range', () => {
    render(
      <BalanceCharts
        {...makeProps({
          allMonths: [],
          balanceMap: new Map(),
        })}
      />,
    )
    expect(screen.getByText('No data for the selected range')).toBeInTheDocument()
  })

  it('switches to Net Worth chart type when clicked', async () => {
    const user = userEvent.setup()
    render(<BalanceCharts {...makeProps()} />)

    const netWorthBtn = screen.getByRole('button', { name: 'Net Worth' })
    await user.click(netWorthBtn)
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    expect(netWorthBtn).toHaveAttribute('aria-pressed', 'true')
    // Previously active button should not be pressed
    expect(screen.getByRole('button', { name: 'FI vs GW' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('switches to Assets vs Liabilities chart type when clicked', async () => {
    const user = userEvent.setup()
    render(<BalanceCharts {...makeProps()} />)

    const avlBtn = screen.getByRole('button', { name: 'Assets vs Liabilities' })
    await user.click(avlBtn)
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    expect(avlBtn).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'FI vs GW' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('renders date filter buttons', () => {
    render(<BalanceCharts {...makeProps()} />)
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'YTD' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Last 12 mo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Year-End' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Custom' })).toBeInTheDocument()
  })

  it('shows custom range pickers when Custom date filter is selected', async () => {
    const user = userEvent.setup()
    render(<BalanceCharts {...makeProps()} />)

    await user.click(screen.getByRole('button', { name: 'Custom' }))
    expect(screen.getByText('to')).toBeInTheDocument()
  })

  it('filters to Year-End months only', async () => {
    const user = userEvent.setup()
    const yearEndMonths = ['2024-12', '2024-06', '2023-12']
    const yearEndMap = buildBalanceMap([
      { accountId: 1, month: '2024-12', balance: 7000 },
      { accountId: 1, month: '2024-06', balance: 6500 },
      { accountId: 1, month: '2023-12', balance: 4000 },
    ])
    render(
      <BalanceCharts
        {...makeProps({
          allMonths: yearEndMonths,
          balanceMap: yearEndMap,
        })}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Year-End' }))
    // Chart should still render (just fewer data points)
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
  })

  it('handles accounts with no balances gracefully', () => {
    render(
      <BalanceCharts
        {...makeProps({
          balanceMap: new Map(),
        })}
      />,
    )
    // Should still render chart container (data points will be 0)
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
  })

  it('renders with a single account', () => {
    const singleMap = buildBalanceMap([{ accountId: 1, month: '2024-01', balance: 5000 }])
    render(
      <BalanceCharts
        {...makeProps({
          accounts: [fiAcct],
          balances: [{ id: 1, accountId: 1, month: '2024-01', balance: 5000 }],
          allMonths: ['2024-01'],
          balanceMap: singleMap,
        })}
      />,
    )
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    // Chart type picker still renders all options with single account
    expect(screen.getByRole('button', { name: 'FI vs GW' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Net Worth' })).toBeInTheDocument()
  })

  it('renders YTD date filter correctly', async () => {
    const user = userEvent.setup()
    // YTD filters to current year, so we need data in the current year
    const yr = new Date().getFullYear().toString()
    const ytdMonths = [`${yr}-03`, `${yr}-02`, `${yr}-01`]
    const ytdEntries = [
      { accountId: 1, month: `${yr}-01`, balance: 5000 },
      { accountId: 1, month: `${yr}-02`, balance: 5500 },
      { accountId: 1, month: `${yr}-03`, balance: 6000 },
    ]
    const ytdMap = buildBalanceMap(ytdEntries)
    render(<BalanceCharts {...makeProps({ allMonths: ytdMonths, balanceMap: ytdMap })} />)

    await user.click(screen.getByRole('button', { name: 'YTD' }))
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
  })

  it('renders Last 12 mo date filter correctly', async () => {
    const user = userEvent.setup()
    render(<BalanceCharts {...makeProps()} />)

    await user.click(screen.getByRole('button', { name: 'Last 12 mo' }))
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
  })

  it('shows custom range with year and month selectors', async () => {
    const user = userEvent.setup()
    render(<BalanceCharts {...makeProps()} />)

    await user.click(screen.getByRole('button', { name: 'Custom' }))

    // Should show From and To selectors
    expect(screen.getByText('to')).toBeInTheDocument()
    // Year select options
    const yearOptions = screen.getAllByRole('option', { name: '2024' })
    expect(yearOptions.length).toBeGreaterThan(0)
  })

  it('filters data by custom from-year selection', async () => {
    const user = userEvent.setup()
    render(<BalanceCharts {...makeProps()} />)

    await user.click(screen.getByRole('button', { name: 'Custom' }))

    // Select year in the first "From" year dropdown
    const yearSelects = screen.getAllByRole('combobox')
    await user.selectOptions(yearSelects[0], '2024')

    // Chart should render with filtered data
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
  })

  it('filters data by custom from-month selection', async () => {
    const user = userEvent.setup()
    render(<BalanceCharts {...makeProps()} />)

    await user.click(screen.getByRole('button', { name: 'Custom' }))

    // First set from year, then from month
    const selects = screen.getAllByRole('combobox')
    await user.selectOptions(selects[0], '2024')
    await user.selectOptions(selects[1], '02')

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
  })

  it('filters data by custom to-year and to-month selection', async () => {
    const user = userEvent.setup()
    render(<BalanceCharts {...makeProps()} />)

    await user.click(screen.getByRole('button', { name: 'Custom' }))

    const selects = screen.getAllByRole('combobox')
    // To year (3rd select) and To month (4th select)
    await user.selectOptions(selects[2], '2024')
    await user.selectOptions(selects[3], '02')

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
  })

  it('shows empty message when custom range excludes all data', async () => {
    const user = userEvent.setup()
    // allMonths are 2024-01 to 2024-03, set custom range to 2025
    const props = makeProps({ allMonths: ['2024-01'] })
    render(<BalanceCharts {...props} />)

    await user.click(screen.getByRole('button', { name: 'Custom' }))

    const selects = screen.getAllByRole('combobox')
    // Set from year to later than any data
    await user.selectOptions(selects[0], '2024')
    await user.selectOptions(selects[1], '12')

    // Depending on data, may show empty or chart
    // With just 2024-01 data and from=2024-12, should be empty
    expect(screen.getByText('No data for the selected range')).toBeInTheDocument()
  })

  it('marks the active chart type button as aria-pressed', () => {
    render(<BalanceCharts {...makeProps()} />)
    expect(screen.getByRole('button', { name: 'FI vs GW' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Net Worth' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Assets vs Liabilities' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('renders net worth chart with single line when Net Worth type is selected', async () => {
    const user = userEvent.setup()
    render(<BalanceCharts {...makeProps()} />)
    await user.click(screen.getByRole('button', { name: 'Net Worth' }))
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
  })

  it('renders bar chart when Assets vs Liabilities type is selected', async () => {
    const user = userEvent.setup()
    render(<BalanceCharts {...makeProps()} />)
    await user.click(screen.getByRole('button', { name: 'Assets vs Liabilities' }))
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
  })
})
