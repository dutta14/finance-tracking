import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GoalMixer from './GoalMixer'
import { makeGoal, makeGwGoal } from '../../../test/factories'

// Focus trap is mocked because JSDOM does not implement focus management or
// layout (getBoundingClientRect returns zeros). Testing real focus trapping
// requires a browser environment (Playwright/Cypress).
vi.mock('../../../hooks/useFocusTrap', () => ({
  useFocusTrap: vi.fn(),
}))

vi.mock('../../../styles/GoalMixer.css', () => ({}))

const goal1 = makeGoal({ id: 1, goalName: 'Plan A', fiGoal: 1_000_000 })
const goal2 = makeGoal({ id: 2, goalName: 'Plan B', fiGoal: 2_000_000 })
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

describe('GoalMixer', () => {
  // #42: No actual `new Date(2024)` pattern found in this test file.
  // Date strings like '1990-01-15' use explicit month/day and are TZ-safe.
  // GoalMixer uses Date.now() for ID generation; fake timers would freeze it.
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the modal with title and subtitle', () => {
    render(<GoalMixer {...defaultProps} />)
    expect(screen.getByText('Mix & Match')).toBeInTheDocument()
    expect(screen.getByText(/Pick an FI base and any GW goals/)).toBeInTheDocument()
  })

  it('renders all FI goals as selectable buttons', () => {
    render(<GoalMixer {...defaultProps} />)
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
    // $1,000,000 appears in the goal list stat and in the preview
    expect(screen.getAllByText('$1,000,000').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Preview at retirement/)).toBeInTheDocument()
  })

  it('toggles GW goal selection via checkboxes', async () => {
    const user = userEvent.setup()
    render(<GoalMixer {...defaultProps} />)
    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[0])
    // After selecting a GW goal, the preview shows a Total row
    expect(screen.getByText('Total')).toBeInTheDocument()
  })

  it('shows preview amounts for selected GW goals', async () => {
    const user = userEvent.setup()
    render(<GoalMixer {...defaultProps} />)
    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[0])
    // College Fund should appear in preview section
    const previewLabels = screen.getAllByText('College Fund')
    expect(previewLabels.length).toBeGreaterThanOrEqual(2) // one in GW list, one in preview
  })

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup()
    render(<GoalMixer {...defaultProps} />)
    await user.click(screen.getByText('Cancel'))
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup()
    render(<GoalMixer {...defaultProps} />)
    await user.click(screen.getByLabelText('Close'))
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape is pressed', async () => {
    const user = userEvent.setup()
    render(<GoalMixer {...defaultProps} />)
    await user.keyboard('{Escape}')
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onCreateGoal, onCreateGwGoal, onClose, and onGoToGoal when creating a mixed goal', async () => {
    const user = userEvent.setup()
    render(<GoalMixer {...defaultProps} />)
    // Select a GW goal
    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[0])
    // Create
    await user.click(screen.getByText('Create as New Goal →'))
    expect(defaultProps.onCreateGoal).toHaveBeenCalledTimes(1)
    const createdGoal = defaultProps.onCreateGoal.mock.calls[0][0]
    expect(createdGoal.goalName).toBe('Plan A – Mixed')
    expect(defaultProps.onCreateGwGoal).toHaveBeenCalledTimes(1)
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
    expect(defaultProps.onGoToGoal).toHaveBeenCalledWith(createdGoal.id)
  })

  it('switches FI base goal when a different goal is clicked', async () => {
    const user = userEvent.setup()
    render(<GoalMixer {...defaultProps} />)
    // Plan B appears in goal list; click the first occurrence (the goal button)
    await user.click(screen.getAllByText('Plan B')[0])
    // Preview should now show Plan B's FI goal amount
    expect(screen.getAllByText('$2,000,000').length).toBeGreaterThanOrEqual(1)
  })

  it('creates GW goals for each selected GW goal with the new FI goal id', async () => {
    const user = userEvent.setup()
    render(<GoalMixer {...defaultProps} />)
    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[0])
    await user.click(checkboxes[1])
    await user.click(screen.getByText('Create as New Goal →'))
    expect(defaultProps.onCreateGwGoal).toHaveBeenCalledTimes(2)
    const newGoalId = defaultProps.onCreateGoal.mock.calls[0][0].id
    expect(defaultProps.onCreateGwGoal.mock.calls[0][0].fiGoalId).toBe(newGoalId)
    expect(defaultProps.onCreateGwGoal.mock.calls[1][0].fiGoalId).toBe(newGoalId)
  })

  it('renders dialog with appropriate ARIA attributes', () => {
    render(<GoalMixer {...defaultProps} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })
})

/* ═══════════════════════════════════════════════════════════════
   Branch Coverage — Additional GoalMixer branches
   ═══════════════════════════════════════════════════════════════ */

