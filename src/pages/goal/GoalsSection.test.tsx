import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { FinancialGoal } from '../../types'
import GoalsSection from './components/GoalsSection'

/* ─── Navigation spy ─── */

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

/* ─── Mock heavy children ─── */

let capturedGridProps: any = {}

vi.mock('./components/GoalsMiniGrid', () => ({
  default: (props: any) => {
    capturedGridProps = props
    return (
      <div data-testid="goals-mini-grid">
        {props.goals.map((g: any) => (
          <button
            key={g.id}
            data-testid={`card-${g.id}`}
            onClick={(e) => props.onSelectGoal(g.id, e.metaKey || e.ctrlKey)}
          >
            {g.goalName}
          </button>
        ))}
      </div>
    )
  },
}))

vi.mock('./components/GoalCompareView', () => ({
  default: ({ goals }: any) => (
    <div data-testid="compare-view">
      Comparing {goals.map((g: any) => g.goalName).join(', ')}
    </div>
  ),
}))

vi.mock('./components/GoalFilterBar', () => {
  const DEFAULT_FILTERS = { retirementAges: [], fiGoalBuckets: [], expenseBuckets: [] }
  const applyFilters = (goals: any[]) => goals
  return {
    default: () => <div data-testid="filter-bar" />,
    GoalFilters: {},
    DEFAULT_FILTERS,
    applyFilters,
  }
})

vi.mock('../../pages/data/types', () => ({
  getLatestGoalTotals: () => ({ fiTotal: 500_000, gwTotal: 0 }),
}))

/* ─── Helpers ─── */

const noop = () => {}

function makeGoal(overrides: Partial<FinancialGoal> = {}): FinancialGoal {
  return {
    id: 1,
    goalName: 'Test Goal',
    createdAt: '2024-01-01',
    birthday: '1990-01-01',
    goalCreatedIn: '2024-01',
    goalEndYear: '2050',
    resetExpenseMonth: false,
    retirementAge: 60,
    expenseMonth: 5000,
    expenseValue: 60000,
    monthlyExpenseValue: 5000,
    expenseValueMar2026: 65000,
    expenseValue2047: 100000,
    monthlyExpense2047: 8333,
    inflationRate: 6,
    safeWithdrawalRate: 3,
    growth: 12,
    retirement: '2050-01',
    fiGoal: 2000000,
    progress: 25,
    ...overrides,
  }
}

const goalA = makeGoal({ id: 1, goalName: 'Alpha' })
const goalB = makeGoal({ id: 2, goalName: 'Bravo' })
const goalC = makeGoal({ id: 3, goalName: 'Charlie' })

const defaultProps = {
  goals: [goalA, goalB, goalC],
  profileBirthday: '1990-01-01',
  gwGoals: [],
  onUpdateGoal: vi.fn(),
  onCopyGoal: vi.fn(),
  onDeleteGoal: vi.fn(),
  onDeleteMultiple: vi.fn(),
  onReorderGoals: vi.fn(),
  onRenameGoal: vi.fn(),
  onCreateGwGoal: vi.fn(),
  onUpdateGwGoal: vi.fn(),
  onDeleteGwGoal: vi.fn(),
}

function renderGoalsSection(overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...overrides }
  return render(
    <MemoryRouter>
      <GoalsSection {...props} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  capturedGridProps = {}
  localStorage.clear()
})

/* ═══════════════════════════════════════════════════════════════
   1. Compare button visibility
   ═══════════════════════════════════════════════════════════════ */

