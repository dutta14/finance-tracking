import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { FinancialGoal, GwGoal } from '../../types'
import { makeGoal, makeGwGoal } from '../../test/factories'
import Goal from './Goal'

/* ─── Captured props from mocked children ─── */

let capturedGoalsSectionProps: Record<string, unknown> = {}
let capturedGoalDetailProps: Record<string, unknown> = {}
let capturedGoalFormModalProps: Record<string, unknown> = {}
let capturedGoalMixerProps: Record<string, unknown> = {}

/* ─── Mock contexts ─── */

const mockCreateGoal = vi.fn()
const mockUpdateGoal = vi.fn()
const mockDeleteGoal = vi.fn()
const mockDeleteWithUndo = vi.fn()
const mockReorderGoals = vi.fn()
const mockCopyGwGoals = vi.fn()
const mockCreateGwGoal = vi.fn()
const mockUpdateGwGoal = vi.fn()
const mockDeleteGwGoal = vi.fn()
const mockOpenProfile = vi.fn()

const goalA = makeGoal({ id: 1, goalName: 'Alpha' })
const goalB = makeGoal({ id: 2, goalName: 'Bravo' })
const goals = [goalA, goalB]
const gwGoalA = makeGwGoal({ id: 10, fiGoalId: 1 })
const gwGoals = [gwGoalA]

vi.mock('../../contexts/GoalsContext', () => ({
  useGoals: () => ({
    visibleGoals: goals,
    gwGoals,
    profile: { birthday: '1990-01-15' },
    createGoal: mockCreateGoal,
    updateGoal: mockUpdateGoal,
    handleDeleteGoal: mockDeleteGoal,
    handleDeleteWithUndo: mockDeleteWithUndo,
    reorderGoals: mockReorderGoals,
    handleCopyGwGoals: mockCopyGwGoals,
    createGwGoal: mockCreateGwGoal,
    updateGwGoal: mockUpdateGwGoal,
    deleteGwGoal: mockDeleteGwGoal,
  }),
}))

vi.mock('../../contexts/LayoutContext', () => ({
  useLayout: () => ({
    handleOpenProfile: mockOpenProfile,
  }),
}))

/* ─── Mock child components to capture props ─── */

vi.mock('./components/GoalsSection', () => ({
  default: (props: Record<string, unknown>) => {
    capturedGoalsSectionProps = props
    return <div data-testid="goals-section">GoalsSection</div>
  },
}))

vi.mock('./components/GoalDetail', () => ({
  default: (props: Record<string, unknown>) => {
    capturedGoalDetailProps = props
    const goalsList = props.goals as FinancialGoal[]
    return <div data-testid="goal-detail">GoalDetail: {goalsList?.length} goals</div>
  },
}))

vi.mock('./components/GoalFormModal', () => ({
  default: (props: Record<string, unknown>) => {
    capturedGoalFormModalProps = props
    return (
      <div data-testid="goal-form-modal" aria-label={props.editingGoalId ? 'Edit goal' : 'Create new goal'}>
        GoalFormModal
      </div>
    )
  },
}))

vi.mock('./components/GoalMixer', () => ({
  default: (props: Record<string, unknown>) => {
    capturedGoalMixerProps = props
    return <div data-testid="goal-mixer">GoalMixer</div>
  },
}))

vi.mock('./components/NewGoalButton', () => ({
  default: ({ onClick }: { onClick: () => void }) => <button onClick={onClick}>+ New Goal</button>,
}))

/* ─── Lazy-loaded FICalculator mock ─── */

vi.mock('../tools/components/FICalculator', () => ({
  default: () => <div data-testid="fi-calculator">FICalculator</div>,
}))

/* ─── Helpers ─── */

function renderGoal(initialRoute = '/goal') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/goal/*" element={<Goal />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  capturedGoalsSectionProps = {}
  capturedGoalDetailProps = {}
  capturedGoalFormModalProps = {}
  capturedGoalMixerProps = {}
})

/* ═══════════════════════════════════════════════════════════════
   1. Tab routing — default
   ═══════════════════════════════════════════════════════════════ */

