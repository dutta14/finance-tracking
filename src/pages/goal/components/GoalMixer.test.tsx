import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GoalMixer from './GoalMixer'
import { makeGoal, makeGwGoal } from '../../../test/factories'
import { getFiTarget } from '../utils/goalCalculations'

vi.mock('../../../hooks/useFocusTrap', () => ({
  useFocusTrap: vi.fn(),
}))

vi.mock('../../../styles/GoalMixer.css', () => ({}))

const goal1 = makeGoal({ id: 1, goalName: 'Plan A', fiGoal: 1_000_000, expenseValue: 60_000, goalEndYear: '2050-01' })
const goal2 = makeGoal({ id: 2, goalName: 'Plan B', fiGoal: 2_000_000, expenseValue: 120_000, goalEndYear: '2050-01' })
const gw1 = makeGwGoal({
  id: 10,
  fiGoalId: 1,
  label: 'College Fund',
  disburseAge: 50,
  disburseAmount: 100000,
  growthRate: 6,
})
const gw2 = makeGwGoal({
  id: 11,
  fiGoalId: 1,
  label: 'Dream Home',
  disburseAge: 55,
  disburseAmount: 200000,
  growthRate: 5,
})
const gw3 = makeGwGoal({ id: 12, fiGoalId: 2, label: 'Legacy', disburseAge: 60, disburseAmount: 50000, growthRate: 4 })

const defaultProps = {
  goals: [goal1, goal2],
  gwGoals: [gw1, gw2, gw3],
  profileBirthday: '1990-01-15',
  onCreateGoal: vi.fn(),
  onCreateGwGoal: vi.fn(),
  onClose: vi.fn(),
  onGoToGoal: vi.fn(),
}

