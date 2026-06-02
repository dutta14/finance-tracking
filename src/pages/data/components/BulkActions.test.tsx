import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BulkActions from './BulkActions'

const defaultProps = {
  selectedCount: 3,
  ownerLabels: { primary: 'Anindya', partner: 'Partner', joint: 'Joint' },
  hasPartner: true,
  existingGroups: ['Banking', 'Investments'],
  onBulkUpdate: vi.fn(),
  onClearSelection: vi.fn(),
}

const renderBulk = (props = {}) => render(<BulkActions {...defaultProps} {...props} />)

describe('BulkActions', () => {
  it('renders selected count', () => {
    renderBulk()
    expect(screen.getByText('3 selected')).toBeInTheDocument()
  })

  it('calls onBulkUpdate with goalType when Goal select changed', async () => {
    const onBulkUpdate = vi.fn()
    renderBulk({ onBulkUpdate })
    const user = userEvent.setup()
    const selects = screen.getAllByRole('combobox')
    await user.selectOptions(selects[0], 'gw')
    expect(onBulkUpdate).toHaveBeenCalledWith({ goalType: 'gw', type: 'liquid' })
  })

  it('calls onBulkUpdate with status when Status select changed', async () => {
    const onBulkUpdate = vi.fn()
    renderBulk({ onBulkUpdate })
    const user = userEvent.setup()
    const selects = screen.getAllByRole('combobox')
    // Status is the 4th select (Goal, Type, Owner, Status)
    await user.selectOptions(selects[3], 'inactive')
    expect(onBulkUpdate).toHaveBeenCalledWith({ status: 'inactive' })
  })

  it('calls onClearSelection when Clear button clicked', async () => {
    const onClearSelection = vi.fn()
    renderBulk({ onClearSelection })
    fireEvent.click(screen.getByText('Clear'))
    expect(onClearSelection).toHaveBeenCalledTimes(1)
  })

  it('shows new group input when "New group…" option selected', async () => {
    renderBulk()
    const user = userEvent.setup()
    const selects = screen.getAllByRole('combobox')
    // Group is the last select (7th: Goal, Type, Owner, Status, Nature, Allocation, Group)
    await user.selectOptions(selects[6], '__new__')
    expect(screen.getByPlaceholderText('Group name')).toBeInTheDocument()
  })
})
