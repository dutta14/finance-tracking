import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CashflowSankey from './CashflowSankey'
import type { Transaction, CategoryGroup } from '../types'

const makeTx = (overrides: Partial<Transaction> = {}): Transaction => ({
  date: '2024-01-15',
  category: 'Groceries',
  amount: -150,
  ...overrides,
})

function deriveCategorySums(yearTransactions: Record<string, Transaction[]>): Record<string, Record<string, number>> {
  const sums: Record<string, Record<string, number>> = {}
  for (const [month, txns] of Object.entries(yearTransactions)) {
    for (const t of txns) {
      if (!sums[t.category]) sums[t.category] = {}
      sums[t.category][month] = (sums[t.category][month] || 0) + t.amount
    }
  }
  return sums
}

const defaultGroups: CategoryGroup[] = [
  { id: 'essentials', name: 'Essentials', categories: ['Groceries', 'Rent'] },
  { id: 'lifestyle', name: 'Lifestyle', categories: ['Entertainment'] },
  { id: 'others', name: 'Others', categories: [] },
  { id: 'removed', name: 'Removed', categories: [] },
]

describe('CashflowSankey', () => {
  const baseProps = {
    year: 2024,
    yearTransactions: {} as Record<string, Transaction[]>,
    categoryGroups: defaultGroups,
    removedCategories: new Set<string>(),
    categorySums: {} as Record<string, Record<string, number>>,
  }

  it('renders empty state when no transactions exist', () => {
    render(<CashflowSankey {...baseProps} />)
    expect(screen.getByText('No transaction data for this year.')).toBeInTheDocument()
  })

  it('renders the title', () => {
    const yearTransactions = {
      '2024-01': [makeTx({ category: 'Salary', amount: 5000 }), makeTx({ category: 'Groceries', amount: -1200 })],
    }
    const props = {
      ...baseProps,
      yearTransactions,
      categorySums: deriveCategorySums(yearTransactions),
    }
    render(<CashflowSankey {...props} />)
    expect(screen.getByText('Cashflow Sankey')).toBeInTheDocument()
  })

  it('renders Group and Category toggle buttons', () => {
    const yearTransactions = {
      '2024-01': [makeTx({ category: 'Salary', amount: 5000 }), makeTx({ category: 'Groceries', amount: -1200 })],
    }
    const props = {
      ...baseProps,
      yearTransactions,
      categorySums: deriveCategorySums(yearTransactions),
    }
    render(<CashflowSankey {...props} />)
    expect(screen.getByText('Group')).toBeInTheDocument()
    expect(screen.getByText('Category')).toBeInTheDocument()
  })

  it('renders SVG paths for income and expense data', () => {
    const yearTransactions = {
      '2024-01': [
        makeTx({ category: 'Salary', amount: 5000 }),
        makeTx({ category: 'Groceries', amount: -1200 }),
        makeTx({ category: 'Rent', amount: -2000 }),
      ],
    }
    const props = {
      ...baseProps,
      yearTransactions,
      categorySums: deriveCategorySums(yearTransactions),
    }
    const { container } = render(<CashflowSankey {...props} />)
    const paths = container.querySelectorAll('path')
    // 1 left link (Salary → band) + 1 right link (Essentials group → band) = 2 paths
    expect(paths).toHaveLength(2)
  })

  it('renders income and expense node labels', () => {
    const yearTransactions = {
      '2024-01': [makeTx({ category: 'Salary', amount: 5000 }), makeTx({ category: 'Groceries', amount: -1200 })],
    }
    const props = {
      ...baseProps,
      yearTransactions,
      categorySums: deriveCategorySums(yearTransactions),
    }
    const { container } = render(<CashflowSankey {...props} />)
    const textEls = container.querySelectorAll('text')
    const textContents = Array.from(textEls).map(t => t.textContent)
    expect(textContents.some(t => t?.includes('Salary'))).toBe(true)
    expect(textContents.some(t => t?.includes('Essentials'))).toBe(true)
  })

  it('switches to category mode on button click', async () => {
    const user = userEvent.setup()
    const yearTransactions = {
      '2024-01': [makeTx({ category: 'Salary', amount: 5000 }), makeTx({ category: 'Groceries', amount: -1200 })],
    }
    const props = {
      ...baseProps,
      yearTransactions,
      categorySums: deriveCategorySums(yearTransactions),
    }
    const { container } = render(<CashflowSankey {...props} />)
    await user.click(screen.getByText('Category'))

    // In category mode, right column header says EXPENSE CATEGORIES
    const textEls = container.querySelectorAll('text')
    const textContents = Array.from(textEls).map(t => t.textContent)
    expect(textContents.some(t => t?.includes('EXPENSE CATEGORIES'))).toBe(true)
    // Individual category name should appear
    expect(textContents.some(t => t?.includes('Groceries'))).toBe(true)
  })

  it('excludes removed categories from the diagram', () => {
    const yearTransactions = {
      '2024-01': [
        makeTx({ category: 'Salary', amount: 5000 }),
        makeTx({ category: 'Groceries', amount: -1200 }),
        makeTx({ category: 'Hidden', amount: -999 }),
      ],
    }
    const props = {
      ...baseProps,
      yearTransactions,
      categorySums: deriveCategorySums(yearTransactions),
      removedCategories: new Set(['Hidden']),
    }
    const { container } = render(<CashflowSankey {...props} />)
    const textEls = container.querySelectorAll('text')
    const textContents = Array.from(textEls).map(t => t.textContent)
    expect(textContents.some(t => t?.includes('Hidden'))).toBe(false)
  })

  it('renders income total in the header', () => {
    const yearTransactions = {
      '2024-01': [makeTx({ category: 'Salary', amount: 5000 }), makeTx({ category: 'Groceries', amount: -1200 })],
    }
    const props = {
      ...baseProps,
      yearTransactions,
      categorySums: deriveCategorySums(yearTransactions),
    }
    const { container } = render(<CashflowSankey {...props} />)
    const textEls = container.querySelectorAll('text')
    const textContents = Array.from(textEls).map(t => t.textContent)
    expect(textContents.some(t => t?.includes('INCOME') && t?.includes('$5,000'))).toBe(true)
  })
})
