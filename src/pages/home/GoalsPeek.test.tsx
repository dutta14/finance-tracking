import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
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
    inflationRate: 6,
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
    type: 'retirement',
    owner: 'primary',
    status: 'active' as const,
    goalType,
    nature: 'asset',
    allocation: 'us-stock',
  }
}

function makeBalance(accountId: number, month: string, balance: number) {
  return { id: accountId * 1000, accountId, month, balance }
}

function setProfileBirthday(birthday: string) {
  localStorage.setItem('user-profile', JSON.stringify({ birthday }))
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
    expect(screen.getByText('FI by')).toBeInTheDocument()
    const dateEl = screen.getByText('FI by').closest('span')?.querySelector('.goals-peek-projected-date')
    expect(dateEl).toBeInTheDocument()
    expect(dateEl!.textContent).toMatch(/[A-Z][a-z]{2} \d{4}/)
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
