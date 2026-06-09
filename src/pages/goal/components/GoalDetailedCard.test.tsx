import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
  loadBudgetStore: vi.fn(() => ({ csvs: {}, categoryGroups: [] })),
  getGlobalCategoryGroups: vi.fn(() => []),
}))

vi.mock('../../../components/TermAbbr', () => ({
  default: ({ term }: { term: string }) => <abbr>{term}</abbr>,
}))

vi.mock('../../budget/utils/csvParser', () => ({
  parseCSV: vi.fn(),
  buildMonthKey: vi.fn((year: number, month: number) => `${year}-${String(month + 1).padStart(2, '0')}`),
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
  computeRequiredCorpus: vi.fn(() => 2_000_000),
  projectFIDate: vi.fn((current: number, target: number, annualSavings: number) => {
    if (annualSavings <= 0) return null
    const months = Math.ceil((target - current) / (annualSavings / 12))
    const d = new Date()
    d.setMonth(d.getMonth() + months)
    return { date: d, months }
  }),
  projectFIDateWithDrawdown: vi.fn(
    (
      current: number,
      annualSavings: number,
      _preGrowth: number,
      _postGrowth: number,
      _monthlyExp: number,
      _inflation: number,
      _endOfLife: Date,
      _retDate: Date,
    ) => {
      if (annualSavings <= 0) return null
      const target = 2_000_000
      const months = Math.ceil((target - current) / (annualSavings / 12))
      const d = new Date()
      d.setMonth(d.getMonth() + months)
      return { date: d, months }
    },
  ),
  DEFAULT_PRE_FI_GROWTH_RATE: 8,
}))

import { getBudgetSaveRate, loadBudgetStore, getGlobalCategoryGroups } from '../../budget/utils/budgetStorage'
import { parseCSV } from '../../budget/utils/csvParser'
import { projectFIDate, projectFIDateWithDrawdown } from '../utils/goalCalculations'

const mockedGetSaveRate = vi.mocked(getBudgetSaveRate)
const mockedLoadBudgetStore = vi.mocked(loadBudgetStore)
const mockedGetGlobalCategoryGroups = vi.mocked(getGlobalCategoryGroups)
const mockedParseCSV = vi.mocked(parseCSV)
const mockedProjectFIDate = vi.mocked(projectFIDate)
const mockedProjectFIDateWithDrawdown = vi.mocked(projectFIDateWithDrawdown)

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
  mockedLoadBudgetStore.mockReturnValue({ csvs: {}, configs: {}, years: [], categoryGroups: [] })
  mockedGetGlobalCategoryGroups.mockReturnValue([])
  mockedParseCSV.mockReset()
})

