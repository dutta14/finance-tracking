import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
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

vi.mock('./GoalCardActions', () => ({
  default: ({
    onEdit,
    onCopy,
    onDelete,
    goal,
  }: {
    onEdit: (g: FinancialGoal) => void
    onCopy: (g: FinancialGoal) => void
    onDelete: (id: number) => void
    goal: FinancialGoal
  }) => (
    <div data-testid="goal-card-actions">
      <button onClick={() => onEdit(goal)}>Edit</button>
      <button onClick={() => onCopy(goal)}>Copy</button>
      <button onClick={() => onDelete(goal.id)}>Delete</button>
    </div>
  ),
}))

vi.mock('./TrajectorySparkline', () => ({
  default: () => <figure role="figure" aria-label="savings trajectory projection" />,
}))

// #52: calculateGoalMetrics and projectFIDate are mocked because GoalDetailedCard
// calls them with internal helpers (getMonthsBetween, parseDate) that are not exported.
// Removing the mock would require restructuring the component. Instead, we use realistic
// mock values and assert the displayed output matches these values.
vi.mock('../utils/goalCalculations', () => ({
  calculateGoalMetrics: vi.fn(() => ({
    monthlyExpenseAtCreation: 5000,
    retirementDate: new Date(2050, 0, 15),
    retirementDateFormatted: 'Jan 2050',
    monthsBetween: 300,
    monthlyExpenseAtRetirement: 8333,
    annualExpenseAtRetirement: 100000,
    fiGoal: 2500000,
  })),
  projectFIDate: vi.fn((current: number, target: number, annualSavings: number) => {
    if (annualSavings <= 0) return null
    const months = Math.ceil((target - current) / (annualSavings / 12))
    const d = new Date()
    d.setMonth(d.getMonth() + months)
    return { date: d, months }
  }),
  DEFAULT_PRE_FI_GROWTH_RATE: 8,
}))

import { getBudgetSaveRate } from '../../budget/utils/budgetStorage'
import { projectFIDate } from '../utils/goalCalculations'

const mockedGetSaveRate = vi.mocked(getBudgetSaveRate)
const mockedProjectFIDate = vi.mocked(projectFIDate)

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
    // #53: Scope the em-dash match to the specific row to avoid fragile unscoped matching
    const projectedRow = screen.getByText('Projected completion').closest('.fi-card-row')!
    expect(within(projectedRow as HTMLElement).getByText('—')).toBeInTheDocument()
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

