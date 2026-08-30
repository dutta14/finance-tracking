import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
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
    incomeCatSet: new Set<string>(['Salary']),
    selectedPeriod: null,
    timePeriod: 'month' as const,
  }

  it('renders empty state when no transactions exist', () => {
    render(
      <MemoryRouter>
        <CashflowSankey {...baseProps} />
      </MemoryRouter>,
    )
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
    render(
      <MemoryRouter>
        <CashflowSankey {...props} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Breakdown')).toBeInTheDocument()
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
    render(
      <MemoryRouter>
        <CashflowSankey {...props} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Group')).toBeInTheDocument()
    expect(screen.getByText('Category')).toBeInTheDocument()
  })

  it('renders SVG paths for income and expense data', () => {
    const yearTransactions = {
      '2024-01': [
        makeTx({ category: 'Salary', amount: 3200 }),
        makeTx({ category: 'Groceries', amount: -1200 }),
        makeTx({ category: 'Rent', amount: -2000 }),
      ],
    }
    const props = {
      ...baseProps,
      yearTransactions,
      categorySums: deriveCategorySums(yearTransactions),
    }
    const { container } = render(
      <MemoryRouter>
        <CashflowSankey {...props} />
      </MemoryRouter>,
    )
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
    const { container } = render(
      <MemoryRouter>
        <CashflowSankey {...props} />
      </MemoryRouter>,
    )
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
    const { container } = render(
      <MemoryRouter>
        <CashflowSankey {...props} />
      </MemoryRouter>,
    )
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
    const { container } = render(
      <MemoryRouter>
        <CashflowSankey {...props} />
      </MemoryRouter>,
    )
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
    const { container } = render(
      <MemoryRouter>
        <CashflowSankey {...props} />
      </MemoryRouter>,
    )
    const textEls = container.querySelectorAll('text')
    const textContents = Array.from(textEls).map(t => t.textContent)
    expect(textContents.some(t => t?.includes('INCOME') && t?.includes('$5,000'))).toBe(true)
  })

  it('renders a savings node when income exceeds expenses', () => {
    const yearTransactions = {
      '2024-01': [makeTx({ category: 'Salary', amount: 5000 }), makeTx({ category: 'Groceries', amount: -1200 })],
    }
    const props = {
      ...baseProps,
      yearTransactions,
      categorySums: deriveCategorySums(yearTransactions),
    }
    const { container } = render(
      <MemoryRouter>
        <CashflowSankey {...props} />
      </MemoryRouter>,
    )
    const textEls = container.querySelectorAll('text')
    const textContents = Array.from(textEls).map(t => t.textContent)

    expect(textContents.some(t => t?.includes('Savings'))).toBe(true)
    expect(textContents.some(t => t?.includes('$3,800') && t?.includes('(76.0%)'))).toBe(true)
  })

  it('filters sankey data to the selected month', () => {
    const yearTransactions = {
      '2024-01': [makeTx({ category: 'Salary', amount: 5000 }), makeTx({ category: 'Groceries', amount: -1200 })],
      '2024-02': [makeTx({ category: 'Salary', amount: 4500 }), makeTx({ category: 'Rent', amount: -2000 })],
    }
    const props = {
      ...baseProps,
      yearTransactions,
      categorySums: deriveCategorySums(yearTransactions),
      selectedPeriod: 'Jan',
    }
    const { container } = render(
      <MemoryRouter>
        <CashflowSankey {...props} />
      </MemoryRouter>,
    )
    const textContents = Array.from(container.querySelectorAll('text')).map(t => t.textContent)

    expect(screen.getByText('Breakdown — Jan')).toBeInTheDocument()
    expect(textContents.some(t => t?.includes('INCOME') && t?.includes('$5,000'))).toBe(true)
    expect(textContents.some(t => t?.includes('EXPENSE GROUPS') && t?.includes('$1,200'))).toBe(true)
    expect(textContents.some(t => t?.includes('$3,800') && t?.includes('(76.0%)'))).toBe(true)
  })

  it('filters sankey data to the selected quarter', () => {
    const yearTransactions = {
      '2024-01': [makeTx({ category: 'Salary', amount: 5000 })],
      '2024-02': [makeTx({ category: 'Salary', amount: 4500 })],
      '2024-03': [makeTx({ category: 'Groceries', amount: -1000 })],
      '2024-04': [makeTx({ category: 'Bonus', amount: 8000 }), makeTx({ category: 'Rent', amount: -2500 })],
    }
    const props = {
      ...baseProps,
      yearTransactions,
      categorySums: deriveCategorySums(yearTransactions),
      selectedPeriod: 'Q1',
      timePeriod: 'quarter' as const,
    }
    const { container } = render(
      <MemoryRouter>
        <CashflowSankey {...props} />
      </MemoryRouter>,
    )
    const textContents = Array.from(container.querySelectorAll('text')).map(t => t.textContent)

    expect(screen.getByText('Breakdown — Q1')).toBeInTheDocument()
    expect(textContents.some(t => t?.includes('INCOME') && t?.includes('$9,500'))).toBe(true)
    expect(textContents.some(t => t?.includes('EXPENSE GROUPS') && t?.includes('$1,000'))).toBe(true)
    expect(textContents.some(t => t?.includes('Bonus'))).toBe(false)
  })

  it('keeps the last category node within the svg bounds when many small categories are shown', async () => {
    const user = userEvent.setup()
    const tinyExpenses = Object.fromEntries(
      Array.from({ length: 30 }, (_, index) => [`Tiny ${index + 1}`, -(index === 0 ? 3000 : 1)]),
    )
    const yearTransactions = {
      '2024-01': [
        makeTx({ category: 'Salary', amount: 5000 }),
        ...Object.entries(tinyExpenses).map(([category, amount]) => makeTx({ category, amount })),
      ],
    }
    const props = {
      ...baseProps,
      yearTransactions,
      categorySums: deriveCategorySums(yearTransactions),
    }

    const { container } = render(
      <MemoryRouter>
        <CashflowSankey {...props} />
      </MemoryRouter>,
    )

    await user.click(screen.getByText('Category'))

    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()

    const viewBox = svg?.getAttribute('viewBox')?.split(' ').map(Number)
    expect(viewBox).toBeDefined()

    const viewBoxHeight = viewBox?.[3] ?? 0
    const rightNodeRects = Array.from(container.querySelectorAll('rect[x="642"][width="18"]'))
    expect(rightNodeRects.length).toBeGreaterThan(0)

    const lastRightNode = rightNodeRects[rightNodeRects.length - 1]
    const lastBottom =
      Number(lastRightNode?.getAttribute('y') ?? 0) + Number(lastRightNode?.getAttribute('height') ?? 0)

    expect(lastBottom).toBeLessThanOrEqual(viewBoxHeight - 36 + 0.001)
  })

  it('keeps the scroll container height fixed when switching to category mode', async () => {
    const user = userEvent.setup()
    const tinyExpenses = Object.fromEntries(
      Array.from({ length: 30 }, (_, index) => [`Tiny ${index + 1}`, -(index === 0 ? 3000 : 1)]),
    )
    const yearTransactions = {
      '2024-01': [
        makeTx({ category: 'Salary', amount: 5000 }),
        ...Object.entries(tinyExpenses).map(([category, amount]) => makeTx({ category, amount })),
      ],
    }
    const props = {
      ...baseProps,
      yearTransactions,
      categorySums: deriveCategorySums(yearTransactions),
    }

    const { container } = render(
      <MemoryRouter>
        <CashflowSankey {...props} />
      </MemoryRouter>,
    )

    const scrollContainer = container.querySelector('.cashflow-sankey-scroll')
    const svg = container.querySelector('svg')

    expect(scrollContainer).not.toBeNull()
    expect(svg).not.toBeNull()

    const groupHeight = scrollContainer?.getAttribute('style') ?? ''
    const groupViewBoxHeight = Number(svg?.getAttribute('viewBox')?.split(' ')[3] ?? 0)

    await user.click(screen.getByText('Category'))

    const categoryHeight = scrollContainer?.getAttribute('style') ?? ''
    const categoryViewBoxHeight = Number(svg?.getAttribute('viewBox')?.split(' ')[3] ?? 0)

    expect(groupHeight).toBe(categoryHeight)
    expect(categoryViewBoxHeight).toBeGreaterThan(groupViewBoxHeight)
  })
})