describe('GoalMixer — empty goals array (line 42, 84, 87, 104, 153, 191)', () => {
  it('renders with empty goals array — no FI goals shown, Create button disabled', () => {
    render(<GoalMixer {...defaultProps} goals={[]} />)
    // selectedGoalId defaults to null when goals is empty (line 42: goals[0]?.id ?? null)
    // Create button should be disabled (line 104: !selectedGoal guard)
    const createBtn = screen.getByText('Create as New Goal →')
    expect(createBtn).toBeDisabled()
  })

  it('shows "(select FI base first)" hint when no goal is selected (line 153)', () => {
    render(<GoalMixer {...defaultProps} goals={[]} />)
    expect(screen.getByText('(select FI base first)')).toBeInTheDocument()
  })

  it('shows "Select an FI base to see a preview" when no goals exist', () => {
    render(<GoalMixer {...defaultProps} goals={[]} />)
    expect(screen.getByText('Select an FI base to see a preview.')).toBeInTheDocument()
  })

  it('handleCreate does nothing when selectedGoal is null (line 104)', () => {
    render(<GoalMixer {...defaultProps} goals={[]} />)
    const createBtn = screen.getByText('Create as New Goal →')
    // Even though disabled, force click to verify the guard
    fireEvent.click(createBtn)
    expect(defaultProps.onCreateGoal).not.toHaveBeenCalled()
    expect(defaultProps.onClose).not.toHaveBeenCalled()
  })

  it('retirementYear is null when no selectedGoal (line 191)', () => {
    render(<GoalMixer {...defaultProps} goals={[]} />)
    // Preview heading should just say "Preview at retirement" without a year
    const heading = screen.getByText('Preview at retirement')
    expect(heading.textContent).toBe('Preview at retirement')
  })
})

describe('GoalMixer — GW goal with empty label (line 173)', () => {
  it('renders "Unnamed goal" for GW goals with empty label', () => {
    const gwNoLabel = makeGwGoal({
      id: 99,
      fiGoalId: 1,
      label: '',
      disburseAge: 50,
      disburseAmount: 50000,
      growthRate: 5,
    })
    render(<GoalMixer {...defaultProps} gwGoals={[gwNoLabel]} />)
    expect(screen.getByText('Unnamed goal')).toBeInTheDocument()
  })
})

describe('GoalMixer — deselecting a GW goal (line 60-72 delete branch)', () => {
  it('deselecting a previously selected GW goal removes it from preview', async () => {
    const user = userEvent.setup()
    render(<GoalMixer {...defaultProps} />)
    const checkboxes = screen.getAllByRole('checkbox')
    // Select
    await user.click(checkboxes[0])
    expect(screen.getByText('Total')).toBeInTheDocument()
    // Deselect (line 60: next.has(id) → next.delete(id))
    await user.click(checkboxes[0])
    expect(screen.queryByText('Total')).not.toBeInTheDocument()
  })
})

describe('GoalMixer — backdrop click (line 221)', () => {
  it('backdrop click calls onClose', () => {
    const { container } = render(<GoalMixer {...defaultProps} />)
    // The backdrop is the outermost .mixer-backdrop div
    const backdrop = container.querySelector('.mixer-backdrop')!
    fireEvent.click(backdrop)
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })
})

describe('GoalMixer — computeGwPv disburseAge <= retirementAge (line 20)', () => {
  it('uses disbursementTarget directly when disburseAge <= retirementAge', async () => {
    const user = userEvent.setup()
    // gw disburseAge=40, goal retirementAge=45 → monthsRetToDisburse = max(0, (40-45)*12) = 0
    // So PV = disbursementTarget (no discounting)
    const earlyGw = makeGwGoal({
      id: 20,
      fiGoalId: 1,
      label: 'Early Disburse',
      disburseAge: 40, // less than goal1's retirementAge (45)
      disburseAmount: 100000,
      growthRate: 6,
    })
    render(<GoalMixer {...defaultProps} gwGoals={[earlyGw]} />)
    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[0])
    // Total row should appear with a computed value
    expect(screen.getByText('Total')).toBeInTheDocument()
  })
})

describe('GoalMixer — GW goal with fiGoalId not matching any goal (line 80)', () => {
  it('filters out GW goals whose fiGoalId does not match any goal', () => {
    const orphanGw = makeGwGoal({
      id: 30,
      fiGoalId: 999, // No goal with id 999
      label: 'Orphan Goal',
      disburseAge: 50,
      disburseAmount: 50000,
      growthRate: 5,
    })
    render(<GoalMixer {...defaultProps} gwGoals={[orphanGw]} />)
    // Orphan GW goal should not appear since its fiGoalId doesn't match
    // The "No GW goals found" message should show
    expect(screen.getByText('No GW goals found across any goals.')).toBeInTheDocument()
    expect(screen.queryByText('Orphan Goal')).not.toBeInTheDocument()
  })
})
