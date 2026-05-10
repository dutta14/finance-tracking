import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UndoToast from './UndoToast'

describe('UndoToast', () => {
  it('renders message and undo button', () => {
    render(<UndoToast message="Goal deleted" onUndo={() => {}} onDismiss={() => {}} />)
    expect(screen.getByText('Goal deleted')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()
  })

  it('calls onUndo when undo button is clicked', async () => {
    const onUndo = vi.fn()
    render(<UndoToast message="Goal deleted" onUndo={onUndo} onDismiss={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(onUndo).toHaveBeenCalledOnce()
  })

  it('calls onDismiss when dismiss button is clicked', async () => {
    const onDismiss = vi.fn()
    render(<UndoToast message="Goal deleted" onUndo={() => {}} onDismiss={onDismiss} />)
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('has role="alert" or aria-live for screen reader announcement', () => {
    const { container } = render(<UndoToast message="Goal deleted" onUndo={() => {}} onDismiss={() => {}} />)
    const alertEl = container.querySelector('[role="alert"], [aria-live]')
    expect(alertEl).toBeInTheDocument()
  })
})
