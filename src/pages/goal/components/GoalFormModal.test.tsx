import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GoalFormModal from './GoalFormModal'
import { FormData } from '../hooks/useFormData'

vi.mock('../../../styles/GoalFormModal.css', () => ({}))
vi.mock('../../../styles/Goal.css', () => ({}))
vi.mock('../../../styles/TemplatePicker.css', () => ({}))
vi.mock('../../../hooks/useFocusTrap', () => ({
  useFocusTrap: vi.fn(),
}))
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

describe('GoalFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the dialog with correct aria-label for new goal', () => {
    render(<GoalFormModal {...defaultProps} />)
    expect(screen.getByRole('dialog', { name: 'Create new goal' })).toBeInTheDocument()
  })

  it('renders the dialog with correct aria-label when editing', () => {
    render(<GoalFormModal {...defaultProps} editingGoalId={42} />)
    expect(screen.getByRole('dialog', { name: 'Edit goal' })).toBeInTheDocument()
  })

  it('does not call onCancel or onSubmit when clicking the backdrop', async () => {
    const user = userEvent.setup()
    render(<GoalFormModal {...defaultProps} />)
    const backdrop = screen.getByRole('dialog').parentElement!
    await user.click(backdrop)

    expect(defaultProps.onCancel).not.toHaveBeenCalled()
    expect(defaultProps.onSubmit).not.toHaveBeenCalled()
  })

  it('does not close the modal when clicking the backdrop', async () => {
    const user = userEvent.setup()
    render(<GoalFormModal {...defaultProps} />)
    const backdrop = screen.getByRole('dialog').parentElement!
    await user.click(backdrop)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('calls onCancel when Escape key is pressed', async () => {
    const user = userEvent.setup()
    render(<GoalFormModal {...defaultProps} />)
    await user.keyboard('{Escape}')

    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1)
  })
})
