import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FC } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Home from './Home'

/* ─── Mock dependencies ─── */

vi.mock('../../styles/Home.css', () => ({}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../contexts/GoalsContext', () => ({
  useGoals: vi.fn(() => ({
    visibleGoals: [],
    gwGoals: [],
    profile: { name: '' },
  })),
}))

vi.mock('../../contexts/DataContext', () => ({
  useData: vi.fn(() => ({
    accounts: [
      {
        id: 1,
        name: 'Checking',
        type: 'liquid',
        owner: 'primary',
        status: 'active',
        goalType: 'gw',
        nature: 'asset',
        allocation: 'cash',
      },
    ],
    balances: [{ id: 1, accountId: 1, month: '2025-01', balance: 5000 }],
  })),
}))

vi.mock('../budget/utils/budgetStorage', () => ({
  loadBudgetStore: vi.fn(() => ({ csvs: {} })),
}))

vi.mock('../../hooks/useTouchDrag', () => ({
  useTouchDrag: () => ({
    getTouchHandlers: () => ({ onTouchStart: vi.fn(), onTouchMove: vi.fn(), onTouchEnd: vi.fn() }),
    isDragging: false,
    isLongPressing: false,
    dragIdx: null,
  }),
}))

vi.mock('./NetWorthSummary', () => ({ default: () => <div data-testid="nw-card">Net Worth Card</div> }))
vi.mock('./MiniCharts', () => ({ default: () => <div data-testid="charts-card">Charts Card</div> }))
vi.mock('./GoalsPeek', () => ({ default: () => <div data-testid="goals-card">Goals Card</div> }))
vi.mock('./AllocationBreakdown', () => ({ default: () => <div data-testid="alloc-card">Allocation Card</div> }))
// Capture the SetupProgress mock so we can override it per-test
let setupProgressImpl: FC<{ onDismiss: () => void }>
vi.mock('./SetupProgress', () => ({
  default: (props: { onDismiss: () => void }) => {
    if (setupProgressImpl) return setupProgressImpl(props)
    return <div data-testid="setup-progress">Setup Progress</div>
  },
}))

import { useGoals } from '../../contexts/GoalsContext'
import { loadBudgetStore } from '../budget/utils/budgetStorage'

const mockedUseGoals = vi.mocked(useGoals)

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  )
}

/* ═══════════════════════════════════════════════════════════════
   Greeting based on time of day
   ═══════════════════════════════════════════════════════════════ */

describe('Home greeting', () => {
  it('shows "Good morning" before noon', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2025, 0, 15, 9, 0, 0))
    renderHome()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Good morning')
  })

  it('shows "Good afternoon" between noon and 5 PM', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2025, 0, 15, 14, 0, 0))
    renderHome()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Good afternoon')
  })

  it('shows "Good evening" after 5 PM', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2025, 0, 15, 20, 0, 0))
    renderHome()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Good evening')
  })

  it('includes the user name in the greeting when profile has a name', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2025, 0, 15, 9, 0, 0))
    mockedUseGoals.mockReturnValue({
      visibleGoals: [],
      gwGoals: [],
      profile: { name: 'Anindya' },
    } as unknown as ReturnType<typeof useGoals>)
    renderHome()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Good morning, Anindya')
  })
})

/* ═══════════════════════════════════════════════════════════════
   Home cards rendering
   ═══════════════════════════════════════════════════════════════ */

describe('Home cards', () => {
  it('renders all four dashboard cards with content', () => {
    renderHome()
    expect(screen.getByTestId('nw-card')).toHaveTextContent('Net Worth Card')
    expect(screen.getByTestId('charts-card')).toHaveTextContent('Charts Card')
    expect(screen.getByTestId('goals-card')).toHaveTextContent('Goals Card')
    expect(screen.getByTestId('alloc-card')).toHaveTextContent('Allocation Card')
  })

  it('renders four draggable card slots', () => {
    renderHome()
    const slots = screen.getAllByTestId(/^drag-slot-/)
    expect(slots).toHaveLength(4)
  })
})

/* ═══════════════════════════════════════════════════════════════
   Card reorder via drag
   ═══════════════════════════════════════════════════════════════ */

