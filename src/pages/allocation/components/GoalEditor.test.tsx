import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GoalEditor from './GoalEditor'
import type { RatioGoal } from '../types'

const defaultProps = {
  groups: [
    { label: 'Stocks', classes: ['us-stock' as const] },
    { label: 'Bonds', classes: ['bonds' as const] },
  ],
  existingGoal: null as RatioGoal | null,
  hasPrimary: true,
  hasPartner: false,
  primaryName: 'Alice',
  partnerName: 'Bob',
  onSave: vi.fn(),
  onCancel: vi.fn(),
}

describe('GoalEditor', () => {
  it('renders Constant and Gradual type tabs', () => {
    render(<GoalEditor {...defaultProps} />)
    expect(screen.getByText('Constant')).toBeInTheDocument()
    expect(screen.getByText('Gradual')).toBeInTheDocument()
  })

  it('shows percentage inputs for each group in constant mode', () => {
    render(<GoalEditor {...defaultProps} />)
    expect(screen.getByText('Stocks')).toBeInTheDocument()
    expect(screen.getByText('Bonds')).toBeInTheDocument()
    expect(screen.getByText('Target %')).toBeInTheDocument()
  })

  it('disables Save Goal when percentages do not sum to 100', () => {
    const threeGroups = [
      { label: 'A', classes: ['us-stock' as const] },
      { label: 'B', classes: ['bonds' as const] },
      { label: 'C', classes: ['cash' as const] },
    ]
    // 3 groups: evenPct = 33, remainder = 1 → [34, 33, 33] = 100. Use existing goal with bad sum.
    const badGoal = { type: 'constant' as const, pcts: [50, 30, 10] }
    render(<GoalEditor {...defaultProps} groups={threeGroups} existingGoal={badGoal} />)
    const saveBtn = screen.getByText('Save Goal')
    expect(saveBtn).toBeDisabled()
  })

  it('enables Save Goal when percentages sum to 100', () => {
    const goal: RatioGoal = { type: 'constant', pcts: [60, 40] }
    render(<GoalEditor {...defaultProps} existingGoal={goal} />)
    const saveBtn = screen.getByText('Save Goal')
    expect(saveBtn).not.toBeDisabled()
  })

  it('calls onSave with constant goal data when Save Goal is clicked', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const goal: RatioGoal = { type: 'constant', pcts: [60, 40] }
    render(<GoalEditor {...defaultProps} existingGoal={goal} onSave={onSave} />)
    await user.click(screen.getByText('Save Goal'))
    expect(onSave).toHaveBeenCalledWith({ type: 'constant', pcts: [60, 40] })
  })

  it('calls onCancel when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<GoalEditor {...defaultProps} onCancel={onCancel} />)
    await user.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalled()
  })

  it('switches to gradual type and shows age inputs', async () => {
    const user = userEvent.setup()
    render(<GoalEditor {...defaultProps} />)
    await user.click(screen.getByText('Gradual'))
    expect(screen.getByText('Start age')).toBeInTheDocument()
    expect(screen.getByText('End age')).toBeInTheDocument()
    expect(screen.getByText('Start %')).toBeInTheDocument()
    expect(screen.getByText('End %')).toBeInTheDocument()
  })

  it('disables Save Goal when start age >= end age in gradual mode', async () => {
    const user = userEvent.setup()
    render(<GoalEditor {...defaultProps} />)
    await user.click(screen.getByText('Gradual'))
    const spinbuttons = screen.getAllByRole('spinbutton')
    const endAgeInput = spinbuttons.find(el => (el as HTMLInputElement).value === '60')!
    await user.clear(endAgeInput)
    await user.type(endAgeInput, '25')
    expect(screen.getByText('Save Goal')).toBeDisabled()
  })
})