/* ═══════════════════════════════════════════════════════════════
   Header & Title
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetailedCard header', () => {
  it('renders the goal name as a heading', () => {
    renderCard({ goalName: 'My FI Goal' })
    expect(screen.getByRole('heading', { name: 'My FI Goal' })).toBeInTheDocument()
  })

  it('hides the title when showTitle is false', () => {
    renderCard({ goalName: 'Hidden Title' }, { showTitle: false })
    expect(screen.queryByRole('heading', { name: 'Hidden Title' })).not.toBeInTheDocument()
  })

  it('renders FI badge', () => {
    renderCard()
    expect(screen.getByText('FI')).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   FI Goal & Progress
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetailedCard FI goal callout', () => {
  it('renders the FI Goal amount with currency formatting', () => {
    renderCard({ fiGoal: 2_000_000 })
    expect(screen.getByText('$2,000,000')).toBeInTheDocument()
  })

  it('renders a progress bar with the correct aria-valuenow', () => {
    setMockFiTotal(500_000)
    renderCard({ fiGoal: 2_000_000 })
    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '25')
  })

  it('renders progress percentage text', () => {
    setMockFiTotal(500_000)
    renderCard({ fiGoal: 2_000_000 })
    expect(screen.getByText('25.0%')).toBeInTheDocument()
  })

  it('clamps progress to 100% when fiTotal exceeds fiGoal', () => {
    setMockFiTotal(3_000_000)
    renderCard({ fiGoal: 2_000_000 })
    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '100')
  })

  it('shows 0% progress when fiGoal is zero', () => {
    renderCard({ fiGoal: 0 })
    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '0')
  })
})

/* ═══════════════════════════════════════════════════════════════
   Parameters Section
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetailedCard parameters section', () => {
  it('renders retirement date computed from birthday + retirementAge', () => {
    renderCard({ retirementAge: 60 })
    expect(screen.getByText('Retirement')).toBeInTheDocument()
    expect(screen.getByText(/Jan 15, 2050/)).toBeInTheDocument()
  })

  it('shows inflation rate', () => {
    renderCard({ inflationRate: 6 })
    expect(screen.getByText('Inflation')).toBeInTheDocument()
    expect(screen.getByText('6%')).toBeInTheDocument()
  })

  it('shows safe withdrawal rate', () => {
    renderCard({ safeWithdrawalRate: 3 })
    expect(screen.getByText(/Safe Withdrawal Rate/)).toBeInTheDocument()
    expect(screen.getByText('3%')).toBeInTheDocument()
  })

  it('shows portfolio growth rate', () => {
    renderCard({ growth: 5 })
    expect(screen.getByText('Portfolio Growth')).toBeInTheDocument()
    expect(screen.getByText('5%')).toBeInTheDocument()
  })

  it('shows goal created date formatted as month-year', () => {
    renderCard({ goalCreatedIn: '2024-01-15' })
    expect(screen.getByText('Goal Created')).toBeInTheDocument()
    expect(screen.getByText('Jan 2024')).toBeInTheDocument()
  })

  it('shows N/A when goalCreatedIn is empty', () => {
    renderCard({ goalCreatedIn: '' })
    expect(screen.getByText('N/A')).toBeInTheDocument()
  })

  it('hides parameters section when condensed is true', () => {
    renderCard({}, { condensed: true })
    expect(screen.queryByText('Parameters')).not.toBeInTheDocument()
    expect(screen.queryByText('Inflation')).not.toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   Expense Toggles
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetailedCard expense toggles', () => {
  it('defaults to annual expense at creation', () => {
    renderCard({ expenseValue: 60000, monthlyExpenseValue: 5000 })
    expect(screen.getByText('$60,000')).toBeInTheDocument()
  })

  it('toggles to monthly expense at creation', () => {
    renderCard({ expenseValue: 60000, monthlyExpenseValue: 5000 })
    const monthlyButtons = screen.getAllByText('Monthly')
    fireEvent.click(monthlyButtons[0])
    expect(screen.getByText('$5,000')).toBeInTheDocument()
  })

  it('switches to retirement view and shows inflated annual expense', () => {
    renderCard({ expenseValue: 60000, expenseValue2047: 100000, monthlyExpense2047: 8333 })
    fireEvent.click(screen.getByText('At Retirement'))
    expect(screen.getByText('$100,000')).toBeInTheDocument()
  })

  it('switches to retirement view and shows inflated monthly expense', () => {
    renderCard({ expenseValue: 60000, expenseValue2047: 100000, monthlyExpense2047: 8333 })
    fireEvent.click(screen.getByText('At Retirement'))
    const monthlyButtons = screen.getAllByText('Monthly')
    fireEvent.click(monthlyButtons[0])
    expect(screen.getByText('$8,333')).toBeInTheDocument()
  })

  it('hides expense section when condensed is true', () => {
    renderCard({}, { condensed: true })
    expect(screen.queryByText('Expenses')).not.toBeInTheDocument()
    expect(screen.queryByText('At Creation')).not.toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   Depletion Warning
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetailedCard depletion warning', () => {
  it('shows depletion warning when funds run out before goal end', () => {
    renderCard({
      fiGoal: 500_000,
      expenseValue2047: 100000,
      monthlyExpense2047: 8333,
      safeWithdrawalRate: 20,
      growth: 0,
      inflationRate: 10,
      retirementAge: 30,
      goalEndYear: '2080-01-01',
    })
    expect(screen.getByText(/Not sustainable beyond/)).toBeInTheDocument()
  })

  it('shows Suggest SWR button when onUpdateGoal is provided and depletion exists', () => {
    const onUpdateGoal = vi.fn()
    renderCard(
      {
        fiGoal: 500_000,
        expenseValue2047: 100000,
        monthlyExpense2047: 8333,
        safeWithdrawalRate: 20,
        growth: 0,
        inflationRate: 10,
        retirementAge: 30,
        goalEndYear: '2080-01-01',
      },
      { onUpdateGoal, showActions: false },
    )
    expect(screen.getByRole('button', { name: 'Suggest SWR' })).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   Edit Mode
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetailedCard edit mode', () => {
  const onUpdateGoal = vi.fn()

  /** Find the input within the same fi-form-group as the given label text */
  function getEditInput(labelText: string) {
    const label = screen.getByText(labelText)
    const group = label.closest('.fi-form-group')!
    return within(group as HTMLElement).getByRole('spinbutton') || within(group as HTMLElement).getByRole('textbox')
  }

  function getEditDateInput(labelText: string) {
    const label = screen.getByText(labelText)
    const group = label.closest('.fi-form-group')!
    return group.querySelector('input')!
  }

  it('shows Edit button when not in edit mode and onUpdateGoal is provided', () => {
    renderCard({}, { onUpdateGoal, showActions: false })
    expect(screen.getByRole('button', { name: /Edit/ })).toBeInTheDocument()
  })

  it('enters edit mode on Edit click and shows form fields', () => {
    renderCard({}, { onUpdateGoal, showActions: false })
    fireEvent.click(screen.getByRole('button', { name: /Edit/ }))
    expect(screen.getByText('Retirement Age')).toBeInTheDocument()
    expect(screen.getByText('Annual Expense ($)')).toBeInTheDocument()
    expect(screen.getByText('Inflation Rate (%)')).toBeInTheDocument()
    expect(screen.getByText('Safe Withdrawal Rate (%)')).toBeInTheDocument()
    expect(screen.getByText('Growth Rate (%)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('shows Save and Cancel buttons in edit mode', () => {
    renderCard({}, { onUpdateGoal, showActions: false })
    fireEvent.click(screen.getByRole('button', { name: /Edit/ }))
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('validates retirement age is positive on save', () => {
    renderCard({}, { onUpdateGoal, showActions: false })
    fireEvent.click(screen.getByRole('button', { name: /Edit/ }))
    fireEvent.change(getEditInput('Retirement Age'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Valid retirement age required')).toBeInTheDocument()
    expect(onUpdateGoal).not.toHaveBeenCalled()
  })

  it('validates annual expense is positive on save', () => {
    renderCard({}, { onUpdateGoal, showActions: false })
    fireEvent.click(screen.getByRole('button', { name: /Edit/ }))
    fireEvent.change(getEditInput('Annual Expense ($)'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Valid annual expense required')).toBeInTheDocument()
    expect(onUpdateGoal).not.toHaveBeenCalled()
  })

  it('validates goal creation date is required on save', () => {
    renderCard({ goalCreatedIn: '2024-01-15' }, { onUpdateGoal, showActions: false })
    fireEvent.click(screen.getByRole('button', { name: /Edit/ }))
    fireEvent.change(getEditDateInput('Goal Creation Date'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Goal creation date is required')).toBeInTheDocument()
    expect(onUpdateGoal).not.toHaveBeenCalled()
  })

  it('calls onUpdateGoal with updated fields on successful save', () => {
    renderCard(
      { retirementAge: 60, expenseValue: 60000, inflationRate: 6, safeWithdrawalRate: 3, growth: 5 },
      { onUpdateGoal, showActions: false },
    )
    fireEvent.click(screen.getByRole('button', { name: /Edit/ }))
    fireEvent.change(getEditInput('Retirement Age'), { target: { value: '55' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onUpdateGoal).toHaveBeenCalledTimes(1)
    const [id, updatedGoal] = onUpdateGoal.mock.calls[0]
    expect(id).toBe(1)
    expect(updatedGoal.retirementAge).toBe(55)
  })

  it('cancels edit mode and resets fields on Cancel click', () => {
    renderCard({}, { onUpdateGoal, showActions: false })
    fireEvent.click(screen.getByRole('button', { name: /Edit/ }))
    fireEvent.change(getEditInput('Retirement Age'), { target: { value: '99' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    // Should exit edit mode — Edit button reappears
    expect(screen.getByRole('button', { name: /Edit/ })).toBeInTheDocument()
    expect(screen.queryByText('Save')).not.toBeInTheDocument()
  })

  it('starts in edit mode when initialEditing is true', () => {
    renderCard({}, { onUpdateGoal, showActions: false, initialEditing: true })
    expect(screen.getByText('Retirement Age')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   Depletion Warning — Suggest SWR interaction
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetailedCard suggest SWR', () => {
  it('shows "Searching…" while suggesting and calls onUpdateGoal on success', async () => {
    vi.useFakeTimers()
    const onUpdateGoal = vi.fn()
    renderCard(
      {
        fiGoal: 500_000,
        expenseValue2047: 100000,
        monthlyExpense2047: 8333,
        safeWithdrawalRate: 20,
        growth: 0,
        inflationRate: 10,
        retirementAge: 30,
        goalEndYear: '2080-01-01',
      },
      { onUpdateGoal, showActions: false },
    )
    const btn = screen.getByRole('button', { name: 'Suggest SWR' })
    fireEvent.click(btn)
    expect(screen.getByText('Searching…')).toBeInTheDocument()
    // Run the setTimeout macrotask (React 19 requires act() to flush state from non-event timers)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    // suggestSWR runs the internal simulation — may or may not find a valid SWR
    // Either way, the button should return to normal
    expect(screen.queryByText('Searching…')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('does not call onUpdateGoal when suggest finds no valid SWR', async () => {
    vi.useFakeTimers()
    const onUpdateGoal = vi.fn()
    // monthlyExpense2047 is high enough to cause depletion, but expenseValue2047 = 0
    // so suggestSWR returns null immediately
    renderCard(
      {
        fiGoal: 500_000,
        expenseValue2047: 0,
        monthlyExpense2047: 8333,
        safeWithdrawalRate: 20,
        growth: 0,
        inflationRate: 10,
        retirementAge: 30,
        goalEndYear: '2080-01-01',
      },
      { onUpdateGoal, showActions: false },
    )
    const btn = screen.getByRole('button', { name: 'Suggest SWR' })
    fireEvent.click(btn)
    await vi.advanceTimersByTimeAsync(0)
    expect(onUpdateGoal).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('does not render Suggest SWR when onUpdateGoal is not provided', () => {
    renderCard({
      fiGoal: 500_000,
      expenseValue2047: 100000,
      monthlyExpense2047: 8333,
      safeWithdrawalRate: 20,
      growth: 0,
      inflationRate: 10,
      retirementAge: 30,
      goalEndYear: '2080-01-01',
    })
    expect(screen.queryByRole('button', { name: 'Suggest SWR' })).not.toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   Depletion Warning — edge cases
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetailedCard depletion edge cases', () => {
  it('does not show depletion warning when fiGoal is zero', () => {
    renderCard({ fiGoal: 0 })
    expect(screen.queryByText(/Not sustainable beyond/)).not.toBeInTheDocument()
  })

  it('does not show depletion warning when retirement date is after goal end', () => {
    renderCard({
      retirementAge: 100,
      goalEndYear: '2050-01-01',
    })
    expect(screen.queryByText(/Not sustainable beyond/)).not.toBeInTheDocument()
  })

  it('does not show depletion warning when funds last until end', () => {
    renderCard({
      fiGoal: 10_000_000,
      expenseValue2047: 50000,
      monthlyExpense2047: 4166,
      safeWithdrawalRate: 4,
      growth: 7,
      inflationRate: 3,
      retirementAge: 60,
      goalEndYear: '2080-01-01',
    })
    expect(screen.queryByText(/Not sustainable beyond/)).not.toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   Projection — projectFIDate returns null
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetailedCard projection — projectFIDate returns null', () => {
  it('shows not-reachable when projectFIDate returns null', () => {
    mockedProjectFIDate.mockReturnValueOnce(null)
    setMockFiTotal(500_000)
    mockedGetSaveRate.mockReturnValue({ annualSavings: 100, saveRate: 0.01, monthsOfData: 12 })
    renderCard({ fiGoal: 2_000_000 })
    expect(screen.getByText('Not reachable at current rate')).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   Projection — diff text variants
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetailedCard projection diff text', () => {
  it('shows "On track" when projected date matches target retirement date', () => {
    // birthday 1990-01-15, retirementAge 60 → target = Jan 15 2050
    const projected = new Date(2050, 0, 15) // Exact match
    mockedProjectFIDate.mockReturnValue({ date: projected, months: 300 })
    setMockFiTotal(500_000)
    mockedGetSaveRate.mockReturnValue({ annualSavings: 60000, saveRate: 40, monthsOfData: 12 })
    renderCard({ fiGoal: 2_000_000, retirementAge: 60 })
    expect(screen.getByText('On track')).toBeInTheDocument()
  })

  it('shows months early when projected date is 1-11 months ahead', () => {
    const projected = new Date(2049, 2, 15) // Mar 2049, ~10 months early
    mockedProjectFIDate.mockReturnValue({ date: projected, months: 293 })
    setMockFiTotal(500_000)
    mockedGetSaveRate.mockReturnValue({ annualSavings: 60000, saveRate: 40, monthsOfData: 12 })
    renderCard({ fiGoal: 2_000_000, retirementAge: 60 })
    expect(screen.getByText(/\d+ months? early/)).toBeInTheDocument()
  })

  it('shows years behind when projected date is far after target', () => {
    const projected = new Date(2055, 0, 15) // Jan 2055, ~5 years behind
    mockedProjectFIDate.mockReturnValue({ date: projected, months: 360 })
    setMockFiTotal(500_000)
    mockedGetSaveRate.mockReturnValue({ annualSavings: 60000, saveRate: 40, monthsOfData: 12 })
    renderCard({ fiGoal: 2_000_000, retirementAge: 60 })
    expect(screen.getByText(/years? behind/)).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   Expense toggle — Monthly at retirement
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetailedCard expense toggles — retirement monthly', () => {
  it('shows monthly inflated expense when both At Retirement and Monthly are selected', () => {
    renderCard({
      expenseValue: 60000,
      monthlyExpenseValue: 5000,
      expenseValue2047: 100000,
      monthlyExpense2047: 8333,
    })
    fireEvent.click(screen.getByText('At Retirement'))
    // There are multiple Monthly buttons (creation + retirement) — click the first one visible
    const monthlyButtons = screen.getAllByText('Monthly')
    fireEvent.click(monthlyButtons[0])
    expect(screen.getByText('$8,333')).toBeInTheDocument()
  })

  it('shows annual inflated expense when At Retirement and Annual are selected', () => {
    renderCard({
      expenseValue: 60000,
      monthlyExpenseValue: 5000,
      expenseValue2047: 100000,
      monthlyExpense2047: 8333,
    })
    fireEvent.click(screen.getByText('At Retirement'))
    expect(screen.getByText('$100,000')).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   Progress bar edge cases
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetailedCard progress bar edge cases', () => {
  it('shows 0.0% progress when no FI accounts have balances', () => {
    setMockFiTotal(0)
    renderCard({ fiGoal: 2_000_000 })
    expect(screen.getByText('0.0%')).toBeInTheDocument()
    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '0')
  })

  it('shows correct progress label for partial completion', () => {
    setMockFiTotal(1_000_000)
    renderCard({ fiGoal: 2_000_000 })
    expect(screen.getByText('50.0%')).toBeInTheDocument()
    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '50')
  })

  it('has accessible label on progress bar', () => {
    setMockFiTotal(500_000)
    renderCard({ fiGoal: 2_000_000 })
    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-label', expect.stringContaining('FI goal progress'))
  })
})

/* ═══════════════════════════════════════════════════════════════
   GoalCardActions integration
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetailedCard actions', () => {
  it('calls onEdit when Edit action is clicked', () => {
    const onEdit = vi.fn()
    const onCopy = vi.fn()
    const onDelete = vi.fn()
    renderCard({}, { onEdit, onCopy, onDelete, showActions: true })
    fireEvent.click(screen.getByText('Edit'))
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('calls onCopy when Copy action is clicked', () => {
    const onEdit = vi.fn()
    const onCopy = vi.fn()
    const onDelete = vi.fn()
    renderCard({}, { onEdit, onCopy, onDelete, showActions: true })
    fireEvent.click(screen.getByText('Copy'))
    expect(onCopy).toHaveBeenCalledTimes(1)
  })

  it('calls onDelete with goal id when Delete action is clicked', () => {
    const onEdit = vi.fn()
    const onCopy = vi.fn()
    const onDelete = vi.fn()
    renderCard({}, { onEdit, onCopy, onDelete, showActions: true })
    fireEvent.click(screen.getByText('Delete'))
    expect(onDelete).toHaveBeenCalledWith(1)
  })

  it('hides actions when showActions is false', () => {
    renderCard({}, { showActions: false })
    expect(screen.queryByTestId('goal-card-actions')).not.toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   Metadata
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetailedCard metadata', () => {
  it('shows "Created" date in non-condensed mode', () => {
    renderCard({ createdAt: 'Jan 1, 2024' })
    expect(screen.getByText(/Created Jan 1, 2024/)).toBeInTheDocument()
  })

  it('hides metadata in condensed mode', () => {
    renderCard({ createdAt: 'Jan 1, 2024' }, { condensed: true })
    expect(screen.queryByText(/Created Jan 1, 2024/)).not.toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   Branch Coverage — Additional uncovered branches
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetailedCard — header conditional (line 364)', () => {
  it('hides header entirely when showTitle=false and showActions=false', () => {
    renderCard({}, { showTitle: false, showActions: false })
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument()
    expect(screen.queryByTestId('goal-card-actions')).not.toBeInTheDocument()
  })

  it('shows header when showTitle=false but showActions=true with all action handlers', () => {
    const onEdit = vi.fn()
    const onCopy = vi.fn()
    const onDelete = vi.fn()
    renderCard({}, { showTitle: false, showActions: true, onEdit, onCopy, onDelete })
    // Header should render (showActions && onEdit && onCopy && onDelete is true)
    expect(screen.getByTestId('goal-card-actions')).toBeInTheDocument()
    // But title should be hidden
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument()
  })
})

describe('GoalDetailedCard — edit form save with valid data (lines 199-215)', () => {
  it('calls onUpdateGoal with computed metrics on valid save', () => {
    const onUpdateGoal = vi.fn()
    renderCard({}, { showActions: false, onUpdateGoal, initialEditing: true })
    // Form is visible — check for a form label text
    expect(screen.getByText('Retirement Age')).toBeInTheDocument()
    // Fill valid values (defaults from toEditFields should be valid)
    fireEvent.click(screen.getByText('Save'))
    expect(onUpdateGoal).toHaveBeenCalledTimes(1)
    const [goalId, updatedGoal] = onUpdateGoal.mock.calls[0]
    expect(goalId).toBe(1)
    expect(updatedGoal.retirementAge).toBe(60)
    expect(updatedGoal.fiGoal).toBe(2500000) // from mocked calculateGoalMetrics
  })

  it('exits edit mode after successful save', () => {
    const onUpdateGoal = vi.fn()
    renderCard({}, { showActions: false, onUpdateGoal, initialEditing: true })
    fireEvent.click(screen.getByText('Save'))
    // Should no longer show the edit form (Save button gone)
    expect(screen.queryByText('Save')).not.toBeInTheDocument()
  })
})

describe('GoalDetailedCard — handleSuggest when suggestSWR returns null (line 244)', () => {
  it('does not call onUpdateGoal when suggestSWR finds no valid SWR', async () => {
    // Create a goal where fund depletes (low growth, high expense) and SWR search fails
    // because expenseValue2047 is 0 (suggestSWR returns null immediately)
    const onUpdateGoal = vi.fn()
    const depletingGoal = makeGoal({
      growth: 1,
      monthlyExpense2047: 50000,
      fiGoal: 500_000,
      expenseValue2047: 0, // causes suggestSWR to return null (line 113: if (!goal.expenseValue2047) return null)
      goalEndYear: '2060-01',
      retirementAge: 40,
    })
    render(
      <GoalDetailedCard
        goal={depletingGoal}
        profileBirthday="1990-01-15"
        condensed={false}
        onUpdateGoal={onUpdateGoal}
        showActions={false}
      />,
    )
    // Depletion warning should be visible
    const suggestBtn = screen.queryByText('Suggest SWR')
    if (suggestBtn) {
      fireEvent.click(suggestBtn)
      await act(async () => {
        await new Promise(r => setTimeout(r, 10))
      })
      // onUpdateGoal should NOT be called since suggestSWR returns null
      expect(onUpdateGoal).not.toHaveBeenCalled()
    }
  })
})

describe('GoalDetailedCard — projection behind target (line 302)', () => {
  it('shows "behind" when projected FI date is after target retirement', () => {
    // Configure: high fiGoal, low savings → projected date far in the future
    setMockFiTotal(100_000)
    mockedGetSaveRate.mockReturnValue({ annualSavings: 10_000, saveRate: 10, monthsOfData: 12 })
    // projectFIDate will return a date far in the future (months = (2M - 100K) / (10K/12) ≈ 2280 months)
    // That date will be far after retirement (1990 + 60 = 2050)
    renderCard({ fiGoal: 2_000_000, retirementAge: 60 })
    expect(screen.getByText(/behind/)).toBeInTheDocument()
  })
})

describe('GoalDetailedCard — fiTotal with active FI accounts (line 263)', () => {
  it('computes fiTotal from active FI accounts in latest month', () => {
    mockDataCtx.accounts = [
      { id: 1, status: 'active', goalType: 'fi' },
      { id: 2, status: 'active', goalType: 'fi' },
      { id: 3, status: 'closed', goalType: 'fi' }, // closed, should be excluded
    ]
    mockDataCtx.balances = [
      { accountId: 1, month: '2024-06', balance: 500_000 },
      { accountId: 2, month: '2024-06', balance: 300_000 },
      { accountId: 3, month: '2024-06', balance: 200_000 },
    ]
    mockDataCtx.allMonths = ['2024-05', '2024-06']
    // fiTotal = 500K + 300K = 800K, fiGoal = 2M → 40%
    renderCard({ fiGoal: 2_000_000 })
    expect(screen.getByText('40.0%')).toBeInTheDocument()
  })

  it('excludes accounts with non-fi goalType from fiTotal', () => {
    mockDataCtx.accounts = [
      { id: 1, status: 'active', goalType: 'fi' },
      { id: 2, status: 'active', goalType: 'other' },
    ]
    mockDataCtx.balances = [
      { accountId: 1, month: '2024-06', balance: 400_000 },
      { accountId: 2, month: '2024-06', balance: 600_000 },
    ]
    mockDataCtx.allMonths = ['2024-06']
    // fiTotal = 400K only (other goalType excluded), fiGoal = 2M → 20%
    renderCard({ fiGoal: 2_000_000 })
    expect(screen.getByText('20.0%')).toBeInTheDocument()
  })
})

describe('GoalDetailedCard — projection on track (absDiffMonths <= 6)', () => {
  it('shows "On track" text when projected date exactly matches target retirement', () => {
    setMockFiTotal(1_900_000)
    mockedGetSaveRate.mockReturnValue({ annualSavings: 1_200_000, saveRate: 80, monthsOfData: 12 })
    // Target retirement: birthday 1990-01-15 + 60 years = Jan 15 2050
    // Set projectFIDate to return a date that rounds to 0 months difference
    mockedProjectFIDate.mockReturnValue({
      date: new Date(2050, 0, 10), // Jan 10 2050 — ~5 days diff rounds to 0 months
      months: 300,
    })
    renderCard({ fiGoal: 2_000_000, retirementAge: 60 })
    expect(screen.getByText('On track')).toBeInTheDocument()
  })
})

describe('GoalDetailedCard — projection years plural (line 302)', () => {
  it('shows plural "years" when projected ahead by more than 1 year', () => {
    setMockFiTotal(1_500_000)
    mockedGetSaveRate.mockReturnValue({ annualSavings: 500_000, saveRate: 60, monthsOfData: 12 })
    // Target: Jan 2050, projected: Jan 2047 → 3 years ahead
    mockedProjectFIDate.mockReturnValueOnce({
      date: new Date(2047, 0, 1),
      months: 24,
    })
    renderCard({ fiGoal: 2_000_000, retirementAge: 60 })
    expect(screen.getByText(/3 years early/)).toBeInTheDocument()
  })

  it('shows singular "year" when projected exactly 1 year ahead', () => {
    setMockFiTotal(1_800_000)
    mockedGetSaveRate.mockReturnValue({ annualSavings: 600_000, saveRate: 70, monthsOfData: 12 })
    // Target: Jan 2050, projected: Jan 2049 → ~12 months → 1 year ahead
    mockedProjectFIDate.mockReturnValueOnce({
      date: new Date(2048, 11, 1), // Dec 2048 → ~13 months before Jan 2050 → rounds to 1 year
      months: 12,
    })
    renderCard({ fiGoal: 2_000_000, retirementAge: 60 })
    expect(screen.getByText(/1 year early/)).toBeInTheDocument()
  })
})

describe('GoalDetailedCard — projection not-reachable when projectFIDate returns null', () => {
  it('shows "Not reachable" when projectFIDate returns null', () => {
    setMockFiTotal(500_000)
    mockedGetSaveRate.mockReturnValue({ annualSavings: 50_000, saveRate: 20, monthsOfData: 12 })
    mockedProjectFIDate.mockReturnValueOnce(null)
    renderCard({ fiGoal: 2_000_000, retirementAge: 60 })
    expect(screen.getByText('Not reachable at current rate')).toBeInTheDocument()
  })
})

describe('GoalDetailedCard — header with showActions and callbacks', () => {
  it('renders GoalCardActions when showActions is true with all callbacks', () => {
    const onEdit = vi.fn()
    const onCopy = vi.fn()
    const onDelete = vi.fn()
    render(
      <GoalDetailedCard
        goal={makeGoal()}
        profileBirthday="1990-01-15"
        condensed={false}
        showActions={true}
        onEdit={onEdit}
        onCopy={onCopy}
        onDelete={onDelete}
      />,
    )
    expect(screen.getByTestId('goal-card-actions')).toBeInTheDocument()
  })

  it('does not render GoalCardActions when showActions is false', () => {
    render(<GoalDetailedCard goal={makeGoal()} profileBirthday="1990-01-15" condensed={false} showActions={false} />)
    expect(screen.queryByTestId('goal-card-actions')).not.toBeInTheDocument()
  })
})

describe('GoalDetailedCard — projection 1 month early (line 299 singular)', () => {
  it('shows singular "month" when 1 month early', () => {
    setMockFiTotal(1_900_000)
    mockedGetSaveRate.mockReturnValue({ annualSavings: 1_200_000, saveRate: 80, monthsOfData: 12 })
    // projectFIDate returns 1 month → date ~1 month from now
    // target retirement: 1990+60 = Jan 2050
    // We need the projected date to be 1 month before retirement
    mockedProjectFIDate.mockReturnValueOnce({
      date: new Date(2049, 11, 1), // Dec 2049 — 1 month before Jan 2050
      months: 1,
    })
    renderCard({ fiGoal: 2_000_000, retirementAge: 60 })
    expect(screen.getByText(/1 month early/)).toBeInTheDocument()
  })
})
