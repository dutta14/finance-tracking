import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GwSection from './GwSection'
import { GwGoal } from '../../../types'
import { makeGoal, makeGwGoal } from '../../../test/factories'

/* ─── Mocks ─── */

let mockGwTotal = 0
vi.mock('../../data/types', () => ({
  getLatestGoalTotals: () => ({ fiTotal: 0, gwTotal: mockGwTotal }),
}))

vi.mock('../../../components/TermAbbr', () => ({
  default: ({ term }: { term: string }) => <abbr>{term}</abbr>,
}))

vi.mock('../../../styles/GwSection.css', () => ({}))

/* ─── Helpers ─── */

const noop = () => {}

const defaultGoal = makeGoal({
  id: 1,
  goalCreatedIn: '2024-01',
  birthday: '1990-01-15',
  retirementAge: 45,
  inflationRate: 3,
  growth: 7,
})

const defaultProps = {
  goal: defaultGoal,
  goals: [defaultGoal],
  profileBirthday: '1990-01-15',
  gwGoals: [] as GwGoal[],
  onCreateGwGoal: noop as (goal: Omit<GwGoal, 'id' | 'createdAt'>) => void,
  onUpdateGwGoal: noop as (id: number, updates: Partial<Omit<GwGoal, 'id' | 'createdAt' | 'fiGoalId'>>) => void,
  onDeleteGwGoal: noop as (id: number) => void,
}

function renderGwSection(overrides: Partial<typeof defaultProps> & { initialFormOpen?: boolean } = {}) {
  return render(<GwSection {...defaultProps} {...overrides} />)
}

/* ─── Tests ─── */

beforeEach(() => {
  mockGwTotal = 0
})

afterEach(() => {
  vi.useRealTimers()
})

