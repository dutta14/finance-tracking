import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AccountList from './AccountList'
import { Account } from '../types'
import { SortCol } from '../hooks/useColumnSort'

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
}

const mockAccount2: Account = {
  id: 2,
  name: 'Savings Account',
  goalType: 'gw',
  type: 'liquid',
  nature: 'asset',
  allocation: 'cash',
  owner: 'primary',
  status: 'active',
  group: 'Banking',
  institution: 'Chase',
}

const defaultProps = {
  filteredAccounts: [mockAccount, mockAccount2],
  accounts: [mockAccount, mockAccount2],
  profile: { name: 'Anindya', avatarDataUrl: '', birthday: '', partner: null },
  existingGroups: ['Banking'],
  ownerLabels: { primary: 'Anindya', partner: 'Partner', joint: 'Joint' },
  editingId: null,
  showMultiSelect: false,
  allFilteredSelected: false,
  selectedIds: new Set<number>(),
  sortCol: null as SortCol | null,
  sortDir: 'asc' as const,
  columnFilters: {},
  openFilterCol: null as SortCol | null,
  filterDropdownRef: { current: null },
  onToggleSort: vi.fn(),
  onToggleColumnFilter: vi.fn(),
  onClearColumnFilter: vi.fn(),
  onSetOpenFilterCol: vi.fn(),
  colUniqueValues: vi.fn(() => []),
  getColLabel: vi.fn((_, val) => val),
  onToggleSelectAll: vi.fn(),
  onToggleSelect: vi.fn(),
  onRowClick: vi.fn(),
  onEdit: vi.fn(),
  onCancelEdit: vi.fn(),
  onUpdate: vi.fn(),
  onDelete: vi.fn(),
}

const renderList = (props = {}) => render(<AccountList {...defaultProps} {...props} />)

describe('AccountList', () => {
  it('renders empty state when filteredAccounts is empty', () => {
    renderList({ filteredAccounts: [] })
    expect(screen.getByText('No accounts')).toBeInTheDocument()
    expect(screen.getByText('Click "+ Add Account" to create one')).toBeInTheDocument()
  })

  it('renders table headers with column names', () => {
    renderList()
    expect(screen.getByText('Account')).toBeInTheDocument()
    expect(screen.getByText('Goal')).toBeInTheDocument()
    expect(screen.getByText('Type')).toBeInTheDocument()
    expect(screen.getByText('Owner')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
  })

  it('renders correct number of rows for filteredAccounts', () => {
    renderList()
    expect(screen.getByText('Checking Account')).toBeInTheDocument()
    expect(screen.getByText('Savings Account')).toBeInTheDocument()
    const rows = screen.getAllByRole('row')
    // 1 header row + 2 data rows
    expect(rows).toHaveLength(3)
  })

  it('shows select-all checkbox when showMultiSelect is true', () => {
    renderList({ showMultiSelect: true })
    const checkboxes = screen.getAllByRole('checkbox')
    // select-all + 2 row checkboxes
    expect(checkboxes.length).toBeGreaterThanOrEqual(1)
    expect(checkboxes[0]).toBeInTheDocument()
  })

  it('calls onEdit when AccountRow edit button is clicked', () => {
    const onEdit = vi.fn()
    renderList({ onEdit })
    const editButtons = screen.getAllByTitle('Edit')
    fireEvent.click(editButtons[0])
    expect(onEdit).toHaveBeenCalledWith(1)
  })
})
