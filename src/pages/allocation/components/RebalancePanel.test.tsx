import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RebalancePanel from './RebalancePanel'

const twoGroups = [
  { label: 'Stocks', classes: ['us-stock' as const] },
  { label: 'Bonds', classes: ['bonds' as const] },
]

describe('RebalancePanel', () => {
  it('renders group names in the rebalance table', () => {
    render(<RebalancePanel groups={twoGroups} actualValues={[6000, 4000]} goalPcts={[60, 40]} onClose={vi.fn()} />)
    expect(screen.getByText('Stocks')).toBeInTheDocument()
    expect(screen.getByText('Bonds')).toBeInTheDocument()
  })

  it('shows on-track message when allocation matches goal', () => {
    render(<RebalancePanel groups={twoGroups} actualValues={[6000, 4000]} goalPcts={[60, 40]} onClose={vi.fn()} />)
    expect(screen.getByText('Your allocation is on track with the goal.')).toBeInTheDocument()
  })

  it('shows transfer actions with specific amounts when allocation is off-target', () => {
    render(<RebalancePanel groups={twoGroups} actualValues={[8000, 2000]} goalPcts={[60, 40]} onClose={vi.fn()} />)
    expect(screen.getByText('Action Plan')).toBeInTheDocument()
    const moveHeading = screen.getByText('Move between groups')
    const actionGroup = moveHeading.parentElement!
    expect(actionGroup).toHaveTextContent('$2,000')
    expect(actionGroup).toHaveTextContent('Stocks')
    expect(actionGroup).toHaveTextContent('Bonds')
  })

  it('shows new money allocation when new money is entered', async () => {
    const user = userEvent.setup()
    render(<RebalancePanel groups={twoGroups} actualValues={[3000, 2000]} goalPcts={[60, 40]} onClose={vi.fn()} />)
    const input = screen.getByPlaceholderText('0')
    await user.clear(input)
    await user.type(input, '5000')
    expect(screen.getByText('Action Plan')).toBeInTheDocument()
    const allocHeading = screen.getByText(/Allocate new money/)
    const actionGroup = allocHeading.parentElement!
    expect(actionGroup).toHaveTextContent('$3,000')
    expect(actionGroup).toHaveTextContent('Stocks')
    expect(actionGroup).toHaveTextContent('$2,000')
    expect(actionGroup).toHaveTextContent('Bonds')
  })

  it('calls onClose when Close button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<RebalancePanel groups={twoGroups} actualValues={[6000, 4000]} goalPcts={[60, 40]} onClose={onClose} />)
    await user.click(screen.getByText('Close'))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders current and target columns', () => {
    render(<RebalancePanel groups={twoGroups} actualValues={[6000, 4000]} goalPcts={[60, 40]} onClose={vi.fn()} />)
    expect(screen.getByText('Current')).toBeInTheDocument()
    expect(screen.getByText('Target')).toBeInTheDocument()
    expect(screen.getByText('Group')).toBeInTheDocument()
  })

  it('shows total row with current total', () => {
    render(<RebalancePanel groups={twoGroups} actualValues={[6000, 4000]} goalPcts={[60, 40]} onClose={vi.fn()} />)
    const totalTexts = screen.getAllByText('$10,000')
    expect(totalTexts).toHaveLength(2)
  })

  it('handles single group without crashing', () => {
    const singleGroup = [{ label: 'All', classes: ['us-stock' as const] }]
    render(<RebalancePanel groups={singleGroup} actualValues={[10000]} goalPcts={[100]} onClose={vi.fn()} />)
    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('Your allocation is on track with the goal.')).toBeInTheDocument()
  })
})
