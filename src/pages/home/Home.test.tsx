import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
vi.mock('./SetupProgress', () => ({ default: () => <div data-testid="setup-progress">Setup Progress</div> }))

import { useGoals } from '../../contexts/GoalsContext'

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
    } as ReturnType<typeof useGoals>)
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
    const cardOrder = screen.getAllByTestId(/-card$/).map(el =>
      el.getAttribute('data-testid'),
    )
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
})