const dollars = (n: number) => '$' + Math.round(n).toLocaleString()
const goal1FiTarget = getFiTarget(goal1, defaultProps.profileBirthday, goal1.growth, undefined, undefined, 3)
const goal2FiTarget = getFiTarget(goal2, defaultProps.profileBirthday, goal2.growth, undefined, undefined, 3)
describe('GoalMixer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the modal with title, subtitle, and template strip', () => {
    render(<GoalMixer {...defaultProps} />)

    expect(screen.getByText('Mix & Match')).toBeInTheDocument()
    expect(screen.getByText(/Pick an FI base and any GW goals/)).toBeInTheDocument()
    expect(screen.getByText('Start from a template')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Start from a template' })).toBeInTheDocument()
  })

  it('renders FI base goals and template chips', () => {
    render(<GoalMixer {...defaultProps} />)

    expect(screen.getByText('Start from a template')).toBeInTheDocument()
    expect(screen.getAllByText('Plan A').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Plan B').length).toBeGreaterThanOrEqual(1)
  })

  it('renders GW goals grouped by their parent FI goal', () => {
    render(<GoalMixer {...defaultProps} />)

    expect(screen.getByText('College Fund')).toBeInTheDocument()
    expect(screen.getByText('Dream Home')).toBeInTheDocument()
    expect(screen.getByText('Legacy')).toBeInTheDocument()
    expect(screen.getByText('from "Plan A"')).toBeInTheDocument()
    expect(screen.getByText('from "Plan B"')).toBeInTheDocument()
  })

  it('shows empty message when there are no GW goals', () => {
    render(<GoalMixer {...defaultProps} gwGoals={[]} />)

    expect(screen.getByText('No GW goals found across any goals.')).toBeInTheDocument()
  })

  it('selects the first goal by default and shows preview', () => {
    render(<GoalMixer {...defaultProps} />)

    expect(screen.getAllByText(dollars(goal1FiTarget)).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Preview at retirement/)).toBeInTheDocument()
  })

  it('quick-fills FI parameters from a template chip and shows attribution', async () => {
    const user = userEvent.setup()
    render(<GoalMixer {...defaultProps} />)

    const chipGroup = screen.getByRole('group', { name: 'Start from a template' })
    await user.click(within(chipGroup).getByRole('button', { name: /Early Retirement/i }))

    expect(screen.getByLabelText('Retirement age')).toHaveValue(45)
    expect(screen.getByLabelText('Annual expense')).toHaveValue(40000)
    expect(screen.getByLabelText('Growth')).toHaveValue(8)
    expect(screen.getAllByText('from Early Retirement')).toHaveLength(3)
  })

  it('marks the selected template chip as partially applied after parameter edits', async () => {
    const user = userEvent.setup()
    render(<GoalMixer {...defaultProps} />)

    const chipGroup = screen.getByRole('group', { name: 'Start from a template' })
    const chip = within(chipGroup).getByRole('button', { name: /Early Retirement/i })
    await user.click(chip)
    await user.clear(screen.getByLabelText('Growth'))
    await user.type(screen.getByLabelText('Growth'), '6.5')

    expect(chip.className).toContain('partial')
    expect(chip.className).not.toContain('selected')
  })

  it('switches FI base when a user goal is clicked', async () => {
    const user = userEvent.setup()
    render(<GoalMixer {...defaultProps} />)

    await user.click(screen.getAllByText('Plan B')[0])

    expect(screen.getAllByText(dollars(goal2FiTarget)).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByLabelText('Annual expense')).toHaveValue(120000)
  })

  it('shows template-first empty state when there are no goals', () => {
    render(<GoalMixer {...defaultProps} goals={[]} gwGoals={[]} />)

    expect(screen.getByText('Pick a template to get started')).toBeInTheDocument()
    expect(screen.queryByText('Your Goals')).not.toBeInTheDocument()
    expect(screen.getByText('Select an FI base to see a preview.')).toBeInTheDocument()
    expect(screen.getByText('Create as New Goal →')).toBeDisabled()
  })

  it('shows template chips as primary option when there are no goals', () => {
    render(<GoalMixer {...defaultProps} goals={[]} gwGoals={[]} />)

    expect(screen.getByText('Start from a template')).toBeInTheDocument()
    expect(screen.getByText('Early Retirement')).toBeInTheDocument()
    expect(screen.getByText('No GW goals found across any goals.')).toBeInTheDocument()
  })

  it('toggles GW goal selection via checkboxes', async () => {
    const user = userEvent.setup()
    render(<GoalMixer {...defaultProps} />)

    await user.click(screen.getAllByRole('checkbox')[0])

    expect(screen.getByText('Total')).toBeInTheDocument()
  })

  it('deselecting a previously selected GW goal removes it from preview', async () => {
    const user = userEvent.setup()
    render(<GoalMixer {...defaultProps} />)

    const checkbox = screen.getAllByRole('checkbox')[0]
    await user.click(checkbox)
    expect(screen.getByText('Total')).toBeInTheDocument()

    await user.click(checkbox)
    expect(screen.queryByText('Total')).not.toBeInTheDocument()
  })

  it('creates a mixed goal from a template source without template metadata', async () => {
    const user = userEvent.setup()
    render(<GoalMixer {...defaultProps} />)

    const chipGroup = screen.getByRole('group', { name: 'Start from a template' })
    await user.click(within(chipGroup).getByRole('button', { name: /Early Retirement/i }))
    await user.click(screen.getAllByRole('checkbox')[0])
    await user.click(screen.getByText('Create as New Goal →'))

    expect(defaultProps.onCreateGoal).toHaveBeenCalledTimes(1)
    const createdGoal = defaultProps.onCreateGoal.mock.calls[0][0]
    expect(createdGoal.goalName).toBe('Early Retirement – Mixed')
    expect(createdGoal.retirementAge).toBe(45)
    expect(createdGoal.expenseValue).toBe(40000)
    expect(createdGoal.growth).toBe(8)
    expect(createdGoal.safeWithdrawalRate).toBe(4)
    expect(createdGoal.birthday).toBe(defaultProps.profileBirthday)
    expect(createdGoal.fiGoal).toBe(getFiTarget(createdGoal, defaultProps.profileBirthday, 8, undefined, undefined, 3))
    expect('templateId' in createdGoal).toBe(false)
    expect(defaultProps.onCreateGwGoal).toHaveBeenCalledTimes(1)
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
    expect(defaultProps.onGoToGoal).toHaveBeenCalledWith(createdGoal.id)
  })

  it('creates GW goals for each selected GW goal with the new FI goal id', async () => {
    const user = userEvent.setup()
    render(<GoalMixer {...defaultProps} />)

    await user.click(screen.getAllByRole('checkbox')[0])
    await user.click(screen.getAllByRole('checkbox')[1])
    await user.click(screen.getByText('Create as New Goal →'))

    expect(defaultProps.onCreateGwGoal).toHaveBeenCalledTimes(2)
    const newGoalId = defaultProps.onCreateGoal.mock.calls[0][0].id
    expect(defaultProps.onCreateGwGoal.mock.calls[0][0].fiGoalId).toBe(newGoalId)
    expect(defaultProps.onCreateGwGoal.mock.calls[1][0].fiGoalId).toBe(newGoalId)
  })

  it('renders dialog with appropriate ARIA attributes', () => {
    render(<GoalMixer {...defaultProps} />)

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup()
    render(<GoalMixer {...defaultProps} />)

    await user.click(screen.getByText('Cancel'))

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup()
    render(<GoalMixer {...defaultProps} />)

    await user.click(screen.getByText('Cancel'))

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape is pressed', async () => {
    const user = userEvent.setup()
    render(<GoalMixer {...defaultProps} />)

    await user.keyboard('{Escape}')

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('backdrop click calls onClose', () => {
    const { container } = render(<GoalMixer {...defaultProps} />)

    fireEvent.click(container.querySelector('.mixer-backdrop')!)
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('renders "Unnamed goal" for GW goals with empty label', () => {
    const gwNoLabel = makeGwGoal({ id: 99, fiGoalId: 1, label: '', disburseAge: 50, disburseAmount: 50000, growthRate: 5 })
    render(<GoalMixer {...defaultProps} gwGoals={[gwNoLabel]} />)

    expect(screen.getByText('Unnamed goal')).toBeInTheDocument()
  })

  it('filters out GW goals whose fiGoalId does not match any goal', () => {
    const orphanGw = makeGwGoal({ id: 30, fiGoalId: 999, label: 'Orphan Goal', disburseAge: 50, disburseAmount: 50000, growthRate: 5 })
    render(<GoalMixer {...defaultProps} gwGoals={[orphanGw]} />)

    expect(screen.getByText('No GW goals found across any goals.')).toBeInTheDocument()
    expect(screen.queryByText('Orphan Goal')).not.toBeInTheDocument()
  })
})
