import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddItemModal from './AddItemModal'
import type { AddItemModalProps } from './AddItemModal'

const baseProps: AddItemModalProps = {
  owner: 'primary',
  onAdd: vi.fn(),
  onClose: vi.fn(),
}

describe('AddItemModal', () => {
  it('renders heading and input', () => {
    render(<AddItemModal {...baseProps} />)
    expect(screen.getByRole('heading', { name: 'Add Checklist Item' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Item name')).toBeInTheDocument()
  })

  it('disables Add button when input is empty', () => {
    render(<AddItemModal {...baseProps} />)
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
  })

  it('enables Add button when text entered', async () => {
    render(<AddItemModal {...baseProps} />)
    await userEvent.type(screen.getByPlaceholderText('Item name'), 'My item')
    expect(screen.getByRole('button', { name: 'Add' })).not.toBeDisabled()
  })

  it('calls onAdd and onClose on Enter key', () => {
    const onAdd = vi.fn()
    const onClose = vi.fn()
    render(<AddItemModal {...baseProps} onAdd={onAdd} onClose={onClose} />)
    const input = screen.getByPlaceholderText('Item name')
    fireEvent.change(input, { target: { value: 'New Doc' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onAdd).toHaveBeenCalledWith('New Doc', 'custom')
    expect(onClose).toHaveBeenCalled()
  })

  it('does not submit on Enter when input is empty', () => {
    const onAdd = vi.fn()
    render(<AddItemModal {...baseProps} onAdd={onAdd} />)
    const input = screen.getByPlaceholderText('Item name')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('calls onAdd and onClose on Add button click', async () => {
    const onAdd = vi.fn()
    const onClose = vi.fn()
    render(<AddItemModal {...baseProps} onAdd={onAdd} onClose={onClose} />)
    await userEvent.type(screen.getByPlaceholderText('Item name'), 'Custom item')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onAdd).toHaveBeenCalledWith('Custom item', 'custom')
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when Cancel clicked', async () => {
    const onClose = vi.fn()
    render(<AddItemModal {...baseProps} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('trims whitespace from label', () => {
    const onAdd = vi.fn()
    render(<AddItemModal {...baseProps} onAdd={onAdd} />)
    const input = screen.getByPlaceholderText('Item name')
    fireEvent.change(input, { target: { value: '  Padded  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onAdd).toHaveBeenCalledWith('Padded', 'custom')
  })
})
