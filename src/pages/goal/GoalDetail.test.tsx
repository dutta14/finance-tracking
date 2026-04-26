import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { FinancialGoal, GwGoal } from '../../types'
import GoalDetail from './components/GoalDetail'

/* ─── Mock heavy child components ─── */

vi.mock('./components/GoalDetailedCard', () => ({
  default: ({ goal }: { goal: FinancialGoal }) => <div data-testid="detailed-card">{goal.goalName}</div>,
}))
vi.mock('./components/GoalDiveDeep', () => ({
  default: () => <div data-testid="dive-deep">DiveDeep</div>,
}))
vi.mock('./components/GwSection', () => ({
  default: () => <div data-testid="gw-section">GwSection</div>,
}))
vi.mock('./components/SavingsPlan', () => ({
  default: () => <div data-testid="savings-plan">SavingsPlan</div>,
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
const threeGoals = [goalA, goalB, goalC]

const defaultProps = {
  goals: threeGoals,
  profileBirthday: '1990-01-01',
  gwGoals: [],
  onUpdateGoal: noop as (goalId: number, g: FinancialGoal) => void,
  onCopyGoal: vi.fn(),
  onDeleteGoal: vi.fn(),
  onRenameGoal: vi.fn(),
  onCreateGwGoal: noop as (data: Omit<GwGoal, 'id' | 'createdAt'>) => void,
  onUpdateGwGoal: noop as (id: number, u: Partial<Omit<GwGoal, 'id' | 'createdAt' | 'fiGoalId'>>) => void,
  onDeleteGwGoal: noop as (id: number) => void,
}

/**
 * Renders GoalDetail at the given route, with a sentinel at /goal
 * so we can verify back-navigation.
 */
function renderDetail(route: string, overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...overrides }
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/goal/:id" element={<GoalDetail {...props} />} />
        <Route path="/goal" element={<div data-testid="goals-list">Goals List</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

/* ═══════════════════════════════════════════════════════════════
   1. Renders correctly for a matching goal
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetail rendering', () => {
  it('renders the goal title when the URL matches a valid goal id', () => {
    renderDetail('/goal/2')
    expect(screen.getByRole('heading', { name: 'Bravo', level: 1 })).toBeInTheDocument()
  })

  it('renders the DetailedCard for the matched goal', () => {
    renderDetail('/goal/1')
    expect(screen.getByTestId('detailed-card')).toHaveTextContent('Alpha')
  })

  it('renders the SavingsPlan aside', () => {
    renderDetail('/goal/1')
    expect(screen.getByTestId('savings-plan')).toBeInTheDocument()
  })

  it('renders the Deep Analysis toggle button', () => {
    renderDetail('/goal/1')
    expect(screen.getByRole('button', { name: /deep analysis/i })).toBeInTheDocument()
  })

  it('renders GwSection when fiGoal > 0', () => {
    renderDetail('/goal/1')
    expect(screen.getByTestId('gw-section')).toBeInTheDocument()
  })

  it('does not render GwSection when fiGoal is 0', () => {
    const zeroGoal = makeGoal({ id: 1, goalName: 'Zero', fiGoal: 0 })
    renderDetail('/goal/1', { goals: [zeroGoal] })
    expect(screen.queryByTestId('gw-section')).not.toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   2. Not-found state
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetail not-found state', () => {
  it('renders not-found message when the id does not match any goal', () => {
    renderDetail('/goal/999')
    expect(screen.getByText(/this goal may have been deleted/i)).toBeInTheDocument()
  })

  it('renders a back link in the not-found state', () => {
    renderDetail('/goal/999')
    expect(screen.getByRole('link', { name: /back to goals/i })).toBeInTheDocument()
  })

  it('navigates to /goal when the not-found back link is clicked', async () => {
    const user = userEvent.setup()
    renderDetail('/goal/999')

    await user.click(screen.getByRole('link', { name: /back to goals/i }))

    expect(screen.getByTestId('goals-list')).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   3. Back link
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetail back link', () => {
  it('renders a "Goals" back link in the header', () => {
    renderDetail('/goal/1')
    const link = screen.getByRole('link', { name: /goals/i })
    expect(link).toHaveClass('goal-detail-back-link')
  })

  it('navigates to /goal when the back link is clicked', async () => {
    const user = userEvent.setup()
    renderDetail('/goal/1')

    await user.click(screen.getByRole('link', { name: /goals/i }))

    expect(screen.getByTestId('goals-list')).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   4. Stepper prev/next
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetail stepper', () => {
  it('renders stepper when there are multiple goals', () => {
    renderDetail('/goal/2')
    expect(screen.getByText('Goal 2 of 3')).toBeInTheDocument()
  })

  it('does not render stepper when there is only one goal', () => {
    renderDetail('/goal/1', { goals: [goalA] })
    expect(screen.queryByLabelText('Previous goal')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Next goal')).not.toBeInTheDocument()
  })

  it('disables the previous button on the first goal', () => {
    renderDetail('/goal/1')
    expect(screen.getByLabelText('Previous goal')).toBeDisabled()
  })

  it('disables the next button on the last goal', () => {
    renderDetail('/goal/3')
    expect(screen.getByLabelText('Next goal')).toBeDisabled()
  })

  it('navigates to the next goal when next is clicked', async () => {
    const user = userEvent.setup()
    renderDetail('/goal/1')

    await user.click(screen.getByLabelText('Next goal'))

    expect(screen.getByRole('heading', { name: 'Bravo', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Goal 2 of 3')).toBeInTheDocument()
  })

  it('navigates to the previous goal when prev is clicked', async () => {
    const user = userEvent.setup()
    renderDetail('/goal/2')

    await user.click(screen.getByLabelText('Previous goal'))

    expect(screen.getByRole('heading', { name: 'Alpha', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Goal 1 of 3')).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   5. Arrow key navigation
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetail arrow key navigation', () => {
  it('navigates to the next goal on ArrowRight', async () => {
    const user = userEvent.setup()
    renderDetail('/goal/1')

    await user.keyboard('{ArrowRight}')

    expect(screen.getByRole('heading', { name: 'Bravo', level: 1 })).toBeInTheDocument()
  })

  it('navigates to the previous goal on ArrowLeft', async () => {
    const user = userEvent.setup()
    renderDetail('/goal/2')

    await user.keyboard('{ArrowLeft}')

    expect(screen.getByRole('heading', { name: 'Alpha', level: 1 })).toBeInTheDocument()
  })

  it('does not navigate past the first goal on ArrowLeft', async () => {
    const user = userEvent.setup()
    renderDetail('/goal/1')

    await user.keyboard('{ArrowLeft}')

    expect(screen.getByRole('heading', { name: 'Alpha', level: 1 })).toBeInTheDocument()
  })

  it('does not navigate past the last goal on ArrowRight', async () => {
    const user = userEvent.setup()
    renderDetail('/goal/3')

    await user.keyboard('{ArrowRight}')

    expect(screen.getByRole('heading', { name: 'Charlie', level: 1 })).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   6. Dive Deep toggle
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetail dive deep toggle', () => {
  it('does not render DiveDeep initially', () => {
    renderDetail('/goal/1')
    expect(screen.queryByTestId('dive-deep')).not.toBeInTheDocument()
  })

  it('renders DiveDeep after clicking the Deep Analysis button', async () => {
    const user = userEvent.setup()
    renderDetail('/goal/1')

    await user.click(screen.getByRole('button', { name: /deep analysis/i }))

    expect(screen.getByTestId('dive-deep')).toBeInTheDocument()
  })

  it('changes the button label to "Close Analysis" when open', async () => {
    const user = userEvent.setup()
    renderDetail('/goal/1')

    await user.click(screen.getByRole('button', { name: /deep analysis/i }))

    expect(screen.getByRole('button', { name: /close analysis/i })).toBeInTheDocument()
  })

  it('hides DiveDeep when the toggle is clicked again', async () => {
    const user = userEvent.setup()
    renderDetail('/goal/1')

    await user.click(screen.getByRole('button', { name: /deep analysis/i }))
    await user.click(screen.getByRole('button', { name: /close analysis/i }))

    expect(screen.queryByTestId('dive-deep')).not.toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   7. Actions menu — rename, duplicate, delete
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetail actions menu', () => {
  it('renders the actions menu trigger button', () => {
    renderDetail('/goal/1')
    expect(screen.getByLabelText('Goal actions')).toBeInTheDocument()
  })

  it('opens the dropdown showing Rename, Duplicate, Delete', async () => {
    const user = userEvent.setup()
    renderDetail('/goal/1')

    await user.click(screen.getByLabelText('Goal actions'))

    expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('calls onCopyGoal when Duplicate is clicked', async () => {
    const onCopyGoal = vi.fn()
    const user = userEvent.setup()
    renderDetail('/goal/1', { onCopyGoal })

    await user.click(screen.getByLabelText('Goal actions'))
    await user.click(screen.getByRole('button', { name: 'Duplicate' }))

    expect(onCopyGoal).toHaveBeenCalledTimes(1)
    expect(onCopyGoal).toHaveBeenCalledWith(goalA)
  })
})

/* ═══════════════════════════════════════════════════════════════
   8. Rename mode
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetail rename', () => {
  it('enters rename mode when Rename is chosen from the actions menu', async () => {
    const user = userEvent.setup()
    renderDetail('/goal/1')

    await user.click(screen.getByLabelText('Goal actions'))
    await user.click(screen.getByRole('button', { name: 'Rename' }))

    expect(screen.getByPlaceholderText('Goal name')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Alpha')).toBeInTheDocument()
  })

  it('commits the rename on Enter and calls onRenameGoal', async () => {
    const onRenameGoal = vi.fn()
    const user = userEvent.setup()
    renderDetail('/goal/1', { onRenameGoal })

    await user.click(screen.getByLabelText('Goal actions'))
    await user.click(screen.getByRole('button', { name: 'Rename' }))

    const input = screen.getByPlaceholderText('Goal name')
    await user.clear(input)
    await user.type(input, 'Renamed Goal{Enter}')

    expect(onRenameGoal).toHaveBeenCalledWith(1, 'Renamed Goal')
  })

  it('cancels rename on Escape without calling onRenameGoal', async () => {
    const onRenameGoal = vi.fn()
    const user = userEvent.setup()
    renderDetail('/goal/1', { onRenameGoal })

    await user.click(screen.getByLabelText('Goal actions'))
    await user.click(screen.getByRole('button', { name: 'Rename' }))

    await user.keyboard('{Escape}')

    // Escape exits rename mode, title re-appears
    expect(screen.getByRole('heading', { name: 'Alpha', level: 1 })).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Goal name')).not.toBeInTheDocument()
    expect(onRenameGoal).not.toHaveBeenCalled()
  })

  it('does not commit rename when the input is blank', async () => {
    const onRenameGoal = vi.fn()
    const user = userEvent.setup()
    renderDetail('/goal/1', { onRenameGoal })

    await user.click(screen.getByLabelText('Goal actions'))
    await user.click(screen.getByRole('button', { name: 'Rename' }))

    const input = screen.getByPlaceholderText('Goal name')
    await user.clear(input)
    await user.type(input, '{Enter}')

    expect(onRenameGoal).not.toHaveBeenCalled()
  })
})

/* ═══════════════════════════════════════════════════════════════
   9. Delete navigation
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetail delete navigation', () => {
  it('calls onDeleteGoal and navigates to the next goal when a middle goal is deleted', async () => {
    const onDeleteGoal = vi.fn()
    const user = userEvent.setup()
    renderDetail('/goal/2', { onDeleteGoal })

    await user.click(screen.getByLabelText('Goal actions'))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onDeleteGoal).toHaveBeenCalledWith(2)
    // Should navigate to next goal (Charlie, id=3)
    expect(screen.getByRole('heading', { name: 'Charlie', level: 1 })).toBeInTheDocument()
  })

  it('navigates to the previous goal when the last goal is deleted', async () => {
    const onDeleteGoal = vi.fn()
    const user = userEvent.setup()
    renderDetail('/goal/3', { onDeleteGoal })

    await user.click(screen.getByLabelText('Goal actions'))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onDeleteGoal).toHaveBeenCalledWith(3)
    // Should navigate to prev goal (Bravo, id=2)
    expect(screen.getByRole('heading', { name: 'Bravo', level: 1 })).toBeInTheDocument()
  })

  it('navigates to /goal when the only goal is deleted', async () => {
    const onDeleteGoal = vi.fn()
    const user = userEvent.setup()
    renderDetail('/goal/1', { goals: [goalA], onDeleteGoal })

    await user.click(screen.getByLabelText('Goal actions'))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onDeleteGoal).toHaveBeenCalledWith(1)
    expect(screen.getByTestId('goals-list')).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   10. Tab bar and header hidden on detail view
   ═══════════════════════════════════════════════════════════════ */

describe('Goal page hides header/tab-bar on detail view', () => {
  // These tests render the full Goal component to test the
  // isDetailView conditional rendering
  // We import Goal lazily here so the GoalDetail child-component mocks apply
  it('does not render the tab bar or header on /goal/:id', async () => {
    vi.doMock('../../contexts/GoalsContext', () => ({
      useGoals: () => ({
        visibleGoals: threeGoals,
        gwGoals: [],
        profile: { birthday: '1990-01-01' },
        createGoal: noop,
        updateGoal: noop,
        handleDeleteGoal: noop,
        handleDeleteWithUndo: noop,
        reorderGoals: noop,
        handleCopyGwGoals: noop,
        createGwGoal: noop,
        updateGwGoal: noop,
        deleteGwGoal: noop,
      }),
    }))
    vi.doMock('../../contexts/LayoutContext', () => ({
      useLayout: () => ({ handleOpenProfile: noop }),
    }))
    const Goal = (await import('./Goal')).default

    render(
      <MemoryRouter initialEntries={['/goal/1']}>
        <Routes>
          <Route path="/goal/*" element={<Goal />} />
        </Routes>
      </MemoryRouter>,
    )

    // Tab bar should NOT be present on detail view
    expect(screen.queryByRole('navigation', { name: 'Goals sections' })).not.toBeInTheDocument()
    // The "Goals" h1 header should NOT be present
    expect(screen.queryByRole('heading', { name: 'Goals', level: 1 })).not.toBeInTheDocument()
    // But the goal detail title IS present
    expect(screen.getByRole('heading', { name: 'Alpha', level: 1 })).toBeInTheDocument()
  })

  it('renders the tab bar and header on /goal (non-detail view)', async () => {
    vi.doMock('../../contexts/GoalsContext', () => ({
      useGoals: () => ({
        visibleGoals: threeGoals,
        gwGoals: [],
        profile: { birthday: '1990-01-01' },
        createGoal: noop,
        updateGoal: noop,
        handleDeleteGoal: noop,
        handleDeleteWithUndo: noop,
        reorderGoals: noop,
        handleCopyGwGoals: noop,
        createGwGoal: noop,
        updateGwGoal: noop,
        deleteGwGoal: noop,
      }),
    }))
    vi.doMock('../../contexts/LayoutContext', () => ({
      useLayout: () => ({ handleOpenProfile: noop }),
    }))
    const Goal = (await import('./Goal')).default

    render(
      <MemoryRouter initialEntries={['/goal']}>
        <Routes>
          <Route path="/goal/*" element={<Goal />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('navigation', { name: 'Goals sections' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Goals', level: 1 })).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   11. GoalDrawer no longer exists
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDrawer removal', () => {
  it('GoalDrawer.tsx file does not exist in the components directory', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const drawerPath = path.resolve(__dirname, 'components', 'GoalDrawer.tsx')
    expect(fs.existsSync(drawerPath)).toBe(false)
  })

  it('GoalDrawer.css file does not exist in the styles directory', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const cssPath = path.resolve(__dirname, '..', '..', 'styles', 'GoalDrawer.css')
    expect(fs.existsSync(cssPath)).toBe(false)
  })

  it('GoalsSection source does not reference GoalDrawer', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const sectionPath = path.resolve(__dirname, 'components', 'GoalsSection.tsx')
    const source = fs.readFileSync(sectionPath, 'utf-8')
    expect(source).not.toContain('GoalDrawer')
  })
})
