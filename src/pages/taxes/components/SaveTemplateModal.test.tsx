import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SaveTemplateModal from './SaveTemplateModal'
import type { SaveTemplateModalProps } from './SaveTemplateModal'
import type { TaxTemplate } from '../types'

const template1: TaxTemplate = {
  id: 'tpl-1',
  name: 'Standard',
  items: [{ label: 'W-2', owner: 'primary', category: 'paystub' }],
}

const baseProps: SaveTemplateModalProps = {
  templates: [],
  onSaveNew: vi.fn(),
  onUpdate: vi.fn(),
  onClose: vi.fn(),
}

describe('SaveTemplateModal', () => {
  it('renders heading', () => {
    render(<SaveTemplateModal {...baseProps} />)
    expect(screen.getByRole('heading', { name: 'Save as Template' })).toBeInTheDocument()
  })

  it('defaults to new mode when no templates exist', () => {
    render(<SaveTemplateModal {...baseProps} />)
    expect(screen.getByPlaceholderText('Template name')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save New' })).toBeInTheDocument()
  })

  it('disables Save New button when name is empty', () => {
    render(<SaveTemplateModal {...baseProps} />)
    expect(screen.getByRole('button', { name: 'Save New' })).toBeDisabled()
  })

  it('enables Save New button when name entered', async () => {
    render(<SaveTemplateModal {...baseProps} />)
    await userEvent.type(screen.getByPlaceholderText('Template name'), 'My Template')
    expect(screen.getByRole('button', { name: 'Save New' })).not.toBeDisabled()
  })

  it('calls onSaveNew with trimmed name', async () => {
    const onSaveNew = vi.fn()
    render(<SaveTemplateModal {...baseProps} onSaveNew={onSaveNew} />)
    await userEvent.type(screen.getByPlaceholderText('Template name'), 'My Template')
    await userEvent.click(screen.getByRole('button', { name: 'Save New' }))
    expect(onSaveNew).toHaveBeenCalledWith('My Template')
  })

  it('defaults to update mode when templates exist', () => {
    render(<SaveTemplateModal {...baseProps} templates={[template1]} />)
    expect(screen.getByRole('button', { name: 'Update Template' })).toBeInTheDocument()
  })

  it('shows radio buttons to switch modes when templates exist', () => {
    render(<SaveTemplateModal {...baseProps} templates={[template1]} />)
    expect(screen.getByLabelText(/update existing/i)).toBeChecked()
    expect(screen.getByLabelText(/create new/i)).not.toBeChecked()
  })

  it('switches to new mode when Create new radio selected', async () => {
    render(<SaveTemplateModal {...baseProps} templates={[template1]} />)
    await userEvent.click(screen.getByLabelText(/create new/i))
    expect(screen.getByPlaceholderText('Template name')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save New' })).toBeInTheDocument()
  })

  it('calls onUpdate with selected template id', async () => {
    const onUpdate = vi.fn()
    render(<SaveTemplateModal {...baseProps} templates={[template1]} onUpdate={onUpdate} />)
    await userEvent.click(screen.getByRole('button', { name: 'Update Template' }))
    expect(onUpdate).toHaveBeenCalledWith('tpl-1')
  })

  it('calls onSaveNew on Enter in name field', () => {
    const onSaveNew = vi.fn()
    render(<SaveTemplateModal {...baseProps} onSaveNew={onSaveNew} />)
    const input = screen.getByPlaceholderText('Template name')
    fireEvent.change(input, { target: { value: 'Quick' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSaveNew).toHaveBeenCalledWith('Quick')
  })

  it('calls onClose when Cancel clicked', async () => {
    const onClose = vi.fn()
    render(<SaveTemplateModal {...baseProps} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
  })
})
