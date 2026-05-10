import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GoalForm from './GoalForm'
import { FormData } from '../hooks/useFormData'
import { GOAL_TEMPLATES } from '../data/goalTemplates'

vi.mock('../../../styles/Goal.css', () => ({}))
vi.mock('../../../styles/TemplatePicker.css', () => ({}))
vi.mock('../utils/goalCalculations', () => ({
  // #54: Provide realistic mock values instead of all-zeros
  calculateGoalMetrics: vi.fn(() => ({
    monthlyExpenseAtCreation: 4167,
    retirementDate: new Date(2050, 0, 15),
    retirementDateFormatted: 'Jan 2050',
    monthsBetween: 300,
    monthlyExpenseAtRetirement: 6250,
    annualExpenseAtRetirement: 75000,
    fiGoal: 1875000,
  })),
}))

const defaultFormData: FormData = {
  goalName: '',
  goalCreatedIn: '2025-01-01',
  goalEndYear: '',
  resetExpenseMonth: false,
  retirementAge: '',
  expenseMonth: '',
  expenseValue: '',
  monthlyExpenseValue: '',
  inflationRate: '',
  safeWithdrawalRate: '',
  growth: '',
}

const defaultProps = {
  formData: defaultFormData,
  error: '',
  editingGoalId: null as number | null,
  profileBirthday: '1990-06-15',
  onOpenProfile: vi.fn(),
  onInputChange: vi.fn(),
  onSetFormFields: vi.fn(),
  onSubmit: vi.fn(),
  onCancel: vi.fn(),
  setError: vi.fn(),
}

