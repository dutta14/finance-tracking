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
})
