import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OwnerSection from './OwnerSection'
import { makeTaxItem } from '../../../test/factories'
import type { OwnerSectionProps } from './OwnerSection'

const baseProps: OwnerSectionProps = {
  owner: 'primary',
  title: 'Alice',
  items: [],
  year: 2024,
  onUpload: vi.fn(),
  onRemoveFile: vi.fn(),
  onRemoveItem: vi.fn(),
  onRename: vi.fn(),
  onAddItem: vi.fn(),
  onAddPaystub: vi.fn(),
  onSuggestAccounts: vi.fn(),
  primaryName: 'Alice',
  partnerName: 'Bob',
  accounts: [],
  hasSuggestions: false,
}

describe('OwnerSection', () => {
  it('renders section title', () => {
    render(<OwnerSection {...baseProps} />)
    expect(screen.getByRole('heading', { name: 'Alice' })).toBeInTheDocument()
  })

  it('renders done/total count', () => {
    const items = [
      makeTaxItem({
        id: 'a',
        label: 'W-2',
        files: [{ id: 'f1', name: 'w2.pdf', content: '', ext: 'pdf', uploadedAt: '2024-01-01' }],
      }),
      makeTaxItem({ id: 'b', label: '1099' }),
    ]
    render(<OwnerSection {...baseProps} items={items} />)
    expect(screen.getByText('1/2')).toBeInTheDocument()
  })

  it('renders empty state when no items', () => {
    render(<OwnerSection {...baseProps} items={[]} />)
    expect(screen.getByText('No items yet')).toBeInTheDocument()
  })

  it('renders Add Item button', () => {
    render(<OwnerSection {...baseProps} />)
    expect(screen.getByRole('button', { name: '+ Add Item' })).toBeInTheDocument()
  })

  it('calls onAddItem when Add Item clicked', async () => {
    const onAddItem = vi.fn()
    render(<OwnerSection {...baseProps} onAddItem={onAddItem} />)
    await userEvent.click(screen.getByRole('button', { name: '+ Add Item' }))
    expect(onAddItem).toHaveBeenCalledWith('primary')
  })

  it('shows Add Paystub button for primary owner without paystub', () => {
    render(<OwnerSection {...baseProps} owner="primary" items={[]} />)
    expect(screen.getByRole('button', { name: '+ Add Paystub' })).toBeInTheDocument()
  })

  it('hides Add Paystub button for joint owner', () => {
    render(<OwnerSection {...baseProps} owner="joint" items={[]} />)
    expect(screen.queryByRole('button', { name: '+ Add Paystub' })).not.toBeInTheDocument()
  })

  it('hides Add Paystub button when paystub already exists', () => {
    const items = [makeTaxItem({ id: 'ps', category: 'paystub' })]
    render(<OwnerSection {...baseProps} items={items} />)
    expect(screen.queryByRole('button', { name: '+ Add Paystub' })).not.toBeInTheDocument()
  })

  it('shows From Accounts button when hasSuggestions is true', () => {
    render(<OwnerSection {...baseProps} hasSuggestions />)
    expect(screen.getByRole('button', { name: '+ From Accounts' })).toBeInTheDocument()
  })

  it('hides From Accounts button when hasSuggestions is false', () => {
    render(<OwnerSection {...baseProps} hasSuggestions={false} />)
    expect(screen.queryByRole('button', { name: '+ From Accounts' })).not.toBeInTheDocument()
  })

  it('calls onSuggestAccounts with owner when From Accounts clicked', async () => {
    const onSuggestAccounts = vi.fn()
    render(<OwnerSection {...baseProps} hasSuggestions onSuggestAccounts={onSuggestAccounts} />)
    await userEvent.click(screen.getByRole('button', { name: '+ From Accounts' }))
    expect(onSuggestAccounts).toHaveBeenCalledWith('primary')
  })
})
