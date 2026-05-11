import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GoalSection from './GoalSection'
import type { CustomRatio } from '../types'
import type { Profile } from '../../../hooks/useProfile'

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
  it('shows Set Goal button when no goal exists', () => {
    render(
      <GoalSection
        activeRatio={makeRatio()}
        profile={defaultProfile}
        allocMap={emptyAllocMap}
        computeGoalPcts={() => null}
        onSetGoal={vi.fn()}
      />,
    )
    expect(screen.getByText('Set Goal')).toBeInTheDocument()
  })

  it('displays goal summary when a constant goal exists', () => {
    const ratio = makeRatio({ goals: { total: { type: 'constant', pcts: [60, 40] } } })
    render(
      <GoalSection
        activeRatio={ratio}
        profile={defaultProfile}
        allocMap={emptyAllocMap}
        computeGoalPcts={() => [60, 40]}
        onSetGoal={vi.fn()}
      />,
    )
    expect(screen.getByText(/Stocks 60%/)).toBeInTheDocument()
    expect(screen.getByText(/Bonds 40%/)).toBeInTheDocument()
  })

  it('shows Edit, Rebalance, and Remove buttons when goal exists', () => {
    const ratio = makeRatio({ goals: { total: { type: 'constant', pcts: [60, 40] } } })
    render(
      <GoalSection
        activeRatio={ratio}
        profile={defaultProfile}
        allocMap={emptyAllocMap}
        computeGoalPcts={() => [60, 40]}
        onSetGoal={vi.fn()}
      />,
    )
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Rebalance')).toBeInTheDocument()
    expect(screen.getByText('Remove')).toBeInTheDocument()
  })

  it('calls onSetGoal with null when Remove is clicked', async () => {
    const user = userEvent.setup()
    const onSetGoal = vi.fn()
    const ratio = makeRatio({ goals: { total: { type: 'constant', pcts: [60, 40] } } })
    render(
      <GoalSection
        activeRatio={ratio}
        profile={defaultProfile}
        allocMap={emptyAllocMap}
        computeGoalPcts={() => [60, 40]}
        onSetGoal={onSetGoal}
      />,
    )
    await user.click(screen.getByText('Remove'))
    expect(onSetGoal).toHaveBeenCalledWith('total', null)
  })

  it('shows goal editor when Edit is clicked', async () => {
    const user = userEvent.setup()
    const ratio = makeRatio({ goals: { total: { type: 'constant', pcts: [60, 40] } } })
    render(
      <GoalSection
        activeRatio={ratio}
        profile={defaultProfile}
        allocMap={emptyAllocMap}
        computeGoalPcts={() => [60, 40]}
        onSetGoal={vi.fn()}
      />,
    )
    await user.click(screen.getByText('Edit'))
    expect(screen.getByText('Constant')).toBeInTheDocument()
    expect(screen.getByText('Save Goal')).toBeInTheDocument()
  })

  it('shows rebalance panel when Rebalance is clicked', async () => {
    const user = userEvent.setup()
    const ratio = makeRatio({ goals: { total: { type: 'constant', pcts: [60, 40] } } })
    render(
      <GoalSection
        activeRatio={ratio}
        profile={defaultProfile}
        allocMap={emptyAllocMap}
        computeGoalPcts={() => [60, 40]}
        onSetGoal={vi.fn()}
      />,
    )
    await user.click(screen.getByText('Rebalance'))
    expect(screen.getByText('Close')).toBeInTheDocument()
  })
})
