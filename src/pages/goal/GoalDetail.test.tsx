import { useEffect, useState } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { FinancialGoal, GwGoal } from '../../types'
import * as dataContextModule from '../../contexts/DataContext'
import * as goalCalculationsModule from './utils/goalCalculations'
import * as goalMathModule from './utils/goalMath'
import * as yearMonthlySavingModule from './hooks/useYearMonthlySaving'
import GoalDetail from './components/GoalDetail'

vi.mock('./components/GoalDetailedCard', () => ({
  default: ({
    goal,
    inflation,
    savingsOverride,
    fiProjectedMonth,
    fiYearOverride,
    onSavingsOverrideChange,
    onTogglePeriod,
    onFiYearOverrideChange,
    summaryYear,
  }: {
    goal: FinancialGoal
    inflation?: number
    savingsOverride?: number | null
    fiProjectedMonth?: string | null
    fiYearOverride?: string | null
    onSavingsOverrideChange?: (value: number | null) => void
    onTogglePeriod?: () => void
    onFiYearOverrideChange?: (value: string | null) => void
    summaryYear?: number
  }) => (
    <div
      data-testid="detailed-card"
      data-inflation={inflation}
      data-savings-override={savingsOverride ?? ''}
      data-fi-projected-month={fiProjectedMonth ?? ''}
      data-fi-year-override={fiYearOverride ?? ''}
      data-summary-year={summaryYear ?? ''}
    >
      <div>{goal.goalName}</div>
      <button onClick={() => onSavingsOverrideChange?.(4321)}>Set savings override</button>
      <button onClick={() => onTogglePeriod?.()}>Toggle period</button>
      <button onClick={() => onFiYearOverrideChange?.('2037-09')}>Set FIRE year override</button>
    </div>
  ),
}))

vi.mock('./components/GoalDiveDeep', () => ({
  default: function MockGoalDiveDeep({
    inflation,
    monthlyContribution,
    onFireMonth,
    gwBalance,
    gwMonthlyContribution,
    gwProjectedMonthlyContribution,
    gwGrowthRate,
    gwTarget,
    gwProjectedTarget,
    gwTargetMonth,
    gwDisburseMonth,
    projectedFiMonth,
  }: {
    inflation?: number
    monthlyContribution?: number
    onFireMonth?: (month: string | null) => void
    gwBalance?: number
    gwMonthlyContribution?: number
    gwProjectedMonthlyContribution?: number
    gwGrowthRate?: number
    gwTarget?: number
    gwProjectedTarget?: number
    gwTargetMonth?: string
    gwDisburseMonth?: string
    projectedFiMonth?: string | null
  }) {
    useEffect(() => {
      onFireMonth?.('Aug 2036')
    }, [onFireMonth])

    return (
      <div
        data-testid="dive-deep"
        data-inflation={inflation}
        data-monthly-contribution={monthlyContribution}
        data-gw-balance={gwBalance ?? ''}
        data-gw-monthly-contribution={gwMonthlyContribution ?? ''}
        data-gw-projected-monthly-contribution={gwProjectedMonthlyContribution ?? ''}
        data-gw-growth-rate={gwGrowthRate ?? ''}
        data-gw-target={gwTarget ?? ''}
        data-gw-projected-target={gwProjectedTarget ?? ''}
        data-gw-target-month={gwTargetMonth ?? ''}
        data-gw-disburse-month={gwDisburseMonth ?? ''}
        data-projected-fi-month={projectedFiMonth ?? ''}
      >
        DiveDeep
      </div>
    )
  },
}))

vi.mock('./components/GwSection', () => ({
  default: () => <div data-testid="gw-section">GwSection</div>,
}))

vi.mock('./components/SavingsPlan', () => ({
  default: () => <div data-testid="savings-plan">SavingsPlan</div>,
  FiSavingsPlan: () => <div data-testid="fi-savings-plan">FiSavingsPlan</div>,
  GwSavingsPlan: () => <div data-testid="gw-savings-plan">GwSavingsPlan</div>,
}))

const noop = () => {}
const currentYear = new Date().getFullYear()

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  vi.spyOn(dataContextModule, 'useData').mockReturnValue({
    accounts: [],
    balances: [],
    allMonths: [],
    setAccounts: noop,
    setBalances: noop,
  })
  vi.spyOn(yearMonthlySavingModule, 'useYearMonthlySaving').mockReturnValue({
    summaryYear: currentYear,
    setSummaryYear: vi.fn(),
    availableYears: [currentYear],
    yearMonthlySaving: null,
  })
})