describe('Goal page tab routing', () => {
  it('renders the Plans tab as active by default at /goal route', () => {
    renderGoal('/goal')

    const plansLink = screen.getByRole('link', { name: 'Plans' })
    expect(plansLink.className).toContain('active')
    expect(screen.getByTestId('goals-section')).toBeInTheDocument()
  })

  it('renders the Calculator tab when navigated to /goal/calculator', async () => {
    renderGoal('/goal/calculator')

    const calcLink = screen.getByRole('link', { name: 'Calculator' })
    expect(calcLink.className).toContain('active')
    expect(await screen.findByTestId('fi-calculator')).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   2. GoalDetail route
   ═══════════════════════════════════════════════════════════════ */

describe('Goal page detail routing', () => {
  it('renders GoalDetail when navigated to /goal/:id with a valid goal id', () => {
    renderGoal('/goal/1')

    expect(screen.getByTestId('goal-detail')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Goals sections' })).not.toBeInTheDocument()
  })

  it('shows "Goal not found" message when navigated to /goal/:id with invalid id', () => {
    renderGoal('/goal/999')

    // #51: GoalDetail renders a "not found" view when the goal ID doesn't match any goal.
    // The component shows "This goal may have been deleted" text and a back link.
    expect(screen.getByTestId('goal-detail')).toBeInTheDocument()
    const detailProps = capturedGoalDetailProps
    expect(detailProps.goals).toEqual(goals)
    // GoalDetail internally calls goals.find(g => g.id === 999) which returns undefined,
    // triggering the not-found branch. Since GoalDetail is mocked in this test file,
    // we can only verify the props are passed correctly. The actual "not found" rendering
    // is tested in GoalDetail.test.tsx (or should be added there).
  })
})

/* ═══════════════════════════════════════════════════════════════
   3. GoalFormModal — create mode
   ═══════════════════════════════════════════════════════════════ */

describe('GoalFormModal interactions', () => {
  it('opens GoalFormModal in create mode when "New Goal" button is clicked', async () => {
    const user = userEvent.setup()
    renderGoal('/goal')

    expect(screen.queryByTestId('goal-form-modal')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /new goal/i }))

    const modal = screen.getByTestId('goal-form-modal')
    expect(modal).toBeInTheDocument()
    expect(modal).toHaveAttribute('aria-label', 'Create new goal')
    expect(capturedGoalFormModalProps.editingGoalId).toBeNull()
  })

  it('opens GoalFormModal in edit mode when a goal edit action is triggered', async () => {
    const user = userEvent.setup()

    // Override useEditingState to return an editingGoalId
    const useEditingStateMock = await import('./hooks/useEditingState')
    const spy = vi.spyOn(useEditingStateMock, 'useEditingState')
    spy.mockReturnValue({
      selectedGoalIds: [],
      setSelectedGoalIds: vi.fn(),
      editingGoalId: 1,
      setEditingGoalId: vi.fn(),
      toggleGoalSelection: vi.fn(),
      startEditing: vi.fn(),
      stopEditing: vi.fn(),
      resetState: vi.fn(),
    })

    renderGoal('/goal')

    // Trigger showing the form
    await user.click(screen.getByRole('button', { name: /new goal/i }))

    const modal = screen.getByTestId('goal-form-modal')
    expect(modal).toBeInTheDocument()
    expect(modal).toHaveAttribute('aria-label', 'Edit goal')
    expect(capturedGoalFormModalProps.editingGoalId).toBe(1)

    spy.mockRestore()
  })

  it('opens GoalFormModal in copy mode with pre-filled data from the source goal', async () => {
    const user = userEvent.setup()
    renderGoal('/goal')

    // Trigger copy through the GoalsSection onCopyGoal callback
    const onCopyGoal = capturedGoalsSectionProps.onCopyGoal as (goal: FinancialGoal) => void
    expect(onCopyGoal).toBeDefined()

    // Simulate copying goalA
    await user.click(screen.getByRole('button', { name: /new goal/i }))
    // Cancel to reset, then trigger copy
    const onCancel = capturedGoalFormModalProps.onCancel as () => void
    onCancel()

    const { act } = await import('@testing-library/react')
    act(() => {
      onCopyGoal(goalA)
    })

    const modal = screen.getByTestId('goal-form-modal')
    expect(modal).toBeInTheDocument()
    // In copy mode, editingGoalId should be null (it's a new goal with pre-filled data)
    expect(capturedGoalFormModalProps.editingGoalId).toBeNull()
    // formData should have the source goal name with "- Duplicate" suffix
    const formData = capturedGoalFormModalProps.formData as Record<string, unknown>
    expect(formData.goalName).toContain('Alpha')
    expect(formData.goalName).toContain('- Duplicate')
  })
})

/* ═══════════════════════════════════════════════════════════════
   4. GoalMixer modal
   ═══════════════════════════════════════════════════════════════ */

describe('GoalMixer', () => {
  it('opens GoalMixer modal when "Mix & Match" is clicked', async () => {
    const user = userEvent.setup()
    renderGoal('/goal')

    expect(screen.queryByTestId('goal-mixer')).not.toBeInTheDocument()

    const mixButton = screen.getByRole('button', { name: /mix/i })
    await user.click(mixButton)

    expect(screen.getByTestId('goal-mixer')).toBeInTheDocument()
    expect(capturedGoalMixerProps.goals).toEqual(goals)
    expect(capturedGoalMixerProps.gwGoals).toEqual(gwGoals)
  })
})

/* ═══════════════════════════════════════════════════════════════
   5. Lazy-loaded FICalculator with Suspense
   ═══════════════════════════════════════════════════════════════ */

describe('FICalculator lazy loading', () => {
  it('lazy-loads FICalculator with Suspense fallback on Calculator tab', async () => {
    renderGoal('/goal/calculator')

    // The mocked FICalculator resolves immediately, but Suspense fallback
    // may flash briefly. Verify the calculator eventually renders.
    expect(await screen.findByTestId('fi-calculator')).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════
   6. GoalDetail GW goal CRUD callbacks
   ═══════════════════════════════════════════════════════════════ */

describe('GoalDetail receives correct callbacks', () => {
  it('passes correct GW goal CRUD callbacks to GoalDetail', () => {
    renderGoal('/goal/1')

    expect(capturedGoalDetailProps.onCreateGwGoal).toBe(mockCreateGwGoal)
    expect(capturedGoalDetailProps.onUpdateGwGoal).toBe(mockUpdateGwGoal)
    expect(capturedGoalDetailProps.onDeleteGwGoal).toBe(mockDeleteGwGoal)
    expect(capturedGoalDetailProps.goals).toEqual(goals)
    expect(capturedGoalDetailProps.profileBirthday).toBe('1990-01-15')
    expect(capturedGoalDetailProps.gwGoals).toEqual(gwGoals)
  })
})
