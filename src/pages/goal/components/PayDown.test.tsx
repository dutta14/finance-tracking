import { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import PayDown from './PayDown'
import type { Account, BalanceEntry } from '../../data/types'

interface MockLoan {
  id: number
  type: 'loan' | 'credit-card'
  name: string
  principal: number
  annualRate: number
  termMonths: number
  startDate: string
  linkedAccountId: number
  monthlyPayment?: number
}

const { mockUseData, mockReadJSON, mockWriteJSON, mockSubscribe, mockUseDateFilter } = vi.hoisted(() => ({
  mockUseData: vi.fn(),
  mockReadJSON: vi.fn(),
  mockWriteJSON: vi.fn(() => Promise.resolve()),
  mockSubscribe: vi.fn(() => () => {}),
  mockUseDateFilter: vi.fn((allMonths: string[]) => ({
    dateFilter: 'all',
    setDateFilter: vi.fn(),
    customFrom: '',
    customTo: '',
    setCustomFrom: vi.fn(),
    setCustomTo: vi.fn(),
    setCustomMonth: vi.fn(),
    filteredMonths: allMonths,
    availableYears: ['2025', '2026'],
    monthOptions: [],
  })),
}))

vi.mock('../../../contexts/DataContext', () => ({
  useData: () => mockUseData(),
}))

vi.mock('../../../contexts/FileStoreContext', () => ({
  useFileStore: () => ({
    fileStore: {
      readJSON: mockReadJSON,
      writeJSON: mockWriteJSON,
      subscribe: mockSubscribe,
    },
  }),
}))

vi.mock('../../../hooks/useDateFilter', () => ({
  useDateFilter: (allMonths: string[]) => mockUseDateFilter(allMonths),
}))

vi.mock('../../../components/DateFilterBar', () => ({
  DateFilterBarFromHook: () => <div data-testid="date-filter-bar" />,
}))

vi.mock('../../../components/MonthPicker', () => ({
  default: ({ selectedMonth, onMonthChange }: { selectedMonth: string; onMonthChange: (month: string) => void }) => (
    <select aria-label="Start date" value={selectedMonth} onChange={event => onMonthChange(event.target.value)}>
      <option value="">Select a month</option>
      <option value="2025-01">Jan 2025</option>
      <option value="2025-02">Feb 2025</option>
      <option value="2026-01">Jan 2026</option>
    </select>
  ),
}))

vi.mock('../../../hooks/useFocusTrap', () => ({
  useFocusTrap: vi.fn(),
}))

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div data-testid="chart-container">{children}</div>,
  LineChart: ({ children }: { children: ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
}))

vi.mock('../../../styles/PayDown.css', () => ({}))

const accounts: Account[] = [
  {
    id: 1,
    name: 'Mortgage',
    type: 'illiquid',
    owner: 'joint',
    status: 'active',
    goalType: 'gw',
    nature: 'liability',
    allocation: 'real-estate',
  },
  {
    id: 2,
    name: 'Visa',
    type: 'liquid',
    owner: 'primary',
    status: 'active',
    goalType: 'gw',
    nature: 'liability',
    allocation: 'cash',
  },
  {
    id: 3,
    name: 'Brokerage',
    type: 'non-retirement',
    owner: 'primary',
    status: 'active',
    goalType: 'fi',
    nature: 'asset',
    allocation: 'us-stock',
  },
]

const balances: BalanceEntry[] = [
  { id: 1, accountId: 1, month: '2025-01', balance: -300000 },
  { id: 2, accountId: 1, month: '2026-01', balance: -295000 },
  { id: 3, accountId: 2, month: '2025-01', balance: -5000 },
  { id: 4, accountId: 2, month: '2025-02', balance: 0 },
]

const ongoingLoan: MockLoan = {
  id: 10,
  type: 'loan',
  name: 'Mortgage',
  principal: 300000,
  annualRate: 6,
  termMonths: 360,
  startDate: '2025-01',
  linkedAccountId: 1,
}

const completedCard: MockLoan = {
  id: 20,
  type: 'credit-card',
  name: 'Visa',
  principal: 5000,
  annualRate: 12,
  termMonths: 12,
  startDate: '2025-01',
  linkedAccountId: 2,
  monthlyPayment: 3000,
}

const setLoans = (loans: MockLoan[]) => {
  mockReadJSON.mockImplementation(async (_path: string, fallback: unknown) =>
    Array.isArray(fallback) ? loans : fallback,
  )
}

const renderPayDown = () => render(<PayDown />)

const getCompletedRowButton = (name: string) =>
  screen.getAllByRole('button').find(button => button.textContent?.includes(name) && button.textContent?.includes('$'))!

const clickDialogSubmit = () => {
  const dialog = screen.getByRole('dialog', { name: 'Add pay down loan' })
  fireEvent.click(within(dialog).getByRole('button', { name: /add|save/i }))
}

