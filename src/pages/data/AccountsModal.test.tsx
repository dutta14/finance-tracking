import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AccountsModal from './AccountsModal'
import { makeAccount, makeProfile } from '../../test/factories'
import type { Account } from './types'
import { GOAL_TYPE_LABELS, ACCOUNT_TYPE_LABELS, NATURE_LABELS, ALLOCATION_LABELS } from './types'

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

const defaultProfile = makeProfile({ name: 'Alice', partner: { name: 'Bob', birthday: '1991-05-20' } })

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
})