describe('GoalForm', () => {
  beforeEach(() => {
    // #55: Use fake timers to control the 80ms setTimeout calls in GoalForm
    // (focus management on step change and template selection).
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders "Use Template" button on step 0 when not editing', () => {
    render(<GoalForm {...defaultProps} editingGoalId={null} />)
    expect(screen.getByRole('button', { name: 'Use Template' })).toBeInTheDocument()
  })

  it('hides "Use Template" button when editing an existing goal', () => {
    render(<GoalForm {...defaultProps} editingGoalId={123} />)
    expect(screen.queryByRole('button', { name: 'Use Template' })).not.toBeInTheDocument()
  })

  it('shows TemplatePicker when "Use Template" is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<GoalForm {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: 'Use Template' }))
    expect(screen.getByText('Early Retirement')).toBeInTheDocument()
    expect(screen.getByText('Coast FI')).toBeInTheDocument()
  })

  it('hides TemplatePicker when "Hide Templates" is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<GoalForm {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: 'Use Template' }))
    expect(screen.getByText('Early Retirement')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Hide Templates' }))
    expect(screen.queryByText('Early Retirement')).not.toBeInTheDocument()
  })

  it('selecting a template populates form fields with dates and jumps to review', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<GoalForm {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: 'Use Template' }))

    const coastFi = GOAL_TEMPLATES.find(t => t.id === 'coast-fi')!
    await user.click(screen.getByText('Coast FI'))

    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const endYear = '2090-06-15'

    expect(defaultProps.onSetFormFields).toHaveBeenCalledWith({
      goalName: coastFi.name,
      goalCreatedIn: todayStr,
      goalEndYear: endYear,
      retirementAge: String(coastFi.retirementAge),
      expenseValue: String(coastFi.annualExpense),
      inflationRate: String(coastFi.inflationRate),
      safeWithdrawalRate: String(coastFi.safeWithdrawalRate),
      growth: String(coastFi.growth),
    })
    expect(screen.getByText('Everything look good?')).toBeInTheDocument()
  })

  it('shows review after navigating back from review and then forward again', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const filledFormData: FormData = {
      ...defaultFormData,
      goalName: 'Coast FI',
      goalCreatedIn: '2026-04-26',
      goalEndYear: '2090-06-15',
      retirementAge: '40',
      expenseValue: '50000',
      inflationRate: '3',
      safeWithdrawalRate: '4',
      growth: '8',
    }

    render(<GoalForm {...defaultProps} formData={filledFormData} />)

    // Select template to jump to step 4 (Review)
    await user.click(screen.getByRole('button', { name: 'Use Template' }))
    await user.click(screen.getByText('Coast FI'))
    expect(screen.getByText('Everything look good?')).toBeInTheDocument()

    // Click dot to go back to step 2 (Expenses)
    await user.click(screen.getByRole('button', { name: /Step 3: Expenses/ }))
    expect(screen.getByText(/annual expenses/i)).toBeInTheDocument()

    // Navigate forward: step 2 → 3
    await user.click(screen.getByRole('button', { name: /Next/ }))
    expect(screen.getByText(/financial parameters/i)).toBeInTheDocument()

    // Navigate forward: step 3 → 4 (Review) — must NOT skip
    await user.click(screen.getByRole('button', { name: /Next/ }))
    expect(screen.getByText('Everything look good?')).toBeInTheDocument()
    expect(defaultProps.onSubmit).not.toHaveBeenCalled()
  })

  it('unmounts the Next button when transitioning to Review so DOM node is not reused as submit', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const filledFormData: FormData = {
      ...defaultFormData,
      goalName: 'Coast FI',
      goalCreatedIn: '2026-04-26',
      goalEndYear: '2090-06-15',
      retirementAge: '40',
      expenseValue: '50000',
      inflationRate: '3',
      safeWithdrawalRate: '4',
      growth: '8',
    }

    render(<GoalForm {...defaultProps} formData={filledFormData} />)

    // Jump to review via template, then go back to step 3
    await user.click(screen.getByRole('button', { name: 'Use Template' }))
    await user.click(screen.getByText('Coast FI'))
    await user.click(screen.getByRole('button', { name: /Step 3: Expenses/ }))
    await user.click(screen.getByRole('button', { name: /Next/ }))

    // Grab a reference to the Next button DOM node at step 3
    const nextBtn = screen.getByRole('button', { name: /Next/ })
    await user.click(nextBtn)

    // With key props, React unmounts the old button — it should no longer be in the DOM.
    // Without key props React reuses the node (changing type to "submit"), which
    // lets the original click propagate as a form submission in real browsers.
    expect(nextBtn).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Create Goal/ })).toBeInTheDocument()
    expect(defaultProps.onSubmit).not.toHaveBeenCalled()
  })

  it('handleSelectTemplate computes 100th birthday without timezone off-by-one', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    // Regression: new Date('1990-06-15') is UTC midnight.  Using local-time
    // getters (getMonth/getDate/getFullYear) shifts the date back one day in
    // timezones west of UTC.  The correct goalEndYear is always '2090-06-15'.
    render(<GoalForm {...defaultProps} profileBirthday="1990-06-15" />)
    await user.click(screen.getByRole('button', { name: 'Use Template' }))
    await user.click(screen.getByText('Coast FI'))

    const call = defaultProps.onSetFormFields.mock.calls[0][0]
    expect(call.goalEndYear).toBe('2090-06-15')
  })

  it('setEndTo100thBirthday computes date without timezone off-by-one', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    // Regression: same UTC-vs-local issue when user clicks "Set to 100th birthday".
    // Render with goalName filled and the error prop that reveals the button.
    // Navigate from step 0 → step 1, where the error + step combo shows the button.
    const formWithName: FormData = {
      ...defaultFormData,
      goalName: 'Test Goal',
    }
    const { rerender } = render(
      <GoalForm {...defaultProps} formData={formWithName} error="" profileBirthday="1990-06-15" />,
    )

    // Advance to step 1 (Timeline)
    await user.click(screen.getByRole('button', { name: /Next/ }))
    vi.clearAllMocks()

    // Re-render with the validation error so the "Set to 100th birthday" button appears
    rerender(
      <GoalForm
        {...defaultProps}
        formData={formWithName}
        error="Please enter the goal end year"
        profileBirthday="1990-06-15"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Set to 100th birthday' }))

    const call = defaultProps.onSetFormFields.mock.calls[0][0]
    expect(call.goalEndYear).toBe('2090-06-15')
  })

  it('does not submit when Enter is pressed on Next button at step 3', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const filledFormData: FormData = {
      ...defaultFormData,
      goalName: 'Coast FI',
      goalCreatedIn: '2026-04-26',
      goalEndYear: '2090-06-15',
      retirementAge: '40',
      expenseValue: '50000',
      inflationRate: '3',
      safeWithdrawalRate: '4',
      growth: '8',
    }

    render(<GoalForm {...defaultProps} formData={filledFormData} />)

    // Jump to review via template
    await user.click(screen.getByRole('button', { name: 'Use Template' }))
    await user.click(screen.getByText('Coast FI'))

    // Go back to step 2, then forward to step 3
    await user.click(screen.getByRole('button', { name: /Step 3: Expenses/ }))
    await user.click(screen.getByRole('button', { name: /Next/ }))

    // At step 3, press Enter on the Next button — browser fires keyDown then click
    const nextBtn = screen.getByRole('button', { name: /Next/ })
    await user.keyboard('{Enter}')
    await user.click(nextBtn)

    // Should land on review, NOT submit the form
    expect(screen.getByText('Everything look good?')).toBeInTheDocument()
    expect(defaultProps.onSubmit).not.toHaveBeenCalled()
  })
})

