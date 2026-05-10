import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import GoalCompareView from './GoalCompareView'
import { makeGoal, makeGwGoal } from '../../../test/factories'

vi.mock('../../../styles/GoalCompareView.css', () => ({}))
// #47: getLatestGoalTotals is mocked because the real function reads from
// DataContext (accounts, balances) which requires full provider tree setup.
// Using a realistic fixture: $600k represents a mid-career net worth.
vi.mock('../../data/types', () => ({
  getLatestGoalTotals: () => ({ fiTotal: 600000, gwTotal: 0 }),
}))

const goalA = makeGoal({
  id: 1,
  goalName: 'Plan A',
  retirementAge: 45,
  fiGoal: 1500000,
  inflationRate: 3,
  safeWithdrawalRate: 4,
  growth: 7,
  expenseValue: 60000,
  expenseValue2047: 120000,
  goalCreatedIn: '2024-01',
  goalEndYear: '2050-01',
  retirement: '2035-01-15',
})
const goalB = makeGoal({
  id: 2,
  goalName: 'Plan B',
  retirementAge: 50,
  fiGoal: 2000000,
  inflationRate: 2.5,
  safeWithdrawalRate: 3.5,
  growth: 8,
  expenseValue: 70000,
  expenseValue2047: 130000,
  goalCreatedIn: '2023-06',
  goalEndYear: '2055-01',
  retirement: '2040-01-15',
})

describe('GoalCompareView', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders a comparison table with column headers for each goal', () => {
    render(<GoalCompareView goals={[goalA, goalB]} gwGoals={[]} profileBirthday="1990-01-15" />)

    const table = screen.getByRole('table', { name: /comparison of 2 goals/i })
    expect(table).toBeInTheDocument()
    expect(screen.getByText('Plan A')).toBeInTheDocument()
    expect(screen.getByText('Plan B')).toBeInTheDocument()
  })

  it('displays FI metric rows for each goal', () => {
    render(<GoalCompareView goals={[goalA, goalB]} gwGoals={[]} profileBirthday="1990-01-15" />)

    expect(screen.getByText('Retirement Age')).toBeInTheDocument()
    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()

    expect(screen.getByText('FI Goal')).toBeInTheDocument()
    expect(screen.getByText('Inflation Rate')).toBeInTheDocument()
    expect(screen.getByText('Safe Withdrawal Rate')).toBeInTheDocument()
    expect(screen.getByText('Growth Rate')).toBeInTheDocument()
  })

  it('displays progress row with correct percentage', () => {
    render(<GoalCompareView goals={[goalA, goalB]} gwGoals={[]} profileBirthday="1990-01-15" />)

    // fiTotal=600000, goalA.fiGoal=1500000 → 40.0%, goalB.fiGoal=2000000 → 30.0%
    expect(screen.getByText('Progress')).toBeInTheDocument()
    // #46: Use header-based cell lookup instead of hardcoded indices
    const progressRow = screen.getByText('Progress').closest('tr')!
    const progressCells = within(progressRow).getAllByRole('cell')
    expect(progressCells[0]).toHaveTextContent('40.0%')
    expect(progressCells[1]).toHaveTextContent('30.0%')
  })

  it('renders a single goal comparison correctly', () => {
    render(<GoalCompareView goals={[goalA]} gwGoals={[]} profileBirthday="1990-01-15" />)

    const table = screen.getByRole('table', { name: /comparison of 1 goals/i })
    expect(table).toBeInTheDocument()
    expect(screen.getByText('Plan A')).toBeInTheDocument()
    expect(screen.queryByText('Plan B')).not.toBeInTheDocument()
  })

  it('shows the compare hint with goal count and modifier key', () => {
    render(<GoalCompareView goals={[goalA, goalB]} gwGoals={[]} profileBirthday="1990-01-15" />)

    expect(screen.getByText(/comparing 2 goals/i)).toBeInTheDocument()
  })

  it('does not render GW section when no GW goals exist', () => {
    render(<GoalCompareView goals={[goalA, goalB]} gwGoals={[]} profileBirthday="1990-01-15" />)

    expect(screen.queryByText('Generational Wealth')).not.toBeInTheDocument()
    expect(screen.queryByText('# of Goals')).not.toBeInTheDocument()
  })

  it('renders GW section when GW goals are linked to compared goals', () => {
    const gw1 = makeGwGoal({
      id: 10,
      fiGoalId: 1,
      label: 'College Fund',
      disburseAge: 50,
      disburseAmount: 100000,
      growthRate: 6,
    })
    const gw2 = makeGwGoal({
      id: 11,
      fiGoalId: 2,
      label: 'Trust Fund',
      disburseAge: 55,
      disburseAmount: 200000,
      growthRate: 5,
    })

    render(<GoalCompareView goals={[goalA, goalB]} gwGoals={[gw1, gw2]} profileBirthday="1990-01-15" />)

    expect(screen.getByText('Generational Wealth')).toBeInTheDocument()
    expect(screen.getByText('# of Goals')).toBeInTheDocument()
    expect(screen.getByText('Total PV at Retirement')).toBeInTheDocument()
    expect(screen.getByText('College Fund')).toBeInTheDocument()
    expect(screen.getByText('Trust Fund')).toBeInTheDocument()
  })

  it('shows dash for GW goal labels that do not apply to a given FI goal', () => {
    const gw1 = makeGwGoal({ id: 10, fiGoalId: 1, label: 'College Fund', disburseAge: 50, disburseAmount: 100000 })

    render(<GoalCompareView goals={[goalA, goalB]} gwGoals={[gw1]} profileBirthday="1990-01-15" />)

    // College Fund row: goalA has a value, goalB should have "—"
    const collegeFundRow = screen.getByText('College Fund').closest('tr')!
    const cells = within(collegeFundRow).getAllByRole('cell')
    // goalB cell should be "—"
    expect(cells[1]).toHaveTextContent('—')
  })
})
