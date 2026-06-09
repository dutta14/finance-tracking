import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GoalDiveDeep from './GoalDiveDeep'
import { makeGoal } from '../../../test/factories'
import * as lifecycleModule from '../utils/lifecycleProjection'

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
  growth: 7,
  monthlyExpense2047: 10000,
  fiGoal: 3_000_000,
})

describe('GoalDiveDeep', () => {
  it('renders title with goal name', () => {
    render(
      <GoalDiveDeep
        goal={baseGoal}
        profileBirthday={profileBirthday}
        retirementCap={6000}
        nonRetirementBase={6000}
        currentBalance={500000}
        monthlyContribution={3000}
      />,
    )
    expect(screen.getByText('Analysis — Retire Early')).toBeInTheDocument()
  })

  it('renders projection section heading', () => {
    render(
      <GoalDiveDeep
        goal={baseGoal}
        profileBirthday={profileBirthday}
        retirementCap={6000}
        nonRetirementBase={6000}
        currentBalance={500000}
        monthlyContribution={3000}
      />,
    )
    expect(screen.getByText('Full Lifecycle — Projected')).toBeInTheDocument()
  })

  it('shows placeholder when birthday is empty', () => {
    const noBirthdayGoal = makeGoal({ ...baseGoal, birthday: '' })
    render(<GoalDiveDeep goal={noBirthdayGoal} profileBirthday="" retirementCap={6000} nonRetirementBase={6000} />)
    expect(screen.getByText(/No projection available/)).toBeInTheDocument()
  })

  it('shows placeholder when goalEndYear is empty', () => {
    const noEndGoal = makeGoal({ ...baseGoal, goalEndYear: '' })
    render(
      <GoalDiveDeep goal={noEndGoal} profileBirthday={profileBirthday} retirementCap={6000} nonRetirementBase={6000} />,
    )
    expect(screen.getByText(/No projection available/)).toBeInTheDocument()
  })

  it('renders interval toggle buttons', () => {
    render(
      <GoalDiveDeep
        goal={baseGoal}
        profileBirthday={profileBirthday}
        retirementCap={6000}
        nonRetirementBase={6000}
        currentBalance={500000}
        monthlyContribution={3000}
      />,
    )
    expect(screen.getByText('Monthly')).toBeInTheDocument()
    expect(screen.getByText('Yearly')).toBeInTheDocument()
    expect(screen.getByText('Every 5 Yrs')).toBeInTheDocument()
    expect(screen.getByText('Every 10 Yrs')).toBeInTheDocument()
  })

  it('defaults to table view and shows View Chart button', () => {
    render(
      <GoalDiveDeep
        goal={baseGoal}
        profileBirthday={profileBirthday}
        retirementCap={6000}
        nonRetirementBase={6000}
        currentBalance={500000}
        monthlyContribution={3000}
      />,
    )
    expect(screen.getByText('View Chart')).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('switches to chart view when View Chart is clicked', async () => {
    const user = userEvent.setup()
    render(
      <GoalDiveDeep
        goal={baseGoal}
        profileBirthday={profileBirthday}
        retirementCap={6000}
        nonRetirementBase={6000}
        currentBalance={500000}
        monthlyContribution={3000}
      />,
    )
    await user.click(screen.getByText('View Chart'))
    expect(screen.getByText('View Table')).toBeInTheDocument()
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
  })

  it('renders table with data rows in yearly view', () => {
    render(
      <GoalDiveDeep
        goal={baseGoal}
        profileBirthday={profileBirthday}
        retirementCap={6000}
        nonRetirementBase={6000}
        currentBalance={500000}
        monthlyContribution={3000}
      />,
    )
    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row')
    expect(rows.length).toBeGreaterThan(10)
  })

  it('changes interval when interval buttons are clicked', async () => {
    const user = userEvent.setup()
    render(
      <GoalDiveDeep
        goal={baseGoal}
        profileBirthday={profileBirthday}
        retirementCap={6000}
        nonRetirementBase={6000}
        currentBalance={500000}
        monthlyContribution={3000}
      />,
    )
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
        retirementCap={6000}
        nonRetirementBase={6000}
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
      <GoalDiveDeep
        goal={depletingGoal}
        profileBirthday={profileBirthday}
        currentBalance={1_500_000}
        monthlyContribution={1000}
        retirementCap={6000}
        nonRetirementBase={6000}
      />,
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
    render(
      <GoalDiveDeep
        goal={goalNoBirthday}
        profileBirthday={profileBirthday}
        retirementCap={6000}
        nonRetirementBase={6000}
      />,
    )
    expect(screen.queryByText(/No projection available/)).not.toBeInTheDocument()
    expect(screen.getByText('View Chart')).toBeInTheDocument()
  })

  it('switches from table back to chart view', async () => {
    const user = userEvent.setup()
    render(
      <GoalDiveDeep
        goal={baseGoal}
        profileBirthday={profileBirthday}
        retirementCap={6000}
        nonRetirementBase={6000}
        currentBalance={500000}
        monthlyContribution={3000}
      />,
    )
    expect(screen.getByRole('table')).toBeInTheDocument()
    await user.click(screen.getByText('View Chart'))
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
  })

  it('renders Projected and Planned scenario buttons', () => {
    render(
      <GoalDiveDeep
        goal={baseGoal}
        profileBirthday={profileBirthday}
        currentBalance={100000}
        monthlyContribution={2000}
        retirementCap={6000}
        nonRetirementBase={6000}
      />,
    )
    expect(screen.getByRole('button', { name: /Projected/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Planned/ })).toBeInTheDocument()
  })

  it('applies aria-pressed to active scenario button', () => {
    render(
      <GoalDiveDeep
        goal={baseGoal}
        profileBirthday={profileBirthday}
        retirementCap={6000}
        nonRetirementBase={6000}
        currentBalance={500000}
        monthlyContribution={3000}
      />,
    )
    const projectedBtn = screen.getByRole('button', { name: /Projected/ })
    expect(projectedBtn).toHaveAttribute('aria-pressed', 'true')
  })

  it('passes growthRate prop to projections', () => {
    // Render with a custom growth rate — should not crash
    render(
      <GoalDiveDeep
        goal={baseGoal}
        profileBirthday={profileBirthday}
        growthRate={10}
        currentBalance={100000}
        monthlyContribution={2000}
        retirementCap={6000}
        nonRetirementBase={6000}
      />,
    )
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  describe('inflation threading', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 0, 1))
    })

    afterEach(() => {
      vi.restoreAllMocks()
      vi.useRealTimers()
    })

    it('passes the threaded inflation setting to the projected lifecycle builder', () => {
      const projectedSpy = vi.spyOn(lifecycleModule, 'buildProjectedLifecycle')

      render(
        <GoalDiveDeep
          goal={baseGoal}
          profileBirthday={profileBirthday}
          inflation={5}
          currentBalance={500000}
          monthlyContribution={3000}
          retirementCap={6000}
          nonRetirementBase={6000}
        />,
      )

      expect(projectedSpy).toHaveBeenCalled()
      expect(projectedSpy.mock.calls.at(-1)?.[10]).toBe(5)
    })

    it('passes the threaded inflation setting to the planned lifecycle builder after switching scenarios', () => {
      const plannedSpy = vi.spyOn(lifecycleModule, 'buildPlannedProjection')

      render(
        <GoalDiveDeep
          goal={baseGoal}
          profileBirthday={profileBirthday}
          inflation={5}
          currentBalance={500000}
          monthlyContribution={3000}
          retirementCap={6000}
          nonRetirementBase={6000}
        />,
      )

      fireEvent.click(screen.getByRole('button', { name: /Planned/ }))

      expect(plannedSpy).toHaveBeenCalled()
      expect(plannedSpy.mock.calls.at(-1)?.[10]).toBe(5)
    })
  })
})
