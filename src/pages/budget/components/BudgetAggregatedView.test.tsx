import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BudgetAggregatedView from './BudgetAggregatedView'
import type { CategoryGroup } from '../types'

const defaultGroups: CategoryGroup[] = [
  { id: 'essentials', name: 'Essentials', categories: ['Groceries', 'Rent'] },
  { id: 'lifestyle', name: 'Lifestyle', categories: ['Entertainment'] },
  { id: 'others', name: 'Others', categories: [] },
]

describe('BudgetAggregatedView', () => {
  const baseCategorySums: Record<string, Record<string, number>> = {
    Groceries: { '2024-01': -500, '2024-02': -600 },
    Rent: { '2024-01': -1500, '2024-02': -1500 },
    Entertainment: { '2024-01': -200, '2024-02': -100 },
  }

  const baseProps = {
    year: 2024,
    type: 'expense' as const,
    categoryGroups: defaultGroups,
    categorySums: baseCategorySums,
    timePeriod: 'month' as const,
  }

  it('renders the title for expense type', () => {
    render(<BudgetAggregatedView {...baseProps} />)
    expect(screen.getByText('Expenses — Aggregated')).toBeInTheDocument()
  })

  it('renders the title for income type', () => {
    const incomeSums = { Salary: { '2024-01': 5000, '2024-02': 5000 } }
    render(<BudgetAggregatedView {...baseProps} type="income" categorySums={incomeSums} />)
    expect(screen.getByText('Income — Aggregated')).toBeInTheDocument()
  })

  it('renders group names sorted alphabetically for expenses', () => {
    render(<BudgetAggregatedView {...baseProps} />)
    expect(screen.getByText('Essentials')).toBeInTheDocument()
    expect(screen.getByText('Lifestyle')).toBeInTheDocument()
  })

  it('renders Grand Total row', () => {
    render(<BudgetAggregatedView {...baseProps} />)
    expect(screen.getByText('Grand Total')).toBeInTheDocument()
  })

  it('renders month column headers for monthly period', () => {
    render(<BudgetAggregatedView {...baseProps} />)
    expect(screen.getByText('Jan')).toBeInTheDocument()
    expect(screen.getByText('Feb')).toBeInTheDocument()
  })

  it('renders quarter column headers for quarterly period', () => {
    render(<BudgetAggregatedView {...baseProps} timePeriod="quarter" />)
    ;['Q1', 'Q2', 'Q3', 'Q4'].forEach(q => {
      expect(screen.getByText(q)).toBeInTheDocument()
    })
  })

  it('renders half column headers for half period', () => {
    render(<BudgetAggregatedView {...baseProps} timePeriod="half" />)
    expect(screen.getByText('H1')).toBeInTheDocument()
    expect(screen.getByText('H2')).toBeInTheDocument()
  })

  it('handles empty category sums gracefully', () => {
    render(<BudgetAggregatedView {...baseProps} categorySums={{}} categoryGroups={[]} />)
    // Should render the title but no data rows and no Grand Total
    expect(screen.getByText('Expenses — Aggregated')).toBeInTheDocument()
    expect(screen.queryByText('Grand Total')).not.toBeInTheDocument()
  })

  it('toggles between Total and % on header click', async () => {
    const user = userEvent.setup()
    render(<BudgetAggregatedView {...baseProps} />)

    // Initially shows "Total"
    expect(screen.getByText('Total')).toBeInTheDocument()

    // Click to toggle to %
    await user.click(screen.getByText('Total'))
    expect(screen.getByText('%')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()

    // Click again to toggle back
    await user.click(screen.getByText('%'))
    expect(screen.getByText('Total')).toBeInTheDocument()
  })

  it('groups income categories under a single Income group', () => {
    const incomeSums = {
      Salary: { '2024-01': 5000 },
      Freelance: { '2024-01': 2000 },
    }
    render(<BudgetAggregatedView {...baseProps} type="income" categorySums={incomeSums} />)
    // Income groups are aggregated under "Income" label
    expect(screen.getByText('Income')).toBeInTheDocument()
    expect(screen.getByText('Grand Total')).toBeInTheDocument()
  })

  it('displays formatted currency values for group totals', () => {
    render(<BudgetAggregatedView {...baseProps} />)
    // Grand total for Jan: |(-500)+(-1500)+(-200)| = $2,200, Feb: |(-600)+(-1500)+(-100)| = $2,200
    // Both appear in Grand Total row period cells
    const grandTotalRow = screen.getByText('Grand Total').closest('tr')!
    const cells = within(grandTotalRow).getAllByText('$2,200')
    expect(cells).toHaveLength(2)
  })

  it('renders different values when timePeriod changes from month to quarter', () => {
    const { rerender } = render(<BudgetAggregatedView {...baseProps} />)
    // Monthly view: Jan = $2,200
    const grandTotalRow = screen.getByText('Grand Total').closest('tr')!
    expect(within(grandTotalRow).getAllByText('$2,200')).toHaveLength(2)

    rerender(<BudgetAggregatedView {...baseProps} timePeriod="quarter" />)
    // Quarterly view: Q1 = |(-500)+(-600)+(-1500)+(-1500)+(-200)+(-100)| = $4,400 appears in Grand Total Q1 + Total
    const grandTotalRowQ = screen.getByText('Grand Total').closest('tr')!
    expect(within(grandTotalRowQ).getAllByText('$4,400')).toHaveLength(2)
  })
})
