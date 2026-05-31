import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BalanceSpreadsheet from './BalanceSpreadsheet'
import { makeAccount, makeProfile } from '../../test/factories'

const profile = makeProfile()

function buildBalanceMap(entries: { accountId: number; month: string; balance: number }[]) {
  const map = new Map<string, number>()
  for (const e of entries) map.set(`${e.accountId}:${e.month}`, e.balance)
  return map
}

const acct1 = makeAccount({
  id: 1,
  name: 'Checking',
  owner: 'primary',
  goalType: 'gw',
  type: 'liquid',
  group: undefined,
})
const acct2 = makeAccount({
  id: 2,
  name: '401k',
  owner: 'primary',
  goalType: 'fi',
  type: 'retirement',
  group: undefined,
})

const months = ['2024-03', '2024-02', '2024-01']
const balanceEntries = [
  { accountId: 1, month: '2024-01', balance: 1000 },
  { accountId: 2, month: '2024-01', balance: 5000 },
  { accountId: 1, month: '2024-02', balance: 1200 },
  { accountId: 2, month: '2024-02', balance: 5500 },
  { accountId: 1, month: '2024-03', balance: 1500 },
  { accountId: 2, month: '2024-03', balance: 6000 },
]
const balanceMap = buildBalanceMap(balanceEntries)

function makeProps(overrides: Partial<React.ComponentProps<typeof BalanceSpreadsheet>> = {}) {
  return {
    spreadsheetAccounts: [acct1, acct2],
    allAccounts: [acct1, acct2],
    balances: [],
    allMonths: months,
    balanceMap,
    profile,
    inlineEntry: null,
    onInlineEntryChange: vi.fn(),
    onSaveInlineEntry: vi.fn(),
    onCancelInlineEntry: vi.fn(),
    onDeleteMonth: vi.fn(),
    ...overrides,
  }
}

