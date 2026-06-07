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
    expect(screen.getByText('Analysis — Retire Early')).toBeInTheDocument()
  })

  it('renders projection section heading', () => {
    render(<GoalDiveDeep goal={baseGoal} profileBirthday={profileBirthday} />)
    expect(screen.getByText('Full Lifecycle — Projected')).toBeInTheDocument()
  })

  it('shows placeholder when birthday is empty', () => {
    const noBirthdayGoal = makeGoal({ ...baseGoal, birthday: '' })
    render(<GoalDiveDeep goal={noBirthdayGoal} profileBirthday="" />)
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

  it('defaults to table view and shows View Chart button', () => {
    render(<GoalDiveDeep goal={baseGoal} profileBirthday={profileBirthday} />)
    expect(screen.getByText('View Chart')).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('switches to chart view when View Chart is clicked', async () => {
    const user = userEvent.setup()
    render(<GoalDiveDeep goal={baseGoal} profileBirthday={profileBirthday} />)
    await user.click(screen.getByText('View Chart'))
    expect(screen.getByText('View Table')).toBeInTheDocument()
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
  })

  it('renders table with data rows in yearly view', () => {
    render(<GoalDiveDeep goal={baseGoal} profileBirthday={profileBirthday} />)
    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row')
    expect(rows.length).toBeGreaterThan(10)
  })

  it('shows collapsible year groups in monthly table view', async () => {
    const user = userEvent.setup()
    render(<GoalDiveDeep goal={baseGoal} profileBirthday={profileBirthday} />)
    await user.click(screen.getByText('Monthly'))
    const yearToggles = screen.getAllByRole('button', { expanded: false })
    expect(yearToggles.length).toBeGreaterThan(0)
  })

  it('expands a year group to show monthly rows', async () => {
    const user = userEvent.setup()
    render(<GoalDiveDeep goal={baseGoal} profileBirthday={profileBirthday} />)
    await user.click(screen.getByText('Monthly'))
    const yearToggles = screen.getAllByRole('button', { expanded: false })
    await user.click(yearToggles[0])
    expect(yearToggles[0]).toHaveAttribute('aria-expanded', 'true')
  })

  it('changes interval when interval buttons are clicked', async () => {
    const user = userEvent.setup()
    render(<GoalDiveDeep goal={baseGoal} profileBirthday={profileBirthday} />)
    await user.click(screen.getByText('Every 5 Yrs'))
    const table = screen.getByRole('table')
    const fiveYrRows = within(table).getAllByRole('row')
    await user.click(screen.getByText('Every 10 Yrs'))
    const tenYrRows = within(table).getAllByRole('row')
    expect(tenYrRows.length).toBeLessThanOrEqual(fiveYrRows.length)
  })

  it('renders drawdown rows with expense amounts when FI reached', () => {
    render(
      <GoalDiveDeep
        goal={baseGoal}
        profileBirthday={profileBirthday}
        currentBalance={5_000_000}
        monthlyContribution={5000}
      />,
    )
    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row')
    let hasSpending = false
    for (let i = 1; i < rows.length; i++) {
      const cells = within(rows[i]).getAllByRole('cell')
      if (cells.length >= 4 && cells[1].textContent === 'Spending') {
        hasSpending = true
        expect(cells[2].textContent).toMatch(/^\$[\d,]+$/)
        break
      }
    }
    expect(hasSpending).toBe(true)
  })

  it('remaining balance decreases during drawdown with low growth', () => {
    const depletingGoal = makeGoal({ ...baseGoal, growth: 1, monthlyExpense2047: 15000, fiGoal: 1_000_000 })
    render(
      <GoalDiveDeep goal={depletingGoal} profileBirthday={profileBirthday} currentBalance={1_500_000} monthlyContribution={1000} />,
    )
    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row')
    const drawdownValues: number[] = []
    for (let i = 1; i < rows.length; i++) {
      const cells = within(rows[i]).getAllByRole('cell')
      if (cells.length >= 4 && cells[1].textContent === 'Spending') {
        const text = cells[3].textContent?.replace(/[$,]/g, '') ?? ''
        const val = parseFloat(text)
        if (!isNaN(val)) drawdownValues.push(val)
      }
    }
    expect(drawdownValues.length).toBeGreaterThan(1)
    expect(drawdownValues[0]).toBeGreaterThan(drawdownValues[drawdownValues.length - 1])
  })

  it('uses profileBirthday when goal.birthday is empty', () => {
    const goalNoBirthday = makeGoal({ ...baseGoal, birthday: '' })
    render(<GoalDiveDeep goal={goalNoBirthday} profileBirthday={profileBirthday} />)
    expect(screen.queryByText(/No projection available/)).not.toBeInTheDocument()
    expect(screen.getByText('View Chart')).toBeInTheDocument()
  })

  it('collapses an expanded year group hiding its monthly rows', async () => {
    const user = userEvent.setup()
    render(<GoalDiveDeep goal={baseGoal} profileBirthday={profileBirthday} />)
    await user.click(screen.getByText('Monthly'))
    const yearToggles = screen.getAllByRole('button', { expanded: false })
    const firstYearToggle = yearToggles[0]
    await user.click(firstYearToggle)
    const table = screen.getByRole('table')
    const expandedRows = within(table).getAllByRole('row').length
    await user.click(firstYearToggle)
    expect(firstYearToggle).toHaveAttribute('aria-expanded', 'false')
    const collapsedRows = within(table).getAllByRole('row').length
    expect(collapsedRows).toBeLessThan(expandedRows)
  })

  it('switches from table back to chart view', async () => {
    const user = userEvent.setup()
    render(<GoalDiveDeep goal={baseGoal} profileBirthday={profileBirthday} />)
    expect(screen.getByRole('table')).toBeInTheDocument()
    await user.click(screen.getByText('View Chart'))
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
  })

  it('expands multiple year groups simultaneously', async () => {
    const user = userEvent.setup()
    render(<GoalDiveDeep goal={baseGoal} profileBirthday={profileBirthday} />)
    await user.click(screen.getByText('Monthly'))
    const yearToggles = screen.getAllByRole('button', { expanded: false })
    await user.click(yearToggles[0])
    await user.click(yearToggles[1])
    expect(yearToggles[0]).toHaveAttribute('aria-expanded', 'true')
    expect(yearToggles[1]).toHaveAttribute('aria-expanded', 'true')
    const table = screen.getByRole('table')
    const allRows = within(table).getAllByRole('row')
    expect(allRows.length).toBeGreaterThan(20)
  })

  it('renders Projected and Planned scenario buttons', () => {
    render(<GoalDiveDeep goal={baseGoal} profileBirthday={profileBirthday} currentBalance={100000} monthlyContribution={2000} />)
    expect(screen.getByRole('button', { name: /Projected/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Planned/ })).toBeInTheDocument()
  })

  it('applies aria-pressed to active scenario button', () => {
    render(<GoalDiveDeep goal={baseGoal} profileBirthday={profileBirthday} />)
    const projectedBtn = screen.getByRole('button', { name: /Projected/ })
    expect(projectedBtn).toHaveAttribute('aria-pressed', 'true')
  })

  it('passes growthRate prop to projections', () => {
    // Render with a custom growth rate — should not crash
    render(<GoalDiveDeep goal={baseGoal} profileBirthday={profileBirthday} growthRate={10} currentBalance={100000} monthlyContribution={2000} />)
    expect(screen.getByRole('table')).toBeInTheDocument()
  })
})