/* ═══════════════════════════════════════════════════════════════
   Step Validation
   ═══════════════════════════════════════════════════════════════ */

describe('GoalForm step 0 validation', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows error when goal name is empty and Next is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<GoalForm {...defaultProps} formData={{ ...defaultFormData, goalName: '' }} />)
    await user.click(screen.getByRole('button', { name: /Next/ }))
    expect(defaultProps.setError).toHaveBeenCalledWith('Please enter a goal name')
  })

  it('shows error and calls onOpenProfile when birthday is missing', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<GoalForm {...defaultProps} formData={{ ...defaultFormData, goalName: 'Test' }} profileBirthday="" />)
    await user.click(screen.getByRole('button', { name: /Next/ }))
    expect(defaultProps.setError).toHaveBeenCalledWith('Please add your birthday in your profile first')
    expect(defaultProps.onOpenProfile).toHaveBeenCalled()
  })

  it('shows "Pick random name" button when goal name error is displayed', () => {
    render(
      <GoalForm {...defaultProps} formData={{ ...defaultFormData, goalName: '' }} error="Please enter a goal name" />,
    )
    expect(screen.getByRole('button', { name: /Pick random name/ })).toBeInTheDocument()
  })
})

describe('GoalForm step 1 validation', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const formAtStep1: FormData = { ...defaultFormData, goalName: 'Test Goal' }

  async function renderAtStep1(user: ReturnType<typeof userEvent.setup>, overrides: Partial<FormData> = {}) {
    const formData = { ...formAtStep1, ...overrides }
    render(<GoalForm {...defaultProps} formData={formData} />)
    // Navigate to step 1
    await user.click(screen.getByRole('button', { name: /Next/ }))
    vi.clearAllMocks()
  }

  it('shows error when goal creation date is empty', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await renderAtStep1(user, { goalCreatedIn: '' })
    await user.click(screen.getByRole('button', { name: /Next/ }))
    expect(defaultProps.setError).toHaveBeenCalledWith('Please enter the goal creation date')
  })

  it('shows error when goal end year is empty', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await renderAtStep1(user, { goalCreatedIn: '2024-01-01', goalEndYear: '' })
    await user.click(screen.getByRole('button', { name: /Next/ }))
    expect(defaultProps.setError).toHaveBeenCalledWith('Please enter the goal end year')
  })

  it('shows error when end date is before start date', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await renderAtStep1(user, { goalCreatedIn: '2024-06-01', goalEndYear: '2024-01-01' })
    await user.click(screen.getByRole('button', { name: /Next/ }))
    expect(defaultProps.setError).toHaveBeenCalledWith('Goal end date must be after the start date')
  })

  it('shows error when end date is more than 100 years from birthday', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await renderAtStep1(user, { goalCreatedIn: '2024-01-01', goalEndYear: '2100-01-01', retirementAge: '60' })
    await user.click(screen.getByRole('button', { name: /Next/ }))
    expect(defaultProps.setError).toHaveBeenCalledWith('Goal end date must be within 100 years of your date of birth')
  })

  it('shows error when retirement age is empty', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await renderAtStep1(user, { goalCreatedIn: '2024-01-01', goalEndYear: '2080-01-01', retirementAge: '' })
    await user.click(screen.getByRole('button', { name: /Next/ }))
    expect(defaultProps.setError).toHaveBeenCalledWith('Please enter a valid retirement age')
  })

  it('shows error when retirement age is zero', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await renderAtStep1(user, { goalCreatedIn: '2024-01-01', goalEndYear: '2080-01-01', retirementAge: '0' })
    await user.click(screen.getByRole('button', { name: /Next/ }))
    expect(defaultProps.setError).toHaveBeenCalledWith('Please enter a valid retirement age')
  })
})

