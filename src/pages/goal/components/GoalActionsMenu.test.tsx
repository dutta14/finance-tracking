import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GoalActionsMenu from './GoalActionsMenu'

describe('GoalActionsMenu', () => {
  it('renders trigger button', () => {
    render(<GoalActionsMenu />)
    expect(screen.getByRole('button', { name: /goal actions/i })).toBeInTheDocument()
  })

  it('does not render menu items when only some callbacks provided (line 47, 57 falsy)', async () => {
    render(<GoalActionsMenu onDelete={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /goal actions/i }))
    expect(screen.queryByText('Edit')).not.toBeInTheDocument()
    expect(screen.queryByText('Go to Goal')).not.toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('renders all menu items when all callbacks provided', async () => {
    render(
      <GoalActionsMenu
        onEdit={vi.fn()}
        onRename={vi.fn()}
        onGoToGoal={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /goal actions/i }))
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Go to Goal')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('calls onEdit and closes menu on click', async () => {
    const onEdit = vi.fn()
    render(<GoalActionsMenu onEdit={onEdit} />)
    await userEvent.click(screen.getByRole('button', { name: /goal actions/i }))
    await userEvent.click(screen.getByText('Edit'))
    expect(onEdit).toHaveBeenCalledOnce()
    expect(screen.queryByText('Edit')).not.toBeInTheDocument()
  })

  it('calls onGoToGoal when clicked (line 57)', async () => {
    const onGoToGoal = vi.fn()
    render(<GoalActionsMenu onGoToGoal={onGoToGoal} />)
    await userEvent.click(screen.getByRole('button', { name: /goal actions/i }))
    await userEvent.click(screen.getByText('Go to Goal'))
    expect(onGoToGoal).toHaveBeenCalledOnce()
  })
})
