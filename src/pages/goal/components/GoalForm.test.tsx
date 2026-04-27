import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GoalForm from './GoalForm'
import { FormData } from '../hooks/useFormData'
import { GOAL_TEMPLATES } from '../data/goalTemplates'

vi.mock('../../../styles/Goal.css', () => ({}))
vi.mock('../../../styles/TemplatePicker.css', () => ({}))
vi.mock('../utils/goalCalculations', () => ({
  calculateGoalMetrics: vi.fn(() => ({
    monthlyExpenseAtCreation: 0,
    retirementDate: new Date(),
    retirementDateFormatted: 'Jan 2050',
    monthsBetween: 300,
    monthlyExpenseAtRetirement: 0,
    annualExpenseAtRetirement: 0,
    fiGoal: 0,
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
    vi.clearAllMocks()
  })

  it('renders "Use Template" button on step 0 when not editing', () => {
    render(<GoalForm {...defaultProps} editingGoalId={null} />)
    expect(screen.getByRole('button', { name: 'Use Template' })).toBeInTheDocument()
  })

  it('hides "Use Template" button when editing an existing goal', () => {
    render(<GoalForm {...defaultProps} editingGoalId={123} />)
    expect(screen.queryByRole('button', { name: 'Use Template' })).not.toBeInTheDocument()
  })

  it('shows TemplatePicker when "Use Template" is clicked', () => {
    render(<GoalForm {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Use Template' }))
    expect(screen.getByText('Early Retirement')).toBeInTheDocument()
    expect(screen.getByText('Coast FI')).toBeInTheDocument()
  })

  it('hides TemplatePicker when "Hide Templates" is clicked', () => {
    render(<GoalForm {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Use Template' }))
    expect(screen.getByText('Early Retirement')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Hide Templates' }))
    expect(screen.queryByText('Early Retirement')).not.toBeInTheDocument()
  })

  it('selecting a template populates form fields with dates and jumps to review', () => {
    render(<GoalForm {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Use Template' }))

    const coastFi = GOAL_TEMPLATES.find(t => t.id === 'coast-fi')!
    fireEvent.click(screen.getByText('Coast FI'))

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

  it('shows review after navigating back from review and then forward again', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Use Template' }))
    fireEvent.click(screen.getByText('Coast FI'))
    expect(screen.getByText('Everything look good?')).toBeInTheDocument()

    // Click dot to go back to step 2 (Expenses)
    fireEvent.click(screen.getByRole('button', { name: /Step 3: Expenses/ }))
    expect(screen.getByText(/annual expenses/i)).toBeInTheDocument()

    // Navigate forward: step 2 → 3
    fireEvent.click(screen.getByRole('button', { name: /Next/ }))
    expect(screen.getByText(/financial parameters/i)).toBeInTheDocument()

    // Navigate forward: step 3 → 4 (Review) — must NOT skip
    fireEvent.click(screen.getByRole('button', { name: /Next/ }))
    expect(screen.getByText('Everything look good?')).toBeInTheDocument()
    expect(defaultProps.onSubmit).not.toHaveBeenCalled()
  })

  it('unmounts the Next button when transitioning to Review so DOM node is not reused as submit', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Use Template' }))
    fireEvent.click(screen.getByText('Coast FI'))
    fireEvent.click(screen.getByRole('button', { name: /Step 3: Expenses/ }))
    fireEvent.click(screen.getByRole('button', { name: /Next/ }))

    // Grab a reference to the Next button DOM node at step 3
    const nextBtn = screen.getByRole('button', { name: /Next/ })
    fireEvent.click(nextBtn)

    // With key props, React unmounts the old button — it should no longer be in the DOM.
    // Without key props React reuses the node (changing type to "submit"), which
    // lets the original click propagate as a form submission in real browsers.
    expect(nextBtn).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Create Goal/ })).toBeInTheDocument()
    expect(defaultProps.onSubmit).not.toHaveBeenCalled()
  })

  it('handleSelectTemplate computes 100th birthday without timezone off-by-one', () => {
    // Regression: new Date('1990-06-15') is UTC midnight.  Using local-time
    // getters (getMonth/getDate/getFullYear) shifts the date back one day in
    // timezones west of UTC.  The correct goalEndYear is always '2090-06-15'.
    render(<GoalForm {...defaultProps} profileBirthday="1990-06-15" />)
    fireEvent.click(screen.getByRole('button', { name: 'Use Template' }))
    fireEvent.click(screen.getByText('Coast FI'))

    const call = defaultProps.onSetFormFields.mock.calls[0][0]
    expect(call.goalEndYear).toBe('2090-06-15')
  })

  it('setEndTo100thBirthday computes date without timezone off-by-one', () => {
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
    fireEvent.click(screen.getByRole('button', { name: /Next/ }))
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

    fireEvent.click(screen.getByRole('button', { name: 'Set to 100th birthday' }))

    const call = defaultProps.onSetFormFields.mock.calls[0][0]
    expect(call.goalEndYear).toBe('2090-06-15')
  })

  it('does not submit when Enter is pressed on Next button at step 3', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Use Template' }))
    fireEvent.click(screen.getByText('Coast FI'))

    // Go back to step 2, then forward to step 3
    fireEvent.click(screen.getByRole('button', { name: /Step 3: Expenses/ }))
    fireEvent.click(screen.getByRole('button', { name: /Next/ }))

    // At step 3, press Enter on the Next button — browser fires keyDown then click
    const nextBtn = screen.getByRole('button', { name: /Next/ })
    fireEvent.keyDown(nextBtn, { key: 'Enter' })
    fireEvent.click(nextBtn)

    // Should land on review, NOT submit the form
    expect(screen.getByText('Everything look good?')).toBeInTheDocument()
    expect(defaultProps.onSubmit).not.toHaveBeenCalled()
  })
})
