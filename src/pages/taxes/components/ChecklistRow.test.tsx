import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChecklistRow from './ChecklistRow'
import { makeTaxItem, makeAccount } from '../../../test/factories'
import type { ChecklistRowProps } from './ChecklistRow'

const baseProps: ChecklistRowProps = {
  item: makeTaxItem({ id: 'item-1', label: 'W-2 Form' }),
  year: 2024,
  onUpload: vi.fn(),
  onRemoveFile: vi.fn(),
  onRemoveItem: vi.fn(),
  onRename: vi.fn(),
  primaryName: 'Alice',
  partnerName: 'Bob',
  accounts: [],
}

describe('ChecklistRow', () => {
  it('renders the item label', () => {
    render(<ChecklistRow {...baseProps} />)
    expect(screen.getByText('W-2 Form')).toBeInTheDocument()
  })

  it('renders Upload button when no files exist', () => {
    render(<ChecklistRow {...baseProps} />)
    expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument()
  })

  it('renders Add button when files exist', () => {
    const item = makeTaxItem({
      id: 'item-1',
      label: 'W-2 Form',
      files: [{ id: 'f1', name: 'w2.pdf', content: '', ext: 'pdf', uploadedAt: '2024-01-01' }],
    })
    render(<ChecklistRow {...baseProps} item={item} />)
    expect(screen.getByRole('button', { name: /^add$/i })).toBeInTheDocument()
  })

  it('renders file chips when files exist', () => {
    const item = makeTaxItem({
      id: 'item-1',
      label: 'W-2',
      files: [
        { id: 'f1', name: 'w2.pdf', content: '', ext: 'pdf', uploadedAt: '2024-01-01' },
        { id: 'f2', name: 'w2-2.pdf', content: '', ext: 'pdf', uploadedAt: '2024-01-02' },
      ],
    })
    render(<ChecklistRow {...baseProps} item={item} />)
    expect(screen.getByText('w2.pdf')).toBeInTheDocument()
    expect(screen.getByText('w2-2.pdf')).toBeInTheDocument()
  })

  it('enters rename mode on double-click', async () => {
    render(<ChecklistRow {...baseProps} />)
    fireEvent.doubleClick(screen.getByText('W-2 Form'))
    expect(screen.getByDisplayValue('W-2 Form')).toBeInTheDocument()
  })

  it('commits rename on Enter', async () => {
    const onRename = vi.fn()
    render(<ChecklistRow {...baseProps} onRename={onRename} />)
    fireEvent.doubleClick(screen.getByText('W-2 Form'))
    const input = screen.getByDisplayValue('W-2 Form')
    fireEvent.change(input, { target: { value: 'Renamed' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onRename).toHaveBeenCalledWith('item-1', 'Renamed')
  })

  it('cancels rename on Escape', async () => {
    render(<ChecklistRow {...baseProps} />)
    fireEvent.doubleClick(screen.getByText('W-2 Form'))
    const input = screen.getByDisplayValue('W-2 Form')
    fireEvent.change(input, { target: { value: 'Nope' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.getByText('W-2 Form')).toBeInTheDocument()
  })

  it('calls onRemoveItem when remove button clicked', async () => {
    const onRemoveItem = vi.fn()
    render(<ChecklistRow {...baseProps} onRemoveItem={onRemoveItem} />)
    await userEvent.click(screen.getByTitle('Remove item'))
    expect(onRemoveItem).toHaveBeenCalledWith('item-1')
  })

  it('calls onRemoveFile when file remove button clicked', async () => {
    const onRemoveFile = vi.fn()
    const item = makeTaxItem({
      id: 'item-1',
      label: 'W-2',
      files: [{ id: 'f1', name: 'w2.pdf', content: '', ext: 'pdf', uploadedAt: '2024-01-01' }],
    })
    render(<ChecklistRow {...baseProps} item={item} onRemoveFile={onRemoveFile} />)
    await userEvent.click(screen.getByTitle('Remove file'))
    expect(onRemoveFile).toHaveBeenCalledWith('item-1', 'f1')
  })

  it('displays linked account names', () => {
    const item = makeTaxItem({ id: 'item-1', label: '1099', accountIds: [1, 2] })
    const accounts = [makeAccount({ id: 1, name: 'Fidelity' }), makeAccount({ id: 2, name: 'Vanguard' })]
    render(<ChecklistRow {...baseProps} item={item} accounts={accounts} />)
    expect(screen.getByText('Fidelity, Vanguard')).toBeInTheDocument()
  })

  it('shows complete aria label when files present', () => {
    const item = makeTaxItem({
      id: 'item-1',
      label: 'W-2',
      files: [{ id: 'f1', name: 'w2.pdf', content: '', ext: 'pdf', uploadedAt: '2024-01-01' }],
    })
    render(<ChecklistRow {...baseProps} item={item} />)
    expect(screen.getByRole('img', { name: 'W-2 (complete)' })).toBeInTheDocument()
  })

  it('shows not started aria label when no files', () => {
    render(<ChecklistRow {...baseProps} />)
    expect(screen.getByRole('img', { name: 'W-2 Form (not started)' })).toBeInTheDocument()
  })
})