describe('GoalForm step 2 validation', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const validStep1: FormData = {
    ...defaultFormData,
    goalName: 'Test',
    goalCreatedIn: '2024-01-01',
    goalEndYear: '2080-01-01',
    retirementAge: '60',
  }

  async function renderAtStep2(user: ReturnType<typeof userEvent.setup>, overrides: Partial<FormData> = {}) {
    const formData = { ...validStep1, ...overrides }
    render(<GoalForm {...defaultProps} formData={formData} />)
    // Navigate step 0 → 1 → 2
    await user.click(screen.getByRole('button', { name: /Next/ }))
    await user.click(screen.getByRole('button', { name: /Next/ }))
    vi.clearAllMocks()
  }

  it('shows error when annual expense is empty', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await renderAtStep2(user, { expenseValue: '' })
    await user.click(screen.getByRole('button', { name: /Next/ }))
    expect(defaultProps.setError).toHaveBeenCalledWith('Please enter a valid annual expense')
  })

  it('shows error when annual expense is zero', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await renderAtStep2(user, { expenseValue: '0' })
    await user.click(screen.getByRole('button', { name: /Next/ }))
    expect(defaultProps.setError).toHaveBeenCalledWith('Please enter a valid annual expense')
  })
})

describe('GoalForm step 3 validation', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const validStep2: FormData = {
    ...defaultFormData,
    goalName: 'Test',
    goalCreatedIn: '2024-01-01',
    goalEndYear: '2080-01-01',
    retirementAge: '60',
    expenseValue: '50000',
  }

  async function renderAtStep3(user: ReturnType<typeof userEvent.setup>, overrides: Partial<FormData> = {}) {
    const formData = { ...validStep2, ...overrides }
    render(<GoalForm {...defaultProps} formData={formData} />)
    // Navigate step 0 → 1 → 2 → 3
    await user.click(screen.getByRole('button', { name: /Next/ }))
    await user.click(screen.getByRole('button', { name: /Next/ }))
    await user.click(screen.getByRole('button', { name: /Next/ }))
    vi.clearAllMocks()
  }

  it('shows error when inflation rate is empty', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await renderAtStep3(user, { inflationRate: '' })
    await user.click(screen.getByRole('button', { name: /Next/ }))
    expect(defaultProps.setError).toHaveBeenCalledWith('Please enter the inflation rate')
  })

  it('shows error when SWR is empty', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await renderAtStep3(user, { inflationRate: '3', safeWithdrawalRate: '' })
    await user.click(screen.getByRole('button', { name: /Next/ }))
    expect(defaultProps.setError).toHaveBeenCalledWith('Please enter the safe withdrawal rate')
  })

  it('shows error when growth rate is empty', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await renderAtStep3(user, { inflationRate: '3', safeWithdrawalRate: '4', growth: '' })
    await user.click(screen.getByRole('button', { name: /Next/ }))
    expect(defaultProps.setError).toHaveBeenCalledWith('Please enter the growth rate')
  })
})

/* ═══════════════════════════════════════════════════════════════
   UI Features
   ═══════════════════════════════════════════════════════════════ */

