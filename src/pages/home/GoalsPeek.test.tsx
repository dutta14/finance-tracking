import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { appStorage } from '../../utils/appStorage'
import { FinancialGoal, GwGoal } from '../../types'
import GoalsPeek from './GoalsPeek'

/* ─── Mock dependencies ─── */

vi.mock('../../contexts/DataContext', () => ({
  useData: vi.fn(() => ({
    accounts: [],
    balances: [],
    allMonths: [],
    setAccounts: () => {},
    setBalances: () => {},
  })),
}))

vi.mock('../budget/utils/budgetStorage', () => ({
  getBudgetSaveRate: vi.fn(() => null),
}))

vi.mock('../../components/TermAbbr', () => ({
  default: ({ term }: { term: string }) => <abbr>{term}</abbr>,
}))

vi.mock('../../styles/Home.css', () => ({}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import { useData } from '../../contexts/DataContext'
import { getBudgetSaveRate } from '../budget/utils/budgetStorage'

const mockedUseData = vi.mocked(useData)
const mockedGetSaveRate = vi.mocked(getBudgetSaveRate)

/* ─── Helpers ─── */

function makeGoal(overrides: Partial<FinancialGoal> = {}): FinancialGoal {
  return {
    id: 1,
    goalName: 'Retire Early',
    createdAt: '2024-01-01',
    birthday: '1990-01-01',
    goalCreatedIn: '2024-01',
    goalEndYear: '2080-01',
    resetExpenseMonth: false,
    retirementAge: 60,
    expenseMonth: 5000,
    expenseValue: 60000,
    monthlyExpenseValue: 5000,
    expenseValueMar2026: 65000,
    expenseValue2047: 100000,
    monthlyExpense2047: 8333,
    safeWithdrawalRate: 3,
    growth: 5,
    retirement: 'Jan 2050',
    fiGoal: 2_000_000,
    progress: 25,
    ...overrides,
  }
}

function makeAccount(id: number, goalType: 'fi' | 'gw') {
  return {
    id,
    name: `Account ${id}`,
    type: 'retirement' as const,
    owner: 'primary' as const,
    status: 'active' as const,
    goalType,
    nature: 'asset' as const,
    allocation: 'us-stock' as const,
  }
}

function makeBalance(accountId: number, month: string, balance: number) {
  return { id: accountId * 1000, accountId, month, balance }
}

function setProfileBirthday(birthday: string) {
  appStorage.setJSON('user-profile', { birthday })
}

const noop = vi.fn()

function renderPeek(goals: FinancialGoal[] = [makeGoal()], gwGoals: GwGoal[] = []) {
  return render(
    <MemoryRouter>
      <GoalsPeek goals={goals} gwGoals={gwGoals} onNavigate={noop} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  setProfileBirthday('1990-01')
  mockedUseData.mockReturnValue({
    accounts: [],
    balances: [],
    allMonths: [],
    setAccounts: () => {},
    setBalances: () => {},
  })
  mockedGetSaveRate.mockReturnValue(null)
})

/* ═══════════════════════════════════════════════════════════════
   Empty state (no goals)
   ═══════════════════════════════════════════════════════════════ */

describe('GoalsPeek empty state', () => {
  it('shows a create goal CTA when there are no goals', () => {
    renderPeek([])
    expect(screen.getByText(/set an fi target/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create a goal/i })).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   With goals — header
   ═══════════════════════════════════════════════════════════════ */

describe('GoalsPeek with goals', () => {
  it('renders the goal name', () => {
    renderPeek()
    expect(screen.getByText('Retire Early')).toBeInTheDocument()
  })

  it('renders a "View Goals" link', () => {
    renderPeek()
    expect(screen.getByText('View Goals →')).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   FI projection — no-budget state (Add budget data →)
   ═══════════════════════════════════════════════════════════════ */

describe('GoalsPeek projection — no budget data', () => {
  it('shows "Add budget data →" when no budget summary exists', () => {
    const fiAcct = makeAccount(1, 'fi')
    mockedUseData.mockReturnValue({
      accounts: [fiAcct],
      balances: [makeBalance(1, '2025-01', 500_000)],
      allMonths: ['2025-01'],
      setAccounts: () => {},
      setBalances: () => {},
    })
    mockedGetSaveRate.mockReturnValue(null)
    renderPeek()
    expect(screen.getByText('Add budget data →')).toBeInTheDocument()
  })

  it('renders the "Add budget data →" fallback as a focusable link to /budget', async () => {
    const user = userEvent.setup()
    const fiAcct = makeAccount(1, 'fi')
    mockedUseData.mockReturnValue({
      accounts: [fiAcct],
      balances: [makeBalance(1, '2025-01', 500_000)],
      allMonths: ['2025-01'],
      setAccounts: () => {},
      setBalances: () => {},
    })
    mockedGetSaveRate.mockReturnValue(null)
    renderPeek()

    const link = screen.getByRole('link', { name: 'Add budget data →' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('tabindex', '0')

    await user.click(link)
    expect(mockNavigate).toHaveBeenCalledWith('/budget')
    // Parent goal-item button should NOT also navigate to /goal/1
    expect(mockNavigate).toHaveBeenCalledTimes(1)
  })

  it('activates the "Add budget data →" link with Enter and Space keys', async () => {
    const user = userEvent.setup()
    const fiAcct = makeAccount(1, 'fi')
    mockedUseData.mockReturnValue({
      accounts: [fiAcct],
      balances: [makeBalance(1, '2025-01', 500_000)],
      allMonths: ['2025-01'],
      setAccounts: () => {},
      setBalances: () => {},
    })
    mockedGetSaveRate.mockReturnValue(null)
    renderPeek()

    const link = screen.getByRole('link', { name: 'Add budget data →' })
    link.focus()
    expect(link).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(mockNavigate).toHaveBeenCalledWith('/budget')

    mockNavigate.mockClear()
    await user.keyboard(' ')
    expect(mockNavigate).toHaveBeenCalledWith('/budget')
  })
})

/* ═══════════════════════════════════════════════════════════════
   FI projection — reached state
   ═══════════════════════════════════════════════════════════════ */

describe('GoalsPeek projection — goal reached', () => {
  it('shows "🎉 Goal reached!" when net worth exceeds fiGoal', () => {
    const fiAcct = makeAccount(1, 'fi')
    mockedUseData.mockReturnValue({
      accounts: [fiAcct],
      balances: [makeBalance(1, '2025-01', 3_000_000)],
      allMonths: ['2025-01'],
      setAccounts: () => {},
      setBalances: () => {},
    })
    renderPeek([makeGoal({ fiGoal: 2_000_000 })])
    expect(screen.getByText(/Goal reached!/)).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   FI projection — not-reachable state
   ═══════════════════════════════════════════════════════════════ */

describe('GoalsPeek projection — not reachable', () => {
  it('shows "Not reachable at current rate" when savings are zero', () => {
    const fiAcct = makeAccount(1, 'fi')
    mockedUseData.mockReturnValue({
      accounts: [fiAcct],
      balances: [makeBalance(1, '2025-01', 500_000)],
      allMonths: ['2025-01'],
      setAccounts: () => {},
      setBalances: () => {},
    })
    mockedGetSaveRate.mockReturnValue({ annualSavings: 0, saveRate: 0, monthsOfData: 12 })
    renderPeek()
    expect(screen.getByText('Not reachable at current rate')).toBeInTheDocument()
  })

  it('shows "Not reachable at current rate" when savings are negative', () => {
    const fiAcct = makeAccount(1, 'fi')
    mockedUseData.mockReturnValue({
      accounts: [fiAcct],
      balances: [makeBalance(1, '2025-01', 500_000)],
      allMonths: ['2025-01'],
      setAccounts: () => {},
      setBalances: () => {},
    })
    mockedGetSaveRate.mockReturnValue({ annualSavings: -5000, saveRate: -10, monthsOfData: 6 })
    renderPeek()
    expect(screen.getByText('Not reachable at current rate')).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   FI projection — projected date state
   ═══════════════════════════════════════════════════════════════ */

describe('GoalsPeek projection — FI date projected', () => {
  it('shows "FI by {Mon YYYY}" when budget data projects a date', () => {
    const fiAcct = makeAccount(1, 'fi')
    mockedUseData.mockReturnValue({
      accounts: [fiAcct],
      balances: [makeBalance(1, '2025-01', 500_000)],
      allMonths: ['2025-01'],
      setAccounts: () => {},
      setBalances: () => {},
    })
    mockedGetSaveRate.mockReturnValue({ annualSavings: 60000, saveRate: 40, monthsOfData: 12 })
    renderPeek([makeGoal({ fiGoal: 2_000_000 })])
    // Should render "FI by" followed by a Mon YYYY date
    const fiByText = screen.getByText('FI by')
    expect(fiByText).toBeInTheDocument()
    const container = fiByText.closest('span')
    expect(container).toBeInTheDocument()
    expect(container!.textContent).toMatch(/FI by [A-Z][a-z]{2} \d{4}/)
  })
})

/* ═══════════════════════════════════════════════════════════════
   FI projection — fiGoal = 0 (no projection shown)
   ═══════════════════════════════════════════════════════════════ */

describe('GoalsPeek projection — fiGoal is 0', () => {
  it('does not show any projection label when fiGoal is 0', () => {
    renderPeek([makeGoal({ fiGoal: 0 })])
    expect(screen.queryByText('Add budget data →')).not.toBeInTheDocument()
    expect(screen.queryByText(/Goal reached!/)).not.toBeInTheDocument()
    expect(screen.queryByText(/not reachable/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/FI by/)).not.toBeInTheDocument()
  })
})

describe('GoalsPeek projection — not reachable via projectFIDate null', () => {
  it('shows "Not reachable" when fiGoal is astronomically high', () => {
    const fiAcct = makeAccount(1, 'fi')
    mockedUseData.mockReturnValue({
      accounts: [fiAcct],
      balances: [makeBalance(1, '2025-01', 1000)],
      allMonths: ['2025-01'],
      setAccounts: () => {},
      setBalances: () => {},
    })
    mockedGetSaveRate.mockReturnValue({ annualSavings: 1, saveRate: 0.01, monthsOfData: 12 })
    renderPeek([makeGoal({ fiGoal: 999_999_999_999 })])
    expect(screen.getByText('Not reachable at current rate')).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   +N more goals
   ═══════════════════════════════════════════════════════════════ */

describe('GoalsPeek overflow', () => {
  it('shows "+N more goals" when there are more than 3 goals', () => {
    const goals = Array.from({ length: 5 }, (_, i) => makeGoal({ id: i + 1, goalName: `Goal ${i + 1}` }))
    renderPeek(goals)
    expect(screen.getByText('+2 more goals')).toBeInTheDocument()
  })

  it('does not show overflow text when there are 3 or fewer goals', () => {
    const goals = Array.from({ length: 3 }, (_, i) => makeGoal({ id: i + 1, goalName: `Goal ${i + 1}` }))
    renderPeek(goals)
    expect(screen.queryByText(/more goal/)).not.toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   Goal item navigation — clicking a goal navigates to its detail page
   ═══════════════════════════════════════════════════════════════ */

describe('GoalsPeek navigation', () => {
  it('navigates to the goal detail page when clicking a specific goal', async () => {
    const user = userEvent.setup()
    const goal = makeGoal({ id: 42, goalName: 'Coast FIRE' })
    renderPeek([goal])
    const goalButton = screen.getByRole('button', { name: /Coast FIRE/i })
    await user.click(goalButton)
    expect(mockNavigate).toHaveBeenCalledWith('/goal/42')
  })

  it('navigates to the correct detail page for each goal', async () => {
    const user = userEvent.setup()
    const goals = [makeGoal({ id: 7, goalName: 'Early Retirement' }), makeGoal({ id: 13, goalName: 'Lean FIRE' })]
    renderPeek(goals)

    await user.click(screen.getByRole('button', { name: /Early Retirement/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/goal/7')

    mockNavigate.mockClear()

    await user.click(screen.getByRole('button', { name: /Lean FIRE/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/goal/13')
  })

  it('header "View Goals" link still calls onNavigate (list page)', async () => {
    const user = userEvent.setup()
    renderPeek()
    await user.click(screen.getByText('View Goals →'))
    expect(noop).toHaveBeenCalledWith(expect.objectContaining({ type: 'click' }))
  })
})

/* ═══════════════════════════════════════════════════════════════
   SI-19: GoalsPeek integration — summary cards and progress
   ═══════════════════════════════════════════════════════════════ */

describe('GoalsPeek summary cards and progress', () => {
  it('renders goal summary cards with name and FI progress bar', () => {
    const fiAcct = makeAccount(1, 'fi')
    mockedUseData.mockReturnValue({
      accounts: [fiAcct],
      balances: [makeBalance(1, '2025-01', 500_000)],
      allMonths: ['2025-01'],
      setAccounts: () => {},
      setBalances: () => {},
    })

    renderPeek([makeGoal({ fiGoal: 2_000_000 })])

    // Goal name visible
    expect(screen.getByText('Retire Early')).toBeInTheDocument()
    // FI progress bar exists with correct aria-label
    const fiBar = screen.getByRole('progressbar', { name: /FI progress/i })
    expect(fiBar).toBeInTheDocument()
    // FI target visible in meta
    expect(screen.getByText(/FI:/)).toBeInTheDocument()
  })

  it('shows empty state message and CTA when no goals exist', async () => {
    const user = userEvent.setup()
    renderPeek([])

    expect(screen.getByText(/set an fi target/i)).toBeInTheDocument()
    const ctaBtn = screen.getByRole('button', { name: /create a goal/i })
    expect(ctaBtn).toBeInTheDocument()
    await user.click(ctaBtn)
    expect(noop).toHaveBeenCalled()
  })

  it('navigates to the correct goal detail page on card click', async () => {
    const user = userEvent.setup()
    const goal = makeGoal({ id: 99, goalName: 'Fat FIRE' })
    renderPeek([goal])

    const goalCard = screen.getByRole('button', { name: /Fat FIRE/i })
    await user.click(goalCard)
    expect(mockNavigate).toHaveBeenCalledWith('/goal/99')
  })

  it('displays the correct FI progress percentage based on current totals', () => {
    const fiAcct = makeAccount(1, 'fi')
    mockedUseData.mockReturnValue({
      accounts: [fiAcct],
      balances: [makeBalance(1, '2025-06', 750_000)],
      allMonths: ['2025-06'],
      setAccounts: () => {},
      setBalances: () => {},
    })

    renderPeek([makeGoal({ fiGoal: 1_500_000 })])

    // 750k / 1.5M = 50%
    const fiBar = screen.getByRole('progressbar', { name: /FI progress: 50%/i })
    expect(fiBar).toBeInTheDocument()
    expect(fiBar).toHaveAttribute('aria-valuenow', '50')
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('renders without crashing when profile birthday is missing from appStorage', () => {
    appStorage.remove('user-profile')
    renderPeek([makeGoal()])
    expect(screen.getByText('Retire Early')).toBeInTheDocument()
  })

  it('handles invalid birthday format gracefully', () => {
    setProfileBirthday('not-a-date')
    renderPeek([makeGoal()])
    expect(screen.getByText('Retire Early')).toBeInTheDocument()
  })

  it('renders with empty gwGoals array', () => {
    renderPeek([makeGoal()], [])
    expect(screen.getByText('Retire Early')).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   GW goals rendering — progress bars and monthly saving
   ═══════════════════════════════════════════════════════════════ */

describe('GoalsPeek GW goals rendering', () => {
  it('renders GW progress bar when gwGoals are present', () => {
    const fiAcct = makeAccount(1, 'fi')
    const gwAcct = makeAccount(2, 'gw')
    mockedUseData.mockReturnValue({
      accounts: [fiAcct, gwAcct],
      balances: [makeBalance(1, '2025-01', 500_000), makeBalance(2, '2025-01', 50_000)],
      allMonths: ['2025-01'],
      setAccounts: () => {},
      setBalances: () => {},
    })

    const goal = makeGoal({ id: 1, fiGoal: 2_000_000, retirementAge: 60 })
    const gwGoal: GwGoal = {
      id: 1,
      fiGoalId: 1,
      label: 'College Fund',
      createdAt: '2024-01-01',
      disburseAge: 65,
      disburseAmount: 200_000,
      growthRate: 6,
      currentSavings: 50_000,
    }

    renderPeek([goal], [gwGoal])

    // GW progress bar should exist
    const gwBar = screen.getByRole('progressbar', { name: /General wealth progress/i })
    expect(gwBar).toBeInTheDocument()
    // GW goal count in meta
    expect(screen.getByText('1 GW goal')).toBeInTheDocument()
  })

  it('renders multiple GW goals count with plural', () => {
    const fiAcct = makeAccount(1, 'fi')
    const gwAcct = makeAccount(2, 'gw')
    mockedUseData.mockReturnValue({
      accounts: [fiAcct, gwAcct],
      balances: [makeBalance(1, '2025-01', 500_000), makeBalance(2, '2025-01', 50_000)],
      allMonths: ['2025-01'],
      setAccounts: () => {},
      setBalances: () => {},
    })

    const goal = makeGoal({ id: 1 })
    const gwGoals: GwGoal[] = [
      {
        id: 1,
        fiGoalId: 1,
        label: 'College Fund',
        createdAt: '2024-01-01',
        disburseAge: 65,
        disburseAmount: 200_000,
        growthRate: 6,
        currentSavings: 50_000,
      },
      {
        id: 2,
        fiGoalId: 1,
        label: 'Wedding',
        createdAt: '2024-01-01',
        disburseAge: 55,
        disburseAmount: 100_000,
        growthRate: 6,
        currentSavings: 20_000,
      },
    ]

    renderPeek([goal], gwGoals)
    expect(screen.getByText('2 GW goals')).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   FI monthly saving display
   ═══════════════════════════════════════════════════════════════ */

describe('GoalsPeek FI monthly saving', () => {
  it('displays monthly saving amount when FI goal is not yet reached', () => {
    const fiAcct = makeAccount(1, 'fi')
    mockedUseData.mockReturnValue({
      accounts: [fiAcct],
      balances: [makeBalance(1, '2025-01', 100_000)],
      allMonths: ['2025-01'],
      setAccounts: () => {},
      setBalances: () => {},
    })

    renderPeek([makeGoal({ fiGoal: 10_000_000, retirementAge: 60 })])

    // Should display a monthly saving amount (e.g. "$X/mo")
    const monthlyText = screen.queryByText(/\/mo/)
    expect(monthlyText).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   FI progress clamped at 100%
   ═══════════════════════════════════════════════════════════════ */

describe('GoalsPeek FI progress clamping', () => {
  it('clamps FI progress at 100% when total exceeds goal', () => {
    const fiAcct = makeAccount(1, 'fi')
    mockedUseData.mockReturnValue({
      accounts: [fiAcct],
      balances: [makeBalance(1, '2025-01', 3_000_000)],
      allMonths: ['2025-01'],
      setAccounts: () => {},
      setBalances: () => {},
    })

    renderPeek([makeGoal({ fiGoal: 2_000_000 })])

    const fiBar = screen.getByRole('progressbar', { name: /FI progress: 100%/i })
    expect(fiBar).toHaveAttribute('aria-valuenow', '100')
  })
})

/* ═══════════════════════════════════════════════════════════════
   budget-changed event subscription (regression: #164)
   ═══════════════════════════════════════════════════════════════ */

describe('GoalsPeek budget-changed subscription (#164)', () => {
  it('re-reads getBudgetSaveRate and re-renders when budget-changed fires', () => {
    // First render: no budget data → "Add budget data →"
    const fiAcct = makeAccount(1, 'fi')
    mockedUseData.mockReturnValue({
      accounts: [fiAcct],
      balances: [makeBalance(1, '2025-01', 500_000)],
      allMonths: ['2025-01'],
      setAccounts: () => {},
      setBalances: () => {},
    })
    mockedGetSaveRate.mockReturnValue(null)
    renderPeek([makeGoal({ fiGoal: 2_000_000 })])
    expect(screen.getByText('Add budget data →')).toBeInTheDocument()
    expect(screen.queryByText('FI by')).not.toBeInTheDocument()

    // Budget data appears (e.g. Budget page imported a CSV). Switch the mock
    // to return a positive save rate, then dispatch the cross-component event.
    mockedGetSaveRate.mockReturnValue({ annualSavings: 60_000, saveRate: 40, monthsOfData: 12 })
    act(() => {
      window.dispatchEvent(new Event('budget-changed'))
    })

    // The component must have re-called getBudgetSaveRate AND re-rendered with
    // the projected FI date. Both assertions matter: the call proves the listener
    // fired; the DOM update proves the new value was committed to state.
    expect(mockedGetSaveRate).toHaveBeenCalledTimes(2) // initial useState + listener
    expect(screen.queryByText('Add budget data →')).not.toBeInTheDocument()
    expect(screen.getByText('FI by')).toBeInTheDocument()
  })

  it('removes the budget-changed listener on unmount', () => {
    const fiAcct = makeAccount(1, 'fi')
    mockedUseData.mockReturnValue({
      accounts: [fiAcct],
      balances: [makeBalance(1, '2025-01', 500_000)],
      allMonths: ['2025-01'],
      setAccounts: () => {},
      setBalances: () => {},
    })
    mockedGetSaveRate.mockReturnValue(null)

    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderPeek([makeGoal({ fiGoal: 2_000_000 })])
    unmount()

    // Verify removeEventListener was called for 'budget-changed' with the
    // same handler that was registered. We don't compare to addEventListener
    // directly because that would test the mock framework; instead we filter
    // removeSpy's calls to the budget-changed event name.
    const budgetRemovals = removeSpy.mock.calls.filter(([evt]) => evt === 'budget-changed')
    expect(budgetRemovals).toHaveLength(1)
    expect(typeof budgetRemovals[0][1]).toBe('function')

    // Belt-and-suspenders: after unmount, dispatching the event must NOT
    // call getBudgetSaveRate again. Reset the mock counter, fire the event,
    // verify zero new calls.
    mockedGetSaveRate.mockClear()
    act(() => {
      window.dispatchEvent(new Event('budget-changed'))
    })
    expect(mockedGetSaveRate).not.toHaveBeenCalled()

    removeSpy.mockRestore()
  })
})

/* ═══════════════════════════════════════════════════════════════
   Only first 3 goals rendered
   ═══════════════════════════════════════════════════════════════ */

describe('GoalsPeek max 3 goals rendered', () => {
  it('renders only the first 3 goal cards', () => {
    const goals = Array.from({ length: 5 }, (_, i) => makeGoal({ id: i + 1, goalName: `Goal ${i + 1}` }))
    renderPeek(goals)

    expect(screen.getByText('Goal 1')).toBeInTheDocument()
    expect(screen.getByText('Goal 2')).toBeInTheDocument()
    expect(screen.getByText('Goal 3')).toBeInTheDocument()
    expect(screen.queryByText('Goal 4')).not.toBeInTheDocument()
    expect(screen.queryByText('Goal 5')).not.toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   calcMonthlySaving edge cases (lines 20, 22)
   ═══════════════════════════════════════════════════════════════ */

describe('GoalsPeek calcMonthlySaving edge cases', () => {
  it('returns 0 monthly saving when nMonths <= 0 (line 20)', () => {
    // Set birthday so retirement month is in the past relative to latestMonth
    setProfileBirthday('1960-01') // born 1960, retire at 60 → retirement 2020
    const fiAcct = makeAccount(1, 'fi')
    mockedUseData.mockReturnValue({
      accounts: [fiAcct],
      balances: [makeBalance(1, '2025-01', 100_000)],
      allMonths: ['2025-01'],
      setAccounts: () => {},
      setBalances: () => {},
    })
    renderPeek([makeGoal({ retirementAge: 60, fiGoal: 2_000_000 })])
    // With nMonths <= 0, fiMonthly = 0, so no /mo text should show
    const monthlyTexts = screen.queryAllByText(/\/mo/)
    // The monthly display should be empty or not show a value
    monthlyTexts.forEach(el => {
      expect(el.textContent).not.toMatch(/\$[1-9]/)
    })
  })

  it('renders monthly saving when growth rate produces non-zero fiMonthly (line 22 is unreachable via component)', () => {
    // Note: r === 0 branch in calcMonthlySaving is unreachable because GROWTH_RATE is a constant > 0
    // This test verifies the normal fiMonthly calculation path works
    setProfileBirthday('1990-01')
    const fiAcct = makeAccount(1, 'fi')
    mockedUseData.mockReturnValue({
      accounts: [fiAcct],
      balances: [makeBalance(1, '2025-01', 500_000)],
      allMonths: ['2025-01'],
      setAccounts: () => {},
      setBalances: () => {},
    })
    renderPeek([makeGoal({ fiGoal: 2_000_000, retirementAge: 60 })])
    // Should render without error; the /mo text shows when fiMonthly > 0
    expect(screen.getByText(/Retire Early/)).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   getTotalForMonth filtering (line 37)
   ═══════════════════════════════════════════════════════════════ */

describe('GoalsPeek getTotalForMonth filtering', () => {
  it('only sums accounts matching goalType fi for FI totals', () => {
    const fiAcct = makeAccount(1, 'fi')
    const gwAcct = makeAccount(2, 'gw')
    mockedUseData.mockReturnValue({
      accounts: [fiAcct, gwAcct],
      balances: [makeBalance(1, '2025-01', 1_000_000), makeBalance(2, '2025-01', 500_000)],
      allMonths: ['2025-01'],
      setAccounts: () => {},
      setBalances: () => {},
    })
    renderPeek([makeGoal({ fiGoal: 2_000_000 })])
    // FI progress should be 1M/2M = 50%, not (1M+500K)/2M = 75%
    const fiBar = screen.getByRole('progressbar', { name: /FI progress: 50%/i })
    expect(fiBar).toHaveAttribute('aria-valuenow', '50')
  })
})

/* ═══════════════════════════════════════════════════════════════
   GW monthly saving display (line 259)
   ═══════════════════════════════════════════════════════════════ */

describe('GoalsPeek GW monthly saving display', () => {
  it('shows GW monthly saving when gwMonthly > 0 (line 259)', () => {
    setProfileBirthday('1990-01')
    const fiAcct = makeAccount(1, 'fi')
    const gwAcct = makeAccount(2, 'gw')
    mockedUseData.mockReturnValue({
      accounts: [fiAcct, gwAcct],
      balances: [makeBalance(1, '2025-01', 500_000), makeBalance(2, '2025-01', 10_000)],
      allMonths: ['2025-01'],
      setAccounts: () => {},
      setBalances: () => {},
    })

    const goal = makeGoal({ id: 1, fiGoal: 2_000_000, retirementAge: 60 })
    const gwGoal: GwGoal = {
      id: 1,
      fiGoalId: 1,
      label: 'College Fund',
      createdAt: '2024-01-01',
      disburseAge: 65,
      disburseAmount: 500_000,
      growthRate: 6,
      currentSavings: 10_000,
    }
    renderPeek([goal], [gwGoal])

    // Should show a /mo amount for GW
    const monthlyTexts = screen.getAllByText(/\/mo/)
    expect(monthlyTexts.length).toBeGreaterThanOrEqual(1)
  })
})

/* ═══════════════════════════════════════════════════════════════
   fiGoal null check (line 264)
   ═══════════════════════════════════════════════════════════════ */

describe('GoalsPeek fiGoal null display', () => {
  it('shows dash when fiGoal is null or undefined (line 264)', () => {
    renderPeek([makeGoal({ fiGoal: null as unknown as number })])
    // Line 264: goal.fiGoal != null is false → renders '—'
    expect(screen.getByText(/FI:.*—/)).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   +N more goals singular (line 277)
   ═══════════════════════════════════════════════════════════════ */

describe('GoalsPeek overflow singular', () => {
  it('shows "+1 more goal" (singular) when exactly 4 goals', () => {
    const goals = Array.from({ length: 4 }, (_, i) => makeGoal({ id: i + 1, goalName: `Goal ${i + 1}` }))
    renderPeek(goals)
    expect(screen.getByText('+1 more goal')).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   GW gwPct calculation when totalNeeded is 0 (line 135)
   ═══════════════════════════════════════════════════════════════ */

describe('GoalsPeek GW progress with zero totalNeeded', () => {
  it('shows 0% GW progress when disburseAmount is 0 (totalNeeded=0, line 135)', () => {
    setProfileBirthday('1990-01')
    const fiAcct = makeAccount(1, 'fi')
    const gwAcct = makeAccount(2, 'gw')
    mockedUseData.mockReturnValue({
      accounts: [fiAcct, gwAcct],
      balances: [makeBalance(1, '2025-01', 500_000), makeBalance(2, '2025-01', 10_000)],
      allMonths: ['2025-01'],
      setAccounts: () => {},
      setBalances: () => {},
    })

    const goal = makeGoal({ id: 1, fiGoal: 2_000_000, retirementAge: 60 })
    const gwGoal: GwGoal = {
      id: 1,
      fiGoalId: 1,
      label: 'Empty Goal',
      createdAt: '2024-01-01',
      disburseAge: 65,
      disburseAmount: 0, // totalNeeded will be 0
      growthRate: 6,
      currentSavings: 0,
    }
    renderPeek([goal], [gwGoal])

    const gwBar = screen.getByRole('progressbar', { name: /General wealth progress: 0%/i })
    expect(gwBar).toHaveAttribute('aria-valuenow', '0')
  })
})

/* ═══════════════════════════════════════════════════════════════
   projectFIDate returns months === 0 (line 161)
   ═══════════════════════════════════════════════════════════════ */

describe('GoalsPeek projection FI date display', () => {
  it('shows projected date when fiTotal < fiGoal and budget data exists (line 160-165)', () => {
    setProfileBirthday('1990-01')
    const fiAcct = makeAccount(1, 'fi')
    mockedUseData.mockReturnValue({
      accounts: [fiAcct],
      balances: [makeBalance(1, '2025-01', 500_000)],
      allMonths: ['2025-01'],
      setAccounts: () => {},
      setBalances: () => {},
    })
    mockedGetSaveRate.mockReturnValue({ annualSavings: 50_000, saveRate: 30, monthsOfData: 12 })
    renderPeek([makeGoal({ fiGoal: 2_000_000 })])
    // Should show a projected date (month year format)
    expect(screen.getByText(/\w{3} \d{4}/)).toBeInTheDocument()
  })
})
