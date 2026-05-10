import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import CashflowBarChart from './CashflowBarChart'
import type { Transaction } from '../types'

// Recharts ResponsiveContainer needs explicit dimensions which JSDOM lacks.
// Mock recharts to render simple DOM elements so we can verify data logic.
vi.mock('recharts', async () => {
  const OrigModule = await vi.importActual<Record<string, unknown>>('recharts')
  return {
    ...OrigModule,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
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
    categorySums: {} as Record<string, Record<string, number>>,
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
    const categorySums: Record<string, Record<string, number>> = {
      Salary: { '2024-01': 5000 },
      Groceries: { '2024-01': -1200 },
    }
    render(<CashflowBarChart {...defaultProps} yearTransactions={yearTransactions} categorySums={categorySums} />)
    // Legend renders 12 items (one per month) with net cashflow amounts
    const legendItems = screen.getAllByText(/^[+-]?\$/)
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
    const categorySums: Record<string, Record<string, number>> = {
      Salary: { '2024-01': 5000 },
      Groceries: { '2024-01': -1200 },
    }
    render(<CashflowBarChart {...defaultProps} yearTransactions={yearTransactions} categorySums={categorySums} />)
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
    const categorySums: Record<string, Record<string, number>> = {
      Salary: { '2024-01': 5000 },
      Groceries: { '2024-01': -1200 },
      Removed: { '2024-01': -9999 },
    }
    render(
      <CashflowBarChart
        {...defaultProps}
        yearTransactions={yearTransactions}
        categorySums={categorySums}
        removedCategories={new Set(['Removed'])}
      />,
    )
    // Net should be 5000 - 1200 = 3800, not including Removed
    expect(screen.getByText('+$3,800')).toBeInTheDocument()
  })
})