describe('Home card reorder via drag', () => {
  it('reorders cards on drag and drop', () => {
    renderHome()
    const slots = screen.getAllByTestId(/^drag-slot-/)

    fireEvent.dragStart(slots[0])
    fireEvent.dragOver(slots[2], { dataTransfer: { dropEffect: '' } })
    fireEvent.drop(slots[2])

    // Verify announcement
    expect(screen.getByText(/moved to position/)).toBeInTheDocument()

    // Verify actual card order: default [NW, Charts, Goals, Alloc] → [Charts, Goals, NW, Alloc]
    const cardOrder = screen.getAllByTestId(/-card$/).map(el => el.getAttribute('data-testid'))
    expect(cardOrder).toEqual(['charts-card', 'goals-card', 'nw-card', 'alloc-card'])
  })

  it('persists reorder to localStorage', () => {
    renderHome()
    const slots = screen.getAllByTestId(/^drag-slot-/)

    fireEvent.dragStart(slots[0])
    fireEvent.dragOver(slots[1], { dataTransfer: { dropEffect: '' } })
    fireEvent.drop(slots[1])

    const stored = JSON.parse(localStorage.getItem('home-card-order') || '[]')
    expect(stored).toEqual([1, 0, 2, 3])
  })
})

/* ═══════════════════════════════════════════════════════════════
   Mobile move buttons
   ═══════════════════════════════════════════════════════════════ */