describe('PayDown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(Date, 'now').mockReturnValue(999)
    mockUseData.mockReturnValue({ accounts, balances })
    setLoans([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the empty state and opens loan and credit-card add flows', async () => {
    renderPayDown()

    expect(screen.getByText('Track loan payoff progress')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    fireEvent.click(screen.getByText('Add loan'))
    expect(screen.getByRole('dialog', { name: 'Add pay down loan' })).toBeInTheDocument()
    expect(screen.getByText('Add loan')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Add pay down loan' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    fireEvent.click(screen.getByText('Add credit card'))
    expect(screen.getByText('Add credit card')).toBeInTheDocument()
    expect(screen.getByText('Monthly payment ($)')).toBeInTheDocument()
  })

  it('validates loan form fields before saving', async () => {
    renderPayDown()

    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    fireEvent.click(screen.getByText('Add loan'))

    clickDialogSubmit()
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a loan name.')

    fireEvent.change(screen.getByPlaceholderText('Home Loan'), { target: { value: 'Mortgage' } })
    clickDialogSubmit()
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a principal greater than 0.')

    fireEvent.change(screen.getByPlaceholderText('300000'), { target: { value: '300000' } })
    clickDialogSubmit()
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid APR.')

    fireEvent.change(screen.getByPlaceholderText('6.5'), { target: { value: '6' } })
    clickDialogSubmit()
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a term in whole months.')

    fireEvent.change(screen.getByPlaceholderText('360'), { target: { value: '360' } })
    clickDialogSubmit()
    expect(screen.getByRole('alert')).toHaveTextContent('Select a valid start month.')

    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2025-01' } })
    clickDialogSubmit()
    expect(screen.getByRole('alert')).toHaveTextContent('Select a linked liability account.')
  })

  it('validates credit-card payment and saves a new loan', async () => {
    renderPayDown()

    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    fireEvent.click(screen.getByText('Add credit card'))

    fireEvent.change(screen.getByPlaceholderText('Chase Sapphire'), { target: { value: 'Visa' } })
    fireEvent.change(screen.getByPlaceholderText('5000'), { target: { value: '5000' } })
    fireEvent.change(screen.getByPlaceholderText('24.99'), { target: { value: '24' } })
    fireEvent.change(screen.getByPlaceholderText('200'), { target: { value: '50' } })
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2025-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Select account' }))
    fireEvent.click(screen.getByRole('option', { name: 'Visa' }))
    clickDialogSubmit()

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Monthly payment must exceed monthly interest to pay down the balance.',
    )

    fireEvent.change(screen.getByPlaceholderText('200'), { target: { value: '300' } })
    clickDialogSubmit()

    await waitFor(() => {
      expect(mockWriteJSON).toHaveBeenCalledWith(
        'paydown-loans.json',
        expect.arrayContaining([
          expect.objectContaining({
            id: 999,
            type: 'credit-card',
            name: 'Visa',
            linkedAccountId: 2,
            monthlyPayment: 300,
          }),
        ]),
      )
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders ongoing and completed cards, and supports edit and delete', async () => {
    setLoans([ongoingLoan, completedCard])
    renderPayDown()

    expect(await screen.findByRole('heading', { name: 'Mortgage' })).toBeInTheDocument()
    expect(screen.getByText('Progress')).toBeInTheDocument()
    expect(screen.getByTestId('date-filter-bar')).toBeInTheDocument()
    expect(screen.getByTestId('chart-container')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Completed' }))
    expect(screen.getByText('Visa')).toBeInTheDocument()
    expect(screen.getByText(/Jan 2025/i)).toBeInTheDocument()

    fireEvent.click(getCompletedRowButton('Visa'))
    const article = screen.getByText('Paid to date').closest('article')!
    expect(within(article).getByText('Paid to date')).toBeInTheDocument()

    fireEvent.click(within(article).getByRole('button', { name: 'Edit' }))
    const nameInput = screen.getByDisplayValue('Visa')
    fireEvent.change(nameInput, { target: { value: 'Visa Updated' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(mockWriteJSON).toHaveBeenCalledWith(
        'paydown-loans.json',
        expect.arrayContaining([expect.objectContaining({ id: 20, name: 'Visa Updated' })]),
      )
    })

    fireEvent.click(
      within(screen.getByText('Paid to date').closest('article')!).getByRole('button', { name: 'Delete' }),
    )
    await waitFor(() => {
      expect(mockWriteJSON).toHaveBeenCalledWith('paydown-loans.json', expect.not.arrayContaining([completedCard]))
    })
  })

  it('shows fallback copy for missing linked accounts and no actual balance history', async () => {
    setLoans([
      {
        id: 30,
        type: 'loan',
        name: 'Old Loan',
        principal: 1000,
        annualRate: 0,
        termMonths: 24,
        startDate: '2026-01',
        linkedAccountId: 99,
      },
    ])

    renderPayDown()

    await waitFor(() => {
      expect(screen.getByText('Linked liability account removed')).toBeInTheDocument()
    })
    expect(
      screen.getByText('No actual balance history found yet for this linked liability account.'),
    ).toBeInTheDocument()
  })

  it('closes add menus when clicking outside', async () => {
    setLoans([ongoingLoan])
    renderPayDown()

    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    expect(screen.getByText('Add credit card')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('Add credit card')).not.toBeInTheDocument()
  })
})
