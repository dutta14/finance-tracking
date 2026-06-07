import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SavingsPlan from './SavingsPlan'
import { makeGoal, makeGwGoal, makeAccount, makeBalanceEntry } from '../../../test/factories'
import type { Account, BalanceEntry } from '../../data/types'

const mockDataCtx = {
  accounts: [] as Account[],
  balances: [] as BalanceEntry[],
  allMonths: [] as string[],
  setAccounts: vi.fn(),
  setBalances: vi.fn(),
}

vi.mock('../../../contexts/DataContext', () => ({
  useData: () => mockDataCtx,
}))

vi.mock('../../../components/TermAbbr', () => ({
  default: ({ term }: { term: string }) => <abbr>{term}</abbr>,
}))

const profileBirthday = '1990-01-15'
const baseGoal = makeGoal({
  id: 1,
  goalName: 'Early Retirement',
  birthday: '1990-01-15',
  retirementAge: 45,
  fiGoal: 1_500_000,
  inflationRate: 3,
  goalCreatedIn: '2024-01-01',
})

describe('SavingsPlan', () => {
  // #45: No actual `new Date(2024)` pattern found in this test file.
  // Date strings use explicit format like '2024-01-01' which is TZ-safe.
  beforeEach(() => {
    mockDataCtx.accounts = []
    mockDataCtx.balances = []
    mockDataCtx.allMonths = []
  })

  it('shows empty message when no balance data exists', () => {
    render(<SavingsPlan goal={baseGoal} gwGoals={[]} profileBirthday={profileBirthday} />)
    expect(screen.getByText('Savings Plan')).toBeInTheDocument()
    expect(screen.getByText('Add balance data to generate a savings plan.')).toBeInTheDocument()
  })

  it('renders FI plan block with target when balance data exists', () => {
    mockDataCtx.accounts = [makeAccount({ id: 1, goalType: 'fi' })]
    mockDataCtx.balances = [makeBalanceEntry({ accountId: 1, month: '2024-01', balance: 200_000 })]
    mockDataCtx.allMonths = ['2024-01']

    render(<SavingsPlan goal={baseGoal} gwGoals={[]} profileBirthday={profileBirthday} />)
    expect(screen.getByText('Savings Plan')).toBeInTheDocument()
    expect(screen.getByText('$1,389,194')).toBeInTheDocument()
  })

  it('renders GW plan block when GW goals exist', () => {
    const gwGoal = makeGwGoal({ id: 10, fiGoalId: 1, disburseAmount: 100000, disburseAge: 50, growthRate: 6 })
    mockDataCtx.accounts = [makeAccount({ id: 1, goalType: 'fi' }), makeAccount({ id: 2, goalType: 'gw' })]
    mockDataCtx.balances = [
      makeBalanceEntry({ accountId: 1, month: '2024-01', balance: 200_000 }),
      makeBalanceEntry({ accountId: 2, month: '2024-01', balance: 50_000 }),
    ]
    mockDataCtx.allMonths = ['2024-01']

    render(<SavingsPlan goal={baseGoal} gwGoals={[gwGoal]} profileBirthday={profileBirthday} />)
    // Should have both FI and GW labels (rendered via TermAbbr mock as <abbr>)
    const abbrs = screen.getAllByText(/^(FI|GW)$/)
    expect(abbrs.length).toBe(2)
  })

  it('does not render GW block when there are no GW goals for this FI goal', () => {
    const unrelatedGw = makeGwGoal({ id: 10, fiGoalId: 999 })
    mockDataCtx.accounts = [makeAccount({ id: 1, goalType: 'fi' })]
    mockDataCtx.balances = [makeBalanceEntry({ accountId: 1, month: '2024-01', balance: 200_000 })]
    mockDataCtx.allMonths = ['2024-01']

    render(<SavingsPlan goal={baseGoal} gwGoals={[unrelatedGw]} profileBirthday={profileBirthday} />)
    const abbrs = screen.queryAllByText('GW')
    expect(abbrs.length).toBe(0)
  })

  it('shows comparison columns when there are multiple months of data', () => {
    mockDataCtx.accounts = [makeAccount({ id: 1, goalType: 'fi' })]
    mockDataCtx.balances = [
      makeBalanceEntry({ accountId: 1, month: '2024-01', balance: 200_000 }),
      makeBalanceEntry({ accountId: 1, month: '2024-06', balance: 250_000 }),
    ]
    mockDataCtx.allMonths = ['2024-01', '2024-06']

    render(<SavingsPlan goal={baseGoal} gwGoals={[]} profileBirthday={profileBirthday} />)
    // Should show initial and current month labels
    expect(screen.getByText('Jan 2024')).toBeInTheDocument()
    expect(screen.getByText('Jun 2024')).toBeInTheDocument()
  })

  it('shows single month result when only one month of data exists', () => {
    mockDataCtx.accounts = [makeAccount({ id: 1, goalType: 'fi' })]
    mockDataCtx.balances = [makeBalanceEntry({ accountId: 1, month: '2024-01', balance: 200_000 })]
    mockDataCtx.allMonths = ['2024-01']

    render(<SavingsPlan goal={baseGoal} gwGoals={[]} profileBirthday={profileBirthday} />)
    expect(screen.getByText('Balance (Jan 2024)')).toBeInTheDocument()
    expect(screen.getByText('Monthly Save')).toBeInTheDocument()
  })

  it('calculates monthly saving that is greater than zero when balance < target', () => {
    mockDataCtx.accounts = [makeAccount({ id: 1, goalType: 'fi' })]
    mockDataCtx.balances = [makeBalanceEntry({ accountId: 1, month: '2024-01', balance: 100_000 })]
    mockDataCtx.allMonths = ['2024-01']

    render(<SavingsPlan goal={baseGoal} gwGoals={[]} profileBirthday={profileBirthday} />)
    // Monthly Save label
    expect(screen.getByText('Monthly Save')).toBeInTheDocument()
    // The gap should show target - balance
    expect(screen.getByText('$1,289,194')).toBeInTheDocument()
    // With balance=100k, fiTarget≈$1,389,194 (finite depletion), 132 months at 8% growth, monthly save ≈ $5,455
    const monthlySaveEl = screen.getByText('$5,455')
    expect(monthlySaveEl).toBeInTheDocument()
  })

  it('shows zero monthly saving when balance already exceeds target', () => {
    mockDataCtx.accounts = [makeAccount({ id: 1, goalType: 'fi' })]
    mockDataCtx.balances = [makeBalanceEntry({ accountId: 1, month: '2024-01', balance: 2_000_000 })]
    mockDataCtx.allMonths = ['2024-01']

    render(<SavingsPlan goal={baseGoal} gwGoals={[]} profileBirthday={profileBirthday} />)
    expect(screen.getByText('Monthly Save')).toBeInTheDocument()
    // $0 appears for both monthly save and gap (since balance > target, gap is $0)
    expect(screen.getAllByText('$0').length).toBeGreaterThanOrEqual(1)
  })

  it('shows delta indicator when comparing initial and current months', () => {
    mockDataCtx.accounts = [makeAccount({ id: 1, goalType: 'fi' })]
    mockDataCtx.balances = [
      makeBalanceEntry({ accountId: 1, month: '2024-01', balance: 200_000 }),
      makeBalanceEntry({ accountId: 1, month: '2024-06', balance: 300_000 }),
    ]
    mockDataCtx.allMonths = ['2024-01', '2024-06']

    render(<SavingsPlan goal={baseGoal} gwGoals={[]} profileBirthday={profileBirthday} />)
    // Delta note should be present — with higher balance, need less saving
    expect(screen.getByText('On track — need less now')).toBeInTheDocument()
  })

  it('allows changing growth rate via input', async () => {
    const user = userEvent.setup()
    mockDataCtx.accounts = [makeAccount({ id: 1, goalType: 'fi' })]
    mockDataCtx.balances = [makeBalanceEntry({ accountId: 1, month: '2024-01', balance: 200_000 })]
    mockDataCtx.allMonths = ['2024-01']

    render(<SavingsPlan goal={baseGoal} gwGoals={[]} profileBirthday={profileBirthday} />)
    const growthInput = screen.getByRole('spinbutton')
    expect(growthInput).toHaveValue(8) // default growth rate
    await user.clear(growthInput)
    await user.type(growthInput, '10')
    expect(growthInput).toHaveValue(10)
  })

  it('does not render FI block when fiGoal is zero', () => {
    const zeroGoal = makeGoal({ ...baseGoal, fiGoal: 0 })
    mockDataCtx.accounts = [makeAccount({ id: 1, goalType: 'fi' })]
    mockDataCtx.balances = [makeBalanceEntry({ accountId: 1, month: '2024-01', balance: 100_000 })]
    mockDataCtx.allMonths = ['2024-01']

    render(<SavingsPlan goal={zeroGoal} gwGoals={[]} profileBirthday={profileBirthday} />)
    expect(screen.getByText('Savings Plan')).toBeInTheDocument()
    expect(screen.queryByText('Monthly Save')).not.toBeInTheDocument()
  })

  it('sums balances from multiple accounts of the same goal type', () => {
    mockDataCtx.accounts = [
      makeAccount({ id: 1, goalType: 'fi' }),
      makeAccount({ id: 2, goalType: 'fi', name: '401k' }),
    ]
    mockDataCtx.balances = [
      makeBalanceEntry({ accountId: 1, month: '2024-01', balance: 100_000 }),
      makeBalanceEntry({ accountId: 2, month: '2024-01', balance: 150_000 }),
    ]
    mockDataCtx.allMonths = ['2024-01']

    render(<SavingsPlan goal={baseGoal} gwGoals={[]} profileBirthday={profileBirthday} />)
    // Balance should be sum: $250,000
    expect(screen.getByText('$250,000')).toBeInTheDocument()
  })

  it('shows diff when multiple months exist and balance increased', () => {
    mockDataCtx.accounts = [makeAccount({ id: 1, goalType: 'fi' })]
    mockDataCtx.balances = [
      makeBalanceEntry({ accountId: 1, month: '2024-01', balance: 100_000 }),
      makeBalanceEntry({ accountId: 1, month: '2024-06', balance: 200_000 }),
    ]
    mockDataCtx.allMonths = ['2024-01', '2024-06']

    render(<SavingsPlan goal={baseGoal} gwGoals={[]} profileBirthday={profileBirthday} />)
    expect(screen.getByText(/On track/)).toBeInTheDocument()
  })

  it('shows upward diff when balance decreased over time', () => {
    mockDataCtx.accounts = [makeAccount({ id: 1, goalType: 'fi' })]
    mockDataCtx.balances = [
      makeBalanceEntry({ accountId: 1, month: '2024-01', balance: 500_000 }),
      makeBalanceEntry({ accountId: 1, month: '2024-06', balance: 200_000 }),
    ]
    mockDataCtx.allMonths = ['2024-01', '2024-06']

    render(<SavingsPlan goal={baseGoal} gwGoals={[]} profileBirthday={profileBirthday} />)
    expect(screen.getByText(/Need to save more/)).toBeInTheDocument()
  })
})
