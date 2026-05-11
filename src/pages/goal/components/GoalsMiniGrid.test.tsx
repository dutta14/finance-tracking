import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

  /* ── Drag over self does not highlight ── */

  it('does not highlight when dragging a card over itself', () => {
    const props = defaultProps()
    const { container } = render(<GoalsMiniGrid {...props} />)

    const items = container.querySelectorAll('.goal-drag-item')
    const firstItem = items[0]
    const dataTransfer = { effectAllowed: '', dropEffect: '' }

    fireEvent.dragStart(firstItem, { dataTransfer })

    firstItem.getBoundingClientRect = () =>
      ({ left: 0, width: 100, top: 0, height: 50, right: 100, bottom: 50, x: 0, y: 0, toJSON: () => {} }) as DOMRect
    fireEvent.dragOver(firstItem, { dataTransfer, clientX: 50 })

    // Should not add drag-over indicator classes
    expect(firstItem).not.toHaveClass('goal-drag-item--drag-before')
    expect(firstItem).not.toHaveClass('goal-drag-item--drag-after')
  })

  /* ── Drop on self is a no-op ── */

  it('does not reorder when dropping on the same card', () => {
    const props = defaultProps()
    const { container } = render(<GoalsMiniGrid {...props} />)

    const items = container.querySelectorAll('.goal-drag-item')
    const firstItem = items[0]
    const dataTransfer = { effectAllowed: '', dropEffect: '' }

    fireEvent.dragStart(firstItem, { dataTransfer })
    fireEvent.drop(firstItem, { dataTransfer })

    expect(props.onReorderGoals).not.toHaveBeenCalled()
  })

  /* ── Drop without prior dragStart is a no-op ── */

  it('does not reorder when dropping without a drag start', () => {
    const props = defaultProps()
    const { container } = render(<GoalsMiniGrid {...props} />)

    const items = container.querySelectorAll('.goal-drag-item')
    fireEvent.drop(items[1], { dataTransfer: { effectAllowed: '', dropEffect: '' } })

    expect(props.onReorderGoals).not.toHaveBeenCalled()
  })

  /* ── Move button boundary checks ── */

  it('does not reorder when moving first goal up', async () => {
    const props = defaultProps()
    render(<GoalsMiniGrid {...props} />)

    // The move-left (up) button for Alpha is disabled
    const btn = screen.getByRole('button', { name: /move alpha left/i })
    expect(btn).toBeDisabled()
  })

  it('does not reorder when moving last goal down', async () => {
    const props = defaultProps()
    render(<GoalsMiniGrid {...props} />)

    // The move-right (down) button for Gamma is disabled
    const btn = screen.getByRole('button', { name: /move gamma right/i })
    expect(btn).toBeDisabled()
  })

  /* ── Does not render move buttons when onReorderGoals is undefined ── */

  it('does not render move buttons when onReorderGoals is undefined', () => {
    const props = defaultProps()
    render(<GoalsMiniGrid {...props} onReorderGoals={undefined} />)

    expect(screen.queryByRole('button', { name: /move alpha/i })).not.toBeInTheDocument()
  })

  /* ── Context menu near window edge repositions ── */

  it('repositions context menu when near right edge of window', () => {
    const props = defaultProps()
    render(<GoalsMiniGrid {...props} />)

    // Simulate right-click near the right edge of the viewport
    const alphaCard = screen.getByText('Alpha').closest('.goal-drag-item')!
    Object.defineProperty(window, 'innerWidth', { value: 200, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true })

    fireEvent.contextMenu(alphaCard, { clientX: 190, clientY: 100 })

    expect(screen.getByText('Open')).toBeInTheDocument()
    // Menu should be repositioned (x adjusted)
    const menu = screen.getByText('Open').closest('.card-context-menu') as HTMLElement
    const left = parseInt(menu.style.left)
    expect(left).toBeLessThan(190)

    // Cleanup
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true })
  })

  /* ── Context menu near bottom edge repositions ── */

  it('repositions context menu when near bottom edge of window', () => {
    const props = defaultProps()
    render(<GoalsMiniGrid {...props} />)

    Object.defineProperty(window, 'innerWidth', { value: 800, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: 200, writable: true })

    const betaCard = screen.getByText('Beta').closest('.goal-drag-item')!
    fireEvent.contextMenu(betaCard, { clientX: 100, clientY: 190 })

    expect(screen.getByText('Open')).toBeInTheDocument()
    const menu = screen.getByText('Open').closest('.card-context-menu') as HTMLElement
    const top = parseInt(menu.style.top)
    expect(top).toBeLessThan(190)

    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true })
  })

  /* ── Rename with empty value does not call onRenameGoal ── */

  it('does not call onRenameGoal when renaming to empty string', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<GoalsMiniGrid {...props} />)

    const alphaCard = screen.getByText('Alpha').closest('.goal-drag-item')!
    fireEvent.contextMenu(alphaCard, { clientX: 100, clientY: 200 })
    await user.click(screen.getByText('Rename'))

    const input = screen.getByDisplayValue('Alpha')
    await user.clear(input)
    fireEvent.blur(input)

    expect(props.onRenameGoal).not.toHaveBeenCalled()
  })

  /* ── Empty goals list renders empty grid ── */

  it('renders empty grid when no goals are provided', () => {
    const props = defaultProps()
    const { container } = render(<GoalsMiniGrid {...props} goals={[]} />)

    const items = container.querySelectorAll('.goal-drag-item')
    expect(items).toHaveLength(0)
  })

  /* ── Context menu returns null for nonexistent goal ── */

  it('does not render context menu for a goal that no longer exists in the list', () => {
    const props = defaultProps()
    const { rerender } = render(<GoalsMiniGrid {...props} />)

    // Open context menu for Alpha
    const alphaCard = screen.getByText('Alpha').closest('.goal-drag-item')!
    fireEvent.contextMenu(alphaCard, { clientX: 100, clientY: 200 })
    expect(screen.getByText('Open')).toBeInTheDocument()

    // Re-render without the goal that had the context menu open
    rerender(<GoalsMiniGrid {...props} goals={[makeGoal({ id: 2, goalName: 'Beta' })]} />)

    // Context menu should not render since goal 1 is gone
    expect(screen.queryByText('Open')).not.toBeInTheDocument()
  })

  /* ── Move goal announces direction in list mode ── */

  it('announces move with up/down direction in list viewMode', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    const { container } = render(<GoalsMiniGrid {...props} viewMode="list" />)

    await user.click(screen.getByRole('button', { name: /move beta up/i }))

    const liveRegion = container.querySelector('[aria-live="polite"]')
    expect(liveRegion).toHaveTextContent('Beta moved before Alpha')
  })

  /* ── DragOver "before" side in grid mode ── */

  it('handles drag over in list mode using clientY for position detection', () => {
    const props = defaultProps()
    const { container } = render(<GoalsMiniGrid {...props} viewMode="list" />)

    const items = container.querySelectorAll('.goal-drag-item')
    const firstItem = items[0]
    const secondItem = items[1]
    const dataTransfer = { effectAllowed: '', dropEffect: '' }

    fireEvent.dragStart(firstItem, { dataTransfer })
    fireEvent.dragOver(secondItem, { dataTransfer, clientY: 0 })

    // Should have some drag indicator class
    expect(secondItem.className).toContain('goal-drag-item--drag-')
  })

  it('reorders correctly when dropping on a different card', () => {
    const props = defaultProps()
    const { container } = render(<GoalsMiniGrid {...props} />)

    const items = container.querySelectorAll('.goal-drag-item')
    const thirdItem = items[2]
    const secondItem = items[1]
    const dataTransfer = { effectAllowed: '', dropEffect: '' }

    fireEvent.dragStart(thirdItem, { dataTransfer })
    fireEvent.dragOver(secondItem, { dataTransfer, clientX: 80 })
    fireEvent.drop(secondItem, { dataTransfer })

    // Gamma moved relative to Beta
    expect(props.onReorderGoals).toHaveBeenCalled()
    const newOrder = props.onReorderGoals.mock.calls[0][0]
    expect(newOrder).toContain(1)
    expect(newOrder).toContain(2)
    expect(newOrder).toContain(3)
    expect(newOrder).toHaveLength(3)
  })

  /* ── Context menu ─────────────────────────────────────────────── */

  describe('context menu', () => {
    it('opens context menu on right-click', () => {
      const props = defaultProps()
      const { container } = render(<GoalsMiniGrid {...props} />)

      const items = container.querySelectorAll('.goal-drag-item')
      fireEvent.contextMenu(items[0], { clientX: 100, clientY: 100 })

      expect(screen.getByText('Open')).toBeInTheDocument()
      expect(screen.getByText('Rename')).toBeInTheDocument()
      expect(screen.getByText('Duplicate')).toBeInTheDocument()
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })

    it('calls onSelectGoal when Open is clicked', () => {
      const props = defaultProps()
      const { container } = render(<GoalsMiniGrid {...props} />)

      const items = container.querySelectorAll('.goal-drag-item')
      fireEvent.contextMenu(items[0], { clientX: 100, clientY: 100 })

      fireEvent.click(screen.getByText('Open'))
      expect(props.onSelectGoal).toHaveBeenCalledWith(1, false)
    })

    it('starts inline rename when Rename is clicked', () => {
      const props = defaultProps()
      const { container } = render(<GoalsMiniGrid {...props} />)

      const items = container.querySelectorAll('.goal-drag-item')
      fireEvent.contextMenu(items[1], { clientX: 100, clientY: 100 })

      fireEvent.click(screen.getByText('Rename'))
      expect(screen.getByDisplayValue('Beta')).toBeInTheDocument()
    })

    it('calls onCopyGoal when Duplicate is clicked', () => {
      const props = defaultProps()
      const { container } = render(<GoalsMiniGrid {...props} />)

      const items = container.querySelectorAll('.goal-drag-item')
      fireEvent.contextMenu(items[0], { clientX: 100, clientY: 100 })

      fireEvent.click(screen.getByText('Duplicate'))
      expect(props.onCopyGoal).toHaveBeenCalledWith(defaultGoals[0])
    })

    it('calls onDeleteGoal when Delete is clicked', () => {
      const props = defaultProps()
      const { container } = render(<GoalsMiniGrid {...props} />)

      const items = container.querySelectorAll('.goal-drag-item')
      fireEvent.contextMenu(items[2], { clientX: 100, clientY: 100 })

      fireEvent.click(screen.getByText('Delete'))
      expect(props.onDeleteGoal).toHaveBeenCalledWith(3)
    })

    it('repositions menu when near right edge of window', () => {
      const props = defaultProps()
      const { container } = render(<GoalsMiniGrid {...props} />)

      const items = container.querySelectorAll('.goal-drag-item')
      // Open near right edge
      fireEvent.contextMenu(items[0], { clientX: window.innerWidth - 10, clientY: 100 })

      const menu = container.querySelector('.card-context-menu') as HTMLElement
      expect(menu).toBeInTheDocument()
    })

    it('repositions menu when near bottom edge of window', () => {
      const props = defaultProps()
      const { container } = render(<GoalsMiniGrid {...props} />)

      const items = container.querySelectorAll('.goal-drag-item')
      // Open near bottom edge
      fireEvent.contextMenu(items[0], { clientX: 100, clientY: window.innerHeight - 10 })

      const menu = container.querySelector('.card-context-menu') as HTMLElement
      expect(menu).toBeInTheDocument()
    })
  })

  /* ── Inline rename ────────────────────────────────────────────── */

  describe('inline rename', () => {
    it('commits rename on Enter key', async () => {
      const user = userEvent.setup()
      const props = defaultProps()
      const { container } = render(<GoalsMiniGrid {...props} />)

      // Open context menu and click Rename
      const items = container.querySelectorAll('.goal-drag-item')
      fireEvent.contextMenu(items[0], { clientX: 100, clientY: 100 })
      fireEvent.click(screen.getByText('Rename'))

      const input = screen.getByDisplayValue('Alpha')
      await user.clear(input)
      await user.type(input, 'Alpha Renamed{enter}')

      expect(props.onRenameGoal).toHaveBeenCalledWith(1, 'Alpha Renamed')
    })

    it('cancels rename on Escape key', async () => {
      const user = userEvent.setup()
      const props = defaultProps()
      const { container } = render(<GoalsMiniGrid {...props} />)

      const items = container.querySelectorAll('.goal-drag-item')
      fireEvent.contextMenu(items[0], { clientX: 100, clientY: 100 })
      fireEvent.click(screen.getByText('Rename'))

      const input = screen.getByDisplayValue('Alpha')
      await user.type(input, ' extra')
      await user.keyboard('{Escape}')

      // Should not have called rename, and card should be back to normal
      expect(screen.getByText('Alpha')).toBeInTheDocument()
    })

    it('commits rename on blur', () => {
      const props = defaultProps()
      const { container } = render(<GoalsMiniGrid {...props} />)

      const items = container.querySelectorAll('.goal-drag-item')
      fireEvent.contextMenu(items[1], { clientX: 100, clientY: 100 })
      fireEvent.click(screen.getByText('Rename'))

      const input = screen.getByDisplayValue('Beta')
      fireEvent.change(input, { target: { value: 'Beta Updated' } })
      fireEvent.blur(input)

      expect(props.onRenameGoal).toHaveBeenCalledWith(2, 'Beta Updated')
    })
  })

  /* ── Empty state ──────────────────────────────────────────────── */

  it('renders empty grid when no goals', () => {
    const props = { ...defaultProps(), goals: [] }
    const { container } = render(<GoalsMiniGrid {...props} />)

    expect(container.querySelector('.goals-mini-grid')).toBeInTheDocument()
    expect(container.querySelectorAll('.goal-drag-item')).toHaveLength(0)
  })

  /* ── Move goal down ───────────────────────────────────────────── */

  it('moves goal down (next) in grid mode', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    const { container } = render(<GoalsMiniGrid {...props} />)

    // Click the → (next) button for Alpha
    await user.click(screen.getByRole('button', { name: /move alpha right/i }))
    expect(props.onReorderGoals).toHaveBeenCalled()

    const liveRegion = container.querySelector('[aria-live="polite"]')
    expect(liveRegion).toHaveTextContent('Alpha moved after Beta')
  })

  /* ── DragOver "before" side in grid mode ──────────────────────── */

  it('clears drag state on dragEnd', () => {
    const props = defaultProps()
    const { container } = render(<GoalsMiniGrid {...props} />)

    const items = container.querySelectorAll('.goal-drag-item')
    const firstItem = items[0]
    const secondItem = items[1]
    const dataTransfer = { effectAllowed: '', dropEffect: '' }

    // Start drag to set draggedId
    fireEvent.dragStart(firstItem, { dataTransfer })
    expect(firstItem.className).toContain('goal-drag-item--dragging')

    // DragOver to set dragOverId
    fireEvent.dragOver(secondItem, { dataTransfer, clientX: 999 })
    expect(secondItem.className).toContain('goal-drag-item--drag-')

    // DragEnd clears both
    fireEvent.dragEnd(firstItem)
    expect(firstItem.className).not.toContain('goal-drag-item--dragging')
    expect(secondItem.className).not.toContain('goal-drag-item--drag-')
  })

  /* ── Compare mode ─────────────────────────────────────────────── */

  it('sets group role and aria-label in compare mode', () => {
    const props = { ...defaultProps(), compareMode: true }
    const { container } = render(<GoalsMiniGrid {...props} />)

    const grid = container.querySelector('[role="group"]')
    expect(grid).toBeInTheDocument()
    expect(grid).toHaveAttribute('aria-label', 'Select goals for comparison')
  })
})
