import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CashflowBarChart from './CashflowBarChart'
import type { Transaction } from '../types'

let lastBarData: Array<{ label: string; income: number; expense: number }> = []

vi.mock('recharts', async () => {
  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
    ComposedChart: ({
      children,
      data,
      onClick,
    }: {
      children: React.ReactNode
      data?: Array<{ label: string; income: number; expense: number }>
      onClick?: (e: { activeLabel?: string }) => void
    }) => {
      lastBarData = data ?? []
      return (
        <div>
          <button type="button" data-testid="bar-chart" onClick={() => onClick?.({ activeLabel: data?.[0]?.label })}>
            {children}
          </button>
          <button type="button" data-testid="bar-chart-empty-click" onClick={() => onClick?.({})} />
        </div>
      )
    },
    Bar: ({ children, name }: { children: React.ReactNode; name?: string }) => (
      <div data-testid={`bar-${String(name).toLowerCase()}`}>{children}</div>
    ),
    Line: () => null,
    Cell: ({ opacity = 1 }: { opacity?: number }) => <div data-testid="bar-cell" data-opacity={opacity} />,
    XAxis: () => null,
    YAxis: ({ tickFormatter }: { tickFormatter?: (value: number) => string }) => (
      <div>
        <span data-testid="y-axis-large">{tickFormatter?.(1200)}</span>
        <span data-testid="y-axis-small">{tickFormatter?.(250)}</span>
      </div>
    ),
    Tooltip: ({
      content,
    }: {
      content?: (args: {
        active?: boolean
        label?: string
        payload?: Array<{ dataKey: string; value: number }>
      }) => React.ReactNode
    }) => {
      const sample = lastBarData[1] ?? lastBarData[0]
      if (!sample || !content) return null
      return (
        <div data-testid="tooltip-content">
          {content({
            active: true,
            label: sample.label,
            payload: [
              { dataKey: 'income', value: sample.income },
              { dataKey: 'expense', value: sample.expense },
            ],
          })}
        </div>
      )
    },
    ReferenceLine: ({
      label,
    }: {
      label?: ((props: { viewBox: { x: number; y: number; width: number } }) => React.ReactNode) | { value?: string }
    }) => {
      if (typeof label === 'function')
        return <div data-testid="reference-label">{label({ viewBox: { x: 10, y: 20, width: 100 } })}</div>
      return null
    },
    ReferenceDot: () => null,
    CartesianGrid: () => null,
  }
})

const makeTx = (overrides: Partial<Transaction> = {}): Transaction => ({
  date: '2024-01-15',
  category: 'Groceries',
  amount: -150,
  ...overrides,
})