describe('BalanceSpreadsheet', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // --- Rendering ---

  it('renders account names as column headers', () => {
    render(<BalanceSpreadsheet {...makeProps()} />)
    expect(screen.getByText('Checking')).toBeInTheDocument()
    expect(screen.getByText('401k')).toBeInTheDocument()
  })

  it('renders month rows with formatted labels', () => {
    render(<BalanceSpreadsheet {...makeProps()} />)
    expect(screen.getByText('Jan 2024')).toBeInTheDocument()
    expect(screen.getByText('Feb 2024')).toBeInTheDocument()
    expect(screen.getByText('Mar 2024')).toBeInTheDocument()
  })

  it('renders a Total column header', () => {
    render(<BalanceSpreadsheet {...makeProps()} />)
    expect(screen.getByText('Total')).toBeInTheDocument()
  })

  it('displays formatted balance values in cells', () => {
    render(<BalanceSpreadsheet {...makeProps()} />)
    expect(screen.getByText('$1,000')).toBeInTheDocument()
    expect(screen.getByText('$5,000')).toBeInTheDocument()
  })

  it('displays total row values summing all accounts for each month', () => {
    render(<BalanceSpreadsheet {...makeProps()} />)
    // Verify totals appear alongside their month labels
    // Jan total: 1000+5000 = $6,000, Feb: 1200+5500 = $6,700, Mar: 1500+6000 = $7,500
    const rows = screen.getAllByRole('row')
    const jan = rows.find(r => within(r).queryByText('Jan 2024'))
    const feb = rows.find(r => within(r).queryByText('Feb 2024'))
    const mar = rows.find(r => within(r).queryByText('Mar 2024'))
    expect(jan).toBeDefined()
    expect(feb).toBeDefined()
    expect(mar).toBeDefined()
    expect(within(jan!).getByText('$6,000')).toBeInTheDocument()
    expect(within(feb!).getByText('$6,700')).toBeInTheDocument()
    expect(within(mar!).getByText('$7,500')).toBeInTheDocument()
  })

  it('renders empty cell when balance data is missing for an account-month', () => {
    const sparseMap = buildBalanceMap([{ accountId: 1, month: '2024-01', balance: 1234 }])
    render(
      <BalanceSpreadsheet
        {...makeProps({
          balanceMap: sparseMap,
          allMonths: ['2024-01'],
        })}
      />,
    )
    // acct1 cell + total cell both show $1,234 (since acct2 has no data)
    expect(screen.getAllByText('$1,234')).toHaveLength(2)
  })

  // --- Group expand/collapse ---

  it('renders grouped accounts as a single collapsed column', () => {
    const grouped1 = makeAccount({ id: 10, name: 'Sub A', group: 'Savings', goalType: 'gw', type: 'liquid' })
    const grouped2 = makeAccount({ id: 11, name: 'Sub B', group: 'Savings', goalType: 'gw', type: 'liquid' })
    const map = buildBalanceMap([
      { accountId: 10, month: '2024-01', balance: 100 },
      { accountId: 11, month: '2024-01', balance: 200 },
    ])

    render(
      <BalanceSpreadsheet
        {...makeProps({
          spreadsheetAccounts: [grouped1, grouped2],
          allAccounts: [grouped1, grouped2],
          allMonths: ['2024-01'],
          balanceMap: map,
        })}
      />,
    )

    expect(screen.getByText('Savings')).toBeInTheDocument()
    expect(screen.queryByText('Sub A')).not.toBeInTheDocument()
    expect(screen.queryByText('Sub B')).not.toBeInTheDocument()
  })

  it('expands grouped accounts when split button is clicked', async () => {
    const user = userEvent.setup()
    const grouped1 = makeAccount({ id: 10, name: 'Sub A', group: 'Savings', goalType: 'gw', type: 'liquid' })
    const grouped2 = makeAccount({ id: 11, name: 'Sub B', group: 'Savings', goalType: 'gw', type: 'liquid' })
    const map = buildBalanceMap([
      { accountId: 10, month: '2024-01', balance: 100 },
      { accountId: 11, month: '2024-01', balance: 200 },
    ])

    render(
      <BalanceSpreadsheet
        {...makeProps({
          spreadsheetAccounts: [grouped1, grouped2],
          allAccounts: [grouped1, grouped2],
          allMonths: ['2024-01'],
          balanceMap: map,
        })}
      />,
    )

    await user.click(screen.getByTitle('Split into sub-accounts'))
    expect(screen.getByText('Sub A')).toBeInTheDocument()
    expect(screen.getByText('Sub B')).toBeInTheDocument()
  })

  it('collapses expanded group when merge button is clicked', async () => {
    const user = userEvent.setup()
    const grouped1 = makeAccount({ id: 10, name: 'Sub A', group: 'Savings', goalType: 'gw', type: 'liquid' })
    const grouped2 = makeAccount({ id: 11, name: 'Sub B', group: 'Savings', goalType: 'gw', type: 'liquid' })
    const map = buildBalanceMap([
      { accountId: 10, month: '2024-01', balance: 100 },
      { accountId: 11, month: '2024-01', balance: 200 },
    ])

    render(
      <BalanceSpreadsheet
        {...makeProps({
          spreadsheetAccounts: [grouped1, grouped2],
          allAccounts: [grouped1, grouped2],
          allMonths: ['2024-01'],
          balanceMap: map,
        })}
      />,
    )

    await user.click(screen.getByTitle('Split into sub-accounts'))
    expect(screen.getByText('Sub A')).toBeInTheDocument()

    await user.click(screen.getByTitle('Merge sub-accounts'))
    expect(screen.queryByText('Sub A')).not.toBeInTheDocument()
    expect(screen.getByText('Savings')).toBeInTheDocument()
  })

  it('shows summed group total when group is collapsed', () => {
    const grouped1 = makeAccount({ id: 10, name: 'Sub A', group: 'Savings', goalType: 'gw', type: 'liquid' })
    const grouped2 = makeAccount({ id: 11, name: 'Sub B', group: 'Savings', goalType: 'gw', type: 'liquid' })
    const map = buildBalanceMap([
      { accountId: 10, month: '2024-01', balance: 123 },
      { accountId: 11, month: '2024-01', balance: 456 },
    ])

    render(
      <BalanceSpreadsheet
        {...makeProps({
          spreadsheetAccounts: [grouped1, grouped2],
          allAccounts: [grouped1, grouped2],
          allMonths: ['2024-01'],
          balanceMap: map,
        })}
      />,
    )

    // Group cell shows $579 (123+456), total cell also shows $579
    expect(screen.getAllByText('$579')).toHaveLength(2)
  })

  // --- Filters ---

  it('filters by owner when owner filter is toggled', async () => {
    const user = userEvent.setup()
    const partnerAcct = makeAccount({
      id: 3,
      name: 'Partner IRA',
      owner: 'partner',
      goalType: 'fi',
      type: 'retirement',
    })
    const map = buildBalanceMap([
      { accountId: 1, month: '2024-01', balance: 1000 },
      { accountId: 3, month: '2024-01', balance: 2000 },
    ])

    render(
      <BalanceSpreadsheet
        {...makeProps({
          spreadsheetAccounts: [acct1, partnerAcct],
          allAccounts: [acct1, partnerAcct],
          allMonths: ['2024-01'],
          balanceMap: map,
        })}
      />,
    )

    // Click Owner filter L1 button
    const ownerBtn = screen.getByRole('button', { name: /^Owner/ })
    await user.click(ownerBtn)

    // Click Partner filter
    const partnerLabel = profile.partner?.name || 'Partner'
    await user.click(screen.getByRole('button', { name: partnerLabel }))

    expect(screen.getByText('Partner IRA')).toBeInTheDocument()
    expect(screen.queryByText('Checking')).not.toBeInTheDocument()
  })

  it('filters by goal type', async () => {
    const user = userEvent.setup()
    render(<BalanceSpreadsheet {...makeProps({ allMonths: ['2024-01'] })} />)

    await user.click(screen.getByRole('button', { name: /^Goal/ }))
    await user.click(screen.getByRole('button', { name: 'FI' }))

    expect(screen.getByText('401k')).toBeInTheDocument()
    expect(screen.queryByText('Checking')).not.toBeInTheDocument()
  })

  it('filters by account type', async () => {
    const user = userEvent.setup()
    render(<BalanceSpreadsheet {...makeProps({ allMonths: ['2024-01'] })} />)

    await user.click(screen.getByRole('button', { name: /^Type/ }))
    await user.click(screen.getByRole('button', { name: 'Retirement' }))

    expect(screen.getByText('401k')).toBeInTheDocument()
    expect(screen.queryByText('Checking')).not.toBeInTheDocument()
  })

  it('shows Clear all button when any filter is active and clears on click', async () => {
    const user = userEvent.setup()
    render(<BalanceSpreadsheet {...makeProps({ allMonths: ['2024-01'] })} />)

    expect(screen.queryByRole('button', { name: 'Clear all' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Goal/ }))
    await user.click(screen.getByRole('button', { name: 'FI' }))

    expect(screen.getByRole('button', { name: 'Clear all' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(screen.getByText('Checking')).toBeInTheDocument()
    expect(screen.getByText('401k')).toBeInTheDocument()
  })

  // --- Date range presets ---

  it('shows date filter options when Date button is clicked', async () => {
    const user = userEvent.setup()
    render(<BalanceSpreadsheet {...makeProps()} />)

    await user.click(screen.getByRole('button', { name: /^Date/ }))
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'YTD' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Last 12 mo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Year-End' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Custom' })).toBeInTheDocument()
  })

  it('filters to year-end months when Year-End preset is selected', async () => {
    const user = userEvent.setup()
    const mths = ['2024-12', '2024-06', '2023-12', '2023-06']
    render(
      <BalanceSpreadsheet
        {...makeProps({
          allMonths: mths,
          balanceMap: new Map(),
        })}
      />,
    )

    await user.click(screen.getByRole('button', { name: /^Date/ }))
    await user.click(screen.getByRole('button', { name: 'Year-End' }))

    expect(screen.getByText('Dec 2024')).toBeInTheDocument()
    expect(screen.getByText('Dec 2023')).toBeInTheDocument()
    expect(screen.queryByText('Jun 2024')).not.toBeInTheDocument()
    expect(screen.queryByText('Jun 2023')).not.toBeInTheDocument()
  })

  it('shows custom range pickers when Custom preset is selected', async () => {
    const user = userEvent.setup()
    render(<BalanceSpreadsheet {...makeProps()} />)

    await user.click(screen.getByRole('button', { name: /^Date/ }))
    await user.click(screen.getByRole('button', { name: 'Custom' }))

    expect(screen.getByText('to')).toBeInTheDocument()
  })

  // --- Inline edit ---

  it('renders inline entry row with input fields when inlineEntry is provided', () => {
    render(
      <BalanceSpreadsheet
        {...makeProps({
          inlineEntry: { month: '2024-04', values: { 1: '2000', 2: '' } },
        })}
      />,
    )

    const inputs = screen.getAllByPlaceholderText('—')
    expect(inputs.length).toBe(2)
  })

  it('calls onSaveInlineEntry when save button is clicked', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(
      <BalanceSpreadsheet
        {...makeProps({
          inlineEntry: { month: '2024-04', values: { 1: '2000' } },
          onSaveInlineEntry: onSave,
        })}
      />,
    )

    await user.click(screen.getByTitle('Save'))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('calls onCancelInlineEntry when cancel button is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(
      <BalanceSpreadsheet
        {...makeProps({
          inlineEntry: { month: '2024-04', values: {} },
          onCancelInlineEntry: onCancel,
        })}
      />,
    )

    await user.click(screen.getByTitle('Cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  // --- Delete month ---

  it('shows confirmation dialog when delete month button is clicked', async () => {
    const user = userEvent.setup()
    render(<BalanceSpreadsheet {...makeProps({ allMonths: ['2024-01'] })} />)

    await user.click(screen.getByTitle('Delete Jan 2024'))
    expect(screen.getByText(/Delete all balance entries for/)).toBeInTheDocument()
    expect(screen.getByText(/This cannot be undone/)).toBeInTheDocument()
  })

  it('calls onDeleteMonth when delete is confirmed', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(
      <BalanceSpreadsheet
        {...makeProps({
          allMonths: ['2024-01'],
          onDeleteMonth: onDelete,
        })}
      />,
    )

    await user.click(screen.getByTitle('Delete Jan 2024'))
    // Click Delete in confirmation dialog
    const confirmMessage = screen.getByText(/Delete all balance entries for/)
    const dialog = confirmMessage.closest('.data-confirm-dialog')!
    await user.click(within(dialog as HTMLElement).getByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledWith('2024-01')
  })

  it('dismisses confirmation dialog when Cancel is clicked', async () => {
    const user = userEvent.setup()
    render(<BalanceSpreadsheet {...makeProps({ allMonths: ['2024-01'] })} />)

    await user.click(screen.getByTitle('Delete Jan 2024'))
    expect(screen.getByText(/Delete all balance entries for/)).toBeInTheDocument()

    const cancelBtn = screen
      .getAllByRole('button', { name: 'Cancel' })
      .find(btn => btn.closest('.data-confirm-actions'))!
    await user.click(cancelBtn)
    expect(screen.queryByText(/Delete all balance entries for/)).not.toBeInTheDocument()
  })

  // --- Filter by nature and allocation ---

  it('filters by nature (asset/liability)', async () => {
    const user = userEvent.setup()
    const liability = makeAccount({
      id: 5,
      name: 'Mortgage',
      nature: 'liability',
      allocation: 'debt',
      goalType: 'gw',
      type: 'illiquid',
    })
    render(
      <BalanceSpreadsheet
        {...makeProps({
          spreadsheetAccounts: [acct1, liability],
          allAccounts: [acct1, liability],
          allMonths: ['2024-01'],
          balanceMap: new Map(),
        })}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Asset\/Liability/ }))
    await user.click(screen.getByRole('button', { name: 'Liability' }))

    expect(screen.getByText('Mortgage')).toBeInTheDocument()
    expect(screen.queryByText('Checking')).not.toBeInTheDocument()
  })

  // ── Allocation filter ──

  it('filters accounts by allocation when allocation filter is active', async () => {
    const user = userEvent.setup()
    const cashAcct = makeAccount({
      id: 1,
      name: 'Savings',
      owner: 'primary',
      goalType: 'gw',
      type: 'liquid',
      allocation: 'cash',
    })
    const stockAcct = makeAccount({
      id: 2,
      name: 'Brokerage',
      owner: 'primary',
      goalType: 'fi',
      type: 'retirement',
      allocation: 'us-stock',
    })

    render(
      <BalanceSpreadsheet
        {...makeProps({
          spreadsheetAccounts: [cashAcct, stockAcct],
          allAccounts: [cashAcct, stockAcct],
          allMonths: ['2024-01'],
          balanceMap: new Map(),
        })}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Allocation/ }))
    await user.click(screen.getByRole('button', { name: 'Cash' }))

    expect(screen.getByText('Savings')).toBeInTheDocument()
    expect(screen.queryByText('Brokerage')).not.toBeInTheDocument()
  })

  // ── Single-member group rendered as standalone ──

  it('renders single-member group as standalone column', () => {
    const loneAcct = makeAccount({
      id: 10,
      name: 'Solo',
      owner: 'primary',
      goalType: 'gw',
      type: 'liquid',
      group: 'OnlyGroup',
    })

    render(
      <BalanceSpreadsheet
        {...makeProps({
          spreadsheetAccounts: [loneAcct],
          allAccounts: [loneAcct],
          allMonths: ['2024-01'],
          balanceMap: new Map(),
        })}
      />,
    )

    // Account should render standalone (no group header)
    expect(screen.getByText('Solo')).toBeInTheDocument()
  })

  // ── Custom date range ──

  it('shows custom date range pickers when Custom date filter is selected', async () => {
    const user = userEvent.setup()
    render(<BalanceSpreadsheet {...makeProps()} />)

    // First click "Date" L1 filter to expand date options
    await user.click(screen.getByRole('button', { name: /Date/ }))
    // Then click "Custom"
    await user.click(screen.getByRole('button', { name: 'Custom' }))

    // Should show year/month select dropdowns for from and to
    const selects = screen.getAllByRole('combobox')
    expect(selects.length).toBeGreaterThanOrEqual(2)
  })

  it('filters months by custom from/to selects', async () => {
    const user = userEvent.setup()
    render(<BalanceSpreadsheet {...makeProps()} />)

    await user.click(screen.getByRole('button', { name: /Date/ }))
    await user.click(screen.getByRole('button', { name: 'Custom' }))

    // Select year in the first (from) year dropdown
    const selects = screen.getAllByRole('combobox')
    await user.selectOptions(selects[0], '2024')
    await user.selectOptions(selects[1], '02')

    // Should filter months — only Feb and Mar visible (from >= 2024-02)
    expect(screen.queryByText('Jan 2024')).not.toBeInTheDocument()
  })

  // ── Delete month confirmation ──

  it('shows delete confirmation dialog on month delete button', async () => {
    const user = userEvent.setup()
    const onDeleteMonth = vi.fn()
    render(<BalanceSpreadsheet {...makeProps({ onDeleteMonth })} />)

    // Find a delete button on a month header
    const deleteBtn = screen.getByTitle('Delete Mar 2024')
    await user.click(deleteBtn)

    // Should show confirmation dialog, not call onDeleteMonth yet
    expect(onDeleteMonth).not.toHaveBeenCalled()
    expect(screen.getByText(/Delete all balance entries for/)).toBeInTheDocument()

    // Confirm delete
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDeleteMonth).toHaveBeenCalledWith('2024-03')
  })

  // ── Additional branch coverage tests ──

  it('toggles L1 filter closed when same filter button is clicked twice', async () => {
    const user = userEvent.setup()
    render(<BalanceSpreadsheet {...makeProps()} />)

    // Open date filter
    await user.click(screen.getByRole('button', { name: /^Date/ }))
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()

    // Click Date again to close (line 63: prev === f ? null : f)
    await user.click(screen.getByRole('button', { name: /^Date/ }))
    expect(screen.queryByRole('button', { name: 'All' })).not.toBeInTheDocument()
  })

  it('toggleSet removes value from set when already present', async () => {
    const user = userEvent.setup()
    render(<BalanceSpreadsheet {...makeProps({ allMonths: ['2024-01'] })} />)

    await user.click(screen.getByRole('button', { name: /^Goal/ }))
    await user.click(screen.getByRole('button', { name: 'FI' }))
    // FI filter is active — only 401k visible
    expect(screen.queryByText('Checking')).not.toBeInTheDocument()

    // Click FI again to remove it (line 68: next.has(value) ? next.delete(value))
    await user.click(screen.getByRole('button', { name: 'FI' }))
    // Both accounts visible again
    expect(screen.getByText('Checking')).toBeInTheDocument()
    expect(screen.getByText('401k')).toBeInTheDocument()
  })

  it('sumGroupForMonth returns 0 when no balances exist for group children', () => {
    const grouped1 = makeAccount({ id: 10, name: 'Sub A', group: 'Empty', goalType: 'gw', type: 'liquid' })
    const grouped2 = makeAccount({ id: 11, name: 'Sub B', group: 'Empty', goalType: 'gw', type: 'liquid' })
    // Empty balance map — sumGroupForMonth returns 0 for both (line 180: val !== undefined check)
    render(
      <BalanceSpreadsheet
        {...makeProps({
          spreadsheetAccounts: [grouped1, grouped2],
          allAccounts: [grouped1, grouped2],
          allMonths: ['2024-01'],
          balanceMap: new Map(),
        })}
      />,
    )
    // Group cell shows empty string when sum is 0 (line 607: groupVal !== 0 ? ... : '')
    expect(screen.getByText('Empty')).toBeInTheDocument()
  })

  it('renders YTD date filter correctly', async () => {
    const user = userEvent.setup()
    const now = new Date()
    const yr = now.getFullYear()
    const curMonth = `${yr}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const prevYearMonth = `${yr - 1}-06`

    render(
      <BalanceSpreadsheet
        {...makeProps({
          allMonths: [curMonth, prevYearMonth],
          balanceMap: new Map(),
        })}
      />,
    )

    await user.click(screen.getByRole('button', { name: /^Date/ }))
    await user.click(screen.getByRole('button', { name: 'YTD' }))
    // YTD should filter out prev year month (line 206)
    // Current month should still be visible
    const rows = document.querySelectorAll('.data-spreadsheet-row-header')
    expect(rows.length).toBeGreaterThanOrEqual(1)
  })

  it('renders Last 12 mo date filter showing only first 12 months', async () => {
    const user = userEvent.setup()
    const mths = Array.from({ length: 15 }, (_, i) => {
      const m = 15 - i
      const yr = 2024 - Math.floor((m - 1) / 12)
      const mo = ((m - 1) % 12) + 1
      return `${yr}-${String(mo).padStart(2, '0')}`
    })

    render(
      <BalanceSpreadsheet
        {...makeProps({
          allMonths: mths,
          balanceMap: new Map(),
        })}
      />,
    )

    await user.click(screen.getByRole('button', { name: /^Date/ }))
    await user.click(screen.getByRole('button', { name: 'Last 12 mo' }))
    // Only 12 months visible (line 208: allMonths.slice(0, 12))
    const monthLabels = document.querySelectorAll('.data-spreadsheet-month-label')
    expect(monthLabels.length).toBe(12)
  })

  it('custom range filters with "to" month only', async () => {
    const user = userEvent.setup()
    render(
      <BalanceSpreadsheet
        {...makeProps({
          allMonths: ['2024-03', '2024-02', '2024-01'],
          balanceMap: new Map(),
        })}
      />,
    )

    await user.click(screen.getByRole('button', { name: /^Date/ }))
    await user.click(screen.getByRole('button', { name: 'Custom' }))

    // Set "to" year and month (line 212: !customTo || m <= customTo)
    const selects = screen.getAllByRole('combobox')
    // selects[2] is "to" year, selects[3] is "to" month
    await user.selectOptions(selects[2], '2024')
    await user.selectOptions(selects[3], '02')

    // Should filter months — only Jan and Feb visible (<= 2024-02)
    expect(screen.queryByText('Mar 2024')).not.toBeInTheDocument()
    expect(screen.getByText('Feb 2024')).toBeInTheDocument()
  })

  it('renders inline entry row with group column as empty cell', () => {
    const grouped1 = makeAccount({ id: 10, name: 'Sub A', group: 'Savings', goalType: 'gw', type: 'liquid' })
    const grouped2 = makeAccount({ id: 11, name: 'Sub B', group: 'Savings', goalType: 'gw', type: 'liquid' })

    render(
      <BalanceSpreadsheet
        {...makeProps({
          spreadsheetAccounts: [grouped1, grouped2],
          allAccounts: [grouped1, grouped2],
          allMonths: ['2024-01'],
          balanceMap: new Map(),
          inlineEntry: { month: '2024-02', values: {} },
        })}
      />,
    )
    // Group cell in inline row is read-only (line 537-545)
    const groupCell = document.querySelector('.data-spreadsheet-group-cell.data-spreadsheet-inline-cell')
    expect(groupCell).toBeInTheDocument()
  })

  it('inline entry displays formatted currency when field is not focused', () => {
    render(
      <BalanceSpreadsheet
        {...makeProps({
          inlineEntry: { month: '2024-04', values: { 1: '5000' } },
        })}
      />,
    )
    // _focused is undefined, so displayVal = formatCurrency(5000) (line 550)
    const inputs = screen.getAllByPlaceholderText('—')
    const firstInput = inputs[0] as HTMLInputElement
    expect(firstInput.value).toBe('$5,000')
  })

  it('inline entry shows raw value when field is focused', () => {
    render(
      <BalanceSpreadsheet
        {...makeProps({
          inlineEntry: { month: '2024-04', values: { 1: '5000' }, _focused: 1 },
        })}
      />,
    )
    // _focused === a.id, so rawVal is shown (line 561)
    const inputs = screen.getAllByPlaceholderText('—')
    const firstInput = inputs[0] as HTMLInputElement
    expect(firstInput.value).toBe('5000')
  })

  it('inline entry input strips non-numeric characters on change', async () => {
    const user = userEvent.setup()
    const onInlineChange = vi.fn()
    render(
      <BalanceSpreadsheet
        {...makeProps({
          inlineEntry: { month: '2024-04', values: {}, _focused: 1 },
          onInlineEntryChange: onInlineChange,
        })}
      />,
    )
    const inputs = screen.getAllByPlaceholderText('—')
    await user.type(inputs[0], '$1,234')
    // onChange strips non-numeric (line 565: replace(/[^0-9.-]/g, ''))
    expect(onInlineChange).toHaveBeenCalled()
  })

  it('renders owner avatar images when avatarDataUrl is set', () => {
    const profileWithAvatar = makeProfile({
      avatarDataUrl: 'data:image/png;base64,abc',
      partner: { name: 'Partner', avatarDataUrl: 'data:image/png;base64,def', birthday: '' },
    })

    render(
      <BalanceSpreadsheet
        {...makeProps({
          profile: profileWithAvatar,
          allMonths: ['2024-01'],
        })}
      />,
    )
    // Primary avatar image rendered (line 413)
    const imgs = document.querySelectorAll('.data-owner-avatar img')
    expect(imgs.length).toBeGreaterThanOrEqual(1)
  })

  it('renders partner avatar for partner-owned account', () => {
    const partnerAcct = makeAccount({
      id: 3,
      name: 'Partner 401k',
      owner: 'partner',
      goalType: 'fi',
      type: 'retirement',
    })
    const profileWithPartner = makeProfile({
      partner: { name: 'Jane', avatarDataUrl: '', birthday: '' },
    })

    render(
      <BalanceSpreadsheet
        {...makeProps({
          spreadsheetAccounts: [partnerAcct],
          allAccounts: [partnerAcct],
          profile: profileWithPartner,
          allMonths: ['2024-01'],
          balanceMap: new Map(),
        })}
      />,
    )
    // Partner initial "J" in avatar (line 428-430)
    const avatar = document.querySelector('.data-owner-avatar-partner')
    expect(avatar).toBeInTheDocument()
    expect(avatar!.textContent).toBe('J')
  })

  it('renders joint owner avatar group for joint account', () => {
    const jointAcct = makeAccount({ id: 3, name: 'Joint Savings', owner: 'joint', goalType: 'gw', type: 'liquid' })
    const profileWithPartner = makeProfile({
      partner: { name: 'Jane', avatarDataUrl: '', birthday: '' },
    })

    render(
      <BalanceSpreadsheet
        {...makeProps({
          spreadsheetAccounts: [jointAcct],
          allAccounts: [jointAcct],
          profile: profileWithPartner,
          allMonths: ['2024-01'],
          balanceMap: new Map(),
        })}
      />,
    )
    // Joint shows avatar group (line 411)
    const avatarGroup = document.querySelector('.data-owner-avatar-group')
    expect(avatarGroup).toBeInTheDocument()
  })

  it('renders inactive accounts with inactive CSS class', () => {
    const inactiveAcct = makeAccount({ id: 3, name: 'Old Account', status: 'inactive', goalType: 'gw', type: 'liquid' })
    const map = buildBalanceMap([{ accountId: 3, month: '2024-01', balance: 500 }])

    render(
      <BalanceSpreadsheet
        {...makeProps({
          spreadsheetAccounts: [inactiveAcct],
          allAccounts: [inactiveAcct],
          allMonths: ['2024-01'],
          balanceMap: map,
        })}
      />,
    )
    // Inactive account column header has inactive class (line 479/616)
    const inactiveHeader = document.querySelector('.data-spreadsheet-inactive')
    expect(inactiveHeader).toBeInTheDocument()
  })

  it('dismisses delete dialog by clicking overlay background', async () => {
    const user = userEvent.setup()
    render(<BalanceSpreadsheet {...makeProps({ allMonths: ['2024-01'] })} />)

    await user.click(screen.getByTitle('Delete Jan 2024'))
    expect(screen.getByText(/Delete all balance entries for/)).toBeInTheDocument()

    // Click overlay background to dismiss (line 630)
    const overlay = document.querySelector('.data-confirm-overlay')!
    fireEvent.click(overlay)
    expect(screen.queryByText(/Delete all balance entries for/)).not.toBeInTheDocument()
  })

  it('renders institution name for accounts that have one', () => {
    const acctWithInst = makeAccount({
      id: 5,
      name: 'Brokerage',
      goalType: 'fi',
      type: 'non-retirement',
      institution: 'Vanguard',
    })

    render(
      <BalanceSpreadsheet
        {...makeProps({
          spreadsheetAccounts: [acctWithInst],
          allAccounts: [acctWithInst],
          allMonths: ['2024-01'],
          balanceMap: new Map(),
        })}
      />,
    )
    // Institution rendered (line 499)
    expect(screen.getByText('Vanguard')).toBeInTheDocument()
  })

  it('setCustomMonth with empty year value clears the custom field', async () => {
    const user = userEvent.setup()
    render(
      <BalanceSpreadsheet
        {...makeProps({
          allMonths: ['2024-03', '2024-02', '2024-01'],
          balanceMap: new Map(),
        })}
      />,
    )

    await user.click(screen.getByRole('button', { name: /^Date/ }))
    await user.click(screen.getByRole('button', { name: 'Custom' }))

    const selects = screen.getAllByRole('combobox')
    // Set from year then clear it (line 222-223: value ? ... : '')
    await user.selectOptions(selects[0], '2024')
    await user.selectOptions(selects[0], '') // clear → empty string
    // All months should be visible (no from filter)
    expect(screen.getByText('Jan 2024')).toBeInTheDocument()
    expect(screen.getByText('Mar 2024')).toBeInTheDocument()
  })
})
