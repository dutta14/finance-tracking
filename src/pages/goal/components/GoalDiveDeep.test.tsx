import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GoalDiveDeep from './GoalDiveDeep'
import { makeGoal } from '../../../test/factories'

vi.mock('recharts', async () => {
  const OrigModule = await vi.importActual<Record<string, unknown>>('recharts')
  return {
    ...OrigModule,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
  }
})

vi.mock('../../../styles/GoalDiveDeep.css', () => ({}))

const profileBirthday = '1990-06-15'

const baseGoal = makeGoal({
  id: 1,
  goalName: 'Retire Early',
  birthday: '1990-06-15',
  goalCreatedIn: '2024-01-01',
  goalEndYear: '2080-01-01',
  retirementAge: 45,
  inflationRate: 3,
  growth: 7,
  monthlyExpense2047: 10000,
  fiGoal: 3_000_000,
})

describe('GoalDiveDeep', () => {
  it('renders title with goal name', () => {
    render(<GoalDiveDeep goal={baseGoal} profileBirthday={profileBirthday} />)
    expect(screen.getByText('Deep Analysis — Retire Early')).toBeInTheDocument()
  })

  it('renders projection section heading', () => {
    render(<GoalDiveDeep goal={baseGoal} profileBirthday={profileBirthday} />)
    expect(screen.getByText('Year-by-Year Projection')).toBeInTheDocument()
  })

  it('shows placeholder when retirement date >= goal end year', () => {
    const noProjectionGoal = makeGoal({
      ...baseGoal,
      retirementAge: 100,
      goalEndYear: '2080-01-01',
    })
    render(<GoalDiveDeep goal={noProjectionGoal} profileBirthday={profileBirthday} />)
    expect(screen.getByText(/No projection available/)).toBeInTheDocument()
  })

  it('shows placeholder when goalEndYear is empty', () => {
    const noEndGoal = makeGoal({ ...baseGoal, goalEndYear: '' })
    render(<GoalDiveDeep goal={noEndGoal} profileBirthday={profileBirthday} />)
    expect(screen.getByText(/No projection available/)).toBeInTheDocument()
  })

  it('renders interval toggle buttons', () => {
    render(<GoalDiveDeep goal={baseGoal} profileBirthday={profileBirthday} />)
    expect(screen.getByText('Monthly')).toBeInTheDocument()
    expect(screen.getByText('Yearly')).toBeInTheDocument()
    expect(screen.getByText('Every 5 Yrs')).toBeInTheDocument()
    expect(screen.getByText('Every 10 Yrs')).toBeInTheDocument()
  })

  it('defaults to chart view and shows View Table button', () => {
    render(<GoalDiveDeep goal={baseGoal} profileBirthday={profileBirthday} />)
    expect(screen.getByText('View Table')).toBeInTheDocument()
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
  })

  it('switches to table view when View Table is clicked', async () => {
    const user = userEvent.setup()
    render(<GoalDiveDeep goal={baseGoal} profileBirthday={profileBirthday} />)
    await user.click(screen.getByText('View Table'))
    expect(screen.getByText('View Chart')).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('Month')).toBeInTheDocument()
    expect(screen.getByText('Est. Monthly Expense')).toBeInTheDocument()
    expect(screen.getByText('Est. Remaining Money')).toBeInTheDocument()
  })

  it('renders table rows in yearly view with first and last months included', async () => {
    const user = userEvent.setup()
    render(<GoalDiveDeep goal={baseGoal} profileBirthday={profileBirthday} />)
    await user.click(screen.getByText('View Table'))
    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row')
    // header + 46 yearly data rows (May 2035 to Jan 2080, every 12th month + first + last)
    expect(rows).toHaveLength(47)
  })

  it('shows collapsible year groups in monthly table view', async () => {
    const user = userEvent.setup()
    render(<GoalDiveDeep goal={baseGoal} profileBirthday={profileBirthday} />)
    await user.click(screen.getByText('View Table'))
    await user.click(screen.getByText('Monthly'))
    // Year header buttons should be present with aria-expanded
    const yearToggles = screen.getAllByRole('button', { expanded: false })
    expect(yearToggles.length).toBeGreaterThan(0)
  })

  it('expands a year group to show monthly rows', async () => {
    const user = userEvent.setup()
    render(<GoalDiveDeep goal={baseGoal} profileBirthday={profileBirthday} />)
    await user.click(screen.getByText('View Table'))
    await user.click(screen.getByText('Monthly'))
    // Click on the first year toggle to expand it
    const yearToggles = screen.getAllByRole('button', { expanded: false })
    await user.click(yearToggles[0])
    // Should now have aria-expanded=true
    expect(yearToggles[0]).toHaveAttribute('aria-expanded', 'true')
  })

  it('changes interval when interval buttons are clicked', async () => {
    const user = userEvent.setup()
    render(<GoalDiveDeep goal={baseGoal} profileBirthday={profileBirthday} />)
    await user.click(screen.getByText('View Table'))
    // Switch to Every 5 Yrs
    await user.click(screen.getByText('Every 5 Yrs'))
    const table = screen.getByRole('table')
    const fiveYrRows = within(table).getAllByRole('row')
    // Switch to Every 10 Yrs — should have fewer rows
    await user.click(screen.getByText('Every 10 Yrs'))
    const tenYrRows = within(table).getAllByRole('row')
    expect(tenYrRows.length).toBeLessThanOrEqual(fiveYrRows.length)
  })

  it('projection starts at retirement date and ends at goal end year', async () => {
    const user = userEvent.setup()
    // birthday 1990-06, retirementAge 45 => retirement Jun 2035
    // goalEndYear 2080-01-01 => end Jan 2080
    // Default interval is yearly — rows filtered by intervalMonths (12)
    render(<GoalDiveDeep goal={baseGoal} profileBirthday={profileBirthday} />)
    await user.click(screen.getByText('View Table'))
    const table = screen.getByRole('table')
    const allText = table.textContent ?? ''
    // First row should be near 2035, last row near 2080
    expect(allText).toContain('2035')
    expect(allText).toContain('2079')
  })

  it('asserts specific projected expense dollar amounts based on retirement year', async () => {
    // #40: monthlyExpense2047 is used as the starting expense at retirement,
    // even when retirement year is 2035. This is a SOURCE CODE BUG:
    // buildProjection() uses goal.monthlyExpense2047 as the initial expense
    // regardless of retirement year (line 34 of GoalDiveDeep.tsx).
    // The field name "monthlyExpense2047" implies it was inflated to year 2047,
    // but the projection starts it at whatever the retirement year is.
    const user = userEvent.setup()
    render(<GoalDiveDeep goal={baseGoal} profileBirthday={profileBirthday} />)
    await user.click(screen.getByText('View Table'))
    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row')
    // First data row (after header) should show the initial expense of $10,000
    const firstDataCells = within(rows[1]).getAllByRole('cell')
    expect(firstDataCells[1].textContent).toBe('$10,000')
    // Remaining should start at fiGoal = $3,000,000
    expect(firstDataCells[2].textContent).toBe('$3,000,000')
  })

  it('remaining balance eventually decreases over time in projection', async () => {
    const user = userEvent.setup()
    // Use low growth (1%) so expenses outpace returns and fund depletes
    const depletingGoal = makeGoal({
      ...baseGoal,
      growth: 1,
      monthlyExpense2047: 15000,
    })
    render(<GoalDiveDeep goal={depletingGoal} profileBirthday={profileBirthday} />)
    await user.click(screen.getByText('View Table'))
    // #41: Re-query the DOM after click to avoid stale reference
    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row')
    const remainingValues: number[] = []
    for (let i = 1; i < rows.length; i++) {
      const cells = within(rows[i]).getAllByRole('cell')
      if (cells.length >= 3) {
        const text = cells[2].textContent?.replace(/[$,]/g, '') ?? ''
        const val = parseFloat(text)
        if (!isNaN(val)) remainingValues.push(val)
      }
    }
    expect(remainingValues.length).toBeGreaterThan(1)
    // With low growth and high expenses, last value should be less than first
    expect(remainingValues[0]).toBeGreaterThan(remainingValues[remainingValues.length - 1])
  })

  it('uses profileBirthday when goal.birthday is empty', () => {
    const goalNoBirthday = makeGoal({ ...baseGoal, birthday: '' })
    render(<GoalDiveDeep goal={goalNoBirthday} profileBirthday={profileBirthday} />)
    // Should render projection (not the empty placeholder)
    expect(screen.queryByText(/No projection available/)).not.toBeInTheDocument()
    expect(screen.getByText('View Table')).toBeInTheDocument()
  })
})