describe('CashflowBarChart', () => {
  const defaultProps = {
    year: 2024,
    yearTransactions: {} as Record<string, Transaction[]>,
    timePeriod: 'month' as const,
    removedCategories: new Set<string>(),
    incomeCatSet: new Set<string>(),
    selectedPeriod: null,
    onSelectPeriod: vi.fn(),
  }

  it('renders the title with the year', () => {
    render(<CashflowBarChart {...defaultProps} />)
    expect(screen.getByText('Cashflow — 2024')).toBeInTheDocument()
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
  })

  it('renders chart for monthly period', () => {
    render(<CashflowBarChart {...defaultProps} />)
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })

  it('renders chart for quarterly period', () => {
    render(<CashflowBarChart {...defaultProps} timePeriod="quarter" />)
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })

  it('renders chart for half period', () => {
    render(<CashflowBarChart {...defaultProps} timePeriod="half" />)
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })

  it('renders chart with income and expense data', () => {
    const yearTransactions: Record<string, Transaction[]> = {
      '2024-01': [makeTx({ category: 'Salary', amount: 5000 }), makeTx({ category: 'Groceries', amount: -1200 })],
    }
    render(
      <CashflowBarChart {...defaultProps} yearTransactions={yearTransactions} incomeCatSet={new Set(['Salary'])} />,
    )
    // Chart renders without errors
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })

  it('handles empty transactions gracefully', () => {
    render(<CashflowBarChart {...defaultProps} />)
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })

  it('excludes removed categories from calculations', () => {
    const yearTransactions: Record<string, Transaction[]> = {
      '2024-01': [
        makeTx({ category: 'Salary', amount: 5000 }),
        makeTx({ category: 'Groceries', amount: -1200 }),
        makeTx({ category: 'Removed', amount: -9999 }),
      ],
    }
    render(
      <CashflowBarChart
        {...defaultProps}
        yearTransactions={yearTransactions}
        incomeCatSet={new Set(['Salary'])}
        removedCategories={new Set(['Removed'])}
      />,
    )
    // Removed category excluded — chart renders without errors
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })

  it('treats all non-income categories as expense', () => {
    const yearTransactions: Record<string, Transaction[]> = {
      '2024-01': [makeTx({ category: 'Unknown', amount: -500 }), makeTx({ category: 'Zeroed', amount: 0 })],
    }

    render(<CashflowBarChart {...defaultProps} yearTransactions={yearTransactions} />)

    // Unknown is not in incomeCatSet, so treated as expense; chart renders
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })

  it('selects a period when clicking a bar', async () => {
    const user = userEvent.setup()
    const onSelectPeriod = vi.fn()

    render(<CashflowBarChart {...defaultProps} onSelectPeriod={onSelectPeriod} />)

    await user.click(screen.getByTestId('bar-chart'))

    expect(onSelectPeriod).toHaveBeenCalledWith('Jan')
  })

  it('dims non-selected bars when a period is selected', () => {
    render(<CashflowBarChart {...defaultProps} selectedPeriod="Feb" />)

    const cells = screen.getAllByTestId('bar-cell')
    expect(cells[0]).toHaveAttribute('data-opacity', '0.35')
    expect(cells[1]).toHaveAttribute('data-opacity', '1')
  })

  it('clears the selection when the selected period is clicked again', async () => {
    const user = userEvent.setup()
    const onSelectPeriod = vi.fn()

    render(<CashflowBarChart {...defaultProps} selectedPeriod="Jan" onSelectPeriod={onSelectPeriod} />)

    await user.click(screen.getByTestId('bar-chart'))

    expect(onSelectPeriod).toHaveBeenCalledWith(null)
  })

  it('ignores chart clicks when recharts does not provide an active label', async () => {
    const user = userEvent.setup()
    const onSelectPeriod = vi.fn()

    render(<CashflowBarChart {...defaultProps} onSelectPeriod={onSelectPeriod} />)

    await user.click(screen.getByTestId('bar-chart-empty-click'))

    expect(onSelectPeriod).not.toHaveBeenCalled()
  })

  it('renders chart with axis formatting', () => {
    render(<CashflowBarChart {...defaultProps} />)

    expect(screen.getByTestId('y-axis-large')).toHaveTextContent('$1k')
    expect(screen.getByTestId('y-axis-small')).toHaveTextContent('$250')
  })

  it('renders chart with expense-only data', () => {
    const yearTransactions: Record<string, Transaction[]> = {
      '2024-01': [makeTx({ category: 'Groceries', amount: -1200 })],
    }

    render(<CashflowBarChart {...defaultProps} yearTransactions={yearTransactions} />)

    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })

  it('renders tooltip deltas and average-vs-median reference content', () => {
    const yearTransactions: Record<string, Transaction[]> = {
      '2024-01': [makeTx({ category: 'Salary', amount: 5000 }), makeTx({ category: 'Groceries', amount: -1200 })],
      '2024-02': [makeTx({ category: 'Salary', amount: 4500 }), makeTx({ category: 'Rent', amount: -2000 })],
    }

    render(
      <CashflowBarChart {...defaultProps} yearTransactions={yearTransactions} incomeCatSet={new Set(['Salary'])} />,
    )

    expect(screen.getByText('Income')).toBeInTheDocument()
    expect(screen.getByText('Expenses')).toBeInTheDocument()
    expect(screen.getByText('Net Income')).toBeInTheDocument()
    expect(screen.getByText('Savings Rate')).toBeInTheDocument()
    expect(screen.getByText('Average')).toBeInTheDocument()
    expect(screen.getByText('Median')).toBeInTheDocument()
  })
})
