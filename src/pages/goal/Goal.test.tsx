import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { FinancialGoal } from '../../types'
import { makeGoal, makeGwGoal } from '../../test/factories'
import Goal from './Goal'

let capturedGoalsSectionProps: Record<string, unknown> = {}
let capturedGoalDetailProps: Record<string, unknown> = {}
let capturedGoalFormModalProps: Record<string, unknown> = {}
let capturedGoalMixerProps: Record<string, unknown> = {}
let capturedMonthPickerProps: Record<string, unknown> = {}

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
const mockSetLeverageSettings = vi.fn()

const goalA = makeGoal({ id: 1, goalName: 'Alpha' })
const goalB = makeGoal({ id: 2, goalName: 'Bravo' })
const goals = [goalA, goalB]
const gwGoalA = makeGwGoal({ id: 10, fiGoalId: 1 })
const gwGoals = [gwGoalA]

vi.mock('../../contexts/GoalsContext', () => ({
  useGoals: () => ({
    visibleGoals: goals,
    gwGoals,
    profile: { birthday: '1990-01-15', partner: { birthday: '1992-02-20' } },
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

vi.mock('../../contexts/DataContext', () => ({
  useData: () => ({
    allMonths: ['2024-01', '2024-02'],
  }),
}))

vi.mock('../../hooks/useGrowthSettings', () => ({
  useGrowthSettings: () => ({
    settings: {
      inflation: 3,
      preBoundaryGrowth: 8,
      postBoundaryGrowth: 6,
      ageBoundary: 60,
      gwGrowth: 8,
    },
    updateSettings: vi.fn(),
  }),
}))

vi.mock('../../hooks/useLeverage', () => ({
  useLeverageSettings: () => ({
    settings: { chartStart: '2024-01' },
    setSettings: mockSetLeverageSettings,
  }),
}))

vi.mock('../../components/GrowthSettingsPanel', () => ({
  default: () => <div data-testid="growth-settings-panel">Growth Settings</div>,
}))

vi.mock('../../components/MonthPicker', () => ({
  default: (props: Record<string, unknown>) => {
    capturedMonthPickerProps = props
    return <div data-testid="month-picker">Month Picker</div>
  },
}))

vi.mock('./components/GoalsSection', () => ({
  default: (props: Record<string, unknown>) => {
    capturedGoalsSectionProps = props
    return (
      <div data-testid="goals-section">
        <button type="button" onClick={() => (props.onNewGoal as (() => void) | undefined)?.()}>
          New Goal
        </button>
        <button type="button" onClick={() => (props.onMixMatch as (() => void) | undefined)?.()}>
          Mix &amp; Match
        </button>
      </div>
    )
  },
}))

vi.mock('./components/GoalDetail', () => ({
  default: (props: Record<string, unknown>) => {
    capturedGoalDetailProps = props
    const detailGoals = props.goals as FinancialGoal[]
    return <div data-testid="goal-detail">GoalDetail: {detailGoals.length} goals</div>
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

vi.mock('./components/GoalActionsMenu', () => ({
  default: (props: { onRename?: () => void; onDuplicate?: () => void; onDelete?: () => void }) => {
    // Use a simple DOM toggle instead of useState to satisfy eslint rules-of-hooks
    const id = 'goal-actions-panel'
    return (
      <div data-testid="goal-actions-menu">
        <button
          type="button"
          aria-label="Goal actions"
          onClick={e => {
            const panel = (e.currentTarget.parentElement as HTMLElement).querySelector(`#${id}`) as HTMLElement
            panel.hidden = !panel.hidden
          }}
        >
          Actions
        </button>
        <div id={id} hidden>
          <button onClick={() => props.onRename?.()}>Rename</button>
          <button onClick={() => props.onDuplicate?.()}>Duplicate</button>
          <button onClick={() => props.onDelete?.()}>Delete</button>
        </div>
      </div>
    )
  },
}))

vi.mock('./components/LeverageGoal', () => ({
  default: () => <div data-testid="leverage-goal">LeverageGoal</div>,
}))

vi.mock('./components/PayDown', () => ({
  default: () => <div data-testid="paydown-goal">PayDown</div>,
}))

vi.mock('../tools/components/FICalculator', () => ({
  default: () => <div data-testid="fi-calculator">FICalculator</div>,
}))

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
  capturedMonthPickerProps = {}
})

describe('Goal page routing', () => {
  it('redirects /goal to plans and renders the goals section', () => {
    renderGoal('/goal')

    expect(screen.getByRole('heading', { name: 'Goals', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'FIRE Plans' }).className).toContain('active')
    expect(screen.getByTestId('goals-section')).toBeInTheDocument()
  })

  it('renders the calculator tab and growth settings at /goal/calculator', () => {
    renderGoal('/goal/calculator')

    expect(screen.getByRole('link', { name: 'FIRE Calculator' }).className).toContain('active')
    expect(screen.getByTestId('fi-calculator')).toBeInTheDocument()
    expect(screen.getByTestId('growth-settings-panel')).toBeInTheDocument()
  })

  it('renders the leverage tab month picker at /goal/leverage', () => {
    renderGoal('/goal/leverage')

    expect(screen.getByRole('link', { name: 'Leverage' }).className).toContain('active')
    expect(screen.getByTestId('month-picker')).toBeInTheDocument()
  })

  it('updates leverage settings when the leverage month picker changes month', () => {
    renderGoal('/goal/leverage')
    ;(capturedMonthPickerProps.onMonthChange as (month: string) => void)('2024-02')

    const updater = mockSetLeverageSettings.mock.calls[0][0]
    expect(updater({ chartStart: '2024-01', compareStart: '2023-01' })).toEqual({
      chartStart: '2024-02',
      compareStart: '2023-01',
    })
  })

  it('renders detail view at /goal/plans/:id and keeps the header navigation visible', () => {
    renderGoal('/goal/plans/1')

    expect(screen.getByRole('heading', { name: 'Alpha', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Goals sections' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open goal drawer' })).toBeInTheDocument()
    expect(screen.getByTestId('goal-detail')).toBeInTheDocument()
  })
})

describe('Goal page detail callbacks', () => {
  it('passes the goal detail callbacks on /goal/plans/:id', () => {
    renderGoal('/goal/plans/1')

    expect(capturedGoalDetailProps.onCreateGwGoal).toBe(mockCreateGwGoal)
    expect(capturedGoalDetailProps.onUpdateGwGoal).toBe(mockUpdateGwGoal)
    expect(capturedGoalDetailProps.onDeleteGwGoal).toBe(mockDeleteGwGoal)
    expect(capturedGoalDetailProps.onUpdateGoal).toBe(mockUpdateGoal)
    expect(capturedGoalDetailProps.goals).toEqual(goals)
    expect(capturedGoalDetailProps.profileBirthday).toBe('1990-01-15')
    expect(capturedGoalDetailProps.partnerBirthday).toBe('1992-02-20')
  })
})

describe('Goal form interactions', () => {
  it('opens GoalFormModal in create mode when New Goal is clicked', async () => {
    const user = userEvent.setup()
    renderGoal('/goal')

    await user.click(screen.getByRole('button', { name: /new goal/i }))

    expect(screen.getByTestId('goal-form-modal')).toHaveAttribute('aria-label', 'Create new goal')
    expect(capturedGoalFormModalProps.editingGoalId).toBeNull()
  })

  it('opens GoalFormModal in edit mode when editingGoalId exists', async () => {
    const user = userEvent.setup()
    const useEditingStateModule = await import('./hooks/useEditingState')
    const spy = vi.spyOn(useEditingStateModule, 'useEditingState')
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
    await user.click(screen.getByRole('button', { name: /new goal/i }))

    expect(screen.getByTestId('goal-form-modal')).toHaveAttribute('aria-label', 'Edit goal')
    expect(capturedGoalFormModalProps.editingGoalId).toBe(1)

    spy.mockRestore()
  })

  it('calls createGoal on submit when not editing', async () => {
    const user = userEvent.setup()
    renderGoal('/goal')

    await user.click(screen.getByRole('button', { name: /new goal/i }))

    const newGoal = makeGoal({ id: 99, goalName: 'New Plan' })
    ;(capturedGoalFormModalProps.onSubmit as (goal: FinancialGoal) => void)(newGoal)

    expect(mockCreateGoal).toHaveBeenCalledWith(newGoal)
    expect(mockUpdateGoal).not.toHaveBeenCalled()
  })

  it('copies GW goals when submitting a duplicated goal', () => {
    renderGoal('/goal')

    act(() => {
      ;(capturedGoalsSectionProps.onCopyGoal as (goal: FinancialGoal) => void)(goalA)
    })

    const copiedGoal = makeGoal({ id: 100, goalName: 'Alpha - Duplicate' })
    act(() => {
      ;(capturedGoalFormModalProps.onSubmit as (goal: FinancialGoal) => void)(copiedGoal)
    })

    expect(mockCreateGoal).toHaveBeenCalledWith(copiedGoal)
    expect(mockCopyGwGoals).toHaveBeenCalledWith(1, 100)
  })

  it('hides the form when cancel is invoked', async () => {
    const user = userEvent.setup()
    renderGoal('/goal')

    await user.click(screen.getByRole('button', { name: /new goal/i }))
    act(() => {
      ;(capturedGoalFormModalProps.onCancel as () => void)()
    })

    expect(screen.queryByTestId('goal-form-modal')).not.toBeInTheDocument()
  })

  it('merges form field updates from the goal form modal callback', async () => {
    const user = userEvent.setup()
    renderGoal('/goal')

    await user.click(screen.getByRole('button', { name: /new goal/i }))

    act(() => {
      ;(capturedGoalFormModalProps.onSetFormFields as (fields: Record<string, unknown>) => void)({
        goalName: 'Updated draft',
      })
    })

    expect(capturedGoalFormModalProps.formData).toEqual(expect.objectContaining({ goalName: 'Updated draft' }))
  })
})

describe('Goal page goal actions', () => {
  it('renames a goal via the GoalsSection callback', () => {
    renderGoal('/goal')
    ;(capturedGoalsSectionProps.onRenameGoal as (id: number, name: string) => void)(1, 'Renamed Alpha')

    expect(mockUpdateGoal).toHaveBeenCalledWith(1, expect.objectContaining({ goalName: 'Renamed Alpha' }))
  })

  it('opens and closes GoalMixer from the plans page', async () => {
    const user = userEvent.setup()
    renderGoal('/goal')

    await user.click(screen.getByRole('button', { name: /mix & match/i }))
    expect(screen.getByTestId('goal-mixer')).toBeInTheDocument()

    act(() => {
      ;(capturedGoalMixerProps.onClose as () => void)()
    })

    expect(screen.queryByTestId('goal-mixer')).not.toBeInTheDocument()
  })

  it('navigates to a goal detail page from the GoalMixer callback', async () => {
    const user = userEvent.setup()
    renderGoal('/goal')

    await user.click(screen.getByRole('button', { name: /mix & match/i }))

    act(() => {
      ;(capturedGoalMixerProps.onGoToGoal as (goalId: number) => void)(2)
    })

    expect(screen.getByRole('heading', { name: 'Bravo', level: 1 })).toBeInTheDocument()
  })
})

describe('Goal drawer behavior', () => {
  it('opens the drawer from detail view and returns to the plans list', async () => {
    const user = userEvent.setup()
    renderGoal('/goal/plans/1')

    await user.click(screen.getByRole('button', { name: 'Open goal drawer' }))
    expect(screen.getByRole('button', { name: /all plans/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /all plans/i }))
    expect(screen.getByRole('heading', { name: 'Goals', level: 1 })).toBeInTheDocument()
    expect(screen.queryByTestId('goal-detail')).not.toBeInTheDocument()
  })

  it('navigates to another plan from the drawer', async () => {
    const user = userEvent.setup()
    renderGoal('/goal/plans/1')

    await user.click(screen.getByRole('button', { name: 'Open goal drawer' }))
    await user.click(screen.getByText('Bravo'))

    expect(screen.getByRole('heading', { name: 'Bravo', level: 1 })).toBeInTheDocument()
  })

  it('renames the active goal from the drawer actions menu when Enter is pressed', async () => {
    const user = userEvent.setup()
    renderGoal('/goal/plans/1')

    await user.click(screen.getByRole('button', { name: 'Open goal drawer' }))
    await user.click(screen.getByRole('button', { name: 'Goal actions' }))
    await user.click(screen.getByRole('button', { name: 'Rename' }))

    const input = screen.getByDisplayValue('Alpha')
    await user.clear(input)
    await user.type(input, 'Renamed Alpha{Enter}')

    expect(mockUpdateGoal).toHaveBeenCalledWith(1, expect.objectContaining({ goalName: 'Renamed Alpha' }))
    expect(screen.queryByDisplayValue('Renamed Alpha')).not.toBeInTheDocument()
  })

  it('closes inline rename without saving when Escape is pressed', async () => {
    const user = userEvent.setup()
    renderGoal('/goal/plans/1')

    await user.click(screen.getByRole('button', { name: 'Open goal drawer' }))
    await user.click(screen.getByRole('button', { name: 'Goal actions' }))
    await user.click(screen.getByRole('button', { name: 'Rename' }))

    const input = screen.getByDisplayValue('Alpha')
    await user.clear(input)
    await user.type(input, 'Discarded Rename{Escape}')

    expect(mockUpdateGoal).not.toHaveBeenCalledWith(1, expect.objectContaining({ goalName: 'Discarded Rename' }))
    expect(screen.queryByDisplayValue('Discarded Rename')).not.toBeInTheDocument()
  })

  it('duplicates the active goal from the drawer actions menu', async () => {
    const user = userEvent.setup()
    renderGoal('/goal/plans/1')

    await user.click(screen.getByRole('button', { name: 'Open goal drawer' }))
    await user.click(screen.getByRole('button', { name: 'Goal actions' }))
    await user.click(screen.getByRole('button', { name: 'Duplicate' }))

    expect(screen.getByTestId('goal-form-modal')).toBeInTheDocument()
    expect(capturedGoalFormModalProps.editingGoalId).toBeNull()
  })

  it('deletes the active goal and navigates to another plan', async () => {
    const user = userEvent.setup()
    renderGoal('/goal/plans/1')

    await user.click(screen.getByRole('button', { name: 'Open goal drawer' }))
    await user.click(screen.getByRole('button', { name: 'Goal actions' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(mockDeleteGoal).toHaveBeenCalledWith(1)
    expect(screen.getByRole('heading', { name: 'Bravo', level: 1 })).toBeInTheDocument()
  })
})