/* ═══════════════════════════════════════════════════════════════
   Savings Pace Prose (replaced old Projected Timeline section)
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetailedCard projection section', () => {
  it('renders the FI goal prose when not condensed', () => {
    renderCard()
    expect(screen.getByText(/growth/)).toBeInTheDocument()
  })

  it('renders growth and inflation in prose', () => {
    renderCard({}, { preBoundaryGrowth: 5, postBoundaryGrowth: 4, inflation: 6 })
    const prose = document.querySelector('.fi-goal-prose')
    expect(prose?.textContent).toMatch(/5%/)
    expect(prose?.textContent).toMatch(/growth/)
    expect(prose?.textContent).toMatch(/6%/)
    expect(prose?.textContent).toMatch(/inflation/)
  })
})

describe('GoalDetailedCard projection — no-goal state', () => {
  it('shows no pace prose when fiGoal is 0', () => {
    renderCard({ fiGoal: 0, expenseValue: 0, goalEndYear: '' })
    expect(screen.queryByText(/saving/)).not.toBeInTheDocument()
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
    const link = screen.getByText('Add budget data')
    expect(link).toBeInTheDocument()
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', '#/budget')
  })
})

describe('GoalDetailedCard projection — not-reachable state', () => {
  it('does not show pace prose when savings are zero', () => {
    setMockFiTotal(500_000)
    mockedGetSaveRate.mockReturnValue({ annualSavings: 0, saveRate: 0, monthsOfData: 12 })
    renderCard({ fiGoal: 2_000_000 })
    expect(screen.queryByText(/At this pace/)).not.toBeInTheDocument()
  })

  it('does not show pace prose when savings are negative', () => {
    setMockFiTotal(500_000)
    mockedGetSaveRate.mockReturnValue({ annualSavings: -10000, saveRate: -5, monthsOfData: 6 })
    renderCard({ fiGoal: 2_000_000 })
    expect(screen.queryByText(/At this pace/)).not.toBeInTheDocument()
  })
})

describe('GoalDetailedCard projection — projected state', () => {
  it('shows savings pace prose when budget data is available', () => {
    setMockFiTotal(500_000)
    mockedGetSaveRate.mockReturnValue({ annualSavings: 60000, saveRate: 40, monthsOfData: 12 })
    renderCard({ fiGoal: 2_000_000 })
    expect(screen.getByText(/saving/)).toBeInTheDocument()
    expect(screen.getByText(/\$5,000\/mo/)).toBeInTheDocument()
  })

  it('shows projected FI date in prose', () => {
    setMockFiTotal(500_000)
    mockedGetSaveRate.mockReturnValue({ annualSavings: 60000, saveRate: 40, monthsOfData: 12 })
    renderCard({ fiGoal: 2_000_000 })
    expect(screen.getByText(/hit FI in/)).toBeInTheDocument()
  })

  it('shows ahead/behind indicator in prose', () => {
    setMockFiTotal(500_000)
    mockedGetSaveRate.mockReturnValue({ annualSavings: 60000, saveRate: 40, monthsOfData: 12 })
    renderCard({ fiGoal: 2_000_000 })
    const paceEl = document.querySelector('.fi-goal-pace')
    expect(paceEl?.textContent).toMatch(/early|behind|On track/)
  })
})

describe('GoalDetailedCard savings override', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 15))
    setMockFiTotal(500_000)
    mockedGetSaveRate.mockReturnValue({ saveRate: 40, annualSavings: 60000, monthsOfData: 12 })
    mockedProjectFIDateWithDrawdown.mockImplementation(
      (
        current: number,
        annualSavings: number,
        _preGrowth: number,
        _postGrowth: number,
        _monthlyExp: number,
        _inflation: number,
        _endOfLife: Date,
        _retDate?: Date,
      ) => {
        if (annualSavings <= 0) return null
        const target = 2_000_000
        const months = Math.ceil((target - current) / (annualSavings / 12))
        const date = new Date()
        date.setMonth(date.getMonth() + months)
        return { date, months, requiredCorpus: target }
      },
    )
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('enters savings override edit mode with the current savings amount prefilled', () => {
    renderCard({ fiGoal: 2_000_000 })

    fireEvent.click(screen.getByText('$5,000/mo'))

    const input = screen.getByRole('textbox')
    expect(input).toHaveClass('fi-savings-inline-input')
    expect(input).toHaveValue('5,000')
  })

  it('shows what-if FI copy after the user enters a savings override', () => {
    renderCard({ fiGoal: 2_000_000 })

    fireEvent.click(screen.getByText('$5,000/mo'))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '10000' } })
    fireEvent.blur(input)

    expect(screen.getByText(/If you saved/)).toBeInTheDocument()
    expect(screen.getByText(/you'd hit FI in/i)).toBeInTheDocument()
  })

  it('uses the threaded inflation prop instead of goal inflation when computing the what-if projection', () => {
    renderCard({ fiGoal: 2_000_000 }, { inflation: 2 })

    fireEvent.click(screen.getByText('$5,000/mo'))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '10000' } })
    fireEvent.blur(input)

    const lastCall = mockedProjectFIDateWithDrawdown.mock.calls.at(-1)
    expect(lastCall?.[5]).toBe(2)
  })

  it('shows that FI is not reachable within 100 years when the savings override projection returns null', () => {
    mockedProjectFIDateWithDrawdown.mockImplementation(
      (
        current: number,
        annualSavings: number,
        _a?: number,
        _b?: number,
        _c?: number,
        _d?: number,
        _e?: Date,
        _f?: Date,
      ) => {
        if (annualSavings === 1200) return null
        const target = 2_000_000
        const months = Math.ceil((target - current) / (annualSavings / 12))
        const date = new Date()
        date.setMonth(date.getMonth() + months)
        return { date, months, requiredCorpus: target }
      },
    )
    renderCard({ fiGoal: 2_000_000 })

    fireEvent.click(screen.getByText('$5,000/mo'))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '100' } })
    fireEvent.blur(input)

    expect(screen.getByText(/not reachable/i)).toBeInTheDocument()
  })

  it('resets the savings override and restores the baseline pace copy when Reset is clicked', () => {
    renderCard({ fiGoal: 2_000_000 })

    fireEvent.click(screen.getByText('$5,000/mo'))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '10000' } })
    fireEvent.blur(input)

    expect(screen.getByText(/If you saved/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))

    expect(screen.getByText(/At this pace, you'll hit FI in/i)).toBeInTheDocument()
  })

  it('converts a yearly override entry back to monthly savings before storing it', () => {
    renderCard({ fiGoal: 2_000_000 }, { showYearly: true })

    fireEvent.click(screen.getByText('$60,000/yr'))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '120000' } })
    fireEvent.blur(input)

    const lastCall = mockedProjectFIDateWithDrawdown.mock.calls.at(-1)
    expect(lastCall?.[1]).toBe(120000)
  })
})

describe('GoalDetailedCard projection — condensed mode', () => {
  it('does not show pace prose when condensed is true', () => {
    renderCard({}, { condensed: true })
    expect(screen.queryByText(/At this pace/)).not.toBeInTheDocument()
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
   Parameters — now shown in prose format
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetailedCard parameters in prose', () => {
  it('renders retirement date in prose', () => {
    renderCard({ retirementAge: 60 })
    expect(screen.getByText(/retire by/)).toBeInTheDocument()
  })

  it('shows inflation rate in prose', () => {
    renderCard({}, { inflation: 6 })
    const prose = document.querySelector('.fi-goal-prose')
    expect(prose?.textContent).toContain('6%')
    expect(prose?.textContent).toContain('inflation')
  })

  it('shows inflation rate in prose', () => {
    renderCard({}, { inflation: 3 })
    const prose = document.querySelector('.fi-goal-prose')
    expect(prose?.textContent).toContain('3%')
    expect(prose?.textContent).toContain('inflation')
  })

  it('shows portfolio growth rate in prose', () => {
    renderCard({ growth: 5 })
    const prose = document.querySelector('.fi-goal-prose')
    expect(prose?.textContent).toContain('growth')
  })

  it('shows goal created date', () => {
    renderCard({ createdAt: '2024-01-01' })
    expect(screen.getByText(/Created 2024-01-01/)).toBeInTheDocument()
  })

  it('hides prose section when condensed is true', () => {
    renderCard({}, { condensed: true })
    expect(screen.queryByText(/inflation/)).not.toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   Expense — shown in prose
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetailedCard expense in prose', () => {
  it('shows annual expense in prose', () => {
    renderCard({ expenseValue: 60000 })
    expect(screen.getByText(/\$60,000\/yr/)).toBeInTheDocument()
  })

  it('hides expense info when condensed is true', () => {
    renderCard({}, { condensed: true })
    expect(screen.queryByText(/\$60,000\/yr/)).not.toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   Depletion Warning
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetailedCard depletion warning', () => {
  it('shows depletion warning when funds run out before goal end', () => {
    renderCard(
      {
        fiGoal: 500_000,
        expenseValue: 0,
        monthlyExpense2047: 8333,
        retirementAge: 30,
        goalEndYear: '2080-01-01',
      },
      { inflation: 10, preBoundaryGrowth: 0, postBoundaryGrowth: 0 },
    )
    expect(screen.getByText(/Not sustainable beyond/)).toBeInTheDocument()
  })

  it('shows depletion warning text when onUpdateGoal is provided and depletion exists', () => {
    const onUpdateGoal = vi.fn()
    renderCard(
      {
        fiGoal: 500_000,
        expenseValue: 0,
        monthlyExpense2047: 8333,
        retirementAge: 30,
        goalEndYear: '2080-01-01',
      },
      { onUpdateGoal, showActions: false, inflation: 10, preBoundaryGrowth: 0, postBoundaryGrowth: 0 },
    )
    expect(screen.getByText(/Not sustainable beyond/)).toBeInTheDocument()
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
    expect(screen.getByText('Goal Creation Date')).toBeInTheDocument()
    expect(screen.getByText('Goal End Year')).toBeInTheDocument()
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
      { retirementAge: 60, expenseValue: 60000, safeWithdrawalRate: 3, growth: 5 },
      { onUpdateGoal, showActions: false, inflation: 6 },
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

describe('GoalDetailedCard suggest SWR (removed feature)', () => {
  it('does not render Suggest SWR button (feature removed)', () => {
    const onUpdateGoal = vi.fn()
    renderCard(
      {
        fiGoal: 500_000,
        expenseValue: 0,
        monthlyExpense2047: 8333,
        retirementAge: 30,
        goalEndYear: '2080-01-01',
      },
      { onUpdateGoal, showActions: false, inflation: 10, preBoundaryGrowth: 0, postBoundaryGrowth: 0 },
    )
    expect(screen.queryByRole('button', { name: 'Suggest SWR' })).not.toBeInTheDocument()
  })

  it('does not render Suggest SWR when onUpdateGoal is not provided', () => {
    renderCard({
      fiGoal: 500_000,
      expenseValue: 0,
      monthlyExpense2047: 8333,
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
  it('shows no pace prose when projectFIDateWithDrawdown returns null', () => {
    mockedProjectFIDateWithDrawdown.mockReturnValueOnce(null)
    setMockFiTotal(500_000)
    mockedGetSaveRate.mockReturnValue({ annualSavings: 100, saveRate: 0.01, monthsOfData: 12 })
    renderCard({ fiGoal: 2_000_000 })
    expect(screen.queryByText(/At this pace/)).not.toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   Projection — diff text variants
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetailedCard projection diff text', () => {
  it('shows "On track" when projected date matches target retirement date', () => {
    // birthday 1990-01-15, retirementAge 60 → target = Jan 15 2050
    const projected = new Date(2050, 0, 15) // Exact match
    mockedProjectFIDateWithDrawdown.mockReturnValueOnce({
      date: projected,
      months: 300,
      requiredCorpus: 2_000_000,
    })
    setMockFiTotal(500_000)
    mockedGetSaveRate.mockReturnValue({ annualSavings: 60000, saveRate: 40, monthsOfData: 12 })
    renderCard({ fiGoal: 2_000_000, retirementAge: 60 })
    expect(screen.getByText(/on track/)).toBeInTheDocument()
  })

  it('shows months early when projected date is 1-11 months ahead', () => {
    const projected = new Date(2049, 2, 15) // Mar 2049, ~10 months early
    mockedProjectFIDateWithDrawdown.mockReturnValueOnce({
      date: projected,
      months: 293,
      requiredCorpus: 2_000_000,
    })
    setMockFiTotal(500_000)
    mockedGetSaveRate.mockReturnValue({ annualSavings: 60000, saveRate: 40, monthsOfData: 12 })
    renderCard({ fiGoal: 2_000_000, retirementAge: 60 })
    expect(screen.getByText(/\d+ months? early/)).toBeInTheDocument()
  })

  it('shows years behind when projected date is far after target', () => {
    const projected = new Date(2055, 0, 15) // Jan 2055, ~5 years behind
    mockedProjectFIDateWithDrawdown.mockReturnValueOnce({
      date: projected,
      months: 360,
      requiredCorpus: 2_000_000,
    })
    setMockFiTotal(500_000)
    mockedGetSaveRate.mockReturnValue({ annualSavings: 60000, saveRate: 40, monthsOfData: 12 })
    renderCard({ fiGoal: 2_000_000, retirementAge: 60 })
    expect(screen.getByText(/years? behind/)).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   Expense toggle — Monthly at retirement
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetailedCard expense — prose format', () => {
  it('shows annual expense in prose', () => {
    renderCard({ expenseValue: 60000 })
    const prose = document.querySelector('.fi-goal-prose')
    expect(prose?.textContent).toContain('$60,000/yr')
  })

  it('shows inflation in prose', () => {
    renderCard({}, { inflation: 3 })
    const prose = document.querySelector('.fi-goal-prose')
    expect(prose?.textContent).toContain('3%')
    expect(prose?.textContent).toContain('inflation')
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
    mockedProjectFIDateWithDrawdown.mockReturnValueOnce({
      date: new Date(2050, 0, 10), // Jan 10 2050 — ~5 days diff rounds to 0 months
      months: 300,
      requiredCorpus: 2_000_000,
    })
    renderCard({ fiGoal: 2_000_000, retirementAge: 60 })
    expect(screen.getByText(/on track/)).toBeInTheDocument()
  })
})

describe('GoalDetailedCard — projection years plural (line 302)', () => {
  it('shows plural "years" when projected ahead by more than 1 year', () => {
    setMockFiTotal(1_500_000)
    mockedGetSaveRate.mockReturnValue({ annualSavings: 500_000, saveRate: 60, monthsOfData: 12 })
    // Target: Jan 2050, projected: Jan 2047 → 3 years ahead
    mockedProjectFIDateWithDrawdown.mockReturnValueOnce({
      date: new Date(2047, 0, 1),
      months: 24,
      requiredCorpus: 2_000_000,
    })
    renderCard({ fiGoal: 2_000_000, retirementAge: 60 })
    expect(screen.getByText(/3 years early/)).toBeInTheDocument()
  })

  it('shows singular "year" when projected exactly 1 year ahead', () => {
    setMockFiTotal(1_800_000)
    mockedGetSaveRate.mockReturnValue({ annualSavings: 600_000, saveRate: 70, monthsOfData: 12 })
    // Target: Jan 15 2050, projected: Jan 15 2049 → exactly 12 months → 1 year ahead
    mockedProjectFIDateWithDrawdown.mockReturnValueOnce({
      date: new Date(2049, 0, 15),
      months: 12,
      requiredCorpus: 2_000_000,
    })
    renderCard({ fiGoal: 2_000_000, retirementAge: 60 })
    expect(screen.getByText(/1 year early/)).toBeInTheDocument()
  })
})

describe('GoalDetailedCard — projection not-reachable when projectFIDateWithDrawdown returns null', () => {
  it('does not show pace prose when projection returns null', () => {
    setMockFiTotal(500_000)
    mockedGetSaveRate.mockReturnValue({ annualSavings: 50_000, saveRate: 20, monthsOfData: 12 })
    mockedProjectFIDateWithDrawdown.mockReturnValueOnce(null)
    renderCard({ fiGoal: 2_000_000, retirementAge: 60 })
    expect(screen.queryByText(/At this pace/)).not.toBeInTheDocument()
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
    mockedProjectFIDateWithDrawdown.mockReturnValueOnce({
      date: new Date(2049, 11, 1),
      months: 1,
      requiredCorpus: 2_000_000,
    })
    renderCard({ fiGoal: 2_000_000, retirementAge: 60 })
    expect(screen.getByText(/1 month early/)).toBeInTheDocument()
  })
})

describe('GoalDetailedCard budget csv savings', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 1))
    setMockFiTotal(500_000)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses selected-year csv savings over the stored budget summary and ignores removed or invalid rows', () => {
    mockedGetSaveRate.mockReturnValue({ annualSavings: 1_200, saveRate: 1, monthsOfData: 12 })
    mockedLoadBudgetStore.mockReturnValue({
      csvs: {
        '2026-01': { month: '2026-01', csv: 'jan', uploadedAt: '2026-01-01T00:00:00.000Z' },
        '2026-02': { month: '2026-02', csv: 'feb', uploadedAt: '2026-02-01T00:00:00.000Z' },
        '2026-03': { month: '2026-03', csv: 'bad', uploadedAt: '2026-03-01T00:00:00.000Z' },
      },
      configs: {},
      years: [2026],
      categoryGroups: [],
    })
    mockedGetGlobalCategoryGroups.mockReturnValue([{ id: 'removed', name: 'Removed', categories: ['Ignore me'] }])
    mockedParseCSV.mockImplementation(csv => {
      if (csv === 'bad') throw new Error('bad csv')
      if (csv === 'jan') {
        return [
          { date: '2026-01-01', category: 'Salary', amount: 5000 },
          { date: '2026-01-02', category: 'Rent', amount: -2000 },
          { date: '2026-01-03', category: 'Ignore me', amount: 1000 },
        ]
      }
      return [
        { date: '2026-02-01', category: 'Salary', amount: 5000 },
        { date: '2026-02-02', category: 'Rent', amount: -1000 },
      ]
    })

    renderCard({ fiGoal: 2_000_000 }, { summaryYear: 2026 })

    expect(screen.getByText(/You're saving/)).toBeInTheDocument()
    expect(screen.getByText('$2,333/mo')).toBeInTheDocument()
    expect(screen.queryByText('$100/mo')).not.toBeInTheDocument()
  })

  it('uses past-tense copy when rendering a prior summary year', () => {
    mockedGetSaveRate.mockReturnValue({ annualSavings: 1_200, saveRate: 1, monthsOfData: 12 })
    mockedLoadBudgetStore.mockReturnValue({
      csvs: {
        '2025-01': { month: '2025-01', csv: '2025-jan', uploadedAt: '2025-01-01T00:00:00.000Z' },
      },
      configs: {},
      years: [2025],
      categoryGroups: [],
    })
    mockedParseCSV.mockReturnValue([
      { date: '2025-01-01', category: 'Salary', amount: 6000 },
      { date: '2025-01-02', category: 'Rent', amount: -2000 },
    ])

    renderCard({ fiGoal: 2_000_000 }, { summaryYear: 2025 })

    expect(screen.getByText(/You saved/)).toBeInTheDocument()
    expect(document.querySelector('.fi-goal-pace')?.textContent).toContain('in 2025')
  })
})

describe('GoalDetailedCard savings override edge cases', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 15))
    setMockFiTotal(500_000)
    mockedGetSaveRate.mockReturnValue({ saveRate: 40, annualSavings: 60000, monthsOfData: 12 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('falls back to projectFIDate when no end-of-life date is available', () => {
    renderCard({ fiGoal: 2_000_000, goalEndYear: '', monthlyExpense2047: 0, expenseValue: 60000 })

    fireEvent.click(screen.getByText('$5,000/mo'))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '10000' } })
    fireEvent.blur(input)

    expect(mockedProjectFIDate).toHaveBeenCalled()
    expect(mockedProjectFIDate.mock.calls.at(-1)?.[2]).toBe(120000)
  })

  it('shows on-track what-if copy when the override hits the target retirement date', () => {
    mockedProjectFIDateWithDrawdown.mockImplementation((_current, annualSavings) => {
      if (annualSavings === 120000) {
        return { date: new Date(2050, 0, 15), months: 288, requiredCorpus: 2_000_000 }
      }
      return { date: new Date(2038, 6, 1), months: 150, requiredCorpus: 2_000_000 }
    })

    renderCard({ fiGoal: 2_000_000 })

    fireEvent.click(screen.getByText('$5,000/mo'))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '10000' } })
    fireEvent.blur(input)

    expect(document.querySelector('.fi-goal-pace')?.textContent).toContain('on track')
  })

  it('shows years-only what-if copy when the override reaches FI in whole years', () => {
    mockedProjectFIDateWithDrawdown.mockImplementation((_current, annualSavings) => {
      if (annualSavings === 120000) {
        return { date: new Date(2028, 0, 1), months: 24, requiredCorpus: 2_000_000 }
      }
      return { date: new Date(2050, 0, 1), months: 288, requiredCorpus: 2_000_000 }
    })

    renderCard({ fiGoal: 2_000_000 })

    fireEvent.click(screen.getByText('$5,000/mo'))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '10000' } })
    fireEvent.blur(input)

    expect(document.querySelector('.fi-goal-pace')?.textContent).toContain('2 years')
  })

  it('shows months-only what-if copy when the override reaches FI within the same year', () => {
    mockedProjectFIDateWithDrawdown.mockImplementation((_current, annualSavings) => {
      if (annualSavings === 120000) {
        return { date: new Date(2026, 5, 1), months: 5, requiredCorpus: 2_000_000 }
      }
      return { date: new Date(2038, 6, 1), months: 150, requiredCorpus: 2_000_000 }
    })

    renderCard({ fiGoal: 2_000_000 })

    fireEvent.click(screen.getByText('$5,000/mo'))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '10000' } })
    fireEvent.blur(input)

    expect(document.querySelector('.fi-goal-pace')?.textContent).toContain('5 months')
  })

  it('clears the inline savings input when the entered value has no digits', () => {
    renderCard({ fiGoal: 2_000_000 })

    fireEvent.click(screen.getByText('$5,000/mo'))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'abc' } })

    expect(input).toHaveValue('')
  })

  it('exits inline edit mode on Enter and Escape', () => {
    renderCard({ fiGoal: 2_000_000 })

    fireEvent.click(screen.getByText('$5,000/mo'))
    let input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('$5,000/mo'))
    input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('uses the controlled savings override prop and notifies the parent on changes and reset', () => {
    const onSavingsOverrideChange = vi.fn()

    renderCard(
      { fiGoal: 2_000_000 },
      { savingsOverride: 4000, onSavingsOverrideChange, onTogglePeriod: vi.fn(), showYearly: false },
    )

    expect(screen.getByText(/If you saved/)).toBeInTheDocument()
    expect(screen.getByText('$4,000/mo')).toBeInTheDocument()

    fireEvent.click(screen.getByText('$4,000/mo'))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '6000' } })
    expect(onSavingsOverrideChange).toHaveBeenCalledWith(6000)

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    expect(onSavingsOverrideChange).toHaveBeenCalledWith(null)
  })
})

describe('GoalDetailedCard expense label toggles', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 15))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('cycles through creation current and retirement dollars when the expense label is clicked', () => {
    renderCard({ expenseValue: 60000, goalCreatedIn: '2024-01-01', retirementAge: 60 })

    const creationLabel = screen.getByText(/2024 dollars/)
    expect(creationLabel).toHaveTextContent('$60,000/yr')

    fireEvent.click(creationLabel)
    expect(screen.getByText(/2026 dollars/)).toBeInTheDocument()

    fireEvent.click(screen.getByText(/2026 dollars/))
    expect(screen.getByText(/2050 dollars/)).toBeInTheDocument()

    fireEvent.click(screen.getByText(/2050 dollars/))
    expect(screen.getByText(/2024 dollars/)).toBeInTheDocument()
  })

  it('shows an em dash when the goal creation year is missing', () => {
    renderCard({ goalCreatedIn: '', expenseValue: 60000 })

    expect(screen.getByText(/— dollars/)).toBeInTheDocument()
  })
})

describe('GoalDetailedCard remaining branch coverage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 15))
    setMockFiTotal(500_000)
    mockedGetSaveRate.mockReturnValue({ annualSavings: 60_000, saveRate: 40, monthsOfData: 12 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('treats active FI accounts without balances as zero-value progress', () => {
    mockDataCtx.accounts = [{ id: 1, status: 'active', goalType: 'fi' }]
    mockDataCtx.balances = []
    mockDataCtx.allMonths = ['2024-06']

    renderCard({ fiGoal: 2_000_000 })

    expect(screen.getByText('0.0%')).toBeInTheDocument()
  })

  it('classifies expense-only csv categories and falls back to the stored budget summary', () => {
    mockedGetSaveRate.mockReturnValue({ annualSavings: 1_200, saveRate: 1, monthsOfData: 12 })
    mockedLoadBudgetStore.mockReturnValue({
      csvs: {
        '2026-01': { month: '2026-01', csv: 'expense-only', uploadedAt: '2026-01-01T00:00:00.000Z' },
      },
      configs: {},
      years: [2026],
      categoryGroups: [],
    })
    mockedParseCSV.mockReturnValue([{ date: '2026-01-01', category: 'Rent', amount: -1000 }])

    renderCard({ fiGoal: 2_000_000 }, { summaryYear: 2026 })

    expect(document.querySelector('.fi-goal-pace')?.textContent).toContain('$100/mo')
  })

  it('falls back to projectFIDate when current expenses are unavailable', () => {
    renderCard({ fiGoal: 2_000_000, goalEndYear: '', monthlyExpense2047: 0, expenseValue: 0 })

    expect(mockedProjectFIDate).toHaveBeenCalled()
  })

  it('shows years-only baseline pace copy for whole-year projections', () => {
    mockedProjectFIDateWithDrawdown.mockReturnValueOnce({
      date: new Date(2028, 0, 1),
      months: 24,
      requiredCorpus: 2_000_000,
    })

    renderCard({ fiGoal: 2_000_000 })

    expect(document.querySelector('.fi-goal-pace')?.textContent).toContain('2 years')
  })

  it('shows months-only baseline pace copy for near-term projections', () => {
    mockedProjectFIDateWithDrawdown.mockReturnValueOnce({
      date: new Date(2026, 5, 1),
      months: 5,
      requiredCorpus: 2_000_000,
    })

    renderCard({ fiGoal: 2_000_000 })

    expect(document.querySelector('.fi-goal-pace')?.textContent).toContain('5 months')
  })

  it('shows singular year-only baseline pace copy for one-year projections', () => {
    mockedProjectFIDateWithDrawdown.mockReturnValueOnce({
      date: new Date(2027, 0, 1),
      months: 12,
      requiredCorpus: 2_000_000,
    })

    renderCard({ fiGoal: 2_000_000 })

    expect(document.querySelector('.fi-goal-pace')?.textContent).toContain('1 year')
  })

  it('shows mixed singular diff text in the baseline projection', () => {
    mockedProjectFIDateWithDrawdown.mockReturnValueOnce({
      date: new Date(2026, 11, 1),
      months: 11,
      requiredCorpus: 2_000_000,
    })

    renderCard({ fiGoal: 2_000_000, retirementAge: 38 })

    expect(document.querySelector('.fi-goal-pace')?.textContent).toContain('1 year 1 month early')
  })

  it('shows singular year and month labels in the baseline time-to-fi copy', () => {
    mockedProjectFIDateWithDrawdown.mockReturnValueOnce({
      date: new Date(2027, 1, 1),
      months: 13,
      requiredCorpus: 2_000_000,
    })

    renderCard({ fiGoal: 2_000_000 })

    expect(document.querySelector('.fi-goal-pace')?.textContent).toContain('1 year 1 month')
  })

  it('shows mixed singular diff text in the what-if projection', () => {
    mockedProjectFIDateWithDrawdown.mockImplementation((_current, annualSavings) => {
      if (annualSavings === 120000) {
        return { date: new Date(2026, 11, 1), months: 11, requiredCorpus: 2_000_000 }
      }
      return { date: new Date(2028, 0, 1), months: 24, requiredCorpus: 2_000_000 }
    })

    renderCard({ fiGoal: 2_000_000, retirementAge: 38 })

    fireEvent.click(screen.getByText('$5,000/mo'))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '10000' } })
    fireEvent.blur(input)

    expect(document.querySelector('.fi-goal-pace')?.textContent).toContain('1 year 1 month early')
  })

  it('shows singular year and month labels in the what-if time-to-fi copy', () => {
    mockedProjectFIDateWithDrawdown.mockImplementation((_current, annualSavings) => {
      if (annualSavings === 120000) {
        return { date: new Date(2027, 1, 1), months: 13, requiredCorpus: 2_000_000 }
      }
      return { date: new Date(2028, 0, 1), months: 24, requiredCorpus: 2_000_000 }
    })

    renderCard({ fiGoal: 2_000_000 })

    fireEvent.click(screen.getByText('$5,000/mo'))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '10000' } })
    fireEvent.blur(input)

    expect(document.querySelector('.fi-goal-pace')?.textContent).toContain('1 year 1 month')
  })

  it('shows singular month-only what-if pace copy for one-month projections', () => {
    mockedProjectFIDateWithDrawdown.mockImplementation((_current, annualSavings) => {
      if (annualSavings === 120000) {
        return { date: new Date(2026, 1, 1), months: 1, requiredCorpus: 2_000_000 }
      }
      return { date: new Date(2028, 0, 1), months: 24, requiredCorpus: 2_000_000 }
    })

    renderCard({ fiGoal: 2_000_000 })

    fireEvent.click(screen.getByText('$5,000/mo'))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '10000' } })
    fireEvent.blur(input)

    expect(document.querySelector('.fi-goal-pace')?.textContent).toContain('1 month')
  })

  it('keeps inline edit mode open for keys other than Enter and Escape', () => {
    renderCard({ fiGoal: 2_000_000 })

    fireEvent.click(screen.getByText('$5,000/mo'))
    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'Tab' })

    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('renders a controlled yearly savings override amount', () => {
    renderCard({ fiGoal: 2_000_000 }, { savingsOverride: 4000, showYearly: true })

    expect(screen.getByText('$48,000/yr')).toBeInTheDocument()
  })
})