function makeGoal(overrides: Partial<FinancialGoal> = {}): FinancialGoal {
  return {
    id: 1,
    goalName: 'Test Goal',
    createdAt: '2024-01-01',
    birthday: '1990-01-01',
    goalCreatedIn: '2024-01',
    goalEndYear: '2050',
    resetExpenseMonth: false,
    retirementAge: 60,
    expenseMonth: 5000,
    expenseValue: 60000,
    monthlyExpenseValue: 5000,
    expenseValueMar2026: 65000,
    expenseValue2047: 100000,
    monthlyExpenseRetirement: 8333,
    safeWithdrawalRate: 3,
    growth: 12,
    retirement: '2050-01',
    fiGoal: 2000000,
    progress: 25,
    ...overrides,
  }
}

const goalA = makeGoal({ id: 1, goalName: 'Alpha' })
const goalB = makeGoal({ id: 2, goalName: 'Bravo' })
const goalC = makeGoal({ id: 3, goalName: 'Charlie' })
const threeGoals = [goalA, goalB, goalC]

const mockGrowthSettings = {
  settings: {
    preBoundaryGrowth: 8,
    postBoundaryGrowth: 6,
    ageBoundary: 60,
    gwGrowth: 8,
    inflation: 3,
    retirementCap: 6000,
    nonRetirementBase: 6000,
    primaryRetirementAccessAge: 60,
    partnerRetirementAccessAge: 60,
  },
  updateSettings: vi.fn(),
  getFiOverride: vi.fn().mockReturnValue(null),
  setFiOverride: vi.fn(),
  getGwOverride: vi.fn().mockReturnValue(null),
  setGwOverride: vi.fn(),
  getEffectiveFiRates: vi.fn().mockReturnValue({ pre: 8, post: 6, hasOverride: false }),
  getEffectiveGwRate: vi.fn().mockReturnValue({ rate: 8, hasOverride: false }),
}

const defaultProps = {
  goals: threeGoals,
  profileBirthday: '1990-01-01',
  gwGoals: [] as GwGoal[],
  growthSettings: mockGrowthSettings as ReturnType<typeof import('../../hooks/useGrowthSettings').useGrowthSettings>,
  onUpdateGoal: noop as (goalId: number, g: FinancialGoal) => void,
  onCopyGoal: vi.fn(),
  onDeleteGoal: vi.fn(),
  onRenameGoal: vi.fn(),
  onCreateGwGoal: noop as (data: Omit<GwGoal, 'id' | 'createdAt'>) => void,
  onUpdateGwGoal: noop as (id: number, u: Partial<Omit<GwGoal, 'id' | 'createdAt' | 'fiGoalId'>>) => void,
  onDeleteGwGoal: noop as (id: number) => void,
}

