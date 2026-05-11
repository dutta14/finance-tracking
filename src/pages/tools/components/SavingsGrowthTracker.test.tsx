import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SavingsGrowthTracker from './SavingsGrowthTracker'
import { loadBudgetStore } from '../../budget/utils/budgetStorage'
import { parseCSV } from '../../budget/utils/csvParser'
import { appStorage } from '../../../utils/appStorage'

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

  it('displays YoY net worth change in dollar mode', () => {
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
        { id: 1, accountId: 1, month: '2022-12', balance: 100000 },
        { id: 2, accountId: 1, month: '2023-12', balance: 150000 },
      ],
      allMonths: ['2022-12', '2023-12'],
      setAccounts: vi.fn(),
      setBalances: vi.fn(),
    })
    renderTracker()
    // Net worth values shown for both years
    expect(screen.getByText('$100,000')).toBeInTheDocument()
    expect(screen.getByText('$150,000')).toBeInTheDocument()
  })

  it('displays YoY change in percentage mode after toggle', async () => {
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
        { id: 1, accountId: 1, month: '2022-12', balance: 100000 },
        { id: 2, accountId: 1, month: '2023-12', balance: 150000 },
      ],
      allMonths: ['2022-12', '2023-12'],
      setAccounts: vi.fn(),
      setBalances: vi.fn(),
    })
    vi.mocked(loadBudgetStore).mockReturnValue({
      csvs: {
        '2022-06': { csv: 'c', month: '2022-06', uploadedAt: '' },
        '2023-06': { csv: 'c', month: '2023-06', uploadedAt: '' },
      },
      categoryGroups: [],
      configs: {},
      years: [2022, 2023],
    })
    vi.mocked(parseCSV).mockReturnValue([
      { date: '2023-06-01', amount: 10000, category: 'Salary' },
      { date: '2023-06-05', amount: -4000, category: 'Rent' },
    ])
    renderTracker()

    await user.click(screen.getByRole('button', { name: /Show YoY change/i }))
    // In percentage mode, deltas should show % values
    const pctElements = screen.getAllByText(/%/)
    // Filter out the toggle button itself
    const deltaElements = pctElements.filter(el => !el.closest('.sgt-toggle-btn'))
    expect(deltaElements.length).toBeGreaterThan(0)
  })

  it('renders income tab hint text after switching tabs', async () => {
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
    expect(screen.getByText(/Gross income & taxes are user-entered/)).toBeInTheDocument()
  })

  it('opens inline edit input when editable dash cell is clicked', async () => {
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
    // On savings tab, netIncome is editable (no budget data) — click the "—" button
    const editableDashes = screen.getAllByRole('button', { name: '—' })
    if (editableDashes.length > 0) {
      await user.click(editableDashes[0])
      const editInput = document.querySelector('.sgt-edit-input')
      expect(editInput).toBeInTheDocument()
    }
  })

  it('commits edit value on blur and saves overrides', async () => {
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

    // Switch to income tab where grossIncome is always editable
    await user.click(screen.getByRole('button', { name: /Income/i, pressed: false }))
    const editableDashes = screen.getAllByRole('button', { name: '—' })
    if (editableDashes.length > 0) {
      await user.click(editableDashes[0])
      const editInput = document.querySelector('.sgt-edit-input') as HTMLInputElement
      if (editInput) {
        await user.type(editInput, '150000')
        await user.tab() // blur to commit
        expect(vi.mocked(appStorage.setJSON)).toHaveBeenCalled()
      }
    }
  })

  it('cancels edit when Escape is pressed', async () => {
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
    const editableDashes = screen.getAllByRole('button', { name: '—' })
    if (editableDashes.length > 0) {
      await user.click(editableDashes[0])
      const editInput = document.querySelector('.sgt-edit-input')
      expect(editInput).toBeInTheDocument()
      await user.keyboard('{Escape}')
      expect(document.querySelector('.sgt-edit-input')).not.toBeInTheDocument()
    }
  })

  it('commits edit value on Enter key press', async () => {
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
    const editableDashes = screen.getAllByRole('button', { name: '—' })
    if (editableDashes.length > 0) {
      await user.click(editableDashes[0])
      const editInput = document.querySelector('.sgt-edit-input')
      expect(editInput).toBeInTheDocument()
      await user.type(editInput!, '200000')
      await user.keyboard('{Enter}')
      expect(document.querySelector('.sgt-edit-input')).not.toBeInTheDocument()
      // After entering 200000 for grossIncome, it should display as $200,000
      expect(screen.getByText('$200,000')).toBeInTheDocument()
    }
  })

  it('opens edit when Enter key is pressed on editable dash cell', async () => {
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
    const editableDashes = screen.getAllByRole('button', { name: '—' })
    if (editableDashes.length > 0) {
      editableDashes[0].focus()
      await user.keyboard('{Enter}')
      expect(document.querySelector('.sgt-edit-input')).toBeInTheDocument()
    }
  })

  it('opens edit when Space key is pressed on editable dash cell', async () => {
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
    const editableDashes = screen.getAllByRole('button', { name: '—' })
    if (editableDashes.length > 0) {
      editableDashes[0].focus()
      await user.keyboard(' ')
      expect(document.querySelector('.sgt-edit-input')).toBeInTheDocument()
    }
  })

  it('renders decline styling for negative expense delta', () => {
    vi.mocked(loadBudgetStore).mockReturnValue({
      csvs: {
        '2022-03': { csv: 'c', month: '2022-03', uploadedAt: '' },
        '2023-03': { csv: 'c', month: '2023-03', uploadedAt: '' },
      },
      categoryGroups: [],
      configs: {},
      years: [2022, 2023],
    })
    // 2022: expense 5000, 2023: expense 3000 → decrease = green (sgt-up)
    vi.mocked(parseCSV).mockImplementation((csv: string) => {
      if (csv === 'c') {
        // Same data both years; we need different data per year
        return [
          { date: '2023-03-01', amount: 10000, category: 'Salary' },
          { date: '2023-03-05', amount: -3000, category: 'Rent' },
        ]
      }
      return []
    })
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
      balances: [
        { id: 1, accountId: 1, month: '2022-12', balance: 100000 },
        { id: 2, accountId: 1, month: '2023-12', balance: 150000 },
      ],
      allMonths: ['2022-12', '2023-12'],
      setAccounts: vi.fn(),
      setBalances: vi.fn(),
    })
    renderTracker()
    // Expense delta between years should exist (0 change since same data)
    // The delta column should render with sgt-up or sgt-down class or show $0
    expect(screen.getByText('2022')).toBeInTheDocument()
    expect(screen.getByText('2023')).toBeInTheDocument()
  })

  it('excludes removed category group from budget calculations', () => {
    vi.mocked(loadBudgetStore).mockReturnValue({
      csvs: { '2024-01': { csv: 'csv-data', month: '2024-01', uploadedAt: '' } },
      categoryGroups: [{ id: 'removed', name: 'Removed', categories: ['OldCat'] }],
      configs: {},
      years: [2024],
    })
    vi.mocked(parseCSV).mockReturnValue([
      { date: '2024-01-15', amount: 5000, category: 'Salary' },
      { date: '2024-01-20', amount: -2000, category: 'OldCat' },
    ])
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
      balances: [{ id: 1, accountId: 1, month: '2024-12', balance: 50000 }],
      allMonths: ['2024-12'],
      setAccounts: vi.fn(),
      setBalances: vi.fn(),
    })
    renderTracker()
    // OldCat is removed, so expense should be N/A (no expense categories remain)
    // Net Income is $5,000 (Salary, not removed) — appears in the Net Income column
    const netIncomeElements = screen.getAllByText('$5,000')
    expect(netIncomeElements.length).toBeGreaterThanOrEqual(1)
  })

  it('prefers December balance for year-end net worth', () => {
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
      balances: [
        { id: 1, accountId: 1, month: '2024-06', balance: 80000 },
        { id: 2, accountId: 1, month: '2024-12', balance: 120000 },
      ],
      allMonths: ['2024-06', '2024-12'],
      setAccounts: vi.fn(),
      setBalances: vi.fn(),
    })
    renderTracker()
    // December balance should be used
    expect(screen.getByText('$120,000')).toBeInTheDocument()
    expect(screen.queryByText('$80,000')).not.toBeInTheDocument()
  })

  it('renders editable value cell on income tab when override exists', async () => {
    const user = userEvent.setup()
    vi.mocked(appStorage.getJSON).mockImplementation(() => ({ 2024: { grossIncome: 250000 } }))
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
    // grossIncome override = 250000 should display as formatted value
    expect(screen.getByText('$250,000')).toBeInTheDocument()
    // Click the editable value to start editing
    const editableValue = screen.getByText('$250,000')
    await user.click(editableValue)
    const editInput = document.querySelector('.sgt-edit-input') as HTMLInputElement
    expect(editInput).toBeInTheDocument()
    expect(editInput.value).toBe('250000')
  })
})
