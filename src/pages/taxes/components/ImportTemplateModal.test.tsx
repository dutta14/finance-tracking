import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ImportTemplateModal from './ImportTemplateModal'
import type { ImportTemplateModalProps } from './ImportTemplateModal'
import type { TaxTemplate } from '../types'

const template1: TaxTemplate = {
  id: 'tpl-1',
  name: 'Standard',
  items: [{ label: 'W-2', owner: 'primary', category: 'paystub' }],
}
const template2: TaxTemplate = {
  id: 'tpl-2',
  name: 'Full',
  items: [
    { label: 'W-2', owner: 'primary', category: 'paystub' },
    { label: '1099', owner: 'primary', category: 'account' },
  ],
}

const baseProps: ImportTemplateModalProps = {
  templates: [template1, template2],
  onImport: vi.fn(),
  onDelete: vi.fn(),
  onClose: vi.fn(),
}

describe('ImportTemplateModal', () => {
  it('renders heading', () => {
    render(<ImportTemplateModal {...baseProps} />)
    expect(screen.getByRole('heading', { name: 'Import from Template' })).toBeInTheDocument()
  })

  it('renders template names', () => {
    render(<ImportTemplateModal {...baseProps} />)
    expect(screen.getByText('Standard')).toBeInTheDocument()
    expect(screen.getByText('Full')).toBeInTheDocument()
  })

  it('renders item counts', () => {
    render(<ImportTemplateModal {...baseProps} />)
    expect(screen.getByText('1 items')).toBeInTheDocument()
    expect(screen.getByText('2 items')).toBeInTheDocument()
  })

  it('renders empty state when no templates', () => {
    render(<ImportTemplateModal {...baseProps} templates={[]} />)
    expect(screen.getByText('No templates saved yet.')).toBeInTheDocument()
  })

  it('calls onImport with template when Use clicked', async () => {
    const onImport = vi.fn()
    render(<ImportTemplateModal {...baseProps} onImport={onImport} />)
    const useButtons = screen.getAllByRole('button', { name: 'Use' })
    await userEvent.click(useButtons[0])
    expect(onImport).toHaveBeenCalledWith(template1)
  })

  it('calls onDelete with template id when delete clicked', async () => {
    const onDelete = vi.fn()
    render(<ImportTemplateModal {...baseProps} onDelete={onDelete} />)
    const deleteButtons = screen.getAllByTitle('Delete template')
    await userEvent.click(deleteButtons[1])
    expect(onDelete).toHaveBeenCalledWith('tpl-2')
  })

  it('calls onClose when Cancel clicked', async () => {
    const onClose = vi.fn()
    render(<ImportTemplateModal {...baseProps} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
  })
})