function renderDetail(route: string, overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...overrides }
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/goal/plans/:id" element={<GoalDetail {...props} />} />
        <Route path="/goal/plans" element={<div data-testid="goals-list">Goals List</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderStatefulDetail(route: string, initialGoals: FinancialGoal[], onUpdateGoal = vi.fn()) {
  const StatefulGoalDetail = () => {
    const [goals, setGoals] = useState(initialGoals)

    return (
      <Routes>
        <Route
          path="/goal/plans/:id"
          element={
            <GoalDetail
              {...defaultProps}
              goals={goals}
              onUpdateGoal={(goalId, goal) => {
                onUpdateGoal(goalId, goal)
                setGoals(prevGoals => prevGoals.map(existingGoal => (existingGoal.id === goalId ? goal : existingGoal)))
              }}
            />
          }
        />
        <Route path="/goal/plans" element={<div data-testid="goals-list">Goals List</div>} />
      </Routes>
    )
  }

  return {
    onUpdateGoal,
    ...render(
      <MemoryRouter initialEntries={[route]}>
        <StatefulGoalDetail />
      </MemoryRouter>,
    ),
  }
}

function mockSummaryCard({ monthlySaving = 5000, yearMonthlySaving = null as number | null } = {}) {
  vi.spyOn(dataContextModule, 'useData').mockReturnValue({
    accounts: [
      {
        id: 1,
        name: '401k',
        type: 'retirement',
        owner: 'primary',
        status: 'active',
        goalType: 'fi',
        nature: 'asset',
        allocation: 'us-stock',
      },
    ],
    balances: [{ id: 1, accountId: 1, month: '2024-01', balance: 0 }],
    allMonths: ['2024-01'],
    setAccounts: noop,
    setBalances: noop,
  })
  vi.spyOn(goalCalculationsModule, 'getFiTarget').mockReturnValue(750000)
  vi.spyOn(goalMathModule, 'calcMonthlySaving').mockReturnValue(monthlySaving)
  vi.spyOn(yearMonthlySavingModule, 'useYearMonthlySaving').mockReturnValue({
    summaryYear: currentYear,
    setSummaryYear: vi.fn(),
    availableYears: [currentYear, currentYear - 1],
    yearMonthlySaving,
  })
}

function mockProjectedGwSummary({
  monthlySaving = 1234,
  gwTargetAtRetirement = 250000,
  gwBalance = 25000,
  monthsToFi = 24,
  monthsFiToRetirement = 96,
} = {}) {
  vi.spyOn(dataContextModule, 'useData').mockReturnValue({
    accounts: [
      {
        id: 1,
        name: 'Brokerage',
        type: 'non-retirement',
        owner: 'primary',
        status: 'active',
        goalType: 'gw',
        nature: 'asset',
        allocation: 'us-stock',
      },
    ],
    balances: [{ id: 1, accountId: 1, month: '2024-01', balance: gwBalance }],
    allMonths: ['2024-01'],
    setAccounts: noop,
    setBalances: noop,
  })
  vi.spyOn(goalCalculationsModule, 'getFiTarget').mockReturnValue(750000)
  vi.spyOn(goalMathModule, 'getGwTarget').mockReturnValue(gwTargetAtRetirement)
  vi.spyOn(goalMathModule, 'getRetirementMonth').mockReturnValue('2044-08')
  vi.spyOn(goalMathModule, 'getFiBreakdown').mockReturnValue({
    retirementPrimary: 0,
    retirementPartner: 0,
    nonRetirement: 0,
    total: 0,
  })
  vi.spyOn(goalMathModule, 'getTotalForMonth').mockImplementation((_accounts, _balances, _month, goalType) =>
    goalType === 'gw' ? gwBalance : 125000,
  )
  vi.spyOn(goalMathModule, 'monthsBetween').mockImplementation((start, end) => {
    if (start === '2024-01' && end === '2036-08') return monthsToFi
    if (start === '2036-08' && end === '2044-08') return monthsFiToRetirement
    return 12
  })
  vi.spyOn(goalMathModule, 'calcMonthlySaving').mockImplementation((_balance, target, _growth, n) => {
    if (target === 750000 || n === 12) return 5000
    return monthlySaving
  })
}

describe('GoalDetail rendering', () => {
  it('renders the matched goal card and section headings', () => {
    renderDetail('/goal/plans/2')

    expect(screen.getByTestId('detailed-card')).toHaveTextContent('Bravo')
    expect(screen.getByRole('heading', { name: /financial independence/i, level: 2 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /generational wealth/i, level: 2 })).toBeInTheDocument()
  })

  it('renders the GW savings plan and GW section when fiGoal is positive', () => {
    renderDetail('/goal/plans/1')

    expect(screen.getByTestId('gw-savings-plan')).toBeInTheDocument()
    expect(screen.getByTestId('gw-section')).toBeInTheDocument()
  })

  it('does not render GwSection when fiGoal is 0', () => {
    const zeroGoal = makeGoal({ id: 1, goalName: 'Zero', fiGoal: 0, expenseValue: 0, monthlyExpenseRetirement: 0 })
    renderDetail('/goal/plans/1', { goals: [zeroGoal] })

    expect(screen.queryByTestId('gw-section')).not.toBeInTheDocument()
  })

  it('keeps the projected FIRE month reported by the chart on initial load', async () => {
    renderDetail('/goal/plans/1')

    await waitFor(() => {
      expect(screen.getByTestId('detailed-card')).toHaveAttribute('data-fi-projected-month', '2036-08')
    })
  })
})

describe('GoalDetail not-found state', () => {
  it('renders not-found content for an invalid plan id', () => {
    renderDetail('/goal/plans/999')
    expect(screen.getByText(/this goal may have been deleted/i)).toBeInTheDocument()
  })

  it('navigates back to /goal/plans from the not-found state', async () => {
    const user = userEvent.setup()
    renderDetail('/goal/plans/999')

    await user.click(screen.getByRole('link', { name: /back to goals/i }))

    expect(screen.getByTestId('goals-list')).toBeInTheDocument()
  })
})

describe('GoalDetail arrow key navigation', () => {
  it('navigates to the next goal on ArrowRight', async () => {
    const user = userEvent.setup()
    renderDetail('/goal/plans/1')

    await user.keyboard('{ArrowRight}')

    expect(screen.getByTestId('detailed-card')).toHaveTextContent('Bravo')
  })

  it('navigates to the previous goal on ArrowLeft', async () => {
    const user = userEvent.setup()
    renderDetail('/goal/plans/2')

    await user.keyboard('{ArrowLeft}')

    expect(screen.getByTestId('detailed-card')).toHaveTextContent('Alpha')
  })

  it('does not navigate past the ends of the plans list', async () => {
    const user = userEvent.setup()
    renderDetail('/goal/plans/3')

    await user.keyboard('{ArrowRight}')

    expect(screen.getByTestId('detailed-card')).toHaveTextContent('Charlie')
  })
})

describe('GoalDetail savings override threading', () => {
  it('stores the savings override locally when GoalDetailedCard changes it', async () => {
    const user = userEvent.setup()
    const { onUpdateGoal } = renderStatefulDetail('/goal/plans/1', [goalA])

    await user.click(screen.getByRole('button', { name: 'Set savings override' }))

    expect(onUpdateGoal).not.toHaveBeenCalled()
    expect(screen.getByTestId('detailed-card')).toHaveAttribute('data-savings-override', '4321')
  })

  it('threads the local savings override into GoalDiveDeep as the monthly contribution', async () => {
    const user = userEvent.setup()
    renderStatefulDetail('/goal/plans/1', [goalA])

    await user.click(screen.getByRole('button', { name: 'Set savings override' }))

    expect(screen.getByTestId('dive-deep')).toHaveAttribute('data-monthly-contribution', '4321')
  })
})

describe('GoalDetail summary threading', () => {
  it('threads the selected-year monthly savings into GoalDiveDeep', () => {
    mockSummaryCard({ yearMonthlySaving: 4000 })

    renderDetail('/goal/plans/1', { goals: [goalA] })

    expect(screen.getByTestId('dive-deep')).toHaveAttribute('data-monthly-contribution', '4000')
  })

  it('threads the inflation setting into GoalDetailedCard and GoalDiveDeep', () => {
    mockSummaryCard()

    renderDetail('/goal/plans/1', { goals: [goalA] })

    expect(screen.getByTestId('detailed-card')).toHaveAttribute('data-inflation', '3')
    expect(screen.getByTestId('dive-deep')).toHaveAttribute('data-inflation', '3')
  })

  it('renders the projected GW card, supports yearly mode, and applies a FIRE year override', async () => {
    const user = userEvent.setup()
    mockProjectedGwSummary()

    renderDetail('/goal/plans/1', {
      goals: [goalA],
      gwGoals: [
        {
          id: 11,
          fiGoalId: 1,
          label: 'Legacy',
          disburseAmount: 1,
          disburseAge: 67,
          createdAt: '2024-01-01',
          growthRate: 7,
          currentSavings: 0,
        },
      ],
    })

    expect(await screen.findByRole('heading', { name: 'Projected' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '$132,103 by Aug 2036' })).toBeInTheDocument()
    expect(screen.getByText('$1,234/mo')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '$132,103 by Aug 2036' }))
    expect(screen.getByRole('button', { name: '$250,000 by Aug 2044' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Toggle period' }))
    expect(screen.getByText('$14,808/yr')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Set FIRE year override' }))
    expect(screen.getByText(/september 2037/i)).toBeInTheDocument()
    expect(screen.getByTestId('dive-deep')).toHaveAttribute('data-gw-disburse-month', '2057-01')
  })

  it('shows the achieved message when projected GW savings are no longer required', async () => {
    mockProjectedGwSummary({ monthlySaving: 0 })

    renderDetail('/goal/plans/1', {
      goals: [goalA],
      gwGoals: [
        {
          id: 12,
          fiGoalId: 1,
          label: 'Legacy',
          disburseAmount: 1,
          disburseAge: 65,
          createdAt: '2024-01-01',
          growthRate: 7,
          currentSavings: 0,
        },
      ],
    })

    expect(await screen.findByText("You've achieved this goal 🎉")).toBeInTheDocument()
  })

  it('omits the GW disbursement month when GW goals belong to another plan', async () => {
    mockProjectedGwSummary()

    renderDetail('/goal/plans/1', {
      goals: [goalA],
      gwGoals: [
        {
          id: 13,
          fiGoalId: 99,
          label: 'Other',
          disburseAmount: 1,
          disburseAge: 70,
          createdAt: '2024-01-01',
          growthRate: 7,
          currentSavings: 0,
        },
      ],
    })

    await waitFor(() => {
      expect(screen.getByTestId('dive-deep')).toHaveAttribute('data-gw-disburse-month', '')
    })
  })
})
