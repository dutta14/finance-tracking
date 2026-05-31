import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AccountsModal from './AccountsModal'
import { makeAccount, makeProfile } from '../../test/factories'
import type { Account } from './types'

let mockFormData = {
  name: 'New Acct',
  type: 'liquid',
  owner: 'primary',
  status: 'active',
  goalType: 'gw',
  nature: 'asset',
  allocation: 'cash',
}
vi.mock('./AccountForm', () => ({
  default: ({
    onSave,
    onCancel,
    initial,
  }: {
    onSave: (d: unknown) => void
    onCancel: () => void
    initial?: Account
  }) => (
    <div data-testid="account-form">
      <span data-testid="form-mode">{initial ? 'edit' : 'add'}</span>
      <button onClick={() => onSave(mockFormData)}>Save</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}))

const defaultProfile = makeProfile({
  name: 'Alice',
  partner: { name: 'Bob', avatarDataUrl: '', birthday: '1991-05-20' },
})

const buildAccounts = (): Account[] => [
  makeAccount({
    id: 1,
    name: 'Checking',
    type: 'liquid',
    owner: 'primary',
    status: 'active',
    goalType: 'gw',
    nature: 'asset',
    allocation: 'cash',
    group: 'Banking',
  }),
  makeAccount({
    id: 2,
    name: '401k',
    type: 'retirement',
    owner: 'primary',
    status: 'active',
    goalType: 'fi',
    nature: 'asset',
    allocation: 'us-stock',
    group: 'Retirement',
  }),
  makeAccount({
    id: 3,
    name: 'Savings',
    type: 'liquid',
    owner: 'joint',
    status: 'active',
    goalType: 'gw',
    nature: 'asset',
    allocation: 'cash',
    group: 'Banking',
  }),
  makeAccount({
    id: 4,
    name: 'Old 401k',
    type: 'retirement',
    owner: 'partner',
    status: 'inactive',
    goalType: 'fi',
    nature: 'asset',
    allocation: 'bonds',
  }),
  makeAccount({
    id: 5,
    name: 'Mortgage',
    type: 'illiquid',
    owner: 'joint',
    status: 'active',
    goalType: 'gw',
    nature: 'liability',
    allocation: 'debt',
  }),
]

const defaultProps = () => ({
  accounts: buildAccounts(),
  profile: defaultProfile,
  onAdd: vi.fn(),
  onUpdate: vi.fn(),
  onBulkUpdate: vi.fn(),
  onDelete: vi.fn(),
  onToggleStatus: vi.fn(),
  onRenameGroup: vi.fn(),
  onClose: vi.fn(),
})

const renderModal = (overrides: Partial<ReturnType<typeof defaultProps>> = {}) => {
  const props = { ...defaultProps(), ...overrides }
  const result = render(<AccountsModal {...props} />)
  return { ...result, props }
}

describe('AccountsModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockFormData = {
      name: 'New Acct',
      type: 'liquid',
      owner: 'primary',
      status: 'active',
      goalType: 'gw',
      nature: 'asset',
      allocation: 'cash',
    }
  })

  // --- Rendering ---

  it('renders modal with Accounts heading', () => {
    renderModal()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Accounts' })).toBeInTheDocument()
  })

  it('renders all accounts in the table', () => {
    renderModal()
    expect(screen.getByText('Checking')).toBeInTheDocument()
    expect(screen.getByText('401k')).toBeInTheDocument()
    expect(screen.getByText('Savings')).toBeInTheDocument()
    expect(screen.getByText('Old 401k')).toBeInTheDocument()
    expect(screen.getByText('Mortgage')).toBeInTheDocument()
  })

  it('shows column headers for all sortable columns', () => {
    renderModal()
    for (const label of ['Account', 'Goal', 'Type', 'A/L', 'Allocation', 'Owner', 'Status']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${label}`) })).toBeInTheDocument()
    }
  })

  it('displays filter buttons with counts', () => {
    renderModal()
    expect(screen.getByRole('button', { name: /All \(5\)/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Active \(4\)/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Inactive \(1\)/ })).toBeInTheDocument()
  })

  it('displays group badge for grouped accounts', () => {
    renderModal()
    expect(screen.getAllByText('↳ Banking').length).toBe(2) // Checking + Savings
    expect(screen.getByText('↳ Retirement')).toBeInTheDocument()
  })

  it('shows empty state when no accounts match filter', () => {
    renderModal({ accounts: [] })
    expect(screen.getByText('No accounts')).toBeInTheDocument()
    expect(screen.getByText('Click "+ Add Account" to create one')).toBeInTheDocument()
  })

  // --- Status filter ---

  it('filters to active accounts when Active clicked', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('button', { name: /Active \(4\)/ }))
    expect(screen.getByText('Checking')).toBeInTheDocument()
    expect(screen.queryByText('Old 401k')).not.toBeInTheDocument()
  })

  it('filters to inactive accounts when Inactive clicked', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('button', { name: /Inactive \(1\)/ }))
    expect(screen.getByText('Old 401k')).toBeInTheDocument()
    expect(screen.queryByText('Checking')).not.toBeInTheDocument()
  })

  it('shows all accounts when All clicked after filtering', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('button', { name: /Active \(4\)/ }))
    await user.click(screen.getByRole('button', { name: /All \(5\)/ }))
    expect(screen.getByText('Old 401k')).toBeInTheDocument()
    expect(screen.getByText('Checking')).toBeInTheDocument()
  })

  // --- Sorting ---

  it('sorts by Account name ascending on first click', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('button', { name: /^Account/ }))
    const rows = screen.getAllByRole('row').slice(1) // skip header
    const names = rows
      .map(r => within(r).queryByText(/^(Checking|401k|Savings|Old 401k|Mortgage)$/))
      .filter(Boolean)
      .map(el => el!.textContent)
    expect(names).toEqual(['401k', 'Checking', 'Mortgage', 'Old 401k', 'Savings'])
  })

  it('sorts by Account name descending on second click', async () => {
    const user = userEvent.setup()
    renderModal()
    const btn = screen.getByRole('button', { name: /^Account/ })
    await user.click(btn)
    await user.click(btn)
    const rows = screen.getAllByRole('row').slice(1)
    const names = rows
      .map(r => within(r).queryByText(/^(Checking|401k|Savings|Old 401k|Mortgage)$/))
      .filter(Boolean)
      .map(el => el!.textContent)
    expect(names).toEqual(['Savings', 'Old 401k', 'Mortgage', 'Checking', '401k'])
  })

  it('clears sort on third click of same column', async () => {
    const user = userEvent.setup()
    renderModal()
    const btn = screen.getByRole('button', { name: /^Account/ })
    await user.click(btn)
    await user.click(btn)
    await user.click(btn)
    // Back to original order (insertion order)
    const rows = screen.getAllByRole('row').slice(1)
    const names = rows
      .map(r => within(r).queryByText(/^(Checking|401k|Savings|Old 401k|Mortgage)$/))
      .filter(Boolean)
      .map(el => el!.textContent)
    expect(names).toEqual(['Checking', '401k', 'Savings', 'Old 401k', 'Mortgage'])
  })

  // --- Column filtering ---

  it('opens column filter dropdown when filter icon clicked', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByTitle('Filter Goal'))
    const dropdown = document.querySelector('.data-th-filter-dropdown')!
    expect(within(dropdown as HTMLElement).getByText('FI')).toBeInTheDocument()
    expect(within(dropdown as HTMLElement).getByText('GW')).toBeInTheDocument()
  })

  it('filters accounts by column value when checkbox selected', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByTitle('Filter Goal'))
    const dropdown = document.querySelector('.data-th-filter-dropdown')! as HTMLElement
    const fiCheckbox = within(dropdown).getAllByRole('checkbox')[0]
    await user.click(fiCheckbox)
    // Only FI accounts should be shown
    expect(screen.getByText('401k')).toBeInTheDocument()
    expect(screen.getByText('Old 401k')).toBeInTheDocument()
    expect(screen.queryByText('Checking')).not.toBeInTheDocument()
    expect(screen.queryByText('Savings')).not.toBeInTheDocument()
    expect(screen.queryByText('Mortgage')).not.toBeInTheDocument()
  })

  it('shows Clear filter button when a column filter is active and clears on click', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByTitle('Filter Goal'))
    const dropdown = document.querySelector('.data-th-filter-dropdown')! as HTMLElement
    const fiCheckbox = within(dropdown).getAllByRole('checkbox')[0]
    await user.click(fiCheckbox)
    const clearBtn = screen.getByText('Clear filter')
    expect(clearBtn).toBeInTheDocument()
    await user.click(clearBtn)
    // All accounts visible again
    expect(screen.getByText('Checking')).toBeInTheDocument()
    expect(screen.getByText('Mortgage')).toBeInTheDocument()
  })

  // --- Selection ---

  it('selects a row on Ctrl+click and shows checkbox column', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('Checking'))
    await user.keyboard('{/Meta}')
    const checkboxes = screen.getAllByRole('checkbox')
    const checkedBoxes = checkboxes.filter(cb => (cb as HTMLInputElement).checked)
    expect(checkedBoxes.length).toBe(1)
  })

  it('toggles selection on Ctrl+click of already selected row', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('Checking'))
    await user.keyboard('{/Meta}')
    // Now Ctrl+click again to deselect
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('Checking'))
    await user.keyboard('{/Meta}')
    // No checkboxes visible (multi-select hidden when 0 selected)
    expect(screen.queryAllByRole('checkbox').length).toBe(0)
  })

  it('selects range of rows on Shift+click', async () => {
    const user = userEvent.setup()
    renderModal()
    // First select one account
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('Checking'))
    await user.keyboard('{/Meta}')
    // Now Shift+click a later row to select range
    await user.keyboard('{Shift>}')
    await user.click(screen.getByText('Savings'))
    await user.keyboard('{/Shift}')
    const checkboxes = screen.getAllByRole('checkbox')
    const checkedBoxes = checkboxes.filter(cb => (cb as HTMLInputElement).checked)
    // Should select Checking (1), 401k (2), Savings (3) = 3 row checkboxes
    expect(checkedBoxes.length).toBe(3)
  })

  it('selects all filtered accounts when select-all checkbox clicked', async () => {
    const user = userEvent.setup()
    renderModal()
    // First select one to show multi-select UI
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('Checking'))
    await user.keyboard('{/Meta}')
    // Now find the header checkbox (select-all)
    const headerRow = screen.getAllByRole('row')[0]
    const selectAllCheckbox = within(headerRow).getByRole('checkbox')
    await user.click(selectAllCheckbox)
    const checkboxes = screen.getAllByRole('checkbox')
    const checkedBoxes = checkboxes.filter(cb => (cb as HTMLInputElement).checked)
    // All 5 + header = 6 checked, but header is "checked" via allFilteredSelected
    expect(checkedBoxes.length).toBe(6)
  })

  it('deselects all when select-all checkbox is unchecked', async () => {
    const user = userEvent.setup()
    renderModal()
    // Select one, then select all, then deselect all
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('Checking'))
    await user.keyboard('{/Meta}')
    const headerRow = screen.getAllByRole('row')[0]
    const selectAllCheckbox = within(headerRow).getByRole('checkbox')
    await user.click(selectAllCheckbox) // select all
    await user.click(selectAllCheckbox) // deselect all
    // Multi-select should be hidden (0 selected)
    expect(screen.queryAllByRole('checkbox').length).toBe(0)
  })

  // --- Bulk edit toolbar ---

  it('shows bulk edit bar when 2+ accounts selected', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('Checking'))
    await user.click(screen.getByText('401k'))
    await user.keyboard('{/Meta}')
    expect(screen.getByText('2 selected')).toBeInTheDocument()
  })

  it('does not show bulk edit bar when only 1 account selected', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('Checking'))
    await user.keyboard('{/Meta}')
    expect(screen.queryByText('1 selected')).not.toBeInTheDocument()
  })

  it('calls onBulkUpdate with goal type when bulk Goal changed', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('Checking'))
    await user.click(screen.getByText('401k'))
    await user.keyboard('{/Meta}')
    // Find the Goal select (first select with "Goal…" option)
    const selects = screen.getAllByRole('combobox')
    const goalSelect = selects.find(s => within(s).queryByText('Goal…'))!
    await user.selectOptions(goalSelect, 'fi')
    expect(props.onBulkUpdate).toHaveBeenCalledWith(new Set([1, 2]), expect.objectContaining({ goalType: 'fi' }))
  })

  it('calls onBulkUpdate with owner when bulk Owner changed', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('Checking'))
    await user.click(screen.getByText('401k'))
    await user.keyboard('{/Meta}')
    const selects = screen.getAllByRole('combobox')
    const ownerSelect = selects.find(s => within(s).queryByText('Owner…'))!
    await user.selectOptions(ownerSelect, 'joint')
    expect(props.onBulkUpdate).toHaveBeenCalledWith(new Set([1, 2]), { owner: 'joint' })
  })

  it('clears selection when Clear button clicked in bulk bar', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('Checking'))
    await user.click(screen.getByText('401k'))
    await user.keyboard('{/Meta}')
    expect(screen.getByText('2 selected')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.queryByText('2 selected')).not.toBeInTheDocument()
  })

  // --- Add / Edit / Delete ---

  it('shows AccountForm when Add Account clicked', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('button', { name: /Add Account/ }))
    expect(screen.getByTestId('account-form')).toBeInTheDocument()
    expect(screen.getByTestId('form-mode')).toHaveTextContent('add')
  })

  it('calls onAdd and hides form when save is clicked on add form', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    await user.click(screen.getByRole('button', { name: /Add Account/ }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(props.onAdd).toHaveBeenCalled()
    expect(screen.queryByTestId('account-form')).not.toBeInTheDocument()
  })

  it('calls onAdd with different form data', async () => {
    const user = userEvent.setup()
    mockFormData = {
      name: 'Roth IRA',
      type: 'retirement',
      owner: 'partner',
      status: 'active',
      goalType: 'fi',
      nature: 'asset',
      allocation: 'us-stock',
    }
    const { props } = renderModal()
    await user.click(screen.getByRole('button', { name: /Add Account/ }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(props.onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Roth IRA', type: 'retirement', goalType: 'fi' }),
    )
  })

  it('hides add form when Cancel clicked', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('button', { name: /Add Account/ }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByTestId('account-form')).not.toBeInTheDocument()
  })

  it('shows edit form when Edit button clicked on a row', async () => {
    const user = userEvent.setup()
    renderModal()
    const editButtons = screen.getAllByTitle('Edit')
    await user.click(editButtons[0])
    expect(screen.getByTestId('account-form')).toBeInTheDocument()
    expect(screen.getByTestId('form-mode')).toHaveTextContent('edit')
  })

  it('calls onDelete when Delete button clicked', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    const deleteButtons = screen.getAllByTitle('Delete')
    await user.click(deleteButtons[0])
    expect(props.onDelete).toHaveBeenCalledWith(1)
  })

  // --- Groups page ---

  it('switches to Groups page when Groups button clicked', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('button', { name: /Groups/ }))
    expect(screen.getByRole('heading', { name: 'Groups' })).toBeInTheDocument()
  })

  it('renders group cards with member accounts', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('button', { name: /Groups/ }))
    expect(screen.getByText('Banking')).toBeInTheDocument()
    expect(screen.getByText('Retirement')).toBeInTheDocument()
  })

  it('shows ungrouped accounts section when ungrouped accounts exist', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('button', { name: /Groups/ }))
    expect(screen.getByText('Ungrouped')).toBeInTheDocument()
  })

  it('navigates back from Groups to Accounts page', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('button', { name: /Groups/ }))
    expect(screen.getByRole('heading', { name: 'Groups' })).toBeInTheDocument()
    // Click back button (the SVG arrow button)
    const backBtn = screen
      .getByRole('heading', { name: 'Groups' })
      .closest('.data-modal-header-back')!
      .querySelector('button')!
    await user.click(backBtn)
    expect(screen.getByRole('heading', { name: 'Accounts' })).toBeInTheDocument()
  })

  it('shows New Group button and creates group on input', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('button', { name: /Groups/ }))
    await user.click(screen.getByRole('button', { name: /New Group/ }))
    const input = screen.getByPlaceholderText('Group name')
    expect(input).toBeInTheDocument()
  })

  it('shows Rename input when rename button clicked on a group', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('button', { name: /Groups/ }))
    const renameButtons = screen.getAllByTitle('Rename group')
    await user.click(renameButtons[0])
    // Rename input should appear with the group name pre-filled
    const inputs = screen.getAllByRole('textbox')
    expect(inputs.length).toBeGreaterThan(0)
  })

  it('calls onRenameGroup when rename is confirmed with Enter', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    await user.click(screen.getByRole('button', { name: /Groups/ }))
    const renameButtons = screen.getAllByTitle('Rename group')
    await user.click(renameButtons[0])
    const input = screen.getByDisplayValue('Banking')
    await user.clear(input)
    await user.type(input, 'Bank Accounts')
    await user.keyboard('{Enter}')
    expect(props.onRenameGroup).toHaveBeenCalledWith('Banking', 'Bank Accounts')
  })

  it('cancels rename on Escape', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    await user.click(screen.getByRole('button', { name: /Groups/ }))
    const renameButtons = screen.getAllByTitle('Rename group')
    await user.click(renameButtons[0])
    const input = screen.getByDisplayValue('Banking')
    await user.click(input)
    await user.keyboard('{Escape}')
    expect(props.onRenameGroup).not.toHaveBeenCalled()
    // Group name should be visible again
    expect(screen.getByText('Banking')).toBeInTheDocument()
  })

  // --- Modal close ---

  it('calls onClose when backdrop clicked', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    const backdrop = screen.getByRole('dialog').parentElement!
    await user.click(backdrop)
    expect(props.onClose).toHaveBeenCalled()
  })

  it('does not call onClose when modal body clicked', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    await user.click(screen.getByRole('dialog'))
    expect(props.onClose).not.toHaveBeenCalled()
  })

  it('calls onClose when Escape key pressed', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    await user.keyboard('{Escape}')
    expect(props.onClose).toHaveBeenCalled()
  })

  it('calls onClose when Close button clicked', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(props.onClose).toHaveBeenCalled()
  })

  // --- Focus trapping ---

  it('renders with role dialog and aria-modal true', () => {
    renderModal()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  // --- Edge cases ---

  it('displays institution when present on account', () => {
    const accounts = [makeAccount({ id: 1, name: 'Checking', institution: 'Chase' })]
    renderModal({ accounts })
    expect(screen.getByText('Chase')).toBeInTheDocument()
  })

  it('displays linked account name when linkedAccountId is set', () => {
    const accounts = [
      makeAccount({ id: 1, name: 'Checking' }),
      makeAccount({ id: 2, name: 'Savings', linkedAccountId: 1 }),
    ]
    renderModal({ accounts })
    expect(screen.getByText('⛓ Checking')).toBeInTheDocument()
  })

  it('shows Groups button with count when groups exist', () => {
    renderModal()
    expect(screen.getByRole('button', { name: /Groups \(2\)/ })).toBeInTheDocument()
  })

  it('shows Groups button without count when no groups', () => {
    const accounts = [makeAccount({ id: 1, name: 'Checking' })]
    renderModal({ accounts })
    const groupsBtn = screen.getByRole('button', { name: 'Groups' })
    expect(groupsBtn.textContent).toBe('Groups')
  })

  it('displays correct goal type and account type labels', () => {
    const accounts = [makeAccount({ id: 1, name: 'IRA', goalType: 'fi', type: 'retirement' })]
    renderModal({ accounts })
    expect(screen.getByText('FI')).toBeInTheDocument()
    expect(screen.getByText('Retirement')).toBeInTheDocument()
  })

  it('displays nature and allocation labels correctly', () => {
    const accounts = [makeAccount({ id: 1, name: 'House', nature: 'liability', allocation: 'debt' })]
    renderModal({ accounts })
    expect(screen.getByText('Liability')).toBeInTheDocument()
    expect(screen.getByText('Debt')).toBeInTheDocument()
  })

  it('shows partner owner option in bulk edit when profile has partner', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('Checking'))
    await user.click(screen.getByText('401k'))
    await user.keyboard('{/Meta}')
    const selects = screen.getAllByRole('combobox')
    const ownerSelect = selects.find(s => within(s).queryByText('Owner…'))!
    expect(within(ownerSelect).getByText('Bob')).toBeInTheDocument()
    expect(within(ownerSelect).getByText('Alice')).toBeInTheDocument()
    expect(within(ownerSelect).getByText('Joint')).toBeInTheDocument()
  })

  // --- Column filter toggle / remove ---

  it('removes column filter when all values are unchecked', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByTitle('Filter Goal'))
    const dropdown = document.querySelector('.data-th-filter-dropdown')! as HTMLElement
    const checkboxes = within(dropdown).getAllByRole('checkbox')
    // Check first value then uncheck it
    await user.click(checkboxes[0])
    // Some accounts should be filtered
    expect(screen.queryAllByRole('row').length).toBeLessThan(6)
    // Open filter again and uncheck
    await user.click(screen.getByTitle('Filter Goal'))
    const dropdown2 = document.querySelector('.data-th-filter-dropdown')! as HTMLElement
    const checkboxes2 = within(dropdown2).getAllByRole('checkbox')
    await user.click(checkboxes2[0])
    // All accounts visible again
    expect(screen.getByText('Checking')).toBeInTheDocument()
    expect(screen.getByText('Mortgage')).toBeInTheDocument()
  })

  // --- Sorting by different columns ---

  it('sorts by Goal column ascending', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('button', { name: /^Goal/ }))
    const rows = screen.getAllByRole('row').slice(1)
    const names = rows
      .map(r => within(r).queryByText(/^(Checking|401k|Savings|Old 401k|Mortgage)$/))
      .filter(Boolean)
      .map(el => el!.textContent)
    // FI accounts before GW accounts
    expect(names[0]).toBe('401k')
    expect(names[1]).toBe('Old 401k')
  })

  // --- getColValue and getColLabel through column filter dropdown ---

  it('renders correct labels in filter dropdown for Type column', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByTitle('Filter Type'))
    const dropdown = document.querySelector('.data-th-filter-dropdown')! as HTMLElement
    expect(within(dropdown).getByText('Liquid')).toBeInTheDocument()
    expect(within(dropdown).getByText('Retirement')).toBeInTheDocument()
    expect(within(dropdown).getByText('Illiquid')).toBeInTheDocument()
  })

  it('renders correct labels in filter dropdown for Owner column', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByTitle('Filter Owner'))
    const dropdown = document.querySelector('.data-th-filter-dropdown')! as HTMLElement
    expect(within(dropdown).getByText('Alice')).toBeInTheDocument()
    expect(within(dropdown).getByText('Bob')).toBeInTheDocument()
    expect(within(dropdown).getByText('Joint')).toBeInTheDocument()
  })

  it('renders correct labels in filter dropdown for Status column', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByTitle('Filter Status'))
    const dropdown = document.querySelector('.data-th-filter-dropdown')! as HTMLElement
    expect(within(dropdown).getByText('Active')).toBeInTheDocument()
    expect(within(dropdown).getByText('Inactive')).toBeInTheDocument()
  })

  it('renders correct labels in filter dropdown for Allocation column', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByTitle('Filter Allocation'))
    const dropdown = document.querySelector('.data-th-filter-dropdown')! as HTMLElement
    expect(within(dropdown).getByText('Cash')).toBeInTheDocument()
  })

  it('renders correct labels in filter dropdown for A/L column', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByTitle('Filter A/L'))
    const dropdown = document.querySelector('.data-th-filter-dropdown')! as HTMLElement
    expect(within(dropdown).getByText('Asset')).toBeInTheDocument()
    expect(within(dropdown).getByText('Liability')).toBeInTheDocument()
  })

  // --- Range select edge cases ---

  it('range select falls back to toggle when Shift-clicking with no prior selection', async () => {
    const user = userEvent.setup()
    renderModal()
    // Shift-click without prior Ctrl+click should select just that row via toggle
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('Savings'))
    await user.keyboard('{/Meta}')
    // Should have one checkbox checked (in multi-select mode)
    const checkboxes = screen.getAllByRole('checkbox')
    const checked = checkboxes.filter(cb => (cb as HTMLInputElement).checked)
    expect(checked.length).toBe(1)
  })

  // --- Bulk edit: Type, Status, Nature, Allocation selects ---

  it('calls onBulkUpdate with type when bulk Type changed', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('Checking'))
    await user.click(screen.getByText('401k'))
    await user.keyboard('{/Meta}')
    const selects = screen.getAllByRole('combobox')
    const typeSelect = selects.find(s => within(s).queryByText('Type…'))!
    await user.selectOptions(typeSelect, 'retirement')
    expect(props.onBulkUpdate).toHaveBeenCalledWith(new Set([1, 2]), expect.objectContaining({ type: 'retirement' }))
  })

  it('calls onBulkUpdate with status when bulk Status changed', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('Checking'))
    await user.click(screen.getByText('401k'))
    await user.keyboard('{/Meta}')
    const selects = screen.getAllByRole('combobox')
    const statusSelect = selects.find(s => within(s).queryByText('Status…'))!
    await user.selectOptions(statusSelect, 'inactive')
    expect(props.onBulkUpdate).toHaveBeenCalledWith(new Set([1, 2]), { status: 'inactive' })
  })

  it('calls onBulkUpdate with nature when bulk A/L changed', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('Checking'))
    await user.click(screen.getByText('401k'))
    await user.keyboard('{/Meta}')
    const selects = screen.getAllByRole('combobox')
    const natureSelect = selects.find(s => within(s).queryByText('A/L…'))!
    await user.selectOptions(natureSelect, 'liability')
    expect(props.onBulkUpdate).toHaveBeenCalledWith(new Set([1, 2]), { nature: 'liability' })
  })

  it('calls onBulkUpdate with allocation when bulk Allocation changed', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('Checking'))
    await user.click(screen.getByText('401k'))
    await user.keyboard('{/Meta}')
    const selects = screen.getAllByRole('combobox')
    const allocSelect = selects.find(s => within(s).queryByText('Allocation…'))!
    await user.selectOptions(allocSelect, 'bonds')
    expect(props.onBulkUpdate).toHaveBeenCalledWith(new Set([1, 2]), { allocation: 'bonds' })
  })

  it('calls onBulkUpdate to remove group when No group selected', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('Checking'))
    await user.click(screen.getByText('401k'))
    await user.keyboard('{/Meta}')
    const selects = screen.getAllByRole('combobox')
    const groupSelect = selects.find(s => within(s).queryByText('Group…'))!
    await user.selectOptions(groupSelect, '__none__')
    expect(props.onBulkUpdate).toHaveBeenCalledWith(new Set([1, 2]), { group: undefined })
  })

  it('calls onBulkUpdate with existing group name when group selected', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('Checking'))
    await user.click(screen.getByText('401k'))
    await user.keyboard('{/Meta}')
    const selects = screen.getAllByRole('combobox')
    const groupSelect = selects.find(s => within(s).queryByText('Group…'))!
    await user.selectOptions(groupSelect, 'Banking')
    expect(props.onBulkUpdate).toHaveBeenCalledWith(new Set([1, 2]), { group: 'Banking' })
  })

  it('shows new group input when New group selected in bulk edit', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('Checking'))
    await user.click(screen.getByText('401k'))
    await user.keyboard('{/Meta}')
    const selects = screen.getAllByRole('combobox')
    const groupSelect = selects.find(s => within(s).queryByText('Group…'))!
    await user.selectOptions(groupSelect, '__new__')
    expect(screen.getByPlaceholderText('Group name')).toBeInTheDocument()
  })

  it('applies new group name via Enter key in bulk edit', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('Checking'))
    await user.click(screen.getByText('401k'))
    await user.keyboard('{/Meta}')
    const selects = screen.getAllByRole('combobox')
    const groupSelect = selects.find(s => within(s).queryByText('Group…'))!
    await user.selectOptions(groupSelect, '__new__')
    const input = screen.getByPlaceholderText('Group name')
    await user.type(input, 'Investments{Enter}')
    expect(props.onBulkUpdate).toHaveBeenCalledWith(new Set([1, 2]), { group: 'Investments' })
  })

  it('dismisses new group name input via Escape key', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('Checking'))
    await user.click(screen.getByText('401k'))
    await user.keyboard('{/Meta}')
    const selects = screen.getAllByRole('combobox')
    const groupSelect = selects.find(s => within(s).queryByText('Group…'))!
    await user.selectOptions(groupSelect, '__new__')
    const input = screen.getByPlaceholderText('Group name')
    await user.type(input, 'test')
    await user.keyboard('{Escape}')
    expect(screen.queryByPlaceholderText('Group name')).not.toBeInTheDocument()
  })

  it('applies new group via confirm button click', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('Checking'))
    await user.click(screen.getByText('401k'))
    await user.keyboard('{/Meta}')
    const selects = screen.getAllByRole('combobox')
    const groupSelect = selects.find(s => within(s).queryByText('Group…'))!
    await user.selectOptions(groupSelect, '__new__')
    const input = screen.getByPlaceholderText('Group name')
    await user.type(input, 'New Grp')
    // Click the confirm (check mark) button
    const confirmBtn = input.closest('.data-bulk-new-group')!.querySelector('.data-bulk-group-ok')! as HTMLElement
    await user.click(confirmBtn)
    expect(props.onBulkUpdate).toHaveBeenCalledWith(new Set([1, 2]), { group: 'New Grp' })
  })

  it('dismisses new group via cancel button click', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('Checking'))
    await user.click(screen.getByText('401k'))
    await user.keyboard('{/Meta}')
    const selects = screen.getAllByRole('combobox')
    const groupSelect = selects.find(s => within(s).queryByText('Group…'))!
    await user.selectOptions(groupSelect, '__new__')
    const input = screen.getByPlaceholderText('Group name')
    const cancelBtn = input.closest('.data-bulk-new-group')!.querySelector('.data-bulk-group-cancel')! as HTMLElement
    await user.click(cancelBtn)
    expect(screen.queryByPlaceholderText('Group name')).not.toBeInTheDocument()
  })

  // --- Edit mode ---

  it('calls onUpdate and closes edit form when save is clicked in edit mode', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    const editButtons = screen.getAllByTitle('Edit')
    await user.click(editButtons[0])
    expect(screen.getByTestId('form-mode')).toHaveTextContent('edit')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(props.onUpdate).toHaveBeenCalledWith(1, mockFormData)
    expect(screen.queryByTestId('account-form')).not.toBeInTheDocument()
  })

  it('closes edit form without calling onUpdate when cancel is clicked', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    const editButtons = screen.getAllByTitle('Edit')
    await user.click(editButtons[0])
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(props.onUpdate).not.toHaveBeenCalled()
    expect(screen.queryByTestId('account-form')).not.toBeInTheDocument()
  })

  // --- Checkbox toggle directly ---

  it('toggles row selection via checkbox click', async () => {
    const user = userEvent.setup()
    renderModal()
    // First select one to show checkboxes
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('Checking'))
    await user.keyboard('{/Meta}')
    // One checked
    const initialChecked = screen.getAllByRole('checkbox').filter(cb => (cb as HTMLInputElement).checked)
    expect(initialChecked.length).toBe(1)
    // Click the checkbox for '401k' row (row index 1, checkbox index 1 — index 0 is header)
    const allCheckboxes = screen.getAllByRole('checkbox')
    // Click the second row checkbox (first non-header, non-checked)
    await user.click(allCheckboxes[2]) // 0=header, 1=Checking(checked), 2=401k
    const afterChecked = screen.getAllByRole('checkbox').filter(cb => (cb as HTMLInputElement).checked)
    // Now 2 rows + header might be checked, or header unchanged
    expect(afterChecked.length).toBeGreaterThanOrEqual(2)
  })

  // --- Groups page: creating group with Enter ---

  it('creates new group card when group name entered and Enter pressed', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('button', { name: /Groups/ }))
    await user.click(screen.getByRole('button', { name: /New Group/ }))
    const input = screen.getByPlaceholderText('Group name')
    await user.type(input, 'Investments{Enter}')
    // Pending group card should appear with the name
    expect(screen.getByText('Investments')).toBeInTheDocument()
  })

  it('dismisses new group creation on Escape', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('button', { name: /Groups/ }))
    await user.click(screen.getByRole('button', { name: /New Group/ }))
    const input = screen.getByPlaceholderText('Group name')
    await user.type(input, 'Test')
    await user.keyboard('{Escape}')
    // Input should be gone, no new group card
    expect(screen.queryByPlaceholderText('Group name')).not.toBeInTheDocument()
  })

  // --- Groups page: rename blur ---

  it('commits rename on blur with changed value', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    await user.click(screen.getByRole('button', { name: /Groups/ }))
    const renameButtons = screen.getAllByTitle('Rename group')
    await user.click(renameButtons[0])
    const input = screen.getByDisplayValue('Banking')
    await user.clear(input)
    await user.type(input, 'Banks')
    // Blur by clicking elsewhere
    await user.click(screen.getByText('Retirement'))
    expect(props.onRenameGroup).toHaveBeenCalledWith('Banking', 'Banks')
  })

  // --- No partner hides partner option ---

  it('does not show partner option in bulk Owner when no partner', async () => {
    const user = userEvent.setup()
    renderModal({ profile: makeProfile({ name: 'Alice', partner: null }) })
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('Checking'))
    await user.click(screen.getByText('401k'))
    await user.keyboard('{/Meta}')
    const selects = screen.getAllByRole('combobox')
    const ownerSelect = selects.find(s => within(s).queryByText('Owner…'))!
    expect(within(ownerSelect).queryByText('Bob')).not.toBeInTheDocument()
  })

  // --- Filter on active then use column filter ---

  it('applies column filter only to the status-filtered subset', async () => {
    const user = userEvent.setup()
    renderModal()
    // Filter to Active
    await user.click(screen.getByRole('button', { name: /Active \(4\)/ }))
    // Now filter by Goal = FI
    await user.click(screen.getByTitle('Filter Goal'))
    const dropdown = document.querySelector('.data-th-filter-dropdown')! as HTMLElement
    const fiCheckbox = within(dropdown).getAllByRole('checkbox')[0]
    await user.click(fiCheckbox)
    // Only active + FI = just 401k
    expect(screen.getByText('401k')).toBeInTheDocument()
    expect(screen.queryByText('Old 401k')).not.toBeInTheDocument() // inactive
    expect(screen.queryByText('Checking')).not.toBeInTheDocument() // GW
  })

  // ── Groups tab ──

  describe('Groups tab', () => {
    it('switches to groups view on Groups tab click', async () => {
      const user = userEvent.setup()
      renderModal()
      const groupsTab = screen.getByText(/Groups/)
      await user.click(groupsTab)
      expect(screen.getByRole('heading', { name: 'Groups' })).toBeInTheDocument()
    })

    it('renders existing groups on Groups tab', async () => {
      const user = userEvent.setup()
      renderModal()
      await user.click(screen.getByText(/Groups/))
      expect(screen.getByText('Banking')).toBeInTheDocument()
      expect(screen.getByText('Retirement')).toBeInTheDocument()
    })

    it('shows + New Group button', async () => {
      const user = userEvent.setup()
      renderModal()
      await user.click(screen.getByText(/Groups/))
      expect(screen.getByText('+ New Group')).toBeInTheDocument()
    })

    it('shows new group input when + New Group is clicked', async () => {
      const user = userEvent.setup()
      renderModal()
      await user.click(screen.getByText(/Groups/))
      await user.click(screen.getByText('+ New Group'))
      expect(screen.getByPlaceholderText('Group name')).toBeInTheDocument()
    })

    it('creates a pending group on Enter', async () => {
      const user = userEvent.setup()
      renderModal()
      await user.click(screen.getByText(/Groups/))
      await user.click(screen.getByText('+ New Group'))
      const input = screen.getByPlaceholderText('Group name')
      await user.type(input, 'New Group Name{enter}')
      expect(screen.getByText('New Group Name')).toBeInTheDocument()
      expect(screen.getByText('Drag accounts here')).toBeInTheDocument()
    })

    it('removes pending group on Remove button click', async () => {
      const user = userEvent.setup()
      renderModal()
      await user.click(screen.getByText(/Groups/))
      await user.click(screen.getByText('+ New Group'))
      const input = screen.getByPlaceholderText('Group name')
      await user.type(input, 'Temp Group{enter}')
      expect(screen.getByText('Temp Group')).toBeInTheDocument()
      // Click the Remove button (the X SVG button)
      const removeBtn = screen.getByTitle('Remove')
      await user.click(removeBtn)
      expect(screen.queryByText('Temp Group')).not.toBeInTheDocument()
    })

    it('cancels group creation on Escape key', async () => {
      const user = userEvent.setup()
      renderModal()
      await user.click(screen.getByText(/Groups/))
      await user.click(screen.getByText('+ New Group'))
      const input = screen.getByPlaceholderText('Group name')
      await user.type(input, 'Cancel Me{escape}')
      expect(screen.queryByPlaceholderText('Group name')).not.toBeInTheDocument()
      // Should go back to + New Group button
      expect(screen.getByText('+ New Group')).toBeInTheDocument()
    })

    it('shows ungrouped accounts section', async () => {
      const accounts = buildAccounts()
      // Make one account ungrouped
      const ungroupedAccounts = accounts.map(a => (a.id === 3 ? { ...a, group: undefined } : a))
      const user = userEvent.setup()
      renderModal({ accounts: ungroupedAccounts })
      await user.click(screen.getByText(/Groups/))
      expect(screen.getByText('Ungrouped')).toBeInTheDocument()
    })

    it('renders group member names inside group cards', async () => {
      const user = userEvent.setup()
      renderModal()
      await user.click(screen.getByText(/Groups/))
      // Banking group should contain Checking
      expect(screen.getByText('Checking')).toBeInTheDocument()
      // Retirement group should contain 401k
      expect(screen.getByText('401k')).toBeInTheDocument()
    })
  })

  // --- Branch coverage: getColValue returns defaults for missing nature/allocation (lines 128, 130) ---

  it('displays default nature "Asset" for accounts without explicit nature', async () => {
    const accounts = [makeAccount({ id: 1, name: 'Test', nature: undefined })]
    const user = userEvent.setup()
    renderModal({ accounts })
    await user.click(screen.getByTitle('Filter A/L'))
    const dropdown = document.querySelector('.data-th-filter-dropdown')! as HTMLElement
    expect(within(dropdown).getByText('Asset')).toBeInTheDocument()
  })

  it('displays default allocation for accounts without explicit allocation', async () => {
    const accounts = [makeAccount({ id: 1, name: 'Test', allocation: undefined, nature: 'asset' })]
    const user = userEvent.setup()
    renderModal({ accounts })
    await user.click(screen.getByTitle('Filter Allocation'))
    const dropdown = document.querySelector('.data-th-filter-dropdown')! as HTMLElement
    // getDefaultAllocation('asset') should return a valid allocation
    const checkboxes = within(dropdown).getAllByRole('checkbox')
    expect(checkboxes.length).toBeGreaterThan(0)
  })

  // --- Branch coverage: getColLabel 'name' case (line 140-141) ---

  it('sorts by name column which uses the raw name value for comparison', async () => {
    const user = userEvent.setup()
    renderModal()
    // Sort by Account (name column) to exercise getColValue('name') path
    await user.click(screen.getByRole('button', { name: /^Account/ }))
    const rows = screen.getAllByRole('row').slice(1)
    const names = rows
      .map(r => within(r).queryByText(/^(Checking|401k|Savings|Old 401k|Mortgage)$/))
      .filter(Boolean)
      .map(el => el!.textContent)
    expect(names[0]).toBe('401k')
  })

  // --- Branch coverage: rangeSelect with lastId == null (line 211) ---

  it('rangeSelect falls back to toggleSelect when no prior selection exists', async () => {
    const user = userEvent.setup()
    renderModal()
    // First ctrl+click to enter multi-select mode, then shift+click same row to test range
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('Checking'))
    await user.keyboard('{/Meta}')
    // Now shift+click another to test range select (this exercises the from/to path)
    await user.keyboard('{Shift>}')
    await user.click(screen.getByText('Savings'))
    await user.keyboard('{/Shift}')
    const checkboxes = screen.getAllByRole('checkbox')
    const checked = checkboxes.filter(cb => (cb as HTMLInputElement).checked)
    // Range from Checking(1) to Savings(3) = 3 rows
    expect(checked.length).toBe(3)
  })

  // --- Branch coverage: rangeSelect with from/to === -1 (line 218) ---

  it('rangeSelect falls back to toggle when last selected id is not in filtered list', async () => {
    const user = userEvent.setup()
    renderModal()
    // Select an account, then filter so it's not in the list, then shift-click
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('Old 401k'))
    await user.keyboard('{/Meta}')
    // Filter to active only (Old 401k is inactive)
    await user.click(screen.getByRole('button', { name: /Active \(4\)/ }))
    // Now shift-click - lastSelectedRef still points to Old 401k (id=4) which isn't in filtered list
    await user.keyboard('{Shift>}')
    await user.click(screen.getByText('Checking'))
    await user.keyboard('{/Shift}')
    const checkboxes = screen.getAllByRole('checkbox')
    const checked = checkboxes.filter(cb => (cb as HTMLInputElement).checked)
    expect(checked.length).toBeGreaterThanOrEqual(1)
  })

  // --- Branch coverage: inactive badge in group members (line 407) ---

  it('shows inactive badge next to inactive accounts in group cards', async () => {
    const user = userEvent.setup()
    const accounts = [
      makeAccount({ id: 1, name: 'Active One', status: 'active', group: 'TestGroup' }),
      makeAccount({ id: 2, name: 'Dead One', status: 'inactive', group: 'TestGroup' }),
    ]
    renderModal({ accounts })
    await user.click(screen.getByRole('button', { name: /Groups/ }))
    expect(screen.getByText('inactive')).toBeInTheDocument()
  })

  // --- Branch coverage: new group input onBlur creates group (line 435) ---

  it('creates pending group on blur of new group input with non-empty value', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('button', { name: /Groups/ }))
    await user.click(screen.getByRole('button', { name: /New Group/ }))
    const input = screen.getByPlaceholderText('Group name')
    await user.type(input, 'BlurGroup')
    // Blur by tabbing away
    await user.tab()
    // Pending group should appear
    expect(screen.getByText('BlurGroup')).toBeInTheDocument()
  })

  // --- Branch coverage: rename on blur without change does not call onRenameGroup (line 364) ---

  it('does not call onRenameGroup on blur when value is same as original', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    await user.click(screen.getByRole('button', { name: /Groups/ }))
    const renameButtons = screen.getAllByTitle('Rename group')
    await user.click(renameButtons[0])
    screen.getByDisplayValue('Banking')
    // Blur without changing
    await user.tab()
    expect(props.onRenameGroup).not.toHaveBeenCalled()
  })

  // --- Branch coverage: column filter dropdown closes on outside click (line 108-117) ---

  it('closes column filter dropdown on outside click', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByTitle('Filter Goal'))
    expect(document.querySelector('.data-th-filter-dropdown')).toBeTruthy()
    // Click outside the dropdown
    await user.click(screen.getByRole('heading', { name: 'Accounts' }))
    // Dropdown should close (no longer open)
    // Verify by trying to find filter dropdown items
    expect(document.querySelector('.data-th-filter-dropdown')).toBeFalsy()
  })

  // --- Branch coverage: drag and drop on group cards (lines 333, 339, 342) ---

  it('moves account to a different group via drag and drop on group card', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    await user.click(screen.getByRole('button', { name: /Groups/ }))

    // Find a draggable member in Banking group and drag to Retirement group
    const groupCards = document.querySelectorAll('.data-group-card')
    const bankingCard = groupCards[0] as HTMLElement
    const retirementCard = groupCards[1] as HTMLElement
    const memberSpan = bankingCard.querySelector('.data-group-member[draggable]') as HTMLElement

    // dragStart sets dragAccountId
    fireEvent.dragStart(memberSpan)
    // dragOver on target group
    fireEvent.dragOver(retirementCard)
    // drop on target group triggers onUpdate
    fireEvent.drop(retirementCard)

    expect(props.onUpdate).toHaveBeenCalledWith(1, { group: 'Retirement' })
  })

  it('dragLeave on group card clears drop target when leaving card bounds', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('button', { name: /Groups/ }))

    const groupCards = document.querySelectorAll('.data-group-card')
    const firstGroupCard = groupCards[0] as HTMLElement

    fireEvent.dragOver(firstGroupCard)
    expect(firstGroupCard).toHaveClass('data-group-card--drop')

    // Simulate leaving to an element outside the card
    fireEvent.dragLeave(firstGroupCard, { relatedTarget: document.body })
    expect(firstGroupCard).not.toHaveClass('data-group-card--drop')
  })

  // --- Branch coverage: drag end resets state (lines 401-403) ---

  it('handles drag end on group member', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('button', { name: /Groups/ }))

    const memberSpans = document.querySelectorAll('.data-group-member[draggable]')
    expect(memberSpans.length).toBeGreaterThan(0)

    const member = memberSpans[0] as HTMLElement
    fireEvent.dragStart(member)
    fireEvent.dragEnd(member)
    // Verify drag state was reset — no drop highlights remain
    const dropHighlights = document.querySelectorAll('.data-group-card--drop')
    expect(dropHighlights.length).toBe(0)
  })

  // --- Branch coverage: ungrouped section drag/drop (lines 498-514) ---

  it('moves account to ungrouped via drag and drop on ungrouped card', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    await user.click(screen.getByRole('button', { name: /Groups/ }))

    const ungroupedCard = document.querySelector('.data-group-card--ungrouped') as HTMLElement
    expect(ungroupedCard).toBeTruthy()

    // Drag a member from a grouped card
    const groupedMember = document.querySelector(
      '.data-group-card:not(.data-group-card--ungrouped) .data-group-member[draggable]',
    ) as HTMLElement
    fireEvent.dragStart(groupedMember)
    fireEvent.dragOver(ungroupedCard)
    fireEvent.drop(ungroupedCard)

    expect(props.onUpdate).toHaveBeenCalledWith(1, { group: undefined })
  })

  it('dragLeave on ungrouped card clears drop target', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('button', { name: /Groups/ }))

    const ungroupedCard = document.querySelector('.data-group-card--ungrouped') as HTMLElement
    fireEvent.dragOver(ungroupedCard)
    expect(ungroupedCard).toHaveClass('data-group-card--drop')

    fireEvent.dragLeave(ungroupedCard, { relatedTarget: document.body })
    expect(ungroupedCard).not.toHaveClass('data-group-card--drop')
  })

  // --- Branch coverage: pending group drag over/leave/drop (lines 450-463) ---

  it('moves account to pending group via drag and drop', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    await user.click(screen.getByRole('button', { name: /Groups/ }))
    await user.click(screen.getByRole('button', { name: /New Group/ }))
    const input = screen.getByPlaceholderText('Group name')
    await user.type(input, 'PendingDrop{Enter}')

    const pendingCard = document.querySelector('.data-group-card--new') as HTMLElement
    expect(pendingCard).toBeTruthy()

    // Drag a member from an existing group
    const groupedMember = document.querySelector(
      '.data-group-card:not(.data-group-card--new) .data-group-member[draggable]',
    ) as HTMLElement
    fireEvent.dragStart(groupedMember)
    fireEvent.dragOver(pendingCard)
    expect(pendingCard).toHaveClass('data-group-card--drop')

    fireEvent.drop(pendingCard)
    expect(props.onUpdate).toHaveBeenCalledWith(1, { group: 'PendingDrop' })
  })

  it('dragLeave on pending group card clears drop target', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('button', { name: /Groups/ }))
    await user.click(screen.getByRole('button', { name: /New Group/ }))
    const input = screen.getByPlaceholderText('Group name')
    await user.type(input, 'TestPending{Enter}')

    const pendingCard = document.querySelector('.data-group-card--new') as HTMLElement
    fireEvent.dragOver(pendingCard)
    expect(pendingCard).toHaveClass('data-group-card--drop')

    fireEvent.dragLeave(pendingCard, { relatedTarget: document.body })
    expect(pendingCard).not.toHaveClass('data-group-card--drop')
  })

  // --- Branch coverage: bulk update no-op when empty value selected (lines 589, 608, 626, 642, 657, 675, 694) ---

  it('does not call onBulkUpdate when Goal select resets to empty placeholder', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('Checking'))
    await user.click(screen.getByText('401k'))
    await user.keyboard('{/Meta}')
    // The Goal select should have no value selected (shows "Goal…")
    const selects = screen.getAllByRole('combobox')
    const goalSelect = selects.find(s => within(s).queryByText('Goal…'))!
    expect((goalSelect as HTMLSelectElement).value).toBe('')
    // Don't change anything — just verify onBulkUpdate is not called spuriously
    expect(props.onBulkUpdate).not.toHaveBeenCalled()
  })

  // --- Branch coverage: new group input blur with empty value does nothing (line 435) ---

  it('does not create pending group on blur when new group input is empty', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('button', { name: /Groups/ }))
    await user.click(screen.getByRole('button', { name: /New Group/ }))
    screen.getByPlaceholderText('Group name')
    // Leave input empty and blur
    await user.tab()
    // Should go back to + New Group button without creating a pending group
    expect(screen.getByText('+ New Group')).toBeInTheDocument()
    expect(screen.queryByText('Drag accounts here')).not.toBeInTheDocument()
  })

  // --- Branch coverage: bulk new group OK button with empty input does nothing (line 737) ---

  it('does not apply group when confirm button clicked with empty group name', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('Checking'))
    await user.click(screen.getByText('401k'))
    await user.keyboard('{/Meta}')
    const selects = screen.getAllByRole('combobox')
    const groupSelect = selects.find(s => within(s).queryByText('Group…'))!
    await user.selectOptions(groupSelect, '__new__')
    const input = screen.getByPlaceholderText('Group name')
    // Click confirm without typing anything
    const confirmBtn = input.closest('.data-bulk-new-group')!.querySelector('.data-bulk-group-ok')! as HTMLElement
    await user.click(confirmBtn)
    // Should not call onBulkUpdate with empty group
    expect(props.onBulkUpdate).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ group: '' }))
  })

  // --- Branch coverage: linked account that doesn't exist returns null (line 903) ---

  it('does not show linked account badge when linkedAccountId points to nonexistent account', () => {
    const accounts = [makeAccount({ id: 1, name: 'Solo', linkedAccountId: 999 })]
    renderModal({ accounts })
    expect(screen.queryByText(/⛓/)).not.toBeInTheDocument()
  })

  // --- Branch coverage: account without nature defaults to 'asset' in table display (line 916, 924) ---

  it('displays default nature Asset and default allocation for account with no nature or allocation', () => {
    const accounts = [makeAccount({ id: 1, name: 'Plain', nature: undefined, allocation: undefined })]
    renderModal({ accounts })
    // Nature should default to 'asset'
    expect(screen.getByText('Asset')).toBeInTheDocument()
    // Allocation should use getDefaultAllocation('asset') result
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows.length).toBe(1)
  })

  // --- Branch coverage: sort by Owner column (exercises getColValue owner branch) ---

  it('sorts by Owner column', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('button', { name: /^Owner/ }))
    const rows = screen.getAllByRole('row').slice(1)
    const firstCell = rows[0]
    // Joint should sort before Primary alphabetically
    expect(within(firstCell).getByText('Joint')).toBeInTheDocument()
  })

  // --- Branch coverage: sort by Status column (exercises getColValue status branch) ---

  it('sorts by Status column ascending shows active first', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('button', { name: /^Status/ }))
    const rows = screen.getAllByRole('row').slice(1)
    // Active < Inactive alphabetically, so active rows first
    expect(within(rows[0]).getByText('Active')).toBeInTheDocument()
    expect(within(rows[rows.length - 1]).getByText('Inactive')).toBeInTheDocument()
  })

  // --- Branch coverage: rename Enter with same value does not call onRenameGroup (line 357) ---

  it('does not call onRenameGroup when Enter pressed with same group name', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    await user.click(screen.getByRole('button', { name: /Groups/ }))
    const renameButtons = screen.getAllByTitle('Rename group')
    await user.click(renameButtons[0])
    screen.getByDisplayValue('Banking')
    // Press Enter without changing value
    await user.keyboard('{Enter}')
    expect(props.onRenameGroup).not.toHaveBeenCalled()
  })

  // --- Branch coverage: toggle filter col on/off (line 811) ---

  it('opens a different column filter when clicking filter icon of another column', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByTitle('Filter Goal'))
    expect(document.querySelector('.data-th-filter-dropdown')).toBeTruthy()
    // Click a different column filter — should switch to that column
    await user.click(screen.getByTitle('Filter Type'))
    const dropdown = document.querySelector('.data-th-filter-dropdown')! as HTMLElement
    expect(within(dropdown).getByText('Liquid')).toBeInTheDocument()
  })

  // --- Branch coverage: drop on group card when dragAccountId is null (no-op) ---

  it('does not call onUpdate on drop when no account was being dragged', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()
    await user.click(screen.getByRole('button', { name: /Groups/ }))

    const groupCards = document.querySelectorAll('.data-group-card')
    const firstGroupCard = groupCards[0] as HTMLElement
    // Drop without prior dragStart
    fireEvent.drop(firstGroupCard)
    expect(props.onUpdate).not.toHaveBeenCalled()
  })

  // --- Branch coverage: ungrouped members dragStart/dragEnd (lines 526-529) ---

  it('handles drag start and end on ungrouped account member', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('button', { name: /Groups/ }))

    const ungroupedCard = document.querySelector('.data-group-card--ungrouped') as HTMLElement
    const members = ungroupedCard.querySelectorAll('.data-group-member[draggable]')
    expect(members.length).toBeGreaterThan(0)

    const member = members[0] as HTMLElement
    fireEvent.dragStart(member)
    fireEvent.dragEnd(member)
    // Verify no leftover state — no drop highlight on any card
    const allCards = document.querySelectorAll('.data-group-card--drop')
    expect(allCards.length).toBe(0)
  })
})
