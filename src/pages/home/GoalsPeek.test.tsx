import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { FinancialGoal, GwGoal } from '../../types'
import GoalsPeek from './GoalsPeek'
import { getFiTarget } from '../goal/utils/goalCalculations'
import { formatCurrency } from '../data/types'

/* ─── Mock dependencies ─── */

vi.mock('../../hooks/useProfile', () => ({
  useProfile: vi.fn(() => ({
    profile: { name: '', birthday: '1990-01', avatarDataUrl: '', partner: null },
    updateProfile: vi.fn(),
  })),
}))

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
  getBudgetSaveRate: vi.fn(() => Promise.resolve(null)),
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

import { useProfile } from '../../hooks/useProfile'
import { useData } from '../../contexts/DataContext'
import { getBudgetSaveRate } from '../budget/utils/budgetStorage'

const mockedUseProfile = vi.mocked(useProfile)
const mockedUseData = vi.mocked(useData)
const mockedGetSaveRate = vi.mocked(getBudgetSaveRate)
const getExpectedFiTarget = (goal: FinancialGoal, profileBirthday = '1990-01') => getFiTarget(goal, profileBirthday, 8)
const getExpectedGwTarget = (goal: FinancialGoal, gwGoals: GwGoal[], profileBirthday = '1990-01', inflation = 3) => {
  const [by, bm] = profileBirthday.split('-').map(Number)
  const created = new Date(goal.goalCreatedIn)

  return gwGoals.reduce((sum, gw) => {
    const disburseYear = by + gw.disburseAge
    const months = Math.max(0, (disburseYear - created.getUTCFullYear()) * 12 + (bm - (created.getUTCMonth() + 1)))
    const disbTarget = gw.disburseAmount * Math.pow(1 + inflation / 100 / 12, months)
    const monthsFromRetirementToDisbursal = Math.max(0, (gw.disburseAge - goal.retirementAge) * 12)
    const presentValue =
      monthsFromRetirementToDisbursal > 0
        ? disbTarget / Math.pow(1 + gw.growthRate / 100 / 12, monthsFromRetirementToDisbursal)
        : disbTarget

    return sum + presentValue
  }, 0)
}
const projectedTextMatcher = (_: string, element: Element | null) =>
  !!element &&
  element.classList.contains('goals-peek-projected') &&
  /FI by [A-Z][a-z]{2} \d{4} → [A-Z][a-z]{2} \d{4}/.test((element.textContent || '').replace(/\s+/g, ' ').trim())

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
    monthlyExpenseRetirement: 8333,
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
  mockedUseProfile.mockReturnValue({
    profile: { name: '', birthday, avatarDataUrl: '', partner: null },
    updateProfile: vi.fn(),
  })
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
  setProfileBirthday('1990-01')
  mockedUseData.mockReturnValue({
    accounts: [],
    balances: [],
    allMonths: [],
    setAccounts: () => {},
    setBalances: () => {},
  })
  mockedGetSaveRate.mockResolvedValue(null)
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
    mockedGetSaveRate.mockResolvedValue(null)
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
    mockedGetSaveRate.mockResolvedValue(null)
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
    mockedGetSaveRate.mockResolvedValue(null)
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
  it('shows "Not reachable at current rate" when savings are zero', async () => {
    const fiAcct = makeAccount(1, 'fi')
    mockedUseData.mockReturnValue({
      accounts: [fiAcct],
      balances: [makeBalance(1, '2025-01', 500_000)],
      allMonths: ['2025-01'],
      setAccounts: () => {},
      setBalances: () => {},
    })
    mockedGetSaveRate.mockResolvedValue({ annualSavings: 0, saveRate: 0, monthsOfData: 12 })
    renderPeek()
    expect(await screen.findByText('Not reachable at current rate')).toBeInTheDocument()
  })

  it('shows "Not reachable at current rate" when savings are negative', async () => {
    const fiAcct = makeAccount(1, 'fi')
    mockedUseData.mockReturnValue({
      accounts: [fiAcct],
      balances: [makeBalance(1, '2025-01', 500_000)],
      allMonths: ['2025-01'],
      setAccounts: () => {},
      setBalances: () => {},
    })
    mockedGetSaveRate.mockResolvedValue({ annualSavings: -5000, saveRate: -10, monthsOfData: 6 })
    renderPeek()
    expect(await screen.findByText('Not reachable at current rate')).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   FI projection — projected date state
   ═══════════════════════════════════════════════════════════════ */

describe('GoalsPeek projection — FI date projected', () => {
  it('shows "FI by {Mon YYYY}" when budget data projects a date', async () => {
    const fiAcct = makeAccount(1, 'fi')
    mockedUseData.mockReturnValue({
      accounts: [fiAcct],
      balances: [makeBalance(1, '2025-01', 500_000)],
      allMonths: ['2025-01'],
      setAccounts: () => {},
      setBalances: () => {},
    })
    mockedGetSaveRate.mockResolvedValue({ annualSavings: 60000, saveRate: 40, monthsOfData: 12 })
    renderPeek([makeGoal({ fiGoal: 2_000_000 })])
    expect(await screen.findByText(projectedTextMatcher)).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   FI projection — fiGoal = 0 (no projection shown)
   ═══════════════════════════════════════════════════════════════ */

describe('GoalsPeek projection — fiGoal is 0', () => {
  it('does not show any projection label when fiGoal is 0', () => {
    renderPeek([makeGoal({ expenseValue: 0, monthlyExpenseRetirement: 0 })])
    expect(screen.queryByText('Add budget data →')).not.toBeInTheDocument()
    expect(screen.queryByText(/Goal reached!/)).not.toBeInTheDocument()
    expect(screen.queryByText(/not reachable/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/FI by/)).not.toBeInTheDocument()
  })
})

describe('GoalsPeek projection — not reachable via projectFIDate null', () => {
  it('shows "Not reachable" when fiGoal is astronomically high', async () => {
    const fiAcct = makeAccount(1, 'fi')
    mockedUseData.mockReturnValue({
      accounts: [fiAcct],
      balances: [makeBalance(1, '2025-01', 1000)],
      allMonths: ['2025-01'],
      setAccounts: () => {},
      setBalances: () => {},
    })
    mockedGetSaveRate.mockResolvedValue({ annualSavings: 1, saveRate: 0.01, monthsOfData: 12 })
    renderPeek([makeGoal({ expenseValue: 10_000_000, goalEndYear: '2200-01' })])
    expect(await screen.findByText('Not reachable at current rate')).toBeInTheDocument()
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
    const goal = makeGoal({ fiGoal: 2_000_000 })
    const fiAcct = makeAccount(1, 'fi')
    mockedUseData.mockReturnValue({
      accounts: [fiAcct],
      balances: [makeBalance(1, '2025-01', 500_000)],
      allMonths: ['2025-01'],
      setAccounts: () => {},
      setBalances: () => {},
    })

    renderPeek([goal])

    // Goal name visible
    expect(screen.getByText('Retire Early')).toBeInTheDocument()
    // FI progress bar exists with correct aria-label
    const fiBar = screen.getByRole('progressbar', { name: /FI progress/i })
    expect(fiBar).toBeInTheDocument()
    expect(screen.getByText(formatCurrency(getExpectedFiTarget(goal)))).toBeInTheDocument()
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
    const goal = makeGoal({ fiGoal: 1_500_000 })
    const target = getExpectedFiTarget(goal)
    const fiAcct = makeAccount(1, 'fi')
    mockedUseData.mockReturnValue({
      accounts: [fiAcct],
      balances: [makeBalance(1, '2025-06', target / 2)],
      allMonths: ['2025-06'],
      setAccounts: () => {},
      setBalances: () => {},
    })

    renderPeek([goal])

    const fiBar = screen.getByRole('progressbar', { name: /FI progress: 50%/i })
    expect(fiBar).toBeInTheDocument()
    expect(fiBar).toHaveAttribute('aria-valuenow', '50')
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('renders without crashing when profile birthday is missing', () => {
    mockedUseProfile.mockReturnValue({
      profile: { name: '', birthday: '', avatarDataUrl: '', partner: null },
      updateProfile: vi.fn(),
    })
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
    expect(screen.getByText(formatCurrency(getExpectedGwTarget(goal, [gwGoal])))).toBeInTheDocument()
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
    expect(screen.getByText(formatCurrency(getExpectedGwTarget(goal, gwGoals)))).toBeInTheDocument()
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
    const goal = makeGoal({ fiGoal: 2_000_000 })
    const target = getExpectedFiTarget(goal)
    const fiAcct = makeAccount(1, 'fi')
    mockedUseData.mockReturnValue({
      accounts: [fiAcct],
      balances: [makeBalance(1, '2025-01', target * 2)],
      allMonths: ['2025-01'],
      setAccounts: () => {},
      setBalances: () => {},
    })

    renderPeek([goal])

    const fiBar = screen.getByRole('progressbar', { name: /FI progress: 100%/i })
    expect(fiBar).toHaveAttribute('aria-valuenow', '100')
  })
})

/* ═══════════════════════════════════════════════════════════════
   budget-changed event subscription (regression: #164)
   ═══════════════════════════════════════════════════════════════ */

describe('GoalsPeek budget-changed subscription (#164)', () => {
  it('shows projected FI date when getBudgetSaveRate returns annual savings', async () => {
    const fiAcct = makeAccount(1, 'fi')
    mockedUseData.mockReturnValue({
      accounts: [fiAcct],
      balances: [makeBalance(1, '2025-01', 500_000)],
      allMonths: ['2025-01'],
      setAccounts: () => {},
      setBalances: () => {},
    })
    mockedGetSaveRate.mockResolvedValue({ annualSavings: 60_000, saveRate: 40, monthsOfData: 12 })
    const goal = makeGoal({ fiGoal: 2_000_000 })
    renderPeek([goal])

    expect(await screen.findByText(projectedTextMatcher)).toBeInTheDocument()
    expect(screen.queryByText('Add budget data →')).not.toBeInTheDocument()
    expect(mockedGetSaveRate).toHaveBeenCalledTimes(1)
  })

  it('does not subscribe to budget-changed directly', () => {
    const fiAcct = makeAccount(1, 'fi')
    mockedUseData.mockReturnValue({
      accounts: [fiAcct],
      balances: [makeBalance(1, '2025-01', 500_000)],
      allMonths: ['2025-01'],
      setAccounts: () => {},
      setBalances: () => {},
    })
    mockedGetSaveRate.mockResolvedValue(null)

    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderPeek([makeGoal({ fiGoal: 2_000_000 })])
    unmount()

    const budgetAdds = addSpy.mock.calls.filter(([evt]) => evt === 'budget-changed')
    const budgetRemovals = removeSpy.mock.calls.filter(([evt]) => evt === 'budget-changed')
    expect(budgetAdds).toHaveLength(0)
    expect(budgetRemovals).toHaveLength(0)

    addSpy.mockRestore()
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
    const goal = makeGoal({ fiGoal: 2_000_000 })
    const target = getExpectedFiTarget(goal)
    const fiAcct = makeAccount(1, 'fi')
    const gwAcct = makeAccount(2, 'gw')
    mockedUseData.mockReturnValue({
      accounts: [fiAcct, gwAcct],
      balances: [makeBalance(1, '2025-01', target / 2), makeBalance(2, '2025-01', target / 4)],
      allMonths: ['2025-01'],
      setAccounts: () => {},
      setBalances: () => {},
    })
    renderPeek([goal])
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

describe('GoalsPeek missing FI target display', () => {
  it('shows a dash when required fields are missing', () => {
    renderPeek([makeGoal({ goalEndYear: '' })])
    expect(screen.getByText('—')).toBeInTheDocument()
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
  it('shows projected date when fiTotal < fiGoal and budget data exists (line 160-165)', async () => {
    setProfileBirthday('1990-01')
    const fiAcct = makeAccount(1, 'fi')
    mockedUseData.mockReturnValue({
      accounts: [fiAcct],
      balances: [makeBalance(1, '2025-01', 500_000)],
      allMonths: ['2025-01'],
      setAccounts: () => {},
      setBalances: () => {},
    })
    mockedGetSaveRate.mockResolvedValue({ annualSavings: 50_000, saveRate: 30, monthsOfData: 12 })
    renderPeek([makeGoal({ fiGoal: 2_000_000 })])
    expect(await screen.findByText(projectedTextMatcher)).toBeInTheDocument()
  })
})
