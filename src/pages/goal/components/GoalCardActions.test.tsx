import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GoalCardActions from './GoalCardActions'
import { makeGoal } from '../../../test/factories'

vi.mock('../../../styles/GoalCardActions.css', () => ({}))

const goal = makeGoal({ id: 42, goalName: 'Early Retirement' })

describe('GoalCardActions', () => {
  // #48: Source buttons use title (no aria-label). title provides accessible name per WAI-ARIA,
  // so getByRole('button', { name }) works and is the preferred accessible query.
  it('renders edit, copy, and delete buttons', () => {
    render(<GoalCardActions goal={goal} onEdit={vi.fn()} onCopy={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Edit goal' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy goal to form' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete goal' })).toBeInTheDocument()
  })

  it('calls onEdit with the goal when edit button is clicked', async () => {
    const onEdit = vi.fn()
    render(<GoalCardActions goal={goal} onEdit={onEdit} onCopy={vi.fn()} onDelete={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Edit goal' }))

    expect(onEdit).toHaveBeenCalledOnce()
    expect(onEdit).toHaveBeenCalledWith(goal)
  })

  it('calls onCopy with the goal when copy button is clicked', async () => {
    const onCopy = vi.fn()
    render(<GoalCardActions goal={goal} onEdit={vi.fn()} onCopy={onCopy} onDelete={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Copy goal to form' }))

    expect(onCopy).toHaveBeenCalledOnce()
    expect(onCopy).toHaveBeenCalledWith(goal)
  })

  it('calls onDelete with the goal id when delete button is clicked', async () => {
    const onDelete = vi.fn()
    render(<GoalCardActions goal={goal} onEdit={vi.fn()} onCopy={vi.fn()} onDelete={onDelete} />)

    await userEvent.click(screen.getByRole('button', { name: 'Delete goal' }))

    expect(onDelete).toHaveBeenCalledOnce()
    expect(onDelete).toHaveBeenCalledWith(42)
  })
})