describe('Compare button visibility', () => {
  it('shows Compare button when 2+ goals exist', () => {
    renderGoalsSection()
    expect(screen.getByRole('button', { name: /compare/i })).toBeInTheDocument()
  })

  it('shows Compare button when exactly 2 goals exist', () => {
    renderGoalsSection({ goals: [goalA, goalB] })
    expect(screen.getByRole('button', { name: /compare/i })).toBeInTheDocument()
  })

  it('hides Compare button when only 1 goal exists', () => {
    renderGoalsSection({ goals: [goalA] })
    expect(screen.queryByRole('button', { name: /compare/i })).not.toBeInTheDocument()
  })

  it('hides Compare button when no goals exist', () => {
    renderGoalsSection({ goals: [] })
    expect(screen.queryByRole('button', { name: /compare/i })).not.toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   2. Entering and exiting compare mode
   ═══════════════════════════════════════════════════════════════ */

describe('Entering and exiting compare mode', () => {
  it('clicking Compare enters compare mode and shows "Exit Compare"', async () => {
    const user = userEvent.setup()
    renderGoalsSection()

    await user.click(screen.getByRole('button', { name: /^compare$/i }))

    expect(screen.getByRole('button', { name: /exit compare/i })).toBeInTheDocument()
  })

  it('shows compare hint when in compare mode with no selection', async () => {
    const user = userEvent.setup()
    renderGoalsSection()

    await user.click(screen.getByRole('button', { name: /^compare$/i }))

    expect(screen.getByText(/click goals to select them/i, { selector: '.goal-compare-hint' })).toBeInTheDocument()
  })

  it('clicking "Exit Compare" exits compare mode', async () => {
    const user = userEvent.setup()
    renderGoalsSection()

    await user.click(screen.getByRole('button', { name: /^compare$/i }))
    await user.click(screen.getByRole('button', { name: /exit compare/i }))

    expect(screen.getByRole('button', { name: /^compare$/i })).toBeInTheDocument()
    expect(screen.queryByText(/click goals to select them/i, { selector: '.goal-compare-hint' })).not.toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   3. Card clicks in compare mode toggle selection, don't navigate
   ═══════════════════════════════════════════════════════════════ */

describe('Card clicks in compare mode toggle selection', () => {
  it('clicking a card in compare mode selects it without navigating', async () => {
    const user = userEvent.setup()
    renderGoalsSection()

    // Enter compare mode
    await user.click(screen.getByRole('button', { name: /^compare$/i }))
    // Click a card (compare mode is on, so multi logic applies)
    await user.click(screen.getByTestId('card-1'))

    // Should show selection bar (1 selected)
    expect(screen.getByText('1 goal selected')).toBeInTheDocument()
    // Should NOT navigate
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('clicking a selected card in compare mode deselects it', async () => {
    const user = userEvent.setup()
    renderGoalsSection()

    await user.click(screen.getByRole('button', { name: /^compare$/i }))
    await user.click(screen.getByTestId('card-1'))

    expect(screen.getByText('1 goal selected')).toBeInTheDocument()

    // Click same card again to deselect
    await user.click(screen.getByTestId('card-1'))

    // Back to zero — hint should show instead of selection bar
    expect(screen.queryByText(/goal selected/i, { selector: '.goal-selection-count' })).not.toBeInTheDocument()
    expect(screen.getByText(/click goals to select them/i, { selector: '.goal-compare-hint' })).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   4. Selecting 2+ goals shows GoalCompareView
   ═══════════════════════════════════════════════════════════════ */

describe('GoalCompareView appears when 2+ goals selected', () => {
  it('renders GoalCompareView when 2 goals are selected in compare mode', async () => {
    const user = userEvent.setup()
    renderGoalsSection()

    await user.click(screen.getByRole('button', { name: /^compare$/i }))
    await user.click(screen.getByTestId('card-1'))
    await user.click(screen.getByTestId('card-2'))

    expect(screen.getByText('2 goals selected')).toBeInTheDocument()
    expect(screen.getByTestId('compare-view')).toBeInTheDocument()
    expect(screen.getByTestId('compare-view')).toHaveTextContent('Comparing Alpha, Bravo')
  })

  it('does not render GoalCompareView when only 1 goal selected', async () => {
    const user = userEvent.setup()
    renderGoalsSection()

    await user.click(screen.getByRole('button', { name: /^compare$/i }))
    await user.click(screen.getByTestId('card-1'))

    expect(screen.queryByTestId('compare-view')).not.toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   5. Cmd+Click toggles selection and auto-enters compare mode
   ═══════════════════════════════════════════════════════════════ */

describe('Cmd+Click auto-enters compare mode', () => {
  it('multi-select click outside compare mode selects goal and enters compare mode', async () => {
    renderGoalsSection()

    // Simulate Cmd+Click by calling onSelectGoal with multi=true directly.
    // GoalsMiniGrid passes (e.metaKey || e.ctrlKey) as the multi arg — that
    // mapping is verified by the GoalsMiniGrid mock wiring.
    const { act } = await import('@testing-library/react')
    await act(() => {
      capturedGridProps.onSelectGoal(1, true)
    })

    // Should be in compare mode now with 1 selected
    expect(screen.getByRole('button', { name: /exit compare/i })).toBeInTheDocument()
    expect(screen.getByText('1 goal selected')).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('multi-select two goals outside compare mode shows GoalCompareView', async () => {
    renderGoalsSection()

    const { act } = await import('@testing-library/react')
    await act(() => {
      capturedGridProps.onSelectGoal(1, true)
    })
    await act(() => {
      capturedGridProps.onSelectGoal(2, true)
    })

    expect(screen.getByText('2 goals selected')).toBeInTheDocument()
    expect(screen.getByTestId('compare-view')).toHaveTextContent('Comparing Alpha, Bravo')
  })
})

/* ═══════════════════════════════════════════════════════════════
   6. Single click outside compare mode navigates
   ═══════════════════════════════════════════════════════════════ */

describe('Single click navigates outside compare mode', () => {
  it('plain click on a card navigates to /goal/:id', async () => {
    const user = userEvent.setup()
    renderGoalsSection()

    await user.click(screen.getByTestId('card-2'))

    expect(mockNavigate).toHaveBeenCalledWith('/goal/2')
  })

  it('plain click does not enter compare mode', async () => {
    const user = userEvent.setup()
    renderGoalsSection()

    await user.click(screen.getByTestId('card-1'))

    expect(screen.queryByText(/goal selected/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /exit compare/i })).not.toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   7. Selection bar shows count, Delete selected, and Done
   ═══════════════════════════════════════════════════════════════ */

describe('Selection bar content', () => {
  it('shows correct plural count, Delete selected, and Done buttons', async () => {
    const user = userEvent.setup()
    renderGoalsSection()

    await user.click(screen.getByRole('button', { name: /^compare$/i }))
    await user.click(screen.getByTestId('card-1'))
    await user.click(screen.getByTestId('card-2'))
    await user.click(screen.getByTestId('card-3'))

    expect(screen.getByText('3 goals selected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete selected/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^done$/i })).toBeInTheDocument()
  })

  it('shows singular "1 goal selected" for a single selection', async () => {
    const user = userEvent.setup()
    renderGoalsSection()

    await user.click(screen.getByRole('button', { name: /^compare$/i }))
    await user.click(screen.getByTestId('card-1'))

    expect(screen.getByText('1 goal selected')).toBeInTheDocument()
  })

  it('does not show selection bar when nothing is selected (only hint)', async () => {
    const user = userEvent.setup()
    renderGoalsSection()

    await user.click(screen.getByRole('button', { name: /^compare$/i }))

    expect(screen.queryByText(/delete selected/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^done$/i })).not.toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   8. "Done" exits compare mode and clears selection
   ═══════════════════════════════════════════════════════════════ */

describe('Done button behavior', () => {
  it('clicking Done exits compare mode and clears all selections', async () => {
    const user = userEvent.setup()
    renderGoalsSection()

    await user.click(screen.getByRole('button', { name: /^compare$/i }))
    await user.click(screen.getByTestId('card-1'))
    await user.click(screen.getByTestId('card-2'))

    expect(screen.getByText('2 goals selected')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^done$/i }))

    // Should exit compare mode
    expect(screen.getByRole('button', { name: /^compare$/i })).toBeInTheDocument()
    // No selection bar or hint
    expect(screen.queryByText(/goal selected/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/click goals to select them/i)).not.toBeInTheDocument()
    // CompareView gone
    expect(screen.queryByTestId('compare-view')).not.toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   9. "Delete selected" calls onDeleteMultiple and exits compare mode
   ═══════════════════════════════════════════════════════════════ */

describe('Delete selected behavior', () => {
  it('clicking Delete selected calls onDeleteMultiple with selected ids', async () => {
    const user = userEvent.setup()
    const onDeleteMultiple = vi.fn()
    renderGoalsSection({ onDeleteMultiple })

    await user.click(screen.getByRole('button', { name: /^compare$/i }))
    await user.click(screen.getByTestId('card-1'))
    await user.click(screen.getByTestId('card-3'))

    await user.click(screen.getByRole('button', { name: /delete selected/i }))

    expect(onDeleteMultiple).toHaveBeenCalledWith([1, 3])
  })

  it('exits compare mode after deleting', async () => {
    const user = userEvent.setup()
    renderGoalsSection()

    await user.click(screen.getByRole('button', { name: /^compare$/i }))
    await user.click(screen.getByTestId('card-1'))

    await user.click(screen.getByRole('button', { name: /delete selected/i }))

    expect(screen.getByRole('button', { name: /^compare$/i })).toBeInTheDocument()
    expect(screen.queryByText(/goal selected/i)).not.toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   10. Drag reorder disabled during compare mode
   ═══════════════════════════════════════════════════════════════ */

describe('Drag reorder disabled in compare mode', () => {
  it('passes onReorderGoals to grid when not in compare mode', () => {
    renderGoalsSection()
    expect(capturedGridProps.onReorderGoals).toBeDefined()
  })

  it('passes undefined onReorderGoals when in compare mode', async () => {
    const user = userEvent.setup()
    renderGoalsSection()

    await user.click(screen.getByRole('button', { name: /^compare$/i }))

    expect(capturedGridProps.onReorderGoals).toBeUndefined()
  })
})

/* ═══════════════════════════════════════════════════════════════
   11. GoalCompareView renders comparison table correctly
   ═══════════════════════════════════════════════════════════════ */

describe('GoalCompareView receives correct goals', () => {
  it('passes only selected goals to GoalCompareView', async () => {
    const user = userEvent.setup()
    renderGoalsSection()

    await user.click(screen.getByRole('button', { name: /^compare$/i }))
    await user.click(screen.getByTestId('card-2'))
    await user.click(screen.getByTestId('card-3'))

    const view = screen.getByTestId('compare-view')
    expect(view).toHaveTextContent('Comparing Bravo, Charlie')
    // Alpha was not selected
    expect(view).not.toHaveTextContent('Alpha')
  })
})

/* ═══════════════════════════════════════════════════════════════
   12. No selectedGoalIds prop flows from App.tsx
   ═══════════════════════════════════════════════════════════════ */

describe('Props interface has no external selection state', () => {
  it('GoalsSection renders without any selectedGoalIds prop', () => {
    // If GoalsSection required selectedGoalIds as a prop,
    // this render would fail TypeScript checks or throw.
    const { container } = renderGoalsSection()
    expect(container).toBeTruthy()
  })
})

/* ═══════════════════════════════════════════════════════════════
   13. Empty states
   ═══════════════════════════════════════════════════════════════ */

describe('Empty states', () => {
  it('shows "No goals created yet" when goals array is empty', () => {
    renderGoalsSection({ goals: [] })
    expect(screen.getByText(/no goals created yet/i)).toBeInTheDocument()
  })

  it('shows count label "0 goals" when no goals exist', () => {
    renderGoalsSection({ goals: [] })
    expect(screen.getByText('0 goals')).toBeInTheDocument()
  })

  it('shows singular count "1 goal" when one goal exists', () => {
    renderGoalsSection({ goals: [goalA] })
    expect(screen.getByText('1 goal')).toBeInTheDocument()
  })
})
