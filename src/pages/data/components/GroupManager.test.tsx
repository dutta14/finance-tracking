import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GroupManager from './GroupManager'
import { Account } from '../types'

const bankingAccount: Account = {
  id: 1,
  name: 'Checking',
  goalType: 'fi',
  type: 'retirement',
  nature: 'asset',
  allocation: 'cash',
  owner: 'primary',
  status: 'active',
  group: 'Banking',
  institution: 'Chase',
}

const investAccount: Account = {
  id: 2,
  name: 'Brokerage',
  goalType: 'gw',
  type: 'liquid',
  nature: 'asset',
  allocation: 'us-stock',
  owner: 'primary',
  status: 'active',
  group: 'Investments',
  institution: 'Fidelity',
}

const defaultProps = {
  accounts: [bankingAccount, investAccount],
  existingGroups: ['Banking', 'Investments'],
  dragAccountId: null,
  dropTarget: null,
  onSetDragAccountId: vi.fn(),
  onSetDropTarget: vi.fn(),
  onUpdate: vi.fn(),
  onRenameGroup: vi.fn(),
}

const renderGroup = (props = {}) => render(<GroupManager {...defaultProps} {...props} />)

describe('GroupManager', () => {
  it('renders group cards for each existing group', () => {
    renderGroup()
    expect(screen.getByText('Banking')).toBeInTheDocument()
    expect(screen.getByText('Investments')).toBeInTheDocument()
  })

  it('renders member names within group cards', () => {
    renderGroup()
    expect(screen.getByText('Checking')).toBeInTheDocument()
    expect(screen.getByText('Brokerage')).toBeInTheDocument()
  })

  it('shows "+ New Group" button', () => {
    renderGroup()
    expect(screen.getByText('+ New Group')).toBeInTheDocument()
  })

  it('shows rename input when rename button clicked', () => {
    renderGroup()
    const renameButtons = screen.getAllByTitle('Rename group')
    fireEvent.click(renameButtons[0])
    expect(screen.getByDisplayValue('Banking')).toBeInTheDocument()
  })

  it('calls onRenameGroup on Enter in rename input', () => {
    const onRenameGroup = vi.fn()
    renderGroup({ onRenameGroup })
    const renameButtons = screen.getAllByTitle('Rename group')
    fireEvent.click(renameButtons[0])
    const input = screen.getByDisplayValue('Banking')
    fireEvent.change(input, { target: { value: 'Bank Accounts' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onRenameGroup).toHaveBeenCalledWith('Banking', 'Bank Accounts')
  })
})
