import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import SavingsGrowthTracker from './SavingsGrowthTracker'
import { loadBudgetStore } from '../../budget/utils/budgetStorage'
import { parseCSV } from '../../budget/utils/csvParser'
import { appStorage } from '../../../utils/appStorage'

const mockUseData = vi.fn(() => ({
  accounts: [] as Array<{
    id: number
    name: string
    type: string
    owner: string
    status: 'active' | 'inactive'
    goalType: string
    nature: string
    allocation: string
  }>,
  balances: [] as Array<{ id: number; accountId: number; month: string; balance: number }>,
  allMonths: [] as string[],
  setAccounts: vi.fn(),
  setBalances: vi.fn(),
}))

vi.mock('../../../contexts/DataContext', () => ({
  useData: () => mockUseData(),
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

const baseAccount = {
  id: 1,
  name: 'Checking',
  type: 'liquid',
  owner: 'primary',
  status: 'active' as const,
  goalType: 'gw',
  nature: 'asset',
  allocation: 'cash',
}

const renderTracker = (initialRoute = '/net-worth/growth') =>
  render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <SavingsGrowthTracker />
    </MemoryRouter>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(loadBudgetStore).mockReturnValue({ csvs: {}, categoryGroups: [], configs: {}, years: [] })
  vi.mocked(parseCSV).mockReturnValue([])
  vi.mocked(appStorage.getJSON).mockReturnValue({})
  mockUseData.mockReturnValue({
    accounts: [baseAccount],
    balances: [],
    allMonths: [],
    setAccounts: vi.fn(),
    setBalances: vi.fn(),
  })
})

describe('SavingsGrowthTracker branch coverage', () => {
  it('falls back to the latest non-December month for year-end net worth', () => {
    mockUseData.mockReturnValue({
      accounts: [baseAccount],
      balances: [
        { id: 1, accountId: 1, month: '2024-06', balance: 80000 },
        { id: 2, accountId: 1, month: '2024-09', balance: 95000 },
      ],
      allMonths: ['2024-06', '2024-09'],
      setAccounts: vi.fn(),
      setBalances: vi.fn(),
    })

    renderTracker()

    expect(within(screen.getByTestId('year-card-2024')).getByText('$95,000')).toBeInTheDocument()
  })

  it('swallows budget parsing failures and still renders a net-worth-only savings row', () => {
    vi.mocked(loadBudgetStore).mockReturnValue({
      csvs: { '2024-01': { csv: 'bad-csv', month: '2024-01', uploadedAt: '' } },
      categoryGroups: [],
      configs: {},
      years: [2024],
    })
    vi.mocked(parseCSV).mockImplementation(() => {
      throw new Error('bad csv')
    })
    mockUseData.mockReturnValue({
      accounts: [baseAccount],
      balances: [{ id: 1, accountId: 1, month: '2024-12', balance: 42000 }],
      allMonths: ['2024-12'],
      setAccounts: vi.fn(),
      setBalances: vi.fn(),
    })

    renderTracker()

    const card = screen.getByTestId('year-card-2024')
    expect(within(card).getByText('$42,000')).toBeInTheDocument()
    expect(card.querySelector('[data-sgt-field="netIncome"]')).toHaveTextContent('—')
  })

  it('falls back to empty overrides when stored override data throws during load', () => {
    vi.mocked(appStorage.getJSON).mockImplementation(() => {
      throw new Error('broken storage')
    })
    mockUseData.mockReturnValue({
      accounts: [baseAccount],
      balances: [{ id: 1, accountId: 1, month: '2024-12', balance: 42000 }],
      allMonths: ['2024-12'],
      setAccounts: vi.fn(),
      setBalances: vi.fn(),
    })

    renderTracker('/net-worth/growth/income')

    expect(screen.getByTestId('year-card-2024')).toBeInTheDocument()
    expect(screen.queryByText('$100,000')).not.toBeInTheDocument()
  })

  it('renders a savings row from overrides alone and shows N/A net worth', () => {
    vi.mocked(appStorage.getJSON).mockReturnValue({ 2025: { netIncome: 90000, savings: 30000 } })

    renderTracker()

    const card = screen.getByTestId('year-card-2025')
    expect(within(card).getByText('Net Worth')).toBeInTheDocument()
    expect(card.querySelector('[data-sgt-field="netWorth"]')).toHaveTextContent('N/A')
    expect(card.querySelector('[data-sgt-field="netIncome"]')).toHaveTextContent('$90,000')
  })

  it('clears a saved override when the edited value is blank', async () => {
    const user = userEvent.setup()
    vi.mocked(appStorage.getJSON).mockReturnValue({ 2024: { grossIncome: 100000 } })
    mockUseData.mockReturnValue({
      accounts: [baseAccount],
      balances: [{ id: 1, accountId: 1, month: '2024-12', balance: 10000 }],
      allMonths: ['2024-12'],
      setAccounts: vi.fn(),
      setBalances: vi.fn(),
    })

    renderTracker('/net-worth/growth/income')

    await user.click(screen.getByRole('button', { name: '$100,000' }))
    const input = document.querySelector('.sgt-edit-input') as HTMLInputElement
    await user.clear(input)
    await user.tab()

    expect(vi.mocked(appStorage.setJSON)).toHaveBeenCalledWith('sgt-overrides', {})
  })

  it('shows zero deltas as dashes on the savings tab even after switching to percentage mode', async () => {
    const user = userEvent.setup()
    vi.mocked(loadBudgetStore).mockReturnValue({
      csvs: {
        '2023-01': { csv: '2023-csv', month: '2023-01', uploadedAt: '' },
        '2024-01': { csv: '2024-csv', month: '2024-01', uploadedAt: '' },
      },
      categoryGroups: [],
      configs: {},
      years: [2023, 2024],
    })
    vi.mocked(parseCSV).mockImplementation(csv => {
      if (csv === '2023-csv' || csv === '2024-csv') {
        return [
          { date: '2024-01-15', amount: 10000, category: 'Salary' },
          { date: '2024-01-20', amount: -4000, category: 'Rent' },
        ]
      }
      return []
    })
    mockUseData.mockReturnValue({
      accounts: [baseAccount],
      balances: [
        { id: 1, accountId: 1, month: '2023-12', balance: 80000 },
        { id: 2, accountId: 1, month: '2024-12', balance: 86000 },
      ],
      allMonths: ['2023-12', '2024-12'],
      setAccounts: vi.fn(),
      setBalances: vi.fn(),
    })

    renderTracker()

    const card = screen.getByTestId('year-card-2024')
    expect(within(card).getAllByText('—').length).toBeGreaterThanOrEqual(2)

    await user.click(screen.getByRole('button', { name: /Show YoY change as percentage/i }))
    expect(within(card).getAllByText('—').length).toBeGreaterThanOrEqual(2)
  })

  it('renders tax-rate deltas in points and percentages for falling tax rates', async () => {
    const user = userEvent.setup()
    vi.mocked(appStorage.getJSON).mockReturnValue({
      2023: { grossIncome: 100000, taxes: 30000 },
      2024: { grossIncome: 100000, taxes: 20000 },
    })
    mockUseData.mockReturnValue({
      accounts: [baseAccount],
      balances: [
        { id: 1, accountId: 1, month: '2023-12', balance: 50000 },
        { id: 2, accountId: 1, month: '2024-12', balance: 75000 },
      ],
      allMonths: ['2023-12', '2024-12'],
      setAccounts: vi.fn(),
      setBalances: vi.fn(),
    })

    renderTracker('/net-worth/growth/income')

    const card = screen.getByTestId('year-card-2024')
    expect(within(card).getByText('▼ 10.0 pts')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Show YoY change as percentage/i }))
    expect(within(card).getAllByText('▼ 33.3%').length).toBeGreaterThanOrEqual(2)
  })

  it('does not make budget-derived net income editable on the savings tab', () => {
    vi.mocked(loadBudgetStore).mockReturnValue({
      csvs: { '2024-01': { csv: '2024-csv', month: '2024-01', uploadedAt: '' } },
      categoryGroups: [],
      configs: {},
      years: [2024],
    })
    vi.mocked(parseCSV).mockReturnValue([
      { date: '2024-01-15', amount: 5000, category: 'Salary' },
      { date: '2024-01-20', amount: -2000, category: 'Rent' },
    ])
    mockUseData.mockReturnValue({
      accounts: [baseAccount],
      balances: [{ id: 1, accountId: 1, month: '2024-12', balance: 50000 }],
      allMonths: ['2024-12'],
      setAccounts: vi.fn(),
      setBalances: vi.fn(),
    })

    renderTracker()

    expect(screen.queryByRole('button', { name: '$5,000' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '$3,000' })).not.toBeInTheDocument()
  })

  it('opens editing from an editable dash when Space is pressed', async () => {
    const user = userEvent.setup()
    mockUseData.mockReturnValue({
      accounts: [baseAccount],
      balances: [{ id: 1, accountId: 1, month: '2024-12', balance: 10000 }],
      allMonths: ['2024-12'],
      setAccounts: vi.fn(),
      setBalances: vi.fn(),
    })

    renderTracker('/net-worth/growth/income')

    const editableDash = screen.getAllByRole('button', { name: '—' })[0]
    editableDash.focus()
    await user.keyboard(' ')

    expect(document.querySelector('.sgt-edit-input')).toBeInTheDocument()
  })
})
