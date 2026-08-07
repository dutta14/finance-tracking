import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GoalSection from './GoalSection'
import type { CustomRatio, RatioGoal } from '../types'
import type { AssetAllocation } from '../../data/types'
import type { Profile } from '../../../hooks/useProfile'

vi.mock('./GoalEditor', () => ({
  default: ({
    hasPrimary,
    hasPartner,
    primaryName,
    partnerName,
    onSave,
    onCancel,
  }: {
    hasPrimary: boolean
    hasPartner: boolean
    primaryName: string
    partnerName: string
    onSave: (goal: RatioGoal) => void
    onCancel: () => void
  }) => (
    <div data-testid="goal-editor">
      <div>primary:{String(hasPrimary)}</div>
      <div>partner:{String(hasPartner)}</div>
      <div>primary-name:{primaryName}</div>
      <div>partner-name:{partnerName}</div>
      <button onClick={() => onSave({ type: 'constant', pcts: [60, 40] })}>Mock Save Goal</button>
      <button onClick={onCancel}>Mock Cancel Goal</button>
    </div>
  ),
}))

vi.mock('./RebalancePanel', () => ({
  default: ({
    actualValues,
    goalPcts,
    onClose,
  }: {
    actualValues: number[]
    goalPcts: number[]
    onClose: () => void
  }) => (
    <div data-testid="rebalance-panel">
      <div>actual:{actualValues.join(',')}</div>
      <div>goal:{goalPcts.join(',')}</div>
      <button onClick={onClose}>Close Mock Rebalance</button>
    </div>
  ),
}))

const makeRatio = (overrides: Partial<CustomRatio> = {}): CustomRatio => ({
  id: 'r1',
  name: 'Test Ratio',
  scope: 'total',
  groups: [
    { label: 'Stocks', classes: ['us-stock'] },
    { label: 'Bonds', classes: ['bonds'] },
  ],
  ...overrides,
})

const defaultProfile: Profile = { name: 'Alice', avatarDataUrl: '', birthday: '1990-01-15', partner: null }
const emptyAllocMap = new Map()

