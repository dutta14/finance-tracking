import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FinancialGoal } from '../../../types'
import GoalDetailedCard from './GoalDetailedCard'

/* ─── Mock external dependencies ─── */

// Mutable mock data for DataContext — tests set accounts/balances to control fiTotal
const mockDataCtx = {
  accounts: [] as { id: number; status: string; goalType: string }[],
  balances: [] as { accountId: number; month: string; balance: number }[],
  allMonths: [] as string[],
  setAccounts: () => {},
  setBalances: () => {},
}

vi.mock('../../../contexts/DataContext', () => ({
  useData: () => mockDataCtx,
}))

vi.mock('../../budget/utils/budgetStorage', () => ({
  getBudgetSaveRate: vi.fn(() => null),
}))

vi.mock('../../../components/TermAbbr', () => ({
  default: ({ term }: { term: string }) => <abbr>{term}</abbr>,
}))

vi.mock('../../../styles/GoalDetailedCard.css', () => ({}))

import { getBudgetSaveRate } from '../../budget/utils/budgetStorage'

const mockedGetSaveRate = vi.mocked(getBudgetSaveRate)

/** Helper: configure the DataContext mock so fiTotal resolves to the given value */
function setMockFiTotal(fiTotal: number) {
  if (fiTotal > 0) {
    mockDataCtx.accounts = [{ id: 1, status: 'active', goalType: 'fi' }]
    mockDataCtx.balances = [{ accountId: 1, month: '2024-01', balance: fiTotal }]
    mockDataCtx.allMonths = ['2024-01']
  } else {
    mockDataCtx.accounts = []
    mockDataCtx.balances = []
    mockDataCtx.allMonths = []
  }
}

/* ─── Helpers ─── */

function makeGoal(overrides: Partial<FinancialGoal> = {}): FinancialGoal {
  return {
    id: 1,
    goalName: 'Test Goal',
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

function renderCard(goalOverrides: Partial<FinancialGoal> = {}, props: Record<string, unknown> = {}) {
  const goal = makeGoal(goalOverrides)
  return render(<GoalDetailedCard goal={goal} profileBirthday="1990-01-15" condensed={false} {...props} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  setMockFiTotal(0)
  mockedGetSaveRate.mockReturnValue(null)
})

/* ═══════════════════════════════════════════════════════════════
   Projected Timeline Section
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetailedCard projection section', () => {
  it('renders the "Projected Timeline" section header', () => {
    renderCard()
    expect(screen.getByText('Projected Timeline')).toBeInTheDocument()
  })

  it('renders an info tooltip for the projection section', () => {
    renderCard()
    expect(screen.getByText('Based on your current savings rate and growth assumptions')).toBeInTheDocument()
  })
})

describe('GoalDetailedCard projection — no-goal state', () => {
  it('shows "—" when fiGoal is 0', () => {
    renderCard({ fiGoal: 0 })
    expect(screen.getByText('Projected completion')).toBeInTheDocument()
    // The value cell next to "Projected completion" shows "—"
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})

describe('GoalDetailedCard projection — reached state', () => {
  it('shows "🎉 Goal reached!" when net worth exceeds fiGoal', () => {
    setMockFiTotal(3_000_000)
    renderCard({ fiGoal: 2_000_000 })
    expect(screen.getByText(/Goal reached!/)).toBeInTheDocument()
  })
})

describe('GoalDetailedCard projection — no-budget state', () => {
  it('shows a link to add budget data when no budget summary exists', () => {
    setMockFiTotal(500_000)
    mockedGetSaveRate.mockReturnValue(null)
    renderCard({ fiGoal: 2_000_000 })
    const link = screen.getByText('Add budget data to see projections')
    expect(link).toBeInTheDocument()
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', '#/budget')
  })
})

describe('GoalDetailedCard projection — not-reachable state', () => {
  it('shows "Not reachable at current rate" when savings are zero', () => {
    setMockFiTotal(500_000)
    mockedGetSaveRate.mockReturnValue({ annualSavings: 0, saveRate: 0, monthsOfData: 12 })
    renderCard({ fiGoal: 2_000_000 })
    expect(screen.getByText('Not reachable at current rate')).toBeInTheDocument()
  })

  it('shows "Not reachable at current rate" when savings are negative', () => {
    setMockFiTotal(500_000)
    mockedGetSaveRate.mockReturnValue({ annualSavings: -10000, saveRate: -5, monthsOfData: 6 })
    renderCard({ fiGoal: 2_000_000 })
    expect(screen.getByText('Not reachable at current rate')).toBeInTheDocument()
  })
})

describe('GoalDetailedCard projection — projected state', () => {
  it('shows monthly savings when budget data is available', () => {
    setMockFiTotal(500_000)
    mockedGetSaveRate.mockReturnValue({ annualSavings: 60000, saveRate: 40, monthsOfData: 12 })
    renderCard({ fiGoal: 2_000_000 })
    expect(screen.getByText('Monthly savings')).toBeInTheDocument()
    expect(screen.getByText('$5,000')).toBeInTheDocument()
  })

  it('shows "Projected completion" with a month-year date label', () => {
    setMockFiTotal(500_000)
    mockedGetSaveRate.mockReturnValue({ annualSavings: 60000, saveRate: 40, monthsOfData: 12 })
    renderCard({ fiGoal: 2_000_000 })
    expect(screen.getByText('Projected completion')).toBeInTheDocument()
    // Should show a date like "Jan 2040" — any Mon YYYY pattern
    const projectedRow = screen.getByText('Projected completion').closest('.fi-card-row')
    expect(projectedRow).toBeInTheDocument()
    const valueEl = projectedRow!.querySelector('.fi-card-row-value--projected')
    expect(valueEl).toBeInTheDocument()
    expect(valueEl!.textContent).toMatch(/[A-Z][a-z]{2} \d{4}/)
  })

  it('shows "vs. target retirement" comparison text', () => {
    setMockFiTotal(500_000)
    mockedGetSaveRate.mockReturnValue({ annualSavings: 60000, saveRate: 40, monthsOfData: 12 })
    renderCard({ fiGoal: 2_000_000 })
    expect(screen.getByText('vs. target retirement')).toBeInTheDocument()
  })

  it('shows ahead/behind indicator relative to retirement date', () => {
    setMockFiTotal(500_000)
    mockedGetSaveRate.mockReturnValue({ annualSavings: 60000, saveRate: 40, monthsOfData: 12 })
    renderCard({ fiGoal: 2_000_000 })
    const retirementRow = screen.getByText('vs. target retirement').closest('.fi-card-row')
    const valueEl = retirementRow!.querySelector('.fi-card-row-value')
    // Should show something like "X years early" or "X years behind" or "On track"
    expect(valueEl!.textContent).toMatch(/early|behind|On track/)
  })

  it('renders the TrajectorySparkline SVG', () => {
    setMockFiTotal(500_000)
    mockedGetSaveRate.mockReturnValue({ annualSavings: 60000, saveRate: 40, monthsOfData: 12 })
    renderCard({ fiGoal: 2_000_000 })
    expect(screen.getByRole('figure', { name: /savings trajectory projection/i })).toBeInTheDocument()
  })
})

describe('GoalDetailedCard projection — condensed mode', () => {
  it('does not show projection section when condensed is true', () => {
    renderCard({}, { condensed: true })
    expect(screen.queryByText('Projected Timeline')).not.toBeInTheDocument()
  })
})
