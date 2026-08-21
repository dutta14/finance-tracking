import { useEffect, useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { FinancialGoal, GwGoal } from '../../types'
import * as dataContextModule from '../../contexts/DataContext'
import * as goalCalculationsModule from './utils/goalCalculations'
import * as goalMathModule from './utils/goalMath'
import * as yearMonthlySavingModule from './hooks/useYearMonthlySaving'
import GoalDetail from './components/GoalDetail'

/* ─── Mock heavy child components ─── */

vi.mock('./components/GoalDetailedCard', () => ({
  default: ({
    goal,
    inflation,
    savingsOverride,
    fiProjectedMonth,
    onSavingsOverrideChange,
    summaryYear,
  }: {
    goal: FinancialGoal
    inflation?: number
    savingsOverride?: number | null
    fiProjectedMonth?: string | null
    onSavingsOverrideChange?: (value: number | null) => void
    summaryYear?: number
  }) => (
    <div
      data-testid="detailed-card"
      data-inflation={inflation}
      data-savings-override={savingsOverride ?? ''}
      data-fi-projected-month={fiProjectedMonth ?? ''}
      data-summary-year={summaryYear ?? ''}
    >
      <div>{goal.goalName}</div>
      <button onClick={() => onSavingsOverrideChange?.(4321)}>Set savings override</button>
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

/* ─── Helpers ─── */

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
  growthSettings: mockGrowthSettings as ReturnType<typeof import('./hooks/useGrowthSettings').useGrowthSettings>,
  onUpdateGoal: noop as (goalId: number, g: FinancialGoal) => void,
  onCopyGoal: vi.fn(),
  onDeleteGoal: vi.fn(),
  onRenameGoal: vi.fn(),
  onCreateGwGoal: noop as (data: Omit<GwGoal, 'id' | 'createdAt'>) => void,
  onUpdateGwGoal: noop as (id: number, u: Partial<Omit<GwGoal, 'id' | 'createdAt' | 'fiGoalId'>>) => void,
  onDeleteGwGoal: noop as (id: number) => void,
}

/**
 * Renders GoalDetail at the given route, with a sentinel at /goal
 * so we can verify back-navigation.
 */
function renderDetail(route: string, overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...overrides }
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/goal/:id" element={<GoalDetail {...props} />} />
        <Route path="/goal" element={<div data-testid="goals-list">Goals List</div>} />
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
          path="/goal/:id"
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
        <Route path="/goal" element={<div data-testid="goals-list">Goals List</div>} />
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

/* ═══════════════════════════════════════════════════════════════
   1. Renders correctly for a matching goal
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetail rendering', () => {
  it('renders the goal title when the URL matches a valid goal id', () => {
    renderDetail('/goal/2')
    expect(screen.getByRole('heading', { name: 'Bravo', level: 1 })).toBeInTheDocument()
  })

  it('renders the DetailedCard for the matched goal', () => {
    renderDetail('/goal/1')
    expect(screen.getByTestId('detailed-card')).toHaveTextContent('Alpha')
  })

  it('renders the SavingsPlan aside', () => {
    renderDetail('/goal/1')
    expect(screen.getByTestId('gw-savings-plan')).toBeInTheDocument()
  })

  it('renders the Goal Parameters toggle button', () => {
    renderDetail('/goal/1')
    expect(screen.getByRole('button', { name: 'Goal Parameters' })).toBeInTheDocument()
  })

  it('renders GwSection when fiGoal > 0', () => {
    renderDetail('/goal/1')
    expect(screen.getByTestId('gw-section')).toBeInTheDocument()
  })

  it('does not render GwSection when fiGoal is 0', () => {
    const zeroGoal = makeGoal({ id: 1, goalName: 'Zero', fiGoal: 0, expenseValue: 0, monthlyExpenseRetirement: 0 })
    renderDetail('/goal/1', { goals: [zeroGoal] })
    expect(screen.queryByTestId('gw-section')).not.toBeInTheDocument()
  })

  it('keeps the projected FIRE month reported by the chart on initial load', async () => {
    renderDetail('/goal/1')

    await waitFor(() => {
      expect(screen.getByTestId('detailed-card')).toHaveAttribute('data-fi-projected-month', '2036-08')
    })
  })
})

/* ═══════════════════════════════════════════════════════════════
   2. Not-found state
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetail not-found state', () => {
  it('renders not-found message when the id does not match any goal', () => {
    renderDetail('/goal/999')
    expect(screen.getByText(/this goal may have been deleted/i)).toBeInTheDocument()
  })

  it('renders a back link in the not-found state', () => {
    renderDetail('/goal/999')
    expect(screen.getByRole('link', { name: /back to goals/i })).toBeInTheDocument()
  })

  it('navigates to /goal when the not-found back link is clicked', async () => {
    const user = userEvent.setup()
    renderDetail('/goal/999')

    await user.click(screen.getByRole('link', { name: /back to goals/i }))

    expect(screen.getByTestId('goals-list')).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   3. Back link
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetail back link', () => {
  it('renders a "Goals" back link in the header', () => {
    renderDetail('/goal/1')
    const link = screen.getByRole('link', { name: /goals/i })
    expect(link).toHaveClass('goal-detail-back-link')
  })

  it('navigates to /goal when the back link is clicked', async () => {
    const user = userEvent.setup()
    renderDetail('/goal/1')

    await user.click(screen.getByRole('link', { name: /goals/i }))

    expect(screen.getByTestId('goals-list')).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   4. Stepper prev/next
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetail stepper', () => {
  it('renders stepper when there are multiple goals', () => {
    renderDetail('/goal/2')
    expect(screen.getByText('Goal 2 of 3')).toBeInTheDocument()
  })

  it('does not render stepper when there is only one goal', () => {
    renderDetail('/goal/1', { goals: [goalA] })
    expect(screen.queryByLabelText('Previous goal')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Next goal')).not.toBeInTheDocument()
  })

  it('disables the previous button on the first goal', () => {
    renderDetail('/goal/1')
    expect(screen.getByLabelText('Previous goal')).toBeDisabled()
  })

  it('disables the next button on the last goal', () => {
    renderDetail('/goal/3')
    expect(screen.getByLabelText('Next goal')).toBeDisabled()
  })

  it('navigates to the next goal when next is clicked', async () => {
    const user = userEvent.setup()
    renderDetail('/goal/1')

    await user.click(screen.getByLabelText('Next goal'))

    expect(screen.getByRole('heading', { name: 'Bravo', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Goal 2 of 3')).toBeInTheDocument()
  })

  it('navigates to the previous goal when prev is clicked', async () => {
    const user = userEvent.setup()
    renderDetail('/goal/2')

    await user.click(screen.getByLabelText('Previous goal'))

    expect(screen.getByRole('heading', { name: 'Alpha', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Goal 1 of 3')).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   5. Arrow key navigation
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetail arrow key navigation', () => {
  it('navigates to the next goal on ArrowRight', async () => {
    const user = userEvent.setup()
    renderDetail('/goal/1')

    await user.keyboard('{ArrowRight}')

    expect(screen.getByRole('heading', { name: 'Bravo', level: 1 })).toBeInTheDocument()
  })

  it('navigates to the previous goal on ArrowLeft', async () => {
    const user = userEvent.setup()
    renderDetail('/goal/2')

    await user.keyboard('{ArrowLeft}')

    expect(screen.getByRole('heading', { name: 'Alpha', level: 1 })).toBeInTheDocument()
  })

  it('does not navigate past the first goal on ArrowLeft', async () => {
    const user = userEvent.setup()
    renderDetail('/goal/1')

    await user.keyboard('{ArrowLeft}')

    expect(screen.getByRole('heading', { name: 'Alpha', level: 1 })).toBeInTheDocument()
  })

  it('does not navigate past the last goal on ArrowRight', async () => {
    const user = userEvent.setup()
    renderDetail('/goal/3')

    await user.keyboard('{ArrowRight}')

    expect(screen.getByRole('heading', { name: 'Charlie', level: 1 })).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   6. Dive Deep toggle
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetail dive deep rendering', () => {
  it('renders DiveDeep immediately', () => {
    renderDetail('/goal/1')
    expect(screen.getByTestId('dive-deep')).toBeInTheDocument()
  })

  it('does not render an Analysis toggle button', () => {
    renderDetail('/goal/1')
    expect(screen.queryByRole('button', { name: /^analysis$/i })).not.toBeInTheDocument()
  })

  it('threads the default inflation setting into DiveDeep', () => {
    renderDetail('/goal/1')
    expect(screen.getByTestId('dive-deep')).toHaveAttribute('data-inflation', '3')
  })

  it('keeps DiveDeep visible after a savings override is reported', async () => {
    const user = userEvent.setup()
    renderDetail('/goal/1')

    await user.click(screen.getByRole('button', { name: 'Set savings override' }))

    expect(screen.getByTestId('dive-deep')).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   7. Actions menu — rename, duplicate, delete
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetail savings override threading', () => {
  it('stores the savings override locally when GoalDetailedCard changes it', async () => {
    const user = userEvent.setup()
    const { onUpdateGoal } = renderStatefulDetail('/goal/1', [goalA])

    await user.click(screen.getByRole('button', { name: 'Set savings override' }))

    expect(onUpdateGoal).not.toHaveBeenCalled()
    expect(screen.getByTestId('detailed-card')).toHaveAttribute('data-savings-override', '4321')
  })

  it('threads the local savings override into GoalDiveDeep as the monthly contribution', async () => {
    const user = userEvent.setup()
    renderStatefulDetail('/goal/1', [goalA])

    await user.click(screen.getByRole('button', { name: 'Set savings override' }))

    expect(screen.getByTestId('dive-deep')).toHaveAttribute('data-monthly-contribution', '4321')
  })
})

describe('GoalDetail actions menu', () => {
  it('renders the actions menu trigger button', () => {
    renderDetail('/goal/1')
    expect(screen.getByLabelText('Goal actions')).toBeInTheDocument()
  })

  it('opens the dropdown showing Rename, Duplicate, Delete', async () => {
    const user = userEvent.setup()
    renderDetail('/goal/1')

    await user.click(screen.getByLabelText('Goal actions'))

    expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('calls onCopyGoal when Duplicate is clicked', async () => {
    const onCopyGoal = vi.fn()
    const user = userEvent.setup()
    renderDetail('/goal/1', { onCopyGoal })

    await user.click(screen.getByLabelText('Goal actions'))
    await user.click(screen.getByRole('button', { name: 'Duplicate' }))

    expect(onCopyGoal).toHaveBeenCalledTimes(1)
    expect(onCopyGoal).toHaveBeenCalledWith(goalA)
  })
})

/* ═══════════════════════════════════════════════════════════════
   8. Rename mode
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetail rename', () => {
  it('enters rename mode when Rename is chosen from the actions menu', async () => {
    const user = userEvent.setup()
    renderDetail('/goal/1')

    await user.click(screen.getByLabelText('Goal actions'))
    await user.click(screen.getByRole('button', { name: 'Rename' }))

    expect(screen.getByPlaceholderText('Goal name')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Alpha')).toBeInTheDocument()
  })

  it('commits the rename on Enter and calls onRenameGoal', async () => {
    const onRenameGoal = vi.fn()
    const user = userEvent.setup()
    renderDetail('/goal/1', { onRenameGoal })

    await user.click(screen.getByLabelText('Goal actions'))
    await user.click(screen.getByRole('button', { name: 'Rename' }))

    const input = screen.getByPlaceholderText('Goal name')
    await user.clear(input)
    await user.type(input, 'Renamed Goal{Enter}')

    expect(onRenameGoal).toHaveBeenCalledWith(1, 'Renamed Goal')
  })

  it('cancels rename on Escape without calling onRenameGoal', async () => {
    const onRenameGoal = vi.fn()
    const user = userEvent.setup()
    renderDetail('/goal/1', { onRenameGoal })

    await user.click(screen.getByLabelText('Goal actions'))
    await user.click(screen.getByRole('button', { name: 'Rename' }))

    await user.keyboard('{Escape}')

    // Escape exits rename mode, title re-appears
    expect(screen.getByRole('heading', { name: 'Alpha', level: 1 })).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Goal name')).not.toBeInTheDocument()
    expect(onRenameGoal).not.toHaveBeenCalled()
  })

  it('does not commit rename when the input is blank', async () => {
    const onRenameGoal = vi.fn()
    const user = userEvent.setup()
    renderDetail('/goal/1', { onRenameGoal })

    await user.click(screen.getByLabelText('Goal actions'))
    await user.click(screen.getByRole('button', { name: 'Rename' }))

    const input = screen.getByPlaceholderText('Goal name')
    await user.clear(input)
    await user.type(input, '{Enter}')

    expect(onRenameGoal).not.toHaveBeenCalled()
  })
})

/* ═══════════════════════════════════════════════════════════════
   9. Delete navigation
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetail delete navigation', () => {
  it('calls onDeleteGoal and navigates to the next goal when a middle goal is deleted', async () => {
    const onDeleteGoal = vi.fn()
    const user = userEvent.setup()
    renderDetail('/goal/2', { onDeleteGoal })

    await user.click(screen.getByLabelText('Goal actions'))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onDeleteGoal).toHaveBeenCalledWith(2)
    // Should navigate to next goal (Charlie, id=3)
    expect(screen.getByRole('heading', { name: 'Charlie', level: 1 })).toBeInTheDocument()
  })

  it('navigates to the previous goal when the last goal is deleted', async () => {
    const onDeleteGoal = vi.fn()
    const user = userEvent.setup()
    renderDetail('/goal/3', { onDeleteGoal })

    await user.click(screen.getByLabelText('Goal actions'))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onDeleteGoal).toHaveBeenCalledWith(3)
    // Should navigate to prev goal (Bravo, id=2)
    expect(screen.getByRole('heading', { name: 'Bravo', level: 1 })).toBeInTheDocument()
  })

  it('navigates to /goal when the only goal is deleted', async () => {
    const onDeleteGoal = vi.fn()
    const user = userEvent.setup()
    renderDetail('/goal/1', { goals: [goalA], onDeleteGoal })

    await user.click(screen.getByLabelText('Goal actions'))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onDeleteGoal).toHaveBeenCalledWith(1)
    expect(screen.getByTestId('goals-list')).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   10. Tab bar and header hidden on detail view
   ═══════════════════════════════════════════════════════════════ */

describe('Goal page hides header/tab-bar on detail view', () => {
  // These tests render the full Goal component to test the
  // isDetailView conditional rendering
  // We import Goal lazily here so the GoalDetail child-component mocks apply
  it('does not render the tab bar or header on /goal/:id', async () => {
    vi.doMock('../../contexts/GoalsContext', () => ({
      useGoals: () => ({
        visibleGoals: threeGoals,
        gwGoals: [],
        profile: { birthday: '1990-01-01' },
        createGoal: noop,
        updateGoal: noop,
        handleDeleteGoal: noop,
        handleDeleteWithUndo: noop,
        reorderGoals: noop,
        handleCopyGwGoals: noop,
        createGwGoal: noop,
        updateGwGoal: noop,
        deleteGwGoal: noop,
      }),
    }))
    vi.doMock('../../contexts/LayoutContext', () => ({
      useLayout: () => ({ handleOpenProfile: noop }),
    }))
    const Goal = (await import('./Goal')).default

    render(
      <MemoryRouter initialEntries={['/goal/1']}>
        <Routes>
          <Route path="/goal/*" element={<Goal />} />
        </Routes>
      </MemoryRouter>,
    )

    // Tab bar should NOT be present on detail view
    expect(screen.queryByRole('navigation', { name: 'Goals sections' })).not.toBeInTheDocument()
    // The "Goals" h1 header should NOT be present
    expect(screen.queryByRole('heading', { name: 'Goals', level: 1 })).not.toBeInTheDocument()
    // But the goal detail title IS present
    expect(screen.getByRole('heading', { name: 'Alpha', level: 1 })).toBeInTheDocument()
  })

  it('renders the tab bar and header on /goal (non-detail view)', async () => {
    vi.doMock('../../contexts/GoalsContext', () => ({
      useGoals: () => ({
        visibleGoals: threeGoals,
        gwGoals: [],
        profile: { birthday: '1990-01-01' },
        createGoal: noop,
        updateGoal: noop,
        handleDeleteGoal: noop,
        handleDeleteWithUndo: noop,
        reorderGoals: noop,
        handleCopyGwGoals: noop,
        createGwGoal: noop,
        updateGwGoal: noop,
        deleteGwGoal: noop,
      }),
    }))
    vi.doMock('../../contexts/LayoutContext', () => ({
      useLayout: () => ({ handleOpenProfile: noop }),
    }))
    const Goal = (await import('./Goal')).default

    render(
      <MemoryRouter initialEntries={['/goal']}>
        <Routes>
          <Route path="/goal/*" element={<Goal />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('navigation', { name: 'Goals sections' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Goals', level: 1 })).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   11. GoalDrawer no longer exists
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDrawer removal', () => {
  it('GoalDrawer.tsx file does not exist in the components directory', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const drawerPath = path.resolve(__dirname, 'components', 'GoalDrawer.tsx')
    expect(fs.existsSync(drawerPath)).toBe(false)
  })

  it('GoalDrawer.css file does not exist in the styles directory', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const cssPath = path.resolve(__dirname, '..', '..', 'styles', 'GoalDrawer.css')
    expect(fs.existsSync(cssPath)).toBe(false)
  })

  it('GoalsSection source does not reference GoalDrawer', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const sectionPath = path.resolve(__dirname, 'components', 'GoalsSection.tsx')
    const source = fs.readFileSync(sectionPath, 'utf-8')
    expect(source).not.toContain('GoalDrawer')
  })
})

describe('GoalDetail summary threading', () => {
  it('renders the FI and GW section headings', () => {
    mockSummaryCard()

    renderDetail('/goal/1', { goals: [goalA] })

    expect(screen.getByRole('heading', { name: /FI Financial Independence/, level: 2 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /GW Generational Wealth/, level: 2 })).toBeInTheDocument()
  })

  it('threads the selected-year monthly savings into GoalDiveDeep', () => {
    mockSummaryCard({ yearMonthlySaving: 4000 })

    renderDetail('/goal/1', { goals: [goalA] })

    expect(screen.getByTestId('dive-deep')).toHaveAttribute('data-monthly-contribution', '4000')
  })

  it('threads the inflation setting into GoalDetailedCard and GoalDiveDeep', () => {
    mockSummaryCard()

    renderDetail('/goal/1', { goals: [goalA] })

    expect(screen.getByTestId('detailed-card')).toHaveAttribute('data-inflation', '3')
    expect(screen.getByTestId('dive-deep')).toHaveAttribute('data-inflation', '3')
  })

  it('threads GW baseline values into GoalDiveDeep when summary data is available', async () => {
    mockSummaryCard()
    vi.spyOn(goalMathModule, 'getTotalForMonth').mockImplementation((_accounts, _balances, _month, goalType) =>
      goalType === 'gw' ? 50_000 : 100_000,
    )
    vi.spyOn(goalMathModule, 'getGwTarget').mockReturnValue(150_000)

    renderDetail('/goal/1', {
      goals: [goalA],
      gwGoals: [
        {
          id: 1,
          fiGoalId: 1,
          label: 'Legacy',
          disburseAmount: 100000,
          growthRate: 8,
          currentSavings: 0,
          disburseAge: 80,
          createdAt: '2024-01-01',
        },
      ],
    })

    await waitFor(() => {
      expect(screen.getByTestId('dive-deep')).toHaveAttribute('data-gw-balance', '50000')
    })
    expect(screen.getByTestId('dive-deep')).toHaveAttribute('data-gw-monthly-contribution', '5000')
    expect(screen.getByTestId('dive-deep')).toHaveAttribute('data-gw-target', '150000')
    expect(screen.getByTestId('dive-deep')).toHaveAttribute('data-gw-target-month', '2050-01')
  })

  it('threads the projected FIRE month into GoalDiveDeep after the chart reports it', async () => {
    mockSummaryCard()

    renderDetail('/goal/1', { goals: [goalA] })

    await waitFor(() => {
      expect(screen.getByTestId('dive-deep')).toHaveAttribute('data-projected-fi-month', '2036-08')
    })
  })

  it('passes zeroed GW props when no GW summary data exists', () => {
    renderDetail('/goal/1', { goals: [goalA] })

    expect(screen.getByTestId('dive-deep')).toHaveAttribute('data-gw-balance', '0')
    expect(screen.getByTestId('dive-deep')).toHaveAttribute('data-gw-target', '0')
  })

  it('threads the selected summary year into GoalDetailedCard', () => {
    mockSummaryCard({ monthlySaving: 5000, yearMonthlySaving: 4000 })

    renderDetail('/goal/1', { goals: [goalA] })

    expect(screen.getByTestId('detailed-card')).toHaveAttribute('data-summary-year', String(currentYear))
  })
})
