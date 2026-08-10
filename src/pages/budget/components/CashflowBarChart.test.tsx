import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CashflowBarChart from './CashflowBarChart'
import type { Transaction } from '../types'

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
      data?: Array<{ label: string }>
      onClick?: (e: { activeLabel?: string }) => void
    }) => (
      <div>
        <button type="button" data-testid="bar-chart" onClick={() => onClick?.({ activeLabel: data?.[0]?.label })}>
          {children}
        </button>
        <button type="button" data-testid="bar-chart-empty-click" onClick={() => onClick?.({})} />
      </div>
    ),
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
    Tooltip: () => null,
    ReferenceLine: () => null,
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

  it('renders all 12 month labels in the legend for monthly period', () => {
    render(<CashflowBarChart {...defaultProps} />)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    months.forEach(m => {
      expect(screen.getByText(m)).toBeInTheDocument()
    })
  })

  it('renders quarter labels for quarterly period', () => {
    render(<CashflowBarChart {...defaultProps} timePeriod="quarter" />)
    ;['Q1', 'Q2', 'Q3', 'Q4'].forEach(q => {
      expect(screen.getByText(q)).toBeInTheDocument()
    })
  })

  it('renders half labels for half period', () => {
    render(<CashflowBarChart {...defaultProps} timePeriod="half" />)
    ;['H1', 'H2'].forEach(h => {
      expect(screen.getByText(h)).toBeInTheDocument()
    })
  })

  it('renders Income and Expense legend labels', () => {
    const yearTransactions: Record<string, Transaction[]> = {
      '2024-01': [makeTx({ category: 'Salary', amount: 5000 }), makeTx({ category: 'Groceries', amount: -1200 })],
    }
    render(
      <CashflowBarChart {...defaultProps} yearTransactions={yearTransactions} incomeCatSet={new Set(['Salary'])} />,
    )
    // Legend renders 12 items (one per month) with net cashflow amounts
    const legendItems = document.querySelectorAll('.cashflow-bar-legend-item')
    expect(legendItems).toHaveLength(12)
    // Jan has data: net = +$3,800; remaining 11 months show +$0
    expect(screen.getByText('+$3,800')).toBeInTheDocument()
    const zeroItems = screen.getAllByText('+$0')
    expect(zeroItems).toHaveLength(11)
  })

  it('displays net cashflow amounts in legend', () => {
    const yearTransactions: Record<string, Transaction[]> = {
      '2024-01': [makeTx({ category: 'Salary', amount: 5000 }), makeTx({ category: 'Groceries', amount: -1200 })],
    }
    render(
      <CashflowBarChart {...defaultProps} yearTransactions={yearTransactions} incomeCatSet={new Set(['Salary'])} />,
    )
    // Net for Jan = 5000 + (-1200) = 3800
    expect(screen.getByText('+$3,800')).toBeInTheDocument()
  })

  it('handles empty transactions gracefully', () => {
    render(<CashflowBarChart {...defaultProps} />)
    // All months should show +$0 net in legend
    const zeroEntries = screen.getAllByText('+$0')
    expect(zeroEntries.length).toBe(12)
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
    // Net should be 5000 - 1200 = 3800, not including Removed
    expect(screen.getByText('+$3,800')).toBeInTheDocument()
  })

  it('treats all non-income categories as expense', () => {
    const yearTransactions: Record<string, Transaction[]> = {
      '2024-01': [makeTx({ category: 'Unknown', amount: -500 }), makeTx({ category: 'Zeroed', amount: 0 })],
    }

    render(<CashflowBarChart {...defaultProps} yearTransactions={yearTransactions} />)

    // Unknown is not in incomeCatSet, so treated as expense; net = -500
    expect(screen.getByText('-$500')).toBeInTheDocument()
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

  it('formats axis ticks and tooltip labels for both income and expense values', () => {
    render(<CashflowBarChart {...defaultProps} />)

    expect(screen.getByTestId('y-axis-large')).toHaveTextContent('$1k')
    expect(screen.getByTestId('y-axis-small')).toHaveTextContent('$250')
    expect(screen.getByTestId('tooltip-income')).toHaveTextContent('Income:$1,200')
    expect(screen.getByTestId('tooltip-expense')).toHaveTextContent('Expense:$250')
    expect(screen.getByTestId('tooltip-label')).toHaveTextContent('Jan 2024')
  })

  it('renders negative net values without a leading plus sign', () => {
    const yearTransactions: Record<string, Transaction[]> = {
      '2024-01': [makeTx({ category: 'Groceries', amount: -1200 })],
    }

    render(<CashflowBarChart {...defaultProps} yearTransactions={yearTransactions} />)

    expect(screen.getByText('-$1,200')).toBeInTheDocument()
    expect(screen.getByText('-$1,200')).toHaveClass('negative')
  })
})
