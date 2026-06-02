import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TaxReturnSection from './TaxReturnSection'
import { makeTaxItem } from '../../../test/factories'
import type { TaxReturnSectionProps } from './TaxReturnSection'

const baseProps: TaxReturnSectionProps = {
  items: [],
  year: 2024,
  onUpload: vi.fn(),
  onRemoveFile: vi.fn(),
  onAddReturnEntry: vi.fn(),
  primaryName: 'Alice',
  partnerName: 'Bob',
  hasPartner: true,
}

describe('TaxReturnSection', () => {
  it('renders section heading', () => {
    render(<TaxReturnSection {...baseProps} />)
    expect(screen.getByRole('heading', { name: 'Tax Returns' })).toBeInTheDocument()
  })

  it('renders empty state when no returns', () => {
    render(<TaxReturnSection {...baseProps} />)
    expect(screen.getByText('No return uploaded yet. Use the menu to add.')).toBeInTheDocument()
  })

  it('renders return items with labels', () => {
    const items = [makeTaxItem({ id: 'jr', label: 'Joint Return', owner: 'joint', category: 'tax-return' })]
    render(<TaxReturnSection {...baseProps} items={items} />)
    expect(screen.getByText('Joint Return')).toBeInTheDocument()
  })

  it('shows Upload button for return without files', () => {
    const items = [makeTaxItem({ id: 'jr', label: 'Joint Return', owner: 'joint', category: 'tax-return' })]
    render(<TaxReturnSection {...baseProps} items={items} />)
    expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument()
  })

  it('shows Replace button for return with files', () => {
    const items = [
      makeTaxItem({
        id: 'jr',
        label: 'Joint Return',
        owner: 'joint',
        category: 'tax-return',
        files: [{ id: 'f1', name: 'return.pdf', content: '', ext: 'pdf', uploadedAt: '2024-04-01' }],
      }),
    ]
    render(<TaxReturnSection {...baseProps} items={items} />)
    expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument()
  })

  it('opens menu on button click', async () => {
    render(<TaxReturnSection {...baseProps} />)
    await userEvent.click(screen.getByRole('button', { name: '⋯' }))
    expect(screen.getByRole('button', { name: /upload joint return/i })).toBeInTheDocument()
  })

  it('shows partner return option when hasPartner is true', async () => {
    render(<TaxReturnSection {...baseProps} hasPartner />)
    await userEvent.click(screen.getByRole('button', { name: '⋯' }))
    expect(screen.getByRole('button', { name: /bob's return/i })).toBeInTheDocument()
  })

  it('hides partner return option when hasPartner is false', async () => {
    render(<TaxReturnSection {...baseProps} hasPartner={false} />)
    await userEvent.click(screen.getByRole('button', { name: '⋯' }))
    expect(screen.queryByRole('button', { name: /bob's return/i })).not.toBeInTheDocument()
  })

  it('calls onAddReturnEntry with joint when joint return selected', async () => {
    const onAddReturnEntry = vi.fn()
    render(<TaxReturnSection {...baseProps} onAddReturnEntry={onAddReturnEntry} />)
    await userEvent.click(screen.getByRole('button', { name: '⋯' }))
    await userEvent.click(screen.getByRole('button', { name: /upload joint return/i }))
    expect(onAddReturnEntry).toHaveBeenCalledWith('joint')
  })

  it('calls onAddReturnEntry with primary when primary return selected', async () => {
    const onAddReturnEntry = vi.fn()
    render(<TaxReturnSection {...baseProps} onAddReturnEntry={onAddReturnEntry} />)
    await userEvent.click(screen.getByRole('button', { name: '⋯' }))
    await userEvent.click(screen.getByRole('button', { name: /alice's return/i }))
    expect(onAddReturnEntry).toHaveBeenCalledWith('primary')
  })

  it('renders file chips for return with files', () => {
    const items = [
      makeTaxItem({
        id: 'jr',
        label: 'Joint Return',
        owner: 'joint',
        category: 'tax-return',
        files: [{ id: 'f1', name: '2024-return.pdf', content: '', ext: 'pdf', uploadedAt: '2024-04-01' }],
      }),
    ]
    render(<TaxReturnSection {...baseProps} items={items} />)
    expect(screen.getByText('2024-return.pdf')).toBeInTheDocument()
  })

  it('calls onRemoveFile when file remove button clicked', async () => {
    const onRemoveFile = vi.fn()
    const items = [
      makeTaxItem({
        id: 'jr',
        label: 'Joint Return',
        owner: 'joint',
        category: 'tax-return',
        files: [{ id: 'f1', name: 'return.pdf', content: '', ext: 'pdf', uploadedAt: '2024-04-01' }],
      }),
    ]
    render(<TaxReturnSection {...baseProps} items={items} onRemoveFile={onRemoveFile} />)
    await userEvent.click(screen.getByTitle('Remove'))
    expect(onRemoveFile).toHaveBeenCalledWith('jr', 'f1')
  })
})
