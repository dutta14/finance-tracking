import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GoalFilterBar, { DEFAULT_FILTERS, GoalFilters, applyFilters } from './GoalFilterBar'
import { makeGoal } from '../../../test/factories'
import { FinancialGoal } from '../../../types'

const goalAge50Low = makeGoal({
  id: 1,
  goalName: 'Low FI',
  retirementAge: 50,
  fiGoal: 2_000_000,
  expenseValue: 40_000,
})
const goalAge55Mid = makeGoal({
  id: 2,
  goalName: 'Mid FI',
  retirementAge: 55,
  fiGoal: 7_000_000,
  expenseValue: 80_000,
})
const goalAge60High = makeGoal({
  id: 3,
  goalName: 'High FI',
  retirementAge: 60,
  fiGoal: 12_000_000,
  expenseValue: 150_000,
})

const goals = [goalAge50Low, goalAge55Mid, goalAge60High]

function renderFilterBar(
  overrides: Partial<{ goals: FinancialGoal[]; filters: GoalFilters; onChange: () => void }> = {},
) {
  const onChange = overrides.onChange ?? vi.fn()
  return {
    onChange,
    ...render(
      <GoalFilterBar
        goals={overrides.goals ?? goals}
        filters={overrides.filters ?? DEFAULT_FILTERS}
        onChange={onChange}
      />,
    ),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GoalFilterBar', () => {
  it('renders a single Filters button and keeps the panel closed by default', () => {
    renderFilterBar()

    expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: /filters/i })).not.toBeInTheDocument()
  })

  it('opens the panel with categories and values', async () => {
    const user = userEvent.setup()
    renderFilterBar()

    await user.click(screen.getByRole('button', { name: /filters/i }))

    expect(screen.getByRole('dialog', { name: /filters/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /retirement age/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /fi goal/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /expense at creation/i })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /select all/i })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /age 50/i })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /age 55/i })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /age 60/i })).toBeInTheDocument()
  })

  it('stages changes and only applies them when Apply is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderFilterBar({ onChange })

    await user.click(screen.getByRole('button', { name: /filters/i }))
    await user.click(screen.getByRole('checkbox', { name: /age 50/i }))

    expect(onChange).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /apply/i }))

    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_FILTERS,
      retirementAges: [50],
    })
    expect(screen.queryByRole('dialog', { name: /filters/i })).not.toBeInTheDocument()
  })

  it('cancels staged changes and restores the last applied state', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderFilterBar({ onChange })

    await user.click(screen.getByRole('button', { name: /filters/i }))
    await user.click(screen.getByRole('checkbox', { name: /age 50/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onChange).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /filters/i }))
    expect(screen.getByRole('checkbox', { name: /select all/i })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /age 50/i })).not.toBeChecked()
  })

  it('treats click-outside as cancel and reverts staged changes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderFilterBar({ onChange })

    await user.click(screen.getByRole('button', { name: /filters/i }))
    await user.click(screen.getByRole('checkbox', { name: /age 50/i }))
    await user.click(document.body)

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: /filters/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /filters/i }))
    expect(screen.getByRole('checkbox', { name: /age 50/i })).not.toBeChecked()
  })

  it('shows the applied filter count on the trigger and grouped selections in the summary', async () => {
    const user = userEvent.setup()
    renderFilterBar({
      filters: {
        retirementAges: [50],
        fiGoalBuckets: ['< $5M'],
        expenseBuckets: [],
      },
    })

    expect(screen.getByRole('button', { name: /filters/i })).toHaveTextContent('(2)')

    await user.click(screen.getByRole('button', { name: /filters/i }))

    expect(screen.getByText('2 filters selected')).toBeInTheDocument()
    const summary = screen.getByText('2 filters selected').closest('.goal-filter-summary-column')
    expect(summary).not.toBeNull()
    expect(within(summary as HTMLElement).getByText('Retirement Age')).toBeInTheDocument()
    expect(within(summary as HTMLElement).getByText('FI Goal')).toBeInTheDocument()
    expect(within(summary as HTMLElement).getByText('Age 50')).toBeInTheDocument()
    expect(within(summary as HTMLElement).getByText('< $5M')).toBeInTheDocument()
  })

  it('clears staged filters and applies the default filters', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderFilterBar({
      onChange,
      filters: {
        retirementAges: [50],
        fiGoalBuckets: ['< $5M'],
        expenseBuckets: [],
      },
    })

    await user.click(screen.getByRole('button', { name: /filters/i }))
    await user.click(screen.getByRole('button', { name: /^clear$/i }))
    expect(screen.getByText('0 filters selected')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /apply/i }))

    expect(onChange).toHaveBeenCalledWith(DEFAULT_FILTERS)
  })

  it('removes a staged selection from the summary before apply', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderFilterBar({
      onChange,
      filters: {
        retirementAges: [50],
        fiGoalBuckets: ['< $5M'],
        expenseBuckets: [],
      },
    })

    await user.click(screen.getByRole('button', { name: /filters/i }))
    await user.click(screen.getByRole('button', { name: /remove retirement age 50/i }))
    await user.click(screen.getByRole('button', { name: /apply/i }))

    expect(onChange).toHaveBeenCalledWith({
      retirementAges: [],
      fiGoalBuckets: ['< $5M'],
      expenseBuckets: [],
    })
  })
})

describe('applyFilters', () => {
  it('returns all goals when no filters are set', () => {
    expect(applyFilters(goals, DEFAULT_FILTERS)).toEqual(goals)
  })

  it('filters goals by retirement age', () => {
    const filters: GoalFilters = { retirementAges: [55], fiGoalBuckets: [], expenseBuckets: [] }
    const result = applyFilters(goals, filters)
    expect(result).toHaveLength(1)
    expect(result[0].goalName).toBe('Mid FI')
  })

  it('filters goals by FI goal bucket', () => {
    const filters: GoalFilters = { retirementAges: [], fiGoalBuckets: ['$10M – $15M'], expenseBuckets: [] }
    const result = applyFilters(goals, filters)
    expect(result).toHaveLength(1)
    expect(result[0].goalName).toBe('High FI')
  })

  it('filters goals by expense bucket', () => {
    const filters: GoalFilters = { retirementAges: [], fiGoalBuckets: [], expenseBuckets: ['$100k – $200k'] }
    const result = applyFilters(goals, filters)
    expect(result).toHaveLength(1)
    expect(result[0].goalName).toBe('High FI')
  })

  it('combines multiple filter dimensions with AND logic', () => {
    const filters: GoalFilters = { retirementAges: [50, 55], fiGoalBuckets: ['< $5M'], expenseBuckets: [] }
    const result = applyFilters(goals, filters)
    expect(result).toHaveLength(1)
    expect(result[0].goalName).toBe('Low FI')
  })
})
