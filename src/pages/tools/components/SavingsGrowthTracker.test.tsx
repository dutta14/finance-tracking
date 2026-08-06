import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import SavingsGrowthTracker from './SavingsGrowthTracker'
import { loadBudgetStore } from '../../budget/utils/budgetStorage'
import { parseCSV } from '../../budget/utils/csvParser'
import { appStorage } from '../../../utils/appStorage'

const mockUseData = vi.fn(() => ({
  accounts: [] as ReturnType<typeof import('../../../contexts/DataContext').useData>['accounts'],
  balances: [] as ReturnType<typeof import('../../../contexts/DataContext').useData>['balances'],
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

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.mocked(loadBudgetStore).mockReturnValue({ csvs: {}, categoryGroups: [], configs: {}, years: [] })
  vi.mocked(parseCSV).mockReturnValue([])
  vi.mocked(appStorage.getJSON).mockReturnValue({})
  mockUseData.mockReturnValue({
    accounts: [],
    balances: [],
    allMonths: [],
    setAccounts: vi.fn(),
    setBalances: vi.fn(),
  })
})

function renderTracker(initialRoute = '/net-worth/growth') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <SavingsGrowthTracker />
    </MemoryRouter>,
  )
}

describe('SavingsGrowthTracker', () => {
  it('renders empty state when no data is available', () => {
    renderTracker()
    expect(screen.getByText(/No data available/)).toBeInTheDocument()
  })

  it('renders year cards in descending order on the savings tab', () => {
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
        { id: 3, accountId: 1, month: '2024-12', balance: 100000 },
      ],
      allMonths: ['2022-12', '2023-12', '2024-12'],
      setAccounts: vi.fn(),
      setBalances: vi.fn(),
    })

    renderTracker()

    const cards = screen.getAllByLabelText(/Year /)
    expect(cards).toHaveLength(3)
    expect(cards[0]).toHaveAttribute('data-testid', 'year-card-2024')
    expect(cards[1]).toHaveAttribute('data-testid', 'year-card-2023')
    expect(cards[2]).toHaveAttribute('data-testid', 'year-card-2022')
  })

  it('renders savings metrics and net worth in each year card', () => {
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

    const card = screen.getByTestId('year-card-2024')
    expect(within(card).getByText('Net Worth')).toBeInTheDocument()
    expect(within(card).getByText('$50,000')).toBeInTheDocument()
    expect(within(card).getByText('Net Income')).toBeInTheDocument()
    expect(within(card).getByText('Expenses')).toBeInTheDocument()
    expect(within(card).getByText('Savings')).toBeInTheDocument()
    expect(within(card).getByText('Growth')).toBeInTheDocument()
    expect(within(card).getByText('$5,000')).toBeInTheDocument()
    expect(within(card).getByText('$2,000')).toBeInTheDocument()
    expect(within(card).getByText('$3,000')).toBeInTheDocument()
  })

  it('renders income metrics on the income route', () => {
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
          allocation: 'us-stock',
        },
      ],
      balances: [{ id: 1, accountId: 1, month: '2023-12', balance: 100000 }],
      allMonths: ['2023-12'],
      setAccounts: vi.fn(),
      setBalances: vi.fn(),
    })
    vi.mocked(appStorage.getJSON).mockReturnValue({ 2023: { grossIncome: 400000, taxes: 120000 } })

    renderTracker('/net-worth/growth/income')

    const card = screen.getByTestId('year-card-2023')
    expect(within(card).getByText('Gross Income')).toBeInTheDocument()
    expect(within(card).getByText('Taxes')).toBeInTheDocument()
    expect(within(card).getByText('Tax Rate')).toBeInTheDocument()
    expect(within(card).getByText('Net Income')).toBeInTheDocument()
    expect(within(card).getByText('$400,000')).toBeInTheDocument()
    expect(within(card).getByText('$120,000')).toBeInTheDocument()
    expect(within(card).getByText('30.0%')).toBeInTheDocument()
  })

  it('toggles YoY change format between dollars and percentages', async () => {
    const user = userEvent.setup()
    vi.mocked(loadBudgetStore).mockReturnValue({
      csvs: {
        '2022-06': { csv: '2022-csv', month: '2022-06', uploadedAt: '' },
        '2023-06': { csv: '2023-csv', month: '2023-06', uploadedAt: '' },
      },
      categoryGroups: [],
      configs: {},
      years: [2022, 2023],
    })
    vi.mocked(parseCSV).mockImplementation(csv => {
      if (csv === '2022-csv') {
        return [
          { date: '2022-06-01', amount: 10000, category: 'Salary' },
          { date: '2022-06-05', amount: -4000, category: 'Rent' },
        ]
      }
      return [
        { date: '2023-06-01', amount: 12000, category: 'Salary' },
        { date: '2023-06-05', amount: -5000, category: 'Rent' },
      ]
    })
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

    const toggleBtn = screen.getByRole('button', { name: /Show YoY change/i })
    expect(toggleBtn).toHaveTextContent('$')
    await user.click(toggleBtn)
    expect(toggleBtn).toHaveTextContent('%')
    expect(screen.getByText('▲ 16.7%')).toBeInTheDocument()
  })

  it('shows N/A for missing non-editable computed values', () => {
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

    const card = screen.getByTestId('year-card-2024')
    const naElements = within(card).getAllByText('N/A')
    expect(naElements.length).toBeGreaterThanOrEqual(2)
  })

  it('renders hint text for each tab', () => {
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

    const { unmount } = renderTracker()
    expect(screen.getByText(/Savings = Net Income from budget/)).toBeInTheDocument()

    unmount()
    renderTracker('/net-worth/growth/income')
    expect(screen.getByText(/Gross income and taxes are user-entered/)).toBeInTheDocument()
  })

  it('opens inline edit input when an editable dash is clicked', async () => {
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

    renderTracker('/net-worth/growth/income')
    await user.click(screen.getAllByRole('button', { name: '—' })[0])

    expect(document.querySelector('.sgt-edit-input')).toBeInTheDocument()
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

    renderTracker('/net-worth/growth/income')
    await user.click(screen.getAllByRole('button', { name: '—' })[0])

    const editInput = document.querySelector('.sgt-edit-input') as HTMLInputElement
    await user.type(editInput, '150000')
    await user.tab()

    expect(vi.mocked(appStorage.setJSON)).toHaveBeenCalled()
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

    renderTracker('/net-worth/growth/income')
    await user.click(screen.getAllByRole('button', { name: '—' })[0])

    expect(document.querySelector('.sgt-edit-input')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(document.querySelector('.sgt-edit-input')).not.toBeInTheDocument()
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

    renderTracker('/net-worth/growth/income')
    await user.click(screen.getAllByRole('button', { name: '—' })[0])

    const editInput = document.querySelector('.sgt-edit-input') as HTMLInputElement
    await user.type(editInput, '200000')
    await user.keyboard('{Enter}')

    expect(document.querySelector('.sgt-edit-input')).not.toBeInTheDocument()
    expect(screen.getAllByText('$200,000').length).toBeGreaterThan(0)
  })

  it('opens edit when Enter or Space is pressed on an editable value', async () => {
    const user = userEvent.setup()
    vi.mocked(appStorage.getJSON).mockReturnValue({ 2024: { grossIncome: 250000 } })
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

    renderTracker('/net-worth/growth/income')

    const editableValue = screen.getByRole('button', { name: '$250,000' })
    editableValue.focus()
    await user.keyboard('{Enter}')
    expect(document.querySelector('.sgt-edit-input')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    const editableValueAgain = screen.getByRole('button', { name: '$250,000' })
    editableValueAgain.focus()
    fireEvent.keyDown(editableValueAgain, { key: ' ' })
    expect(document.querySelector('.sgt-edit-input')).toBeInTheDocument()
  })

  it('excludes removed categories from budget calculations', () => {
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

    const card = screen.getByTestId('year-card-2024')
    expect(card.querySelector('[data-sgt-field="netIncome"]')).toHaveTextContent('$5,000')
    expect(card.querySelector('[data-sgt-field="expense"]')).toHaveTextContent('$0')
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

    const card = screen.getByTestId('year-card-2024')
    expect(within(card).getByText('$120,000')).toBeInTheDocument()
    expect(within(card).queryByText('$80,000')).not.toBeInTheDocument()
  })

  it('keeps data-sgt hooks on cards and metric values for test compatibility', () => {
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

    renderTracker('/net-worth/growth/income')

    const card = screen.getByTestId('year-card-2023')
    expect(card).toHaveAttribute('data-sgt-year', '2023')
    expect(within(card).getByText('2023')).toHaveAttribute('data-sgt-field', 'year')
    expect(card.querySelector('[data-sgt-field="grossIncome"]')).not.toBeNull()
    expect(card.querySelector('[data-sgt-field="taxes"]')).not.toBeNull()
    expect(card.querySelector('[data-sgt-field="taxRate"]')).not.toBeNull()
    expect(card.querySelector('[data-sgt-field="netIncome"]')).not.toBeNull()
  })
})
