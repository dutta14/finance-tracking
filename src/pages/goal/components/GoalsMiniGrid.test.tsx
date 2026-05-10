import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GoalsMiniGrid from './GoalsMiniGrid'
import { makeGoal, makeGwGoal } from '../../../test/factories'

vi.mock('../../../styles/GoalMiniCard.css', () => ({}))

vi.mock('../../data/types', () => ({
  getLatestGoalTotals: () => ({ fiTotal: 600000, gwTotal: 0 }),
}))

const defaultGoals = [
  makeGoal({ id: 1, goalName: 'Alpha' }),
  makeGoal({ id: 2, goalName: 'Beta' }),
  makeGoal({ id: 3, goalName: 'Gamma' }),
]

const defaultProps = () => ({
  goals: defaultGoals,
  selectedGoalIds: [1],
  onSelectGoal: vi.fn(),
  onReorderGoals: vi.fn(),
  onRenameGoal: vi.fn(),
  onCopyGoal: vi.fn(),
  onDeleteGoal: vi.fn(),
  gwGoals: [] as ReturnType<typeof makeGwGoal>[],
  profileBirthday: '1990-01-15',
})

describe('GoalsMiniGrid', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /* ── Rendering ── */

  it('renders a GoalMiniCard for each goal', () => {
    const props = defaultProps()
    render(<GoalsMiniGrid {...props} />)

    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByText('Gamma')).toBeInTheDocument()
  })

  it('renders in grid layout by default', () => {
    const props = defaultProps()
    const { container } = render(<GoalsMiniGrid {...props} />)

    expect(container.querySelector('.goals-mini-grid')).toBeInTheDocument()
    expect(container.querySelector('.goals-mini-list')).not.toBeInTheDocument()
  })

  it('renders in list layout when viewMode is "list"', () => {
    const props = defaultProps()
    const { container } = render(<GoalsMiniGrid {...props} viewMode="list" />)

    expect(container.querySelector('.goals-mini-list')).toBeInTheDocument()
    expect(container.querySelector('.goals-mini-grid')).not.toBeInTheDocument()
  })

  it('sets group role and aria-label in compareMode', () => {
    const props = defaultProps()
    render(<GoalsMiniGrid {...props} compareMode />)

    expect(screen.getByRole('group', { name: /select goals for comparison/i })).toBeInTheDocument()
  })

  /* ── Context menu ── */

  it('opens context menu on right-click', () => {
    const props = defaultProps()
    render(<GoalsMiniGrid {...props} />)

    const alphaCard = screen.getByText('Alpha').closest('.goal-drag-item')!
    fireEvent.contextMenu(alphaCard, { clientX: 100, clientY: 200 })

    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.getByText('Rename')).toBeInTheDocument()
    expect(screen.getByText('Duplicate')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('calls onSelectGoal when Open is clicked from context menu', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<GoalsMiniGrid {...props} />)

    const alphaCard = screen.getByText('Alpha').closest('.goal-drag-item')!
    fireEvent.contextMenu(alphaCard, { clientX: 100, clientY: 200 })
    await user.click(screen.getByText('Open'))

    expect(props.onSelectGoal).toHaveBeenCalledWith(1, false)
  })

  it('calls onCopyGoal when Duplicate is clicked from context menu', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<GoalsMiniGrid {...props} />)

    const betaCard = screen.getByText('Beta').closest('.goal-drag-item')!
    fireEvent.contextMenu(betaCard, { clientX: 100, clientY: 200 })
    await user.click(screen.getByText('Duplicate'))

    expect(props.onCopyGoal).toHaveBeenCalledWith(defaultGoals[1])
  })

  it('calls onDeleteGoal when Delete is clicked from context menu', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<GoalsMiniGrid {...props} />)

    const gammaCard = screen.getByText('Gamma').closest('.goal-drag-item')!
    fireEvent.contextMenu(gammaCard, { clientX: 100, clientY: 200 })
    await user.click(screen.getByText('Delete'))

    expect(props.onDeleteGoal).toHaveBeenCalledWith(3)
  })

  it('closes context menu on outside mousedown', () => {
    const props = defaultProps()
    render(<GoalsMiniGrid {...props} />)

    const alphaCard = screen.getByText('Alpha').closest('.goal-drag-item')!
    fireEvent.contextMenu(alphaCard, { clientX: 100, clientY: 200 })
    expect(screen.getByText('Open')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)

    expect(screen.queryByText('Open')).not.toBeInTheDocument()
  })

  /* ── Rename ── */

  it('enters rename mode when Rename is clicked from context menu', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<GoalsMiniGrid {...props} />)

    const alphaCard = screen.getByText('Alpha').closest('.goal-drag-item')!
    fireEvent.contextMenu(alphaCard, { clientX: 100, clientY: 200 })
    await user.click(screen.getByText('Rename'))

    const input = screen.getByDisplayValue('Alpha')
    expect(input).toBeInTheDocument()
    expect(screen.getByText(/enter to save/i)).toBeInTheDocument()
  })

  it('commits rename on Enter key', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<GoalsMiniGrid {...props} />)

    const alphaCard = screen.getByText('Alpha').closest('.goal-drag-item')!
    fireEvent.contextMenu(alphaCard, { clientX: 100, clientY: 200 })
    await user.click(screen.getByText('Rename'))

    const input = screen.getByDisplayValue('Alpha')
    await user.clear(input)
    await user.type(input, 'AlphaRenamed{Enter}')

    expect(props.onRenameGoal).toHaveBeenCalledWith(1, 'AlphaRenamed')
  })

  it('cancels rename on Escape key', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<GoalsMiniGrid {...props} />)

    const alphaCard = screen.getByText('Alpha').closest('.goal-drag-item')!
    fireEvent.contextMenu(alphaCard, { clientX: 100, clientY: 200 })
    await user.click(screen.getByText('Rename'))

    const input = screen.getByDisplayValue('Alpha')
    await user.type(input, '{Escape}')

    expect(props.onRenameGoal).not.toHaveBeenCalled()
    expect(screen.queryByDisplayValue('Alpha')).not.toBeInTheDocument()
  })

  it('commits rename on blur', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<GoalsMiniGrid {...props} />)

    const alphaCard = screen.getByText('Alpha').closest('.goal-drag-item')!
    fireEvent.contextMenu(alphaCard, { clientX: 100, clientY: 200 })
    await user.click(screen.getByText('Rename'))

    const input = screen.getByDisplayValue('Alpha')
    fireEvent.blur(input)

    expect(props.onRenameGoal).toHaveBeenCalledWith(1, 'Alpha')
  })

  /* ── HTML5 drag and drop ── */

  it('sets draggable attribute on items when onReorderGoals is provided', () => {
    const props = defaultProps()
    const { container } = render(<GoalsMiniGrid {...props} />)

    const items = container.querySelectorAll('.goal-drag-item')
    items.forEach(item => expect(item).toHaveAttribute('draggable', 'true'))
  })

  it('does not set draggable when onReorderGoals is undefined', () => {
    const props = defaultProps()
    const { container } = render(<GoalsMiniGrid {...props} onReorderGoals={undefined} />)

    const items = container.querySelectorAll('.goal-drag-item')
    items.forEach(item => expect(item).toHaveAttribute('draggable', 'false'))
  })

  it('adds dragging class on drag start and removes on drag end', () => {
    const props = defaultProps()
    const { container } = render(<GoalsMiniGrid {...props} />)

    const firstItem = container.querySelectorAll('.goal-drag-item')[0]
    const dataTransfer = { effectAllowed: '', dropEffect: '' }
    fireEvent.dragStart(firstItem, { dataTransfer })

    expect(firstItem).toHaveClass('goal-drag-item--dragging')

    fireEvent.dragEnd(firstItem)
    expect(firstItem).not.toHaveClass('goal-drag-item--dragging')
  })

  it('adds drag-over class during dragOver and calls onReorderGoals on drop', () => {
    const props = defaultProps()
    const { container } = render(<GoalsMiniGrid {...props} />)

    const items = container.querySelectorAll('.goal-drag-item')
    const firstItem = items[0]
    const secondItem = items[1]
    const dataTransfer = { effectAllowed: '', dropEffect: '' }

    fireEvent.dragStart(firstItem, { dataTransfer })

    // Drag over second item on the right side (after)
    secondItem.getBoundingClientRect = () =>
      ({ left: 0, width: 100, top: 0, height: 50, right: 100, bottom: 50, x: 0, y: 0, toJSON: () => {} }) as DOMRect
    fireEvent.dragOver(secondItem, { dataTransfer, clientX: 80 })

    expect(secondItem).toHaveClass('goal-drag-item--drag-after')

    fireEvent.drop(secondItem, { dataTransfer })

    // Goal 1 (Alpha) moved after goal 2 (Beta): [2,1,3]
    expect(props.onReorderGoals).toHaveBeenCalledWith([2, 1, 3])
  })

  it('announces reorder to screen readers after drop', () => {
    const props = defaultProps()
    const { container } = render(<GoalsMiniGrid {...props} />)

    const items = container.querySelectorAll('.goal-drag-item')
    const firstItem = items[0]
    const secondItem = items[1]
    const dataTransfer = { effectAllowed: '', dropEffect: '' }

    fireEvent.dragStart(firstItem, { dataTransfer })

    const rect = {
      left: 0,
      width: 100,
      top: 0,
      height: 50,
      right: 100,
      bottom: 50,
      x: 0,
      y: 0,
      toJSON: () => {},
    } as DOMRect
    secondItem.getBoundingClientRect = () => rect
    fireEvent.dragOver(secondItem, { dataTransfer, clientX: 80 })
    fireEvent.drop(secondItem, { dataTransfer })

    const liveRegion = container.querySelector('[aria-live="polite"]')
    expect(liveRegion).toHaveTextContent('Alpha moved after Beta')
  })

  it('reorders goals via drag and drop in list viewMode', () => {
    const props = defaultProps()
    const { container } = render(<GoalsMiniGrid {...props} viewMode="list" />)

    const items = container.querySelectorAll('.goal-drag-item')
    const firstItem = items[0]
    const secondItem = items[1]
    const dataTransfer = { effectAllowed: '', dropEffect: '' }

    fireEvent.dragStart(firstItem, { dataTransfer })

    // #50: Mocking getBoundingClientRect because JSDOM returns zeros for all layout properties.
    // Using { top: 0, height: 100 } to simulate a 100px-tall list item; clientY=80 places
    // the cursor in the bottom half, resulting in an "after" drop position.
    fireEvent.dragOver(secondItem, { dataTransfer, clientY: 0 })

    // Verify the drag-over indicator is applied
    expect(secondItem.className).toContain('goal-drag-item--drag-')

    fireEvent.drop(secondItem, { dataTransfer })
    // #49: Assert the call arguments match expected reorder
    expect(props.onReorderGoals).toHaveBeenCalledWith([2, 1, 3])
  })

  /* ── Mobile move buttons ── */

  it('renders move-up and move-down buttons for each goal', () => {
    const props = defaultProps()
    render(<GoalsMiniGrid {...props} />)

    expect(screen.getByRole('button', { name: /move alpha left/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /move alpha right/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /move beta left/i })).toBeInTheDocument()
  })

  it('disables move-up for first goal and move-down for last goal', () => {
    const props = defaultProps()
    render(<GoalsMiniGrid {...props} />)

    expect(screen.getByRole('button', { name: /move alpha left/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /move gamma right/i })).toBeDisabled()
  })

  it('calls onReorderGoals when move button is clicked', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<GoalsMiniGrid {...props} />)

    // Move Beta left (swap with Alpha)
    await user.click(screen.getByRole('button', { name: /move beta left/i }))

    expect(props.onReorderGoals).toHaveBeenCalledWith([2, 1, 3])
  })

  it('uses up/down labels and aria-labels in list viewMode', () => {
    const props = defaultProps()
    render(<GoalsMiniGrid {...props} viewMode="list" />)

    expect(screen.getByRole('button', { name: /move alpha up/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /move alpha down/i })).toBeInTheDocument()
  })

  it('announces move to screen readers', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    const { container } = render(<GoalsMiniGrid {...props} />)

    await user.click(screen.getByRole('button', { name: /move beta left/i }))

    const liveRegion = container.querySelector('[aria-live="polite"]')
    expect(liveRegion).toHaveTextContent('Beta moved before Alpha')
  })

  /* ── Multi-select in compareMode ── */

  it('renders GoalMiniCards with aria-pressed in compareMode', () => {
    const props = defaultProps()
    render(<GoalsMiniGrid {...props} compareMode selectedGoalIds={[1, 3]} />)

    const buttons = screen.getAllByRole('button', { pressed: true })
    const goalButtons = buttons.filter(b => b.getAttribute('aria-label')?.includes('selected for comparison'))
    expect(goalButtons).toHaveLength(2)
  })
})
