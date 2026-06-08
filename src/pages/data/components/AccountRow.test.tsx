import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AccountRow from './AccountRow'
import { Account } from '../types'

const mockAccount: Account = {
  id: 1,
  name: 'Checking Account',
  goalType: 'fi',
  type: 'retirement',
  nature: 'asset',
  allocation: 'cash',
  owner: 'primary',
  status: 'active',
  group: 'Banking',
  institution: 'Chase',
  linkedAccountId: undefined,
}

const defaultProps = {
  account: mockAccount,
  accounts: [mockAccount],
  ownerLabels: { primary: 'Anindya', partner: 'Partner', joint: 'Joint' },
  isSelected: false,
  showMultiSelect: false,
  onToggleSelect: vi.fn(),
  onRowClick: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
}

const renderRow = (props = {}) =>
  render(
    <table>
      <tbody>
        <AccountRow {...defaultProps} {...props} />
      </tbody>
    </table>,
  )

describe('AccountRow', () => {
  it('renders account name, institution, and group badge', () => {
    renderRow()
    expect(screen.getByText('Checking Account')).toBeInTheDocument()
    expect(screen.getByText('Chase')).toBeInTheDocument()
    expect(screen.getByText('↳ Banking')).toBeInTheDocument()
  })

  it('renders correct goal type badge', () => {
    renderRow()
    expect(screen.getByText('FI')).toBeInTheDocument()
  })

  it('shows checkbox when showMultiSelect is true', () => {
    renderRow({ showMultiSelect: true })
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
  })

  it('calls onEdit when edit button clicked', () => {
    const onEdit = vi.fn()
    renderRow({ onEdit })
    fireEvent.click(screen.getByTitle('Edit'))
    expect(onEdit).toHaveBeenCalledWith(1)
  })

  it('calls onDelete when delete button clicked', () => {
    const onDelete = vi.fn()
    renderRow({ onDelete })
    fireEvent.click(screen.getByTitle('Delete'))
    expect(onDelete).toHaveBeenCalledWith(1)
  })
})
