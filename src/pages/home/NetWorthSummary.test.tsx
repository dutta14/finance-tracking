import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NetWorthSummary from './NetWorthSummary'
import { makeAccount, makeBalanceEntry } from '../../test/factories'
import type { Account, BalanceEntry } from '../data/types'

let capturedMonthPickerProps: Record<string, unknown> = {}

vi.mock('../../components/MonthPicker', () => ({
  default: (props: Record<string, unknown>) => {
    capturedMonthPickerProps = props
    return (
      <div data-testid="month-picker">
        <span>{String(props.selectedMonth)}</span>
        <button type="button" onClick={() => (props.onMonthChange as (month: string) => void)('2024-02')}>
          Switch to February 2024
        </button>
      </div>
    )
  },
}))

const accounts: Account[] = [
  makeAccount({ id: 1, name: '401k', goalType: 'fi', type: 'retirement' }),
  makeAccount({ id: 2, name: 'Brokerage', goalType: 'fi', type: 'non-retirement' }),
  makeAccount({ id: 3, name: 'Checking', goalType: 'gw', type: 'liquid' }),
  makeAccount({ id: 4, name: 'Home Equity', goalType: 'gw', type: 'illiquid' }),
]

const balances: BalanceEntry[] = [
  makeBalanceEntry({ id: 1, accountId: 1, month: '2024-03', balance: 1100 }),
  makeBalanceEntry({ id: 2, accountId: 2, month: '2024-03', balance: 2200 }),
  makeBalanceEntry({ id: 3, accountId: 3, month: '2024-03', balance: 3300 }),
  makeBalanceEntry({ id: 4, accountId: 4, month: '2024-03', balance: 4400 }),
  makeBalanceEntry({ id: 5, accountId: 1, month: '2024-02', balance: 1000 }),
  makeBalanceEntry({ id: 6, accountId: 2, month: '2024-02', balance: 2000 }),
  makeBalanceEntry({ id: 7, accountId: 3, month: '2024-02', balance: 3000 }),
  makeBalanceEntry({ id: 8, accountId: 4, month: '2024-02', balance: 4000 }),
  makeBalanceEntry({ id: 9, accountId: 1, month: '2024-01', balance: 900 }),
  makeBalanceEntry({ id: 10, accountId: 2, month: '2024-01', balance: 1800 }),
  makeBalanceEntry({ id: 11, accountId: 3, month: '2024-01', balance: 2700 }),
  makeBalanceEntry({ id: 12, accountId: 4, month: '2024-01', balance: 3600 }),
  makeBalanceEntry({ id: 13, accountId: 1, month: '2023-12', balance: 800 }),
  makeBalanceEntry({ id: 14, accountId: 2, month: '2023-12', balance: 1600 }),
  makeBalanceEntry({ id: 15, accountId: 3, month: '2023-12', balance: 2400 }),
  makeBalanceEntry({ id: 16, accountId: 4, month: '2023-12', balance: 3200 }),
]

const defaultProps = {
  accounts,
  balances,
  allMonths: ['2024-03', '2024-02', '2024-01', '2023-12'],
  onNavigate: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  capturedMonthPickerProps = {}
})

describe('NetWorthSummary', () => {
  it('opens the comparison dropdown and shows every comparison period option', async () => {
    const user = userEvent.setup()
    render(<NetWorthSummary {...defaultProps} />)

    const trigger = screen.getByRole('button', { name: /comparison period/i })
    expect(trigger).toHaveTextContent('1 month')

    await user.click(trigger)

    expect(screen.getByRole('listbox', { name: /comparison period/i })).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(6)
    expect(screen.getByRole('option', { name: '1 month' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('option', { name: 'All time' })).toBeInTheDocument()
  })

  it('closes the comparison dropdown when clicking outside the menu', async () => {
    const user = userEvent.setup()
    render(<NetWorthSummary {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /comparison period/i }))
    expect(screen.getByRole('listbox', { name: /comparison period/i })).toBeInTheDocument()

    fireEvent.mouseDown(document.body)

    expect(screen.queryByRole('listbox', { name: /comparison period/i })).not.toBeInTheDocument()
  })

  it('updates the comparison trend when a different comparison period is selected', async () => {
    const user = userEvent.setup()
    render(<NetWorthSummary {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /comparison period/i }))
    await user.click(screen.getByRole('option', { name: '3 months' }))

    expect(screen.getByRole('button', { name: /comparison period/i })).toHaveTextContent('3 months')
    expect(
      screen.getByText(
        (_, element) =>
          !!element?.classList.contains('nw-change') && /\$3,000 \(37\.5%\)/.test(element.textContent || ''),
      ),
    ).toBeInTheDocument()
  })

  it('recomputes the headline trend when the selected month changes', async () => {
    const user = userEvent.setup()
    render(<NetWorthSummary {...defaultProps} />)

    expect(capturedMonthPickerProps.selectedMonth).toBe('2024-03')

    await user.click(screen.getByRole('button', { name: 'Switch to February 2024' }))

    expect(screen.getByTestId('month-picker')).toHaveTextContent('2024-02')
    expect(
      screen.getByText(
        (_, element) =>
          !!element?.classList.contains('nw-change') && /\$1,000 \(11\.1%\)/.test(element.textContent || ''),
      ),
    ).toBeInTheDocument()
  })

  it('renders FI and GW rows with subtopic labels and percentage trends', () => {
    render(<NetWorthSummary {...defaultProps} />)

    expect(screen.getByText('Financial Independence (FI)')).toBeInTheDocument()
    expect(screen.getByText('Generational Wealth (GW)')).toBeInTheDocument()
    expect(screen.getByText('Retirement')).toBeInTheDocument()
    expect(screen.getByText('Non-Retirement')).toBeInTheDocument()
    expect(screen.getByText('Liquid')).toBeInTheDocument()
    expect(screen.getByText('Illiquid')).toBeInTheDocument()
    expect(screen.getAllByText('(10.0%)')).toHaveLength(6)
  })
})