describe('GoalForm UI features', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows "New Goal" heading when creating', () => {
    render(<GoalForm {...defaultProps} editingGoalId={null} />)
    expect(screen.getByRole('heading', { name: 'New Goal' })).toBeInTheDocument()
  })

  it('shows "Edit Goal" heading when editing', () => {
    render(<GoalForm {...defaultProps} editingGoalId={42} />)
    expect(screen.getByRole('heading', { name: 'Edit Goal' })).toBeInTheDocument()
  })

  it('Cancel button at step 0 calls onCancel', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<GoalForm {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(defaultProps.onCancel).toHaveBeenCalled()
  })

  it('Close button calls onCancel', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<GoalForm {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(defaultProps.onCancel).toHaveBeenCalled()
  })

  it('Back button appears on step > 0 and goes back', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const formData = { ...defaultFormData, goalName: 'Test' }
    render(<GoalForm {...defaultProps} formData={formData} />)
    await user.click(screen.getByRole('button', { name: /Next/ }))
    expect(screen.getByRole('button', { name: /Back/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Back/ }))
    expect(screen.getByLabelText(/What do you want to call this goal/)).toBeInTheDocument()
  })

  it('Use Recommended button fills parameter fields', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const validForm: FormData = {
      ...defaultFormData,
      goalName: 'Test',
      goalCreatedIn: '2024-01-01',
      goalEndYear: '2080-01-01',
      retirementAge: '60',
      expenseValue: '50000',
    }
    render(<GoalForm {...defaultProps} formData={validForm} />)
    // Navigate to step 3
    await user.click(screen.getByRole('button', { name: /Next/ }))
    await user.click(screen.getByRole('button', { name: /Next/ }))
    await user.click(screen.getByRole('button', { name: /Next/ }))
    await user.click(screen.getByRole('button', { name: 'Use Recommended' }))
    expect(defaultProps.onSetFormFields).toHaveBeenCalledWith({
      inflationRate: '3',
      safeWithdrawalRate: '4',
      growth: '6',
    })
  })

  it('renders step dots with aria-label and aria-current for the active step', () => {
    render(<GoalForm {...defaultProps} />)
    const activeStep = screen.getByRole('button', { name: /Step 1: Name \(current\)/ })
    expect(activeStep).toHaveAttribute('aria-current', 'step')
  })

  it('shows the review screen with all filled data on step 4', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const filledForm: FormData = {
      ...defaultFormData,
      goalName: 'My FIRE Goal',
      goalCreatedIn: '2024-06-01',
      goalEndYear: '2080-06-01',
      retirementAge: '55',
      expenseValue: '50000',
      inflationRate: '3',
      safeWithdrawalRate: '4',
      growth: '6',
    }
    render(<GoalForm {...defaultProps} formData={filledForm} />)
    // Jump to review via template
    await user.click(screen.getByRole('button', { name: 'Use Template' }))
    await user.click(screen.getByText('Coast FI'))

    expect(screen.getByText('Goal Name')).toBeInTheDocument()
    expect(screen.getByText('Retirement Age')).toBeInTheDocument()
    expect(screen.getByText('Inflation')).toBeInTheDocument()
    expect(screen.getByText('SWR')).toBeInTheDocument()
    expect(screen.getByText('Growth')).toBeInTheDocument()
  })

  it('shows Create Goal button on review step and submits the form', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const filledForm: FormData = {
      ...defaultFormData,
      goalName: 'My FIRE Goal',
      goalCreatedIn: '2024-06-01',
      goalEndYear: '2080-06-01',
      retirementAge: '55',
      expenseValue: '50000',
      inflationRate: '3',
      safeWithdrawalRate: '4',
      growth: '6',
    }
    render(<GoalForm {...defaultProps} formData={filledForm} />)
    // Jump to review
    await user.click(screen.getByRole('button', { name: 'Use Template' }))
    await user.click(screen.getByText('Coast FI'))

    const submitBtn = screen.getByRole('button', { name: /Create Goal/ })
    expect(submitBtn).toBeInTheDocument()
    await user.click(submitBtn)
    expect(defaultProps.onSubmit).toHaveBeenCalledTimes(1)
    const goal = defaultProps.onSubmit.mock.calls[0][0]
    expect(goal.goalName).toBe('My FIRE Goal')
    expect(goal.retirementAge).toBe(55)
  })

  it('shows Update Goal button when editing on review step', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const filledForm: FormData = {
      ...defaultFormData,
      goalName: 'Existing Goal',
      goalCreatedIn: '2024-06-01',
      goalEndYear: '2080-06-01',
      retirementAge: '55',
      expenseValue: '50000',
      inflationRate: '3',
      safeWithdrawalRate: '4',
      growth: '6',
    }
    render(<GoalForm {...defaultProps} formData={filledForm} editingGoalId={42} />)
    // Navigate all steps manually since templates are hidden in edit mode
    await user.click(screen.getByRole('button', { name: /Next/ }))
    await user.click(screen.getByRole('button', { name: /Next/ }))
    await user.click(screen.getByRole('button', { name: /Next/ }))
    await user.click(screen.getByRole('button', { name: /Next/ }))

    expect(screen.getByRole('button', { name: /Update Goal/ })).toBeInTheDocument()
  })
})
