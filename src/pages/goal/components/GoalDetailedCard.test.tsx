import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
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
    renderCard({}, { onUpdateGoal, showActions: false })
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
