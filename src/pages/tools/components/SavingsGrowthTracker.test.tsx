import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SavingsGrowthTracker from './SavingsGrowthTracker'
import { loadBudgetStore } from '../../budget/utils/budgetStorage'
import { parseCSV } from '../../budget/utils/csvParser'

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
    getJSON: vi.fn(() => ({})),
    setJSON: vi.fn(),
  },
}))

vi.mock('../../../styles/SavingsGrowthTracker.css', () => ({}))

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

function renderTracker() {
  return render(<SavingsGrowthTracker />)
}

describe('SavingsGrowthTracker', () => {
  it('renders empty state when no data is available', () => {
    renderTracker()
    expect(screen.getByText(/No data available/)).toBeInTheDocument()
  })

  it('renders savings tab columns when data exists', () => {
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
      balances: [{ id: 1, accountId: 1, month: '2023-12', balance: 100000 }],
      allMonths: ['2023-12'],
      setAccounts: vi.fn(),
      setBalances: vi.fn(),
    })
    renderTracker()
    expect(screen.getByText('Year')).toBeInTheDocument()
    expect(screen.getByText('Net Income')).toBeInTheDocument()
    expect(screen.getByText('Expense')).toBeInTheDocument()
    // "Savings" appears as both a tab button and column header
    const savingsElements = screen.getAllByText('Savings')
    expect(savingsElements.length).toBe(2) // tab + column header
    expect(screen.getByText('Net Worth')).toBeInTheDocument()
  })

  it('switches to income tab when Income button is clicked', async () => {
    const user = userEvent.setup()
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
      balances: [{ id: 1, accountId: 1, month: '2023-12', balance: 100000 }],
      allMonths: ['2023-12'],
      setAccounts: vi.fn(),
      setBalances: vi.fn(),
    })
    renderTracker()
    await user.click(screen.getByRole('button', { name: /Income/i, pressed: false }))
    expect(screen.getByText('Gross Income')).toBeInTheDocument()
    expect(screen.getByText('Taxes')).toBeInTheDocument()
    expect(screen.getByText('Tax Rate')).toBeInTheDocument()
  })

  it('displays year rows from balance data', () => {
    mockUseData.mockReturnValue({
      accounts: [
        {
          id: 1,
          name: 'Checking',
          type: 'liquid',
          owner: 'primary',
          status: 'active',
          goalType: 'gw',
          nature: 'asset',
          allocation: 'cash',
        },
      ],
      balances: [
        { id: 1, accountId: 1, month: '2022-12', balance: 50000 },
        { id: 2, accountId: 1, month: '2023-12', balance: 75000 },
      ],
      allMonths: ['2022-12', '2023-12'],
      setAccounts: vi.fn(),
      setBalances: vi.fn(),
    })
    renderTracker()
    expect(screen.getByText('2022')).toBeInTheDocument()
    expect(screen.getByText('2023')).toBeInTheDocument()
  })

  it('toggles YoY change format between $ and %', async () => {
    const user = userEvent.setup()
    mockUseData.mockReturnValue({
      accounts: [
        {
          id: 1,
          name: 'Checking',
          type: 'liquid',
          owner: 'primary',
          status: 'active',
          goalType: 'gw',
          nature: 'asset',
          allocation: 'cash',
        },
      ],
      balances: [
        { id: 1, accountId: 1, month: '2022-12', balance: 50000 },
        { id: 2, accountId: 1, month: '2023-12', balance: 75000 },
      ],
      allMonths: ['2022-12', '2023-12'],
      setAccounts: vi.fn(),
      setBalances: vi.fn(),
    })
    renderTracker()
    const toggleBtn = screen.getByRole('button', { name: /Show YoY change/i })
    expect(toggleBtn).toHaveTextContent('$')
    await user.click(toggleBtn)
    expect(toggleBtn).toHaveTextContent('%')
  })

  it('renders net worth values for each year', () => {
    mockUseData.mockReturnValue({
      accounts: [
        {
          id: 1,
          name: 'Savings',
          type: 'liquid',
          owner: 'primary',
          status: 'active',
          goalType: 'gw',
          nature: 'asset',
          allocation: 'cash',
        },
      ],
      balances: [{ id: 1, accountId: 1, month: '2024-06', balance: 200000 }],
      allMonths: ['2024-06'],
      setAccounts: vi.fn(),
      setBalances: vi.fn(),
    })
    renderTracker()
    expect(screen.getByText('$200,000')).toBeInTheDocument()
  })

  it('renders hint text for savings tab', () => {
    mockUseData.mockReturnValue({
      accounts: [
        {
          id: 1,
          name: 'A',
          type: 'liquid',
          owner: 'primary',
          status: 'active',
          goalType: 'gw',
          nature: 'asset',
          allocation: 'cash',
        },
      ],
      balances: [{ id: 1, accountId: 1, month: '2024-12', balance: 100 }],
      allMonths: ['2024-12'],
      setAccounts: vi.fn(),
      setBalances: vi.fn(),
    })
    renderTracker()
    expect(screen.getByText(/Savings = Net Income from budget/)).toBeInTheDocument()
  })

  it('renders editable cell for grossIncome on income tab', async () => {
    const user = userEvent.setup()
    mockUseData.mockReturnValue({
      accounts: [
        {
          id: 1,
          name: 'A',
          type: 'liquid',
          owner: 'primary',
          status: 'active',
          goalType: 'gw',
          nature: 'asset',
          allocation: 'cash',
        },
      ],
      balances: [{ id: 1, accountId: 1, month: '2024-12', balance: 100 }],
      allMonths: ['2024-12'],
      setAccounts: vi.fn(),
      setBalances: vi.fn(),
    })
    renderTracker()
    await user.click(screen.getByRole('button', { name: /Income/i, pressed: false }))
    // Income tab with 1 year, no budget/overrides: grossIncome, taxes, netIncome are editable "—", taxRate is non-editable "—"
    const dashElements = screen.getAllByText('—')
    expect(dashElements.length).toBe(4)
  })

  it('renders the Savings and Income tab buttons with aria-pressed', () => {
    mockUseData.mockReturnValue({
      accounts: [
        {
          id: 1,
          name: 'A',
          type: 'liquid',
          owner: 'primary',
          status: 'active',
          goalType: 'gw',
          nature: 'asset',
          allocation: 'cash',
        },
      ],
      balances: [{ id: 1, accountId: 1, month: '2024-12', balance: 100 }],
      allMonths: ['2024-12'],
      setAccounts: vi.fn(),
      setBalances: vi.fn(),
    })
    renderTracker()
    const savingsBtn = screen.getByRole('button', { pressed: true })
    expect(savingsBtn).toHaveTextContent('Savings')
  })

  it('shows N/A for missing computed values', () => {
    mockUseData.mockReturnValue({
      accounts: [
        {
          id: 1,
          name: 'A',
          type: 'liquid',
          owner: 'primary',
          status: 'active',
          goalType: 'gw',
          nature: 'asset',
          allocation: 'cash',
        },
      ],
      balances: [{ id: 1, accountId: 1, month: '2024-12', balance: 100 }],
      allMonths: ['2024-12'],
      setAccounts: vi.fn(),
      setBalances: vi.fn(),
    })
    renderTracker()
    // Expense and Growth columns show N/A when no budget data (1 year row)
    const naElements = screen.getAllByText('N/A')
    expect(naElements.length).toBe(2)
  })

  it('computes savings when budget CSV data is available', () => {
    vi.mocked(loadBudgetStore).mockReturnValue({
      csvs: { '2024-01': { csv: 'csv-data', month: '2024-01', uploadedAt: '' } },
      categoryGroups: [],
      configs: {},
      years: [2024],
    })
    vi.mocked(parseCSV).mockReturnValue([
      { date: '2024-01-15', amount: 5000, category: 'Salary' },
      { date: '2024-01-20', amount: -2000, category: 'Rent' },
    ])
    mockUseData.mockReturnValue({
      accounts: [
        {
          id: 1,
          name: 'Checking',
          type: 'liquid',
          owner: 'primary',
          status: 'active',
          goalType: 'gw',
          nature: 'asset',
          allocation: 'cash',
        },
      ],
      balances: [{ id: 1, accountId: 1, month: '2024-12', balance: 50000 }],
      allMonths: ['2024-12'],
      setAccounts: vi.fn(),
      setBalances: vi.fn(),
    })
    renderTracker()
    expect(screen.getByText('2024')).toBeInTheDocument()
    // Net Income = $5,000 (from Salary, classified as income)
    expect(screen.getByText('$5,000')).toBeInTheDocument()
    // Expense = $2,000 (from Rent, classified as expense)
    expect(screen.getByText('$2,000')).toBeInTheDocument()
    // Savings = Net Income - Expense = $3,000
    expect(screen.getByText('$3,000')).toBeInTheDocument()
  })
})
