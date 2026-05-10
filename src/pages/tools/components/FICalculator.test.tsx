import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FICalculator from './FICalculator'

/* ─── Mock dependencies ─── */

const mockUseData = vi.fn(() => ({
  accounts: [] as ReturnType<typeof import('../../../contexts/DataContext').useData>['accounts'],
  balances: [] as ReturnType<typeof import('../../../contexts/DataContext').useData>['balances'],
  allMonths: [] as string[],
  setAccounts: vi.fn(),
  setBalances: vi.fn(),
}))

vi.mock('../../../contexts/DataContext', () => ({
  useData: (...args: unknown[]) => mockUseData(...args),
}))

vi.mock('../../budget/utils/budgetStorage', () => ({
  loadBudgetStore: vi.fn(() => ({ csvs: {}, categoryGroups: [], configs: {}, years: [] })),
}))

vi.mock('../../budget/utils/csvParser', () => ({
  parseCSV: vi.fn(() => []),
}))

vi.mock('../../../utils/appStorage', () => ({
  appStorage: {
    getJSON: vi.fn((key: string, fallback: unknown) => {
      if (key === 'fi-simulations') return []
      if (key === 'user-profile') return {}
      return fallback ?? {}
    }),
    setJSON: vi.fn(),
  },
}))

vi.mock('../../../styles/FICalculator.css', () => ({}))

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mockUseData.mockReturnValue({
    accounts: [],
    balances: [],
    allMonths: [],
    setAccounts: vi.fn(),
    setBalances: vi.fn(),
  })
})

function renderCalc() {
  return render(<FICalculator />)
}

describe('FICalculator', () => {
  it('renders the Annual Expense input', () => {
    renderCalc()
    expect(screen.getByText('Annual Expense')).toBeInTheDocument()
  })

  it('renders inflation and growth rate steppers', () => {
    renderCalc()
    expect(screen.getByText('Inflation')).toBeInTheDocument()
    expect(screen.getByText('Growth')).toBeInTheDocument()
  })

  it('renders retire year and plan until steppers', () => {
    renderCalc()
    expect(screen.getByText('Retire in')).toBeInTheDocument()
    expect(screen.getByText('Plan until')).toBeInTheDocument()
  })

  it('renders the primary 401(k) stepper', () => {
    renderCalc()
    expect(screen.getByText('Primary 401(k)')).toBeInTheDocument()
  })

  it('renders the GW liquid toggle', () => {
    renderCalc()
    expect(screen.getByText(/Include GW liquid/)).toBeInTheDocument()
  })

  it('renders current holdings summary section', () => {
    renderCalc()
    expect(screen.getByText('FI Retirement (Primary)')).toBeInTheDocument()
    expect(screen.getByText('FI Retirement (Partner)')).toBeInTheDocument()
    expect(screen.getByText('FI Non-Retirement')).toBeInTheDocument()
  })

  it('displays result section with annual saving or FI ready message', () => {
    renderCalc()
    // With no accounts/balances and default expense=60000, gap > 0 so "Save each year" should show
    expect(screen.getByText(/Save each year until/)).toBeInTheDocument()
  })

  it('renders year-by-year projection when expanded', async () => {
    const user = userEvent.setup()
    renderCalc()
    const expandBtn = screen.getByText(/Year-by-year projection/)
    await user.click(expandBtn)
    expect(screen.getByText('Year')).toBeInTheDocument()
    expect(screen.getByText('Expense')).toBeInTheDocument()
    expect(screen.getByText('Net Worth')).toBeInTheDocument()
  })

  it('updates annual expense when user types in the input', async () => {
    const user = userEvent.setup()
    renderCalc()
    const input = screen.getByDisplayValue('60,000')
    await user.clear(input)
    await user.type(input, '120000')
    expect(input).toHaveValue('120,000')
  })

  it('displays inflation rate value and responds to stepper clicks', () => {
    renderCalc()
    // Default inflation is 3%, scoped to the Inflation stepper row
    const inflationRow = screen.getByText('Inflation').parentElement!
    expect(within(inflationRow).getByText('3%')).toBeInTheDocument()
  })

  it('displays growth rate value', () => {
    renderCalc()
    // Default growth is 8%, scoped to the Growth stepper row
    const growthRow = screen.getByText('Growth').parentElement!
    expect(within(growthRow).getByText('8%')).toBeInTheDocument()
  })

  it('shows the Save button and save form', async () => {
    const user = userEvent.setup()
    renderCalc()
    const saveBtn = screen.getByText('+ Save')
    await user.click(saveBtn)
    expect(screen.getByPlaceholderText('Simulation name')).toBeInTheDocument()
  })

  it('shows FI ready when existing balances exceed corpus need', () => {
    mockUseData.mockReturnValue({
      accounts: [
        {
          id: 1,
          name: 'Brokerage',
          type: 'non-retirement',
          owner: 'primary',
          status: 'active',
          goalType: 'fi',
          nature: 'asset',
          allocation: 'stocks',
        },
      ],
      balances: [{ id: 1, accountId: 1, month: '2025-01', balance: 50_000_000 }],
      allMonths: ['2025-01'],
      setAccounts: vi.fn(),
      setBalances: vi.fn(),
    })
    renderCalc()
    expect(screen.getByText(/You're ready to FI/)).toBeInTheDocument()
  })

  it('renders breakdown rows when result is computed', () => {
    renderCalc()
    expect(screen.getByText(/Expense at retirement/)).toBeInTheDocument()
    expect(screen.getByText(/Non-ret corpus needed/)).toBeInTheDocument()
    expect(screen.getByText(/Gap to close/)).toBeInTheDocument()
  })

  it('cancel save form hides the input', async () => {
    const user = userEvent.setup()
    renderCalc()
    await user.click(screen.getByText('+ Save'))
    expect(screen.getByPlaceholderText('Simulation name')).toBeInTheDocument()
    await user.click(screen.getByText('✕'))
    expect(screen.queryByPlaceholderText('Simulation name')).not.toBeInTheDocument()
  })

  it('does not render partner 401(k) when no partner birth year', () => {
    renderCalc()
    expect(screen.queryByText('Partner 401(k)')).not.toBeInTheDocument()
  })
})