describe('GwSection', () => {
  describe('empty state', () => {
    it('renders section title "Generational Wealth"', () => {
      renderGwSection()
      expect(screen.getByRole('heading', { name: /generational wealth/i })).toBeInTheDocument()
    })

    it('renders empty state message when no GW goals exist', () => {
      renderGwSection()
      expect(screen.getByText('No generational wealth goals yet.')).toBeInTheDocument()
    })

    it('renders "+ New GW goal" button when no GW goals exist', () => {
      renderGwSection()
      expect(screen.getByText('+ New GW goal')).toBeInTheDocument()
    })

    it('does not show "Copy from existing" button when no other goals have GW goals', () => {
      renderGwSection()
      expect(screen.queryByText('Copy from existing')).not.toBeInTheDocument()
    })

    it('shows "Copy from existing" button when other FI goals have GW goals', () => {
      const otherGoal = makeGoal({ id: 2, goalName: 'Plan B' })
      const otherGw = makeGwGoal({ id: 10, fiGoalId: 2 })
      renderGwSection({
        goals: [defaultGoal, otherGoal],
        gwGoals: [otherGw],
      })
      expect(screen.getByText('Copy from existing')).toBeInTheDocument()
    })
  })

  describe('add form', () => {
    it('opens add form when "+ New GW goal" is clicked', async () => {
      const user = userEvent.setup()
      renderGwSection()
      await user.click(screen.getByText('+ New GW goal'))
      expect(screen.getByText('New GW goal')).toBeInTheDocument()
      expect(screen.getByText('Add goal')).toBeInTheDocument()
    })

    it('opens form when initialFormOpen is true', () => {
      renderGwSection({ initialFormOpen: true })
      expect(screen.getByText('New GW goal')).toBeInTheDocument()
    })

    it('closes add form on Cancel', async () => {
      const user = userEvent.setup()
      renderGwSection({ initialFormOpen: true })
      await user.click(screen.getByText('Cancel'))
      expect(screen.queryByText('New GW goal')).not.toBeInTheDocument()
    })

    it('shows validation error when label is empty', async () => {
      const user = userEvent.setup()
      renderGwSection({ initialFormOpen: true })
      await user.click(screen.getByText('Add goal'))
      expect(screen.getByText('Please enter a label for this goal.')).toBeInTheDocument()
    })

    it('shows validation error when disbursement age is not greater than current age', async () => {
      const user = userEvent.setup()
      renderGwSection({ initialFormOpen: true })

      const labelInput = screen.getByRole('textbox')
      await user.type(labelInput, 'College Fund')

      const ageInput = screen.getByPlaceholderText(/> \d+/)
      await user.type(ageInput, '30')

      const amountInput = screen.getByPlaceholderText('e.g. 500000')
      await user.type(amountInput, '100000')

      await user.click(screen.getByText('Add goal'))
      expect(screen.getByText(/Disbursement age must be greater than your current age/)).toBeInTheDocument()
    })

    it('shows validation error when target amount is zero or negative', async () => {
      const user = userEvent.setup()
      renderGwSection({ initialFormOpen: true })

      const labelInput = screen.getByRole('textbox')
      await user.type(labelInput, 'College Fund')

      const ageInput = screen.getByPlaceholderText(/> \d+/)
      await user.type(ageInput, '60')

      const amountInput = screen.getByPlaceholderText('e.g. 500000')
      await user.type(amountInput, '0')

      await user.click(screen.getByText('Add goal'))
      expect(screen.getByText('Enter a valid target amount.')).toBeInTheDocument()
    })

    it('shows validation error when growth rate is out of range', async () => {
      const user = userEvent.setup()
      renderGwSection({ initialFormOpen: true })

      const labelInput = screen.getByRole('textbox')
      await user.type(labelInput, 'College Fund')

      const ageInput = screen.getByPlaceholderText(/> \d+/)
      await user.type(ageInput, '60')

      const amountInput = screen.getByPlaceholderText('e.g. 500000')
      await user.type(amountInput, '100000')

      // Clear default growth rate and set to 0
      const growthInput = screen.getByDisplayValue('7')
      await user.clear(growthInput)
      await user.type(growthInput, '0')

      await user.click(screen.getByText('Add goal'))
      expect(screen.getByText('Growth rate must be between 0 and 50%.')).toBeInTheDocument()
    })

    it('calls onCreateGwGoal with correct data when form is valid', async () => {
      const onCreate = vi.fn()
      const user = userEvent.setup()
      renderGwSection({ initialFormOpen: true, onCreateGwGoal: onCreate })

      await user.type(screen.getByRole('textbox'), 'College Fund')
      await user.type(screen.getByPlaceholderText(/> \d+/), '60')
      await user.type(screen.getByPlaceholderText('e.g. 500000'), '100000')

      await user.click(screen.getByText('Add goal'))

      expect(onCreate).toHaveBeenCalledWith({
        fiGoalId: 1,
        label: 'College Fund',
        disburseAge: 60,
        disburseAmount: 100000,
        growthRate: 7,
        currentSavings: 0,
      })
    })

    it('closes the form after a successful add', async () => {
      const user = userEvent.setup()
      renderGwSection({ initialFormOpen: true })

      await user.type(screen.getByRole('textbox'), 'College Fund')
      await user.type(screen.getByPlaceholderText(/> \d+/), '60')
      await user.type(screen.getByPlaceholderText('e.g. 500000'), '100000')

      await user.click(screen.getByText('Add goal'))
      expect(screen.queryByText('New GW goal')).not.toBeInTheDocument()
    })

    it('resets form fields after Cancel', async () => {
      const user = userEvent.setup()
      renderGwSection({ initialFormOpen: true })

      await user.type(screen.getByRole('textbox'), 'Something')
      await user.click(screen.getByText('Cancel'))

      // Re-open the form
      await user.click(screen.getByText('+ New GW goal'))
      expect(screen.getByRole('textbox')).toHaveValue('')
    })

    it('shows current age hint when currentAge > 0', () => {
      renderGwSection({ initialFormOpen: true })
      expect(screen.getByText(/You are currently \d+ \(at goal creation\)/)).toBeInTheDocument()
    })
  })

  describe('rendering existing GW goals', () => {
    const gw1 = makeGwGoal({
      id: 1,
      fiGoalId: 1,
      label: 'College Fund',
      disburseAge: 50,
      disburseAmount: 100000,
      growthRate: 6,
    })
    const gw2 = makeGwGoal({
      id: 2,
      fiGoalId: 1,
      label: 'Family Trust',
      disburseAge: 55,
      disburseAmount: 200000,
      growthRate: 5,
    })

    it('renders goal labels', () => {
      renderGwSection({ gwGoals: [gw1, gw2] })
      expect(screen.getByText('College Fund')).toBeInTheDocument()
      expect(screen.getByText('Family Trust')).toBeInTheDocument()
    })

    it('renders disbursement age', () => {
      renderGwSection({ gwGoals: [gw1] })
      expect(screen.getByText('50 yrs')).toBeInTheDocument()
    })

    it('renders growth rate', () => {
      renderGwSection({ gwGoals: [gw1] })
      expect(screen.getByText('6% / yr')).toBeInTheDocument()
    })

    it('renders "Unnamed goal" when label is empty', () => {
      const unnamed = makeGwGoal({ id: 3, fiGoalId: 1, label: '' })
      renderGwSection({ gwGoals: [unnamed] })
      expect(screen.getByText('Unnamed goal')).toBeInTheDocument()
    })

    it('renders "+ Add another GW goal" button when goals already exist', () => {
      renderGwSection({ gwGoals: [gw1] })
      expect(screen.getByText('+ Add another GW goal')).toBeInTheDocument()
    })

    it('renders progress percentage', () => {
      renderGwSection({ gwGoals: [gw1] })
      expect(screen.getByText('0.0%')).toBeInTheDocument()
    })
  })

  describe('edit form', () => {
    const gw1 = makeGwGoal({
      id: 1,
      fiGoalId: 1,
      label: 'College Fund',
      disburseAge: 50,
      disburseAmount: 100000,
      growthRate: 6,
    })

    it('opens edit form when edit button is clicked', async () => {
      const user = userEvent.setup()
      renderGwSection({ gwGoals: [gw1] })
      await user.click(screen.getByLabelText('Edit GW goal'))
      expect(screen.getByText('Editing goal')).toBeInTheDocument()
    })

    it('pre-populates edit form with existing values', async () => {
      const user = userEvent.setup()
      renderGwSection({ gwGoals: [gw1] })
      await user.click(screen.getByLabelText('Edit GW goal'))

      expect(screen.getByDisplayValue('College Fund')).toBeInTheDocument()
      expect(screen.getByDisplayValue('50')).toBeInTheDocument()
      expect(screen.getByDisplayValue('100000')).toBeInTheDocument()
      expect(screen.getByDisplayValue('6')).toBeInTheDocument()
    })

    it('calls onUpdateGwGoal with updated data on save', async () => {
      const onUpdate = vi.fn()
      const user = userEvent.setup()
      renderGwSection({ gwGoals: [gw1], onUpdateGwGoal: onUpdate })

      await user.click(screen.getByLabelText('Edit GW goal'))

      const labelInput = screen.getByDisplayValue('College Fund')
      await user.clear(labelInput)
      await user.type(labelInput, 'Updated Fund')

      await user.click(screen.getByText('Save'))

      expect(onUpdate).toHaveBeenCalledWith(1, {
        label: 'Updated Fund',
        disburseAge: 50,
        disburseAmount: 100000,
        growthRate: 6,
      })
    })

    it('shows validation error in edit form when label is empty', async () => {
      const user = userEvent.setup()
      renderGwSection({ gwGoals: [gw1] })
      await user.click(screen.getByLabelText('Edit GW goal'))

      const labelInput = screen.getByDisplayValue('College Fund')
      await user.clear(labelInput)

      await user.click(screen.getByText('Save'))
      expect(screen.getByText('Label is required.')).toBeInTheDocument()
    })

    it('shows validation error in edit form when disbursement age is invalid', async () => {
      const user = userEvent.setup()
      renderGwSection({ gwGoals: [gw1] })
      await user.click(screen.getByLabelText('Edit GW goal'))

      const ageInput = screen.getByDisplayValue('50')
      await user.clear(ageInput)
      await user.type(ageInput, '20')

      await user.click(screen.getByText('Save'))
      expect(screen.getByText(/Disbursement age must be greater than/)).toBeInTheDocument()
    })

    it('shows validation error in edit form when target amount is invalid', async () => {
      const user = userEvent.setup()
      renderGwSection({ gwGoals: [gw1] })
      await user.click(screen.getByLabelText('Edit GW goal'))

      const amountInput = screen.getByDisplayValue('100000')
      await user.clear(amountInput)
      await user.type(amountInput, '0')

      await user.click(screen.getByText('Save'))
      expect(screen.getByText('Enter a valid target amount.')).toBeInTheDocument()
    })

    it('shows validation error in edit form when growth rate is out of range', async () => {
      const user = userEvent.setup()
      renderGwSection({ gwGoals: [gw1] })
      await user.click(screen.getByLabelText('Edit GW goal'))

      const growthInput = screen.getByDisplayValue('6')
      await user.clear(growthInput)
      await user.type(growthInput, '51')

      await user.click(screen.getByText('Save'))
      expect(screen.getByText(/Growth rate must be 0\.1–50%/)).toBeInTheDocument()
    })

    it('cancels edit and restores original values', async () => {
      const user = userEvent.setup()
      renderGwSection({ gwGoals: [gw1] })
      await user.click(screen.getByLabelText('Edit GW goal'))

      const labelInput = screen.getByDisplayValue('College Fund')
      await user.clear(labelInput)
      await user.type(labelInput, 'Changed')

      await user.click(screen.getByText('Cancel'))
      expect(screen.getByText('College Fund')).toBeInTheDocument()
      expect(screen.queryByText('Changed')).not.toBeInTheDocument()
    })
  })

  describe('delete with undo', () => {
    const gw1 = makeGwGoal({ id: 1, fiGoalId: 1, label: 'College Fund' })

    it('shows undo bar when delete is clicked', async () => {
      const user = userEvent.setup()
      renderGwSection({ gwGoals: [gw1] })
      await user.click(screen.getByLabelText('Delete GW goal'))
      expect(screen.getByText('Goal will be deleted in 10s')).toBeInTheDocument()
      expect(screen.getByText('Undo')).toBeInTheDocument()
    })

    it('calls onDeleteGwGoal after 10s timeout', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const onDelete = vi.fn()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderGwSection({ gwGoals: [gw1], onDeleteGwGoal: onDelete })

      await user.click(screen.getByLabelText('Delete GW goal'))
      expect(onDelete).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(10_000)
      expect(onDelete).toHaveBeenCalledWith(1)
    })

    it('cancels delete when Undo is clicked', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const onDelete = vi.fn()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderGwSection({ gwGoals: [gw1], onDeleteGwGoal: onDelete })

      await user.click(screen.getByLabelText('Delete GW goal'))
      await user.click(screen.getByText('Undo'))

      await vi.advanceTimersByTimeAsync(10_000)
      expect(onDelete).not.toHaveBeenCalled()
      expect(screen.queryByText('Goal will be deleted in 10s')).not.toBeInTheDocument()
    })
  })

  describe('dollar view toggle', () => {
    const gw1 = makeGwGoal({
      id: 1,
      fiGoalId: 1,
      label: 'College Fund',
      disburseAge: 50,
      disburseAmount: 100000,
      growthRate: 6,
    })

    it('shows Creation and Disbursement toggle buttons', () => {
      renderGwSection({ gwGoals: [gw1] })
      expect(screen.getByText('Creation')).toBeInTheDocument()
      expect(screen.getByText('Disbursement')).toBeInTheDocument()
    })

    it('displays creation-year dollars by default', () => {
      renderGwSection({ gwGoals: [gw1] })
      expect(screen.getByText('$100,000')).toBeInTheDocument()
    })

    it('switches to disbursement-year dollars when Disbursement is clicked', async () => {
      const user = userEvent.setup()
      renderGwSection({ gwGoals: [gw1] })

      await user.click(screen.getByText('Disbursement'))
      // Disbursement value should be inflation-adjusted (>100k)
      const target = screen.queryByText('$100,000')
      expect(target).not.toBeInTheDocument()
    })
  })

  describe('import / copy from existing', () => {
    const otherGoal = makeGoal({ id: 2, goalName: 'Plan B' })
    const otherGw = makeGwGoal({ id: 10, fiGoalId: 2, label: 'Trust Fund', disburseAge: 55, disburseAmount: 200000 })

    it('shows import picker when "Copy from existing" is clicked in empty state', async () => {
      const user = userEvent.setup()
      renderGwSection({
        goals: [defaultGoal, otherGoal],
        gwGoals: [otherGw],
      })

      await user.click(screen.getByText('Copy from existing'))
      expect(screen.getByText('Trust Fund')).toBeInTheDocument()
      expect(screen.getByText('Plan B')).toBeInTheDocument()
    })

    it('calls onCreateGwGoal when an import item is clicked', async () => {
      const onCreate = vi.fn()
      const user = userEvent.setup()
      renderGwSection({
        goals: [defaultGoal, otherGoal],
        gwGoals: [otherGw],
        onCreateGwGoal: onCreate,
      })

      await user.click(screen.getByText('Copy from existing'))
      await user.click(screen.getByText('Trust Fund'))

      expect(onCreate).toHaveBeenCalledWith({
        fiGoalId: 1,
        label: 'Trust Fund',
        disburseAge: 55,
        disburseAmount: 200000,
        growthRate: 6,
        currentSavings: 0,
      })
    })

    it('closes import picker when Cancel is clicked', async () => {
      const user = userEvent.setup()
      renderGwSection({
        goals: [defaultGoal, otherGoal],
        gwGoals: [otherGw],
      })

      await user.click(screen.getByText('Copy from existing'))
      expect(screen.getByText('Trust Fund')).toBeInTheDocument()

      const cancelBtn = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelBtn)
      expect(screen.queryByText('Trust Fund')).not.toBeInTheDocument()
    })
  })

  describe('progress calculation', () => {
    const gw1 = makeGwGoal({
      id: 1,
      fiGoalId: 1,
      label: 'College Fund',
      disburseAge: 50,
      disburseAmount: 100000,
      growthRate: 6,
    })

    it('shows 0.0% progress when gwTotal is 0', () => {
      mockGwTotal = 0
      renderGwSection({ gwGoals: [gw1] })
      expect(screen.getByText('0.0%')).toBeInTheDocument()
    })

    it('shows progress > 0% when gwTotal > 0', () => {
      mockGwTotal = 50000
      renderGwSection({ gwGoals: [gw1] })
      expect(screen.getByText('41.8%')).toBeInTheDocument()
    })

    it('caps progress at 100%', () => {
      mockGwTotal = 999999999
      renderGwSection({ gwGoals: [gw1] })
      expect(screen.getByText('100.0%')).toBeInTheDocument()
    })
  })

  describe('retirement milestone', () => {
    it('shows GW goal by retirement label with retirement year', () => {
      const goal = makeGoal({
        id: 1,
        goalCreatedIn: '2024-01',
        birthday: '1990-01-15',
        retirementAge: 45,
      })
      const gw1 = makeGwGoal({
        id: 1,
        fiGoalId: 1,
        label: 'College Fund',
        disburseAge: 50,
        disburseAmount: 100000,
        growthRate: 6,
      })
      renderGwSection({ goal, gwGoals: [gw1] })
      // retirementYear = 1990 + 45 = 2035
      expect(screen.getByText(/GW Goal by retirement \(2035\)/)).toBeInTheDocument()
    })

    it('displays PV at retirement amount', () => {
      const gw1 = makeGwGoal({
        id: 1,
        fiGoalId: 1,
        label: 'College Fund',
        disburseAge: 50,
        disburseAmount: 100000,
        growthRate: 6,
      })
      renderGwSection({ gwGoals: [gw1] })
      expect(screen.getByText('$119,740')).toBeInTheDocument()
    })
  })
})