describe('Home — SetupProgress conditional rendering', () => {
  it('shows SetupProgress when onboarding is not dismissed', () => {
    renderHome()
    expect(screen.getByTestId('setup-progress')).toBeInTheDocument()
  })

  it('hides SetupProgress when onboarding has been dismissed', () => {
    localStorage.setItem('onboarding-dismissed', '1')
    renderHome()
    expect(screen.queryByTestId('setup-progress')).not.toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   Mobile move buttons
   ═══════════════════════════════════════════════════════════════ */

describe('Home mobile move buttons', () => {
  it('renders move up/down buttons for each card', () => {
    renderHome()
    const upButtons = screen.getAllByRole('button', { name: /Move .+ up/i })
    const downButtons = screen.getAllByRole('button', { name: /Move .+ down/i })
    expect(upButtons).toHaveLength(4)
    expect(downButtons).toHaveLength(4)
  })

  it('disables the up button on the first card and down button on the last', () => {
    renderHome()
    const upButtons = screen.getAllByRole('button', { name: /Move .+ up/i })
    const downButtons = screen.getAllByRole('button', { name: /Move .+ down/i })
    expect(upButtons[0]).toBeDisabled()
    expect(downButtons[downButtons.length - 1]).toBeDisabled()
  })

  it('moves a card down when clicking the down button', () => {
    renderHome()
    const downButtons = screen.getAllByRole('button', { name: /Move .+ down/i })
    fireEvent.click(downButtons[0])
    expect(screen.getByText(/moved to position 2/)).toBeInTheDocument()
  })

  it('moves a card up when clicking the up button', () => {
    renderHome()
    // Move second card up
    const upButtons = screen.getAllByRole('button', { name: /Move .+ up/i })
    fireEvent.click(upButtons[1])
    expect(screen.getByText(/moved to position 1/)).toBeInTheDocument()
  })

  it('persists move to localStorage', () => {
    renderHome()
    const downButtons = screen.getAllByRole('button', { name: /Move .+ down/i })
    fireEvent.click(downButtons[0])

    const stored = JSON.parse(localStorage.getItem('home-card-order') || '[]')
    expect(stored).toEqual([1, 0, 2, 3])
  })

  it('does not move card past top boundary', () => {
    renderHome()
    const upButtons = screen.getAllByRole('button', { name: /Move .+ up/i })
    // First button is disabled — clicking it should not produce an announcement
    expect(upButtons[0]).toBeDisabled()
  })

  it('does not move card past bottom boundary', () => {
    renderHome()
    const downButtons = screen.getAllByRole('button', { name: /Move .+ down/i })
    // Last button is disabled
    expect(downButtons[3]).toBeDisabled()
  })
})

/* ═══════════════════════════════════════════════════════════════
   Drag end resets state
   ═══════════════════════════════════════════════════════════════ */

describe('Home drag end', () => {
  it('resets drag state when drag ends without a drop', () => {
    renderHome()
    const slots = screen.getAllByTestId(/^drag-slot-/)

    fireEvent.dragStart(slots[0])
    fireEvent.dragOver(slots[1], { dataTransfer: { dropEffect: '' } })

    // Verify drag-over class is applied
    expect(slots[1]).toHaveClass('home-grid-slot--over')

    fireEvent.dragEnd(slots[0])

    // Drag-over class should be removed
    expect(slots[1]).not.toHaveClass('home-grid-slot--over')
  })
})

/* ═══════════════════════════════════════════════════════════════
   Drag leave clears highlight
   ═══════════════════════════════════════════════════════════════ */

describe('Home drag leave', () => {
  it('clears drag-over highlight on drag leave', () => {
    renderHome()
    const slots = screen.getAllByTestId(/^drag-slot-/)

    fireEvent.dragStart(slots[0])
    fireEvent.dragOver(slots[2], { dataTransfer: { dropEffect: '' } })
    expect(slots[2]).toHaveClass('home-grid-slot--over')

    fireEvent.dragLeave(slots[2])
    expect(slots[2]).not.toHaveClass('home-grid-slot--over')
  })
})

/* ═══════════════════════════════════════════════════════════════
   Card order persistence
   ═══════════════════════════════════════════════════════════════ */

describe('Home card order persistence', () => {
  it('loads card order from localStorage', () => {
    localStorage.setItem('home-card-order', JSON.stringify([3, 2, 1, 0]))
    renderHome()

    // Cards should be in reversed order: Allocation, Goals, Charts, Net Worth
    const cardOrder = screen.getAllByTestId(/-card$/).map(el => el.getAttribute('data-testid'))
    expect(cardOrder).toEqual(['alloc-card', 'goals-card', 'charts-card', 'nw-card'])
  })

  it('falls back to default order when localStorage has invalid data', () => {
    localStorage.setItem('home-card-order', JSON.stringify([1, 2]))
    renderHome()

    // Should use default order: NW, Charts, Goals, Alloc
    const cardOrder = screen.getAllByTestId(/-card$/).map(el => el.getAttribute('data-testid'))
    expect(cardOrder).toEqual(['nw-card', 'charts-card', 'goals-card', 'alloc-card'])
  })
})

/* ═══════════════════════════════════════════════════════════════
   Setup guide link
   ═══════════════════════════════════════════════════════════════ */

describe('Home setup guide link', () => {
  it('shows setup guide link when dismissed but not all sections complete', () => {
    localStorage.setItem('onboarding-dismissed', '1')
    // Default mock: accounts=[1], balances=[1], goals=[], hasBudgetData=false → not allComplete
    renderHome()

    expect(screen.getByText('Setup guide')).toBeInTheDocument()
  })

  it('does not show setup guide link when all sections are complete', () => {
    localStorage.setItem('onboarding-dismissed', '1')
    mockedUseGoals.mockReturnValue({
      visibleGoals: [{ id: 1, goalName: 'FI' }],
      gwGoals: [],
      profile: { name: '' },
    } as unknown as ReturnType<typeof useGoals>)
    vi.mocked(loadBudgetStore).mockReturnValue({
      csvs: { '2024': { csv: 'data', month: '2024', uploadedAt: '' } },
      configs: {},
      years: [],
      categoryGroups: [],
    })

    renderHome()

    expect(screen.queryByText('Setup guide')).not.toBeInTheDocument()
  })

  it('restores setup progress when setup guide link is clicked', async () => {
    const user = userEvent.setup()
    localStorage.setItem('onboarding-dismissed', '1')
    // Ensure defaults: no goals, no budget → allComplete = false
    mockedUseGoals.mockReturnValue({
      visibleGoals: [],
      gwGoals: [],
      profile: { name: '' },
    } as unknown as ReturnType<typeof useGoals>)
    vi.mocked(loadBudgetStore).mockReturnValue({ csvs: {}, configs: {}, years: [], categoryGroups: [] })

    renderHome()

    await user.click(screen.getByText('Setup guide'))

    // SetupProgress should now be visible
    expect(screen.getByTestId('setup-progress')).toBeInTheDocument()
    // onboarding-dismissed should be removed from localStorage
    expect(localStorage.getItem('onboarding-dismissed')).toBeNull()
  })
})

/* ═══════════════════════════════════════════════════════════════
   SetupProgress dismiss
   ═══════════════════════════════════════════════════════════════ */

describe('Home SetupProgress dismiss', () => {
  it('hides SetupProgress and persists to localStorage when onDismiss is called', () => {
    setupProgressImpl = ({ onDismiss }) => (
      <div data-testid="setup-progress">
        <button onClick={onDismiss}>Dismiss</button>
      </div>
    )

    renderHome()
    expect(screen.getByTestId('setup-progress')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Dismiss'))

    expect(screen.queryByTestId('setup-progress')).not.toBeInTheDocument()
    expect(localStorage.getItem('onboarding-dismissed')).toBe('1')

    // Clean up the override
    setupProgressImpl = undefined!
  })
})

/* ═══════════════════════════════════════════════════════════════
   Drop on same position is a no-op
   ═══════════════════════════════════════════════════════════════ */

describe('Home drop on same position', () => {
  it('does not reorder when dropping on the same slot', () => {
    renderHome()
    const slots = screen.getAllByTestId(/^drag-slot-/)

    fireEvent.dragStart(slots[0])
    fireEvent.drop(slots[0])

    // No announcement should appear
    expect(screen.queryByText(/moved to position/)).not.toBeInTheDocument()
    // Order unchanged
    const cardOrder = screen.getAllByTestId(/-card$/).map(el => el.getAttribute('data-testid'))
    expect(cardOrder).toEqual(['nw-card', 'charts-card', 'goals-card', 'alloc-card'])
  })
})

/* ═══════════════════════════════════════════════════════════════
   loadOrder fallback for non-array storage
   ═══════════════════════════════════════════════════════════════ */

describe('Home card order — invalid storage values', () => {
  it('falls back to default order when localStorage is a string', () => {
    localStorage.setItem('home-card-order', '"not-an-array"')
    renderHome()
    const cardOrder = screen.getAllByTestId(/-card$/).map(el => el.getAttribute('data-testid'))
    expect(cardOrder).toEqual(['nw-card', 'charts-card', 'goals-card', 'alloc-card'])
  })

  it('falls back to default order when localStorage is null', () => {
    localStorage.setItem('home-card-order', 'null')
    renderHome()
    const cardOrder = screen.getAllByTestId(/-card$/).map(el => el.getAttribute('data-testid'))
    expect(cardOrder).toEqual(['nw-card', 'charts-card', 'goals-card', 'alloc-card'])
  })
})

/* ═══════════════════════════════════════════════════════════════
   Drag-over class applied during drag
   ═══════════════════════════════════════════════════════════════ */

describe('Home drag-over visual state', () => {
  it('applies drag-over class to the target slot during drag', () => {
    renderHome()
    const slots = screen.getAllByTestId(/^drag-slot-/)

    fireEvent.dragStart(slots[0])
    fireEvent.dragOver(slots[3], { dataTransfer: { dropEffect: '' } })

    expect(slots[3]).toHaveClass('home-grid-slot--over')
  })
})

/* ═══════════════════════════════════════════════════════════════
   Multiple reorders persist correctly
   ═══════════════════════════════════════════════════════════════ */

describe('Home multiple reorders', () => {
  it('persists correct order after two sequential move-down operations', () => {
    renderHome()
    const downButtons = screen.getAllByRole('button', { name: /Move .+ down/i })
    fireEvent.click(downButtons[0]) // NW moves to pos 1
    // Re-query since DOM changed
    const updatedDown = screen.getAllByRole('button', { name: /Move .+ down/i })
    fireEvent.click(updatedDown[0]) // Charts (now pos 0) moves to pos 1

    const stored = JSON.parse(localStorage.getItem('home-card-order') || '[]')
    expect(stored).toHaveLength(4)
  })
})

/* ═══════════════════════════════════════════════════════════════
   Accessibility — live region announces card moves
   ═══════════════════════════════════════════════════════════════ */

describe('Home accessibility — live region', () => {
  it('announces card name and position in the live region', () => {
    renderHome()
    const downButtons = screen.getAllByRole('button', { name: /Move .+ down/i })
    fireEvent.click(downButtons[0])

    const liveRegion = screen.getByText(/moved to position/)
    expect(liveRegion.closest('[aria-live]')).toHaveAttribute('aria-live', 'polite')
  })
})

/* ═══════════════════════════════════════════════════════════════
   Budget data presence flag
   ═══════════════════════════════════════════════════════════════ */

describe('Home hasBudgetData flag', () => {
  it('shows setup guide when no budget data and dismissed', () => {
    localStorage.setItem('onboarding-dismissed', '1')
    vi.mocked(loadBudgetStore).mockReturnValue({ csvs: {}, configs: {}, years: [], categoryGroups: [] })
    mockedUseGoals.mockReturnValue({
      visibleGoals: [],
      gwGoals: [],
      profile: { name: '' },
    } as unknown as ReturnType<typeof useGoals>)
    renderHome()
    expect(screen.getByText('Setup guide')).toBeInTheDocument()
  })
})