describe('GoalSection', () => {
  it('shows the empty goal state when the active scope has no goal', () => {
    render(
      <GoalSection
        activeRatio={makeRatio()}
        profile={defaultProfile}
        allocMap={emptyAllocMap}
        computeGoalPcts={() => null}
        onSetGoal={vi.fn()}
      />,
    )

    expect(screen.getByText('+ Set Goal')).toBeInTheDocument()
    expect(screen.getByText(/No goal set for/)).toHaveTextContent('No goal set for Total')
  })

  it('renders the constant-goal summary and action buttons', () => {
    render(
      <GoalSection
        activeRatio={makeRatio({ goals: { total: { type: 'constant', pcts: [60, 40] } } })}
        profile={defaultProfile}
        allocMap={emptyAllocMap}
        computeGoalPcts={() => [60, 40]}
        onSetGoal={vi.fn()}
      />,
    )

    expect(screen.getByText('Stocks 60% / Bonds 40%')).toBeInTheDocument()
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Rebalance')).toBeInTheDocument()
    expect(screen.getByText('Remove')).toBeInTheDocument()
  })

  it('renders the gradual-goal summary for the active scope', () => {
    render(
      <GoalSection
        activeRatio={makeRatio({
          goals: {
            total: {
              type: 'gradual',
              owner: 'primary',
              startAge: 30,
              endAge: 60,
              startPcts: [80, 20],
              endPcts: [40, 60],
            },
          },
        })}
        profile={defaultProfile}
        allocMap={emptyAllocMap}
        computeGoalPcts={() => [60, 40]}
        onSetGoal={vi.fn()}
      />,
    )

    expect(screen.getByText(/Age 30→60 \(primary\): Stocks 80→40% \/ Bonds 20→60%/)).toBeInTheDocument()
  })

  it('opens the editor from the empty state and passes profile availability props', async () => {
    const user = userEvent.setup()
    render(
      <GoalSection
        activeRatio={makeRatio()}
        profile={{
          name: '',
          avatarDataUrl: '',
          birthday: '',
          partner: { name: 'Pat', avatarDataUrl: '', birthday: '1992-03-10' },
        }}
        allocMap={emptyAllocMap}
        computeGoalPcts={() => null}
        onSetGoal={vi.fn()}
      />,
    )

    await user.click(screen.getByText('+ Set Goal'))

    expect(screen.getByTestId('goal-editor')).toBeInTheDocument()
    expect(screen.getByText('primary:false')).toBeInTheDocument()
    expect(screen.getByText('partner:true')).toBeInTheDocument()
    expect(screen.getByText('primary-name:')).toBeInTheDocument()
    expect(screen.getByText('partner-name:Pat')).toBeInTheDocument()
  })

  it('saves the goal for the active scope and closes the editor', async () => {
    const user = userEvent.setup()
    const onSetGoal = vi.fn()

    render(
      <GoalSection
        activeRatio={makeRatio()}
        profile={defaultProfile}
        allocMap={emptyAllocMap}
        computeGoalPcts={() => null}
        onSetGoal={onSetGoal}
      />,
    )

    await user.click(screen.getByText('+ Set Goal'))
    await user.click(screen.getByText('Mock Save Goal'))

    expect(onSetGoal).toHaveBeenCalledWith('total', { type: 'constant', pcts: [60, 40] })
    expect(screen.queryByTestId('goal-editor')).not.toBeInTheDocument()
  })

  it('closes the editor without saving when cancel is clicked', async () => {
    const user = userEvent.setup()
    const onSetGoal = vi.fn()

    render(
      <GoalSection
        activeRatio={makeRatio()}
        profile={defaultProfile}
        allocMap={emptyAllocMap}
        computeGoalPcts={() => null}
        onSetGoal={onSetGoal}
      />,
    )

    await user.click(screen.getByText('+ Set Goal'))
    await user.click(screen.getByText('Mock Cancel Goal'))

    expect(onSetGoal).not.toHaveBeenCalled()
    expect(screen.queryByTestId('goal-editor')).not.toBeInTheDocument()
  })

  it('calls onSetGoal with null when remove is clicked', async () => {
    const user = userEvent.setup()
    const onSetGoal = vi.fn()

    render(
      <GoalSection
        activeRatio={makeRatio({ goals: { total: { type: 'constant', pcts: [60, 40] } } })}
        profile={defaultProfile}
        allocMap={emptyAllocMap}
        computeGoalPcts={() => [60, 40]}
        onSetGoal={onSetGoal}
      />,
    )

    await user.click(screen.getByText('Remove'))
    expect(onSetGoal).toHaveBeenCalledWith('total', null)
  })

  it('opens rebalance, computes actual values, and clamps negative class totals to zero', async () => {
    const user = userEvent.setup()
    const allocMap = new Map<string, Map<AssetAllocation, number>>([
      [
        'total',
        new Map<AssetAllocation, number>([
          ['us-stock', 120000],
          ['bonds', -5000],
        ]),
      ],
    ])

    render(
      <GoalSection
        activeRatio={makeRatio({ goals: { total: { type: 'constant', pcts: [60, 40] } } })}
        profile={defaultProfile}
        allocMap={allocMap}
        computeGoalPcts={() => [60, 40]}
        onSetGoal={vi.fn()}
      />,
    )

    await user.click(screen.getByText('Rebalance'))

    expect(screen.getByTestId('rebalance-panel')).toBeInTheDocument()
    expect(screen.getByText('actual:120000,0')).toBeInTheDocument()
    expect(screen.getByText('goal:60,40')).toBeInTheDocument()
    expect(screen.getByText('Hide Rebalance')).toBeInTheDocument()
  })

  it('does not render the rebalance panel when goal percentages cannot be computed', async () => {
    const user = userEvent.setup()

    render(
      <GoalSection
        activeRatio={makeRatio({ goals: { total: { type: 'constant', pcts: [60, 40] } } })}
        profile={defaultProfile}
        allocMap={emptyAllocMap}
        computeGoalPcts={() => null}
        onSetGoal={vi.fn()}
      />,
    )

    await user.click(screen.getByText('Rebalance'))

    expect(screen.queryByTestId('rebalance-panel')).not.toBeInTheDocument()
    expect(screen.getByText('Hide Rebalance')).toBeInTheDocument()
  })

  it('closes the rebalance panel when edit is clicked and when the panel close action runs', async () => {
    const user = userEvent.setup()

    render(
      <GoalSection
        activeRatio={makeRatio({ goals: { total: { type: 'constant', pcts: [60, 40] } } })}
        profile={defaultProfile}
        allocMap={emptyAllocMap}
        computeGoalPcts={() => [60, 40]}
        onSetGoal={vi.fn()}
      />,
    )

    await user.click(screen.getByText('Rebalance'))
    expect(screen.getByTestId('rebalance-panel')).toBeInTheDocument()

    await user.click(screen.getByText('Edit'))
    expect(screen.getByTestId('goal-editor')).toBeInTheDocument()
    expect(screen.queryByTestId('rebalance-panel')).not.toBeInTheDocument()

    await user.click(screen.getByText('Mock Cancel Goal'))
    await user.click(screen.getByText('Rebalance'))
    await user.click(screen.getByText('Close Mock Rebalance'))
    expect(screen.queryByTestId('rebalance-panel')).not.toBeInTheDocument()
  })

  it('renders badges for goals that exist on the other scopes', () => {
    render(
      <GoalSection
        activeRatio={makeRatio({
          scope: 'fi',
          goals: {
            fi: { type: 'constant', pcts: [55, 45] },
            total: { type: 'constant', pcts: [60, 40] },
            gw: { type: 'constant', pcts: [70, 30] },
          },
        })}
        profile={defaultProfile}
        allocMap={emptyAllocMap}
        computeGoalPcts={() => [55, 45]}
        onSetGoal={vi.fn()}
      />,
    )

    expect(screen.getByText('Total has goal')).toBeInTheDocument()
    expect(screen.getByText('GW has goal')).toBeInTheDocument()
  })
})
