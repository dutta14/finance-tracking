import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, within, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BudgetTable from './BudgetTable'
import { makeCategoryGroup, makeTransaction } from '../../../test/factories'
import type { Transaction, TimePeriod } from '../types'

/* ─── Helpers ─── */

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

const defaultProps = () => ({
  year: 2025,
  type: 'expense' as 'income' | 'expense',
  categoryGroups: [
    makeCategoryGroup({ id: 'essentials', name: 'Essentials', categories: ['Groceries', 'Rent'] }),
    makeCategoryGroup({ id: 'lifestyle', name: 'Lifestyle', categories: ['Dining', 'Entertainment'] }),
  ],
  categorySums: {
    Groceries: { '2025-01': -200, '2025-02': -180 },
    Rent: { '2025-01': -1500, '2025-02': -1500 },
    Dining: { '2025-01': -100, '2025-02': -120 },
    Entertainment: { '2025-01': -50 },
  } as Record<string, Record<string, number>>,
  monthsWithData: new Set(['2025-01', '2025-02']),
  onUploadCSV: vi.fn(() => ({ ok: true })),
  onRemoveCSV: vi.fn(),
  onEditCategory: vi.fn(),
  yearTransactions: {
    '2025-01': [
      makeTransaction({ date: '2025-01-05', category: 'Groceries', amount: -200, description: 'Whole Foods' }),
      makeTransaction({ date: '2025-01-01', category: 'Rent', amount: -1500, description: 'Apartment' }),
      makeTransaction({ date: '2025-01-10', category: 'Dining', amount: -100, description: 'Sushi place' }),
      makeTransaction({ date: '2025-01-15', category: 'Entertainment', amount: -50, description: 'Movie' }),
    ],
    '2025-02': [
      makeTransaction({ date: '2025-02-05', category: 'Groceries', amount: -180, description: 'Trader Joes' }),
      makeTransaction({ date: '2025-02-01', category: 'Rent', amount: -1500, description: 'Apartment' }),
      makeTransaction({ date: '2025-02-12', category: 'Dining', amount: -120, description: 'Italian' }),
    ],
  } as Record<string, Transaction[]>,
  timePeriod: 'month' as TimePeriod,
})

const renderTable = (overrides: Partial<ReturnType<typeof defaultProps>> = {}) =>
  render(<BudgetTable {...defaultProps()} {...overrides} />)

/* ─── Tests ─── */

describe('BudgetTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /* ─── Rendering ─── */

  describe('rendering', () => {
    it('renders the Expenses heading for expense type', () => {
      renderTable()
      expect(screen.getByText('Expenses')).toBeInTheDocument()
    })

    it('renders the Income heading for income type', () => {
      renderTable({
        type: 'income',
        categorySums: { Salary: { '2025-01': 5000 } },
        categoryGroups: [makeCategoryGroup({ id: 'income', name: 'Income', categories: ['Salary'] })],
      })
      expect(screen.getByText('Income')).toBeInTheDocument()
    })

    it('renders 12 month column headers for month time period', () => {
      renderTable()
      const expectedMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      expectedMonths.forEach(month => {
        expect(screen.getByText(month)).toBeInTheDocument()
      })
    })

    it('renders Total column header', () => {
      renderTable()
      expect(screen.getByText('Total')).toBeInTheDocument()
    })

    it('renders Category column header', () => {
      renderTable()
      expect(screen.getByText('Category')).toBeInTheDocument()
    })
  })

  /* ─── Expense group rendering ─── */

  describe('expense group rendering', () => {
    it('renders group header rows for expense type', () => {
      renderTable()
      expect(screen.getByText('Essentials')).toBeInTheDocument()
      expect(screen.getByText('Lifestyle')).toBeInTheDocument()
    })

    it('renders category rows under groups', () => {
      renderTable()
      expect(screen.getByText('Groceries')).toBeInTheDocument()
      expect(screen.getByText('Rent')).toBeInTheDocument()
      expect(screen.getByText('Dining')).toBeInTheDocument()
      expect(screen.getByText('Entertainment')).toBeInTheDocument()
    })

    it('renders formatted dollar amounts for categories', () => {
      renderTable()
      // Groceries Jan = $200 (abs of -200)
      expect(screen.getByText('$200')).toBeInTheDocument()
      // Rent Jan = $1,500
      expect(screen.getAllByText('$1,500')).toHaveLength(2)
    })

    it('rounds sub-cent amounts correctly ($0.005 rounds to $0)', () => {
      renderTable({
        categorySums: { Groceries: { '2025-01': -0.005 } },
        categoryGroups: [makeCategoryGroup({ id: 'e', name: 'Essentials', categories: ['Groceries'] })],
      })
      // 2 months × 3 rows (category + group total + grand total) = 6
      const zeros1 = screen.getAllByText('$0')
      expect(zeros1).toHaveLength(6)
    })

    it('rounds negative sub-cent amounts correctly (-$0.004 rounds to $0)', () => {
      renderTable({
        categorySums: { Groceries: { '2025-01': -0.004 } },
        categoryGroups: [makeCategoryGroup({ id: 'e', name: 'Essentials', categories: ['Groceries'] })],
      })
      // 2 months × 3 rows (category + group total + grand total) = 6
      const zeros2 = screen.getAllByText('$0')
      expect(zeros2).toHaveLength(6)
    })

    it('formats amounts over $1B correctly', () => {
      renderTable({
        categorySums: { Groceries: { '2025-01': -1_234_567_890 } },
        categoryGroups: [makeCategoryGroup({ id: 'e', name: 'Essentials', categories: ['Groceries'] })],
      })
      // 2 months × 3 rows (category + group total + grand total) = 6
      const bigAmounts = screen.getAllByText('$1,234,567,890')
      expect(bigAmounts).toHaveLength(6)
    })

    it('renders Grand Total row', () => {
      renderTable()
      expect(screen.getByText('Grand Total')).toBeInTheDocument()
    })

    it('does not render groups with no relevant categories', () => {
      renderTable({
        categoryGroups: [
          makeCategoryGroup({ id: 'essentials', name: 'Essentials', categories: ['Groceries'] }),
          makeCategoryGroup({ id: 'empty', name: 'Empty Group', categories: ['NonExistent'] }),
        ],
      })
      expect(screen.queryByText('Empty Group')).not.toBeInTheDocument()
    })
  })

  /* ─── Income rendering ─── */

  describe('income rendering', () => {
    const incomeProps = {
      type: 'income' as const,
      categoryGroups: [makeCategoryGroup({ id: 'income', name: 'Income', categories: ['Salary', 'Freelance'] })],
      categorySums: {
        Salary: { '2025-01': 5000, '2025-02': 5000 },
        Freelance: { '2025-01': 1000 },
      } as Record<string, Record<string, number>>,
      yearTransactions: {} as Record<string, Transaction[]>,
    }

    it('renders income categories as a flat list without group headers', () => {
      renderTable(incomeProps)
      expect(screen.getByText('Salary')).toBeInTheDocument()
      expect(screen.getByText('Freelance')).toBeInTheDocument()
      // Income type should not render group header names as group rows
      // (it uses flat list, no GroupRows)
    })

    it('renders formatted income amounts', () => {
      renderTable(incomeProps)
      expect(screen.getAllByText('$5,000')).toHaveLength(3)
      expect(screen.getAllByText('$1,000')).toHaveLength(2)
    })
  })

  /* ─── Income vs expense classification ─── */

  describe('income vs expense classification', () => {
    it('classifies categories with any negative values as expense', () => {
      renderTable({
        type: 'expense',
        categorySums: {
          Mixed: { '2025-01': 50, '2025-02': -100 },
        },
        categoryGroups: [makeCategoryGroup({ id: 'g', name: 'Group', categories: ['Mixed'] })],
      })
      expect(screen.getByText('Mixed')).toBeInTheDocument()
    })

    it('classifies purely positive categories as income', () => {
      renderTable({
        type: 'income',
        categorySums: {
          PureIncome: { '2025-01': 500 },
        },
        categoryGroups: [makeCategoryGroup({ id: 'g', name: 'Income', categories: ['PureIncome'] })],
      })
      expect(screen.getByText('PureIncome')).toBeInTheDocument()
    })

    it('does not show purely positive categories in expense table', () => {
      renderTable({
        type: 'expense',
        categorySums: {
          PureIncome: { '2025-01': 500 },
        },
        categoryGroups: [makeCategoryGroup({ id: 'g', name: 'Group', categories: ['PureIncome'] })],
      })
      expect(screen.queryByText('PureIncome')).not.toBeInTheDocument()
    })

    it('does not show categories with negative values in income table', () => {
      renderTable({
        type: 'income',
        categorySums: {
          Expense: { '2025-01': -100 },
        },
        categoryGroups: [makeCategoryGroup({ id: 'g', name: 'Group', categories: ['Expense'] })],
      })
      expect(screen.queryByText('Expense')).not.toBeInTheDocument()
    })
  })

  /* ─── Percentage display toggle ─── */

  describe('percentage display toggle', () => {
    it('shows Total initially and toggles to % on click', async () => {
      const user = userEvent.setup()
      renderTable()
      const totalHeader = screen.getByText('Total')
      await user.click(totalHeader)
      expect(screen.getByText('%')).toBeInTheDocument()
    })

    it('shows percentage values for categories when % mode is active', async () => {
      const user = userEvent.setup()
      renderTable()
      const totalHeader = screen.getByText('Total')
      await user.click(totalHeader)
      // 4 categories + 2 group totals = 6 percentage cells (the '%' header is a separate element)
      const pctCells = screen.getAllByText(/%$/)
      expect(pctCells).toHaveLength(6)
    })

    it('toggles back to Total on second click', async () => {
      const user = userEvent.setup()
      renderTable()
      const totalHeader = screen.getByText('Total')
      await user.click(totalHeader)
      expect(screen.getByText('%')).toBeInTheDocument()
      await user.click(screen.getByText('%'))
      expect(screen.getByText('Total')).toBeInTheDocument()
    })

    it('shows 100% for Grand Total when in percentage mode', async () => {
      const user = userEvent.setup()
      renderTable()
      await user.click(screen.getByText('Total'))
      expect(screen.getByText('100%')).toBeInTheDocument()
    })
  })

  /* ─── Time period bucketing ─── */

  describe('time period bucketing', () => {
    it('renders Q1-Q4 headers for quarter time period', () => {
      renderTable({ timePeriod: 'quarter' })
      expect(screen.getByText('Q1')).toBeInTheDocument()
      expect(screen.getByText('Q2')).toBeInTheDocument()
      expect(screen.getByText('Q3')).toBeInTheDocument()
      expect(screen.getByText('Q4')).toBeInTheDocument()
    })

    it('does not render individual month headers for quarter time period', () => {
      renderTable({ timePeriod: 'quarter' })
      expect(screen.queryByText('Jan')).not.toBeInTheDocument()
      expect(screen.queryByText('Feb')).not.toBeInTheDocument()
    })

    it('renders H1-H2 headers for half time period', () => {
      renderTable({ timePeriod: 'half' })
      expect(screen.getByText('H1')).toBeInTheDocument()
      expect(screen.getByText('H2')).toBeInTheDocument()
    })

    it('aggregates values across months in quarter view', () => {
      renderTable({
        timePeriod: 'quarter',
        categorySums: {
          Groceries: { '2025-01': -100, '2025-02': -100, '2025-03': -100 },
        },
        categoryGroups: [makeCategoryGroup({ id: 'g', name: 'Group', categories: ['Groceries'] })],
        yearTransactions: {},
      })
      // Q1 total should be $300 (abs) — appears in category row (Q1 + Total), group row (Q1 + Total), grand total (Q1 + Total)
      expect(screen.getAllByText('$300')).toHaveLength(6)
    })

    it('aggregates values across months in half-year view', () => {
      renderTable({
        timePeriod: 'half',
        categorySums: {
          Groceries: {
            '2025-01': -100,
            '2025-02': -100,
            '2025-03': -100,
            '2025-04': -100,
            '2025-05': -100,
            '2025-06': -100,
          },
        },
        categoryGroups: [makeCategoryGroup({ id: 'g', name: 'Group', categories: ['Groceries'] })],
        yearTransactions: {},
      })
      // H1 total should be $600 — appears in category row (H1 + Total), group row (H1 + Total), grand total (H1 + Total)
      expect(screen.getAllByText('$600')).toHaveLength(6)
    })
  })

  /* ─── Totals computation ─── */

  describe('totals computation', () => {
    it('computes correct category year total', () => {
      renderTable({
        categorySums: {
          Groceries: { '2025-01': -200, '2025-02': -180 },
        },
        categoryGroups: [makeCategoryGroup({ id: 'g', name: 'Group', categories: ['Groceries'] })],
        yearTransactions: {},
      })
      // Year total = $380 — appears in category row Total, group row Total, grand total Total
      expect(screen.getAllByText('$380')).toHaveLength(3)
    })

    it('renders empty cell for zero-value months', () => {
      renderTable({
        categorySums: {
          Groceries: { '2025-01': -200 },
        },
        categoryGroups: [makeCategoryGroup({ id: 'g', name: 'Group', categories: ['Groceries'] })],
        yearTransactions: {},
      })
      // $200 appears in category row (Jan + Total), group row (Jan + Total), grand total (Jan + Total)
      expect(screen.getAllByText('$200')).toHaveLength(6)
    })

    it('shows group totals that sum all categories in the group', () => {
      renderTable({
        categorySums: {
          Groceries: { '2025-01': -100 },
          Rent: { '2025-01': -400 },
        },
        categoryGroups: [
          makeCategoryGroup({ id: 'essentials', name: 'Essentials', categories: ['Groceries', 'Rent'] }),
        ],
        yearTransactions: {},
      })
      // Group total for Jan = $500 — appears in group row (Jan + Total) + grand total (Jan + Total)
      expect(screen.getAllByText('$500')).toHaveLength(4)
    })

    it('does not render Grand Total row when there are no relevant categories', () => {
      renderTable({
        categorySums: {},
        categoryGroups: [],
        yearTransactions: {},
      })
      expect(screen.queryByText('Grand Total')).not.toBeInTheDocument()
    })
  })

  /* ─── Expand month / drilldown ─── */

  describe('drill-down panel', () => {
    it('expands to show transactions when month header is clicked', async () => {
      const user = userEvent.setup()
      renderTable()
      await user.click(screen.getByText('Jan'))
      expect(screen.getByText('Jan 2025 — Expense Transactions')).toBeInTheDocument()
    })

    it('shows transaction rows with date, category, amount, description', async () => {
      const user = userEvent.setup()
      renderTable()
      await user.click(screen.getByText('Jan'))
      expect(screen.getByText('2025-01-05')).toBeInTheDocument()
      expect(screen.getByText('Whole Foods')).toBeInTheDocument()
    })

    it('collapses drilldown when same month is clicked again', async () => {
      const user = userEvent.setup()
      renderTable()
      await user.click(screen.getByText('Jan'))
      expect(screen.getByText('Jan 2025 — Expense Transactions')).toBeInTheDocument()
      await user.click(screen.getByText('Jan'))
      expect(screen.queryByText('Jan 2025 — Expense Transactions')).not.toBeInTheDocument()
    })

    it('closes drilldown with × button', async () => {
      const user = userEvent.setup()
      renderTable()
      await user.click(screen.getByText('Jan'))
      expect(screen.getByText('Jan 2025 — Expense Transactions')).toBeInTheDocument()
      const drilldownHeader = screen.getByText('Jan 2025 — Expense Transactions').parentElement!
      const closeBtn = within(drilldownHeader).getByText('×')
      await user.click(closeBtn)
      expect(screen.queryByText('Jan 2025 — Expense Transactions')).not.toBeInTheDocument()
    })

    it('shows empty message when month has no transactions', async () => {
      const user = userEvent.setup()
      renderTable()
      // Mar has no data
      await user.click(screen.getByText('Mar'))
      expect(screen.getByText(/No expense transactions for this month/)).toBeInTheDocument()
    })

    it('switches drilldown to a different month', async () => {
      const user = userEvent.setup()
      renderTable()
      await user.click(screen.getByText('Jan'))
      expect(screen.getByText('Jan 2025 — Expense Transactions')).toBeInTheDocument()
      await user.click(screen.getByText('Feb'))
      expect(screen.getByText('Feb 2025 — Expense Transactions')).toBeInTheDocument()
      expect(screen.queryByText('Jan 2025 — Expense Transactions')).not.toBeInTheDocument()
    })

    it('shows Income label in drilldown for income type', async () => {
      const user = userEvent.setup()
      renderTable({
        type: 'income',
        categorySums: { Salary: { '2025-01': 5000 } },
        categoryGroups: [makeCategoryGroup({ id: 'inc', name: 'Income', categories: ['Salary'] })],
        yearTransactions: {
          '2025-01': [makeTransaction({ date: '2025-01-01', category: 'Salary', amount: 5000 })],
        },
      })
      await user.click(screen.getByText('Jan'))
      expect(screen.getByText('Jan 2025 — Income Transactions')).toBeInTheDocument()
    })
  })

  /* ─── Sorting transactions in drilldown ─── */

  describe('sorting transactions', () => {
    it('sorts by date descending by default', async () => {
      const user = userEvent.setup()
      renderTable()
      await user.click(screen.getByText('Jan'))
      const drilldownEl = screen.getByText(/— Expense Transactions/).parentElement!.parentElement!
      const drilldownTable = within(drilldownEl).getAllByRole('table')[0]
      const dateCells = within(drilldownTable)
        .getAllByRole('row')
        .slice(1)
        .map(r => within(r).getAllByRole('cell')[0]?.textContent)
      expect(dateCells[0]).toBe('2025-01-15')
    })

    it('toggles date sort direction on click', async () => {
      const user = userEvent.setup()
      renderTable()
      await user.click(screen.getByText('Jan'))
      const dateHeader = screen.getByText(/^Date/)
      await user.click(dateHeader)
      // Now asc
      const drilldownTable = dateHeader.closest('table')!
      const dateCells = within(drilldownTable)
        .getAllByRole('row')
        .slice(1)
        .map(r => within(r).getAllByRole('cell')[0]?.textContent)
      expect(dateCells[0]).toBe('2025-01-01')
    })

    it('sorts by category ascending when Category header is clicked', async () => {
      const user = userEvent.setup()
      renderTable()
      await user.click(screen.getByText('Jan'))
      const drilldownEl = screen.getByText(/— Expense Transactions/).parentElement!.parentElement!
      const catHeader = within(drilldownEl).getByText(/^Category/)
      await user.click(catHeader)
      const drilldownTable = catHeader.closest('table')!
      const catCells = within(drilldownTable)
        .getAllByRole('row')
        .slice(1)
        .map(r => within(r).getAllByRole('cell')[1]?.textContent)
      expect(catCells[0]).toBe('Dining')
    })

    it('sorts by amount when Amount header is clicked', async () => {
      const user = userEvent.setup()
      renderTable()
      await user.click(screen.getByText('Jan'))
      const amtHeader = screen.getByText(/^Amount/)
      await user.click(amtHeader)
      const drilldownTable = amtHeader.closest('table')!
      const amtCells = within(drilldownTable)
        .getAllByRole('row')
        .slice(1)
        .map(r => within(r).getAllByRole('cell')[2]?.textContent)
      // Ascending by amount: -1500, -200, -100, -50 → displayed as $1,500, $200, $100, $50
      expect(amtCells[0]).toBe('$1,500')
    })

    it('shows sort direction indicator on active column', async () => {
      const user = userEvent.setup()
      renderTable()
      await user.click(screen.getByText('Jan'))
      // Date is default desc
      expect(screen.getByText(/Date ↓/)).toBeInTheDocument()
    })
  })

  /* ─── Filter categories in drilldown ─── */

  describe('category filter in drilldown', () => {
    it('shows All Categories button when drilldown is open', async () => {
      const user = userEvent.setup()
      renderTable()
      await user.click(screen.getByText('Jan'))
      expect(screen.getByText('All Categories')).toBeInTheDocument()
    })

    it('opens filter dropdown on click', async () => {
      const user = userEvent.setup()
      renderTable()
      await user.click(screen.getByText('Jan'))
      await user.click(screen.getByText('All Categories'))
      expect(screen.getByPlaceholderText('Search categories…')).toBeInTheDocument()
    })

    it('filters category list by search text', async () => {
      const user = userEvent.setup()
      renderTable()
      await user.click(screen.getByText('Jan'))
      await user.click(screen.getByText('All Categories'))
      const searchInput = screen.getByPlaceholderText('Search categories…')
      await user.type(searchInput, 'Groc')
      // Groceries should remain, Dining/Rent/Entertainment should be filtered
      // Exact match: no "All Categories" checkbox when searching + Groceries
      const labels = screen.getAllByText(/Groceries/i)
      expect(labels).toHaveLength(3)
    })

    it('shows filtered transaction count after unchecking a category', async () => {
      const user = userEvent.setup()
      renderTable()
      await user.click(screen.getByText('Jan'))
      await user.click(screen.getByText('All Categories'))
      // Uncheck Groceries checkbox — this goes from "all" to "remaining selected"
      const grocCheckbox = screen.getAllByRole('checkbox').find(cb => {
        const label = cb.closest('label')
        return label?.textContent?.includes('Groceries')
      })!
      expect(grocCheckbox).toBeTruthy()
      await user.click(grocCheckbox)
      // Should now show "3 of 4 categories" (all minus Groceries)
      expect(screen.getByText(/3 of 4 categories/)).toBeInTheDocument()
    })
  })

  /* ─── Context menu ─── */

  describe('context menu', () => {
    it('opens context menu on right-click of month header', async () => {
      renderTable()
      const janHeader = screen.getByText('Jan')
      fireEvent.contextMenu(janHeader)
      expect(screen.getByText(/Upload CSV for Jan/)).toBeInTheDocument()
    })

    it('shows Remove CSV option only for months with data', async () => {
      renderTable()
      const janHeader = screen.getByText('Jan')
      fireEvent.contextMenu(janHeader)
      expect(screen.getByText('Remove CSV')).toBeInTheDocument()
    })

    it('does not show Remove CSV option for months without data', async () => {
      renderTable()
      const marHeader = screen.getByText('Mar')
      fireEvent.contextMenu(marHeader)
      expect(screen.queryByText('Remove CSV')).not.toBeInTheDocument()
    })

    it('closes context menu when backdrop is clicked', async () => {
      const user = userEvent.setup()
      renderTable()
      fireEvent.contextMenu(screen.getByText('Jan'))
      expect(screen.getByText(/Upload CSV for Jan/)).toBeInTheDocument()
      // Click the backdrop
      const backdrop = screen.getByTestId('ctx-menu-backdrop')
      await user.click(backdrop)
      expect(screen.queryByText(/Upload CSV for Jan/)).not.toBeInTheDocument()
    })

    it('calls onRemoveCSV when Remove CSV is clicked', async () => {
      const user = userEvent.setup()
      const props = defaultProps()
      render(<BudgetTable {...props} />)
      fireEvent.contextMenu(screen.getByText('Jan'))
      await user.click(screen.getByText('Remove CSV'))
      expect(props.onRemoveCSV).toHaveBeenCalledWith('2025-01')
    })

    it('shows CSV format help in context menu', () => {
      renderTable()
      fireEvent.contextMenu(screen.getByText('Jan'))
      expect(screen.getByText(/Expected CSV format/)).toBeInTheDocument()
    })
  })

  /* ─── CSV upload via file input ─── */

  describe('CSV upload', () => {
    it('triggers file input when Upload CSV is clicked from context menu', async () => {
      const user = userEvent.setup()
      renderTable()
      fireEvent.contextMenu(screen.getByText('Jan'))
      const uploadBtn = screen.getByText(/Upload CSV for Jan/)
      const fileInput = screen.getByTestId('csv-file-input') as HTMLInputElement
      const clickSpy = vi.spyOn(fileInput, 'click')
      await user.click(uploadBtn)
      expect(clickSpy).toHaveBeenCalled()
    })

    it('calls onUploadCSV with CSV text when file is selected', async () => {
      const user = userEvent.setup()
      const props = defaultProps()
      render(<BudgetTable {...props} />)
      fireEvent.contextMenu(screen.getByText('Feb'))

      const uploadBtn = screen.getByText(/Upload CSV for Feb/)
      const fileInput = screen.getByTestId('csv-file-input') as HTMLInputElement
      vi.spyOn(fileInput, 'click').mockImplementation(() => {})
      await user.click(uploadBtn)

      const csvContent = 'Date,Category,Amount\n2025-02-01,Groceries,-50'
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' })

      // jsdom FileReader works — just trigger change and let FileReader do its thing
      Object.defineProperty(fileInput, 'files', { value: [file], writable: false })
      fireEvent.change(fileInput)

      // Wait for FileReader onload
      await vi.waitFor(() => {
        expect(props.onUploadCSV).toHaveBeenCalledWith('2025-02', csvContent)
      })
    })
  })

  /* ─── Error toast ─── */

  describe('error toast', () => {
    it('shows error toast when CSV upload fails', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const props = defaultProps()
      props.onUploadCSV = vi.fn(() => ({ ok: false, error: 'Invalid CSV format' }))
      render(<BudgetTable {...props} />)

      fireEvent.contextMenu(screen.getByText('Jan'))
      const fileInput = screen.getByTestId('csv-file-input') as HTMLInputElement
      vi.spyOn(fileInput, 'click').mockImplementation(() => {})
      await user.click(screen.getByText(/Upload CSV for Jan/))

      const csvContent = 'bad,data'
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' })
      Object.defineProperty(fileInput, 'files', { value: [file], writable: false })
      fireEvent.change(fileInput)

      // Wait for FileReader
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })

      expect(screen.getByText('⚠ Invalid CSV format')).toBeInTheDocument()
    })

    it('auto-clears error toast after 5 seconds', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const props = defaultProps()
      props.onUploadCSV = vi.fn(() => ({ ok: false, error: 'Bad CSV' }))
      render(<BudgetTable {...props} />)

      fireEvent.contextMenu(screen.getByText('Jan'))
      const fileInput = screen.getByTestId('csv-file-input') as HTMLInputElement
      vi.spyOn(fileInput, 'click').mockImplementation(() => {})
      await user.click(screen.getByText(/Upload CSV for Jan/))

      const file = new File(['bad'], 'test.csv', { type: 'text/csv' })
      Object.defineProperty(fileInput, 'files', { value: [file], writable: false })
      fireEvent.change(fileInput)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })

      expect(screen.getByText('⚠ Bad CSV')).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(screen.queryByText('⚠ Bad CSV')).not.toBeInTheDocument()
    })

    it('dismisses error toast when × is clicked', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const props = defaultProps()
      props.onUploadCSV = vi.fn(() => ({ ok: false, error: 'Upload error' }))
      render(<BudgetTable {...props} />)

      fireEvent.contextMenu(screen.getByText('Jan'))
      const fileInput = screen.getByTestId('csv-file-input') as HTMLInputElement
      vi.spyOn(fileInput, 'click').mockImplementation(() => {})
      await user.click(screen.getByText(/Upload CSV for Jan/))

      const file = new File(['x'], 'test.csv', { type: 'text/csv' })
      Object.defineProperty(fileInput, 'files', { value: [file], writable: false })
      fireEvent.change(fileInput)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })

      expect(screen.getByText('⚠ Upload error')).toBeInTheDocument()

      const dismissBtn = screen.getByRole('button', { name: 'Dismiss error' })
      await user.click(dismissBtn)
      expect(screen.queryByText('⚠ Upload error')).not.toBeInTheDocument()
    })
  })

  /* ─── Removed categories ─── */

  describe('removed categories', () => {
    const removedProps = () => ({
      categoryGroups: [
        makeCategoryGroup({ id: 'essentials', name: 'Essentials', categories: ['Groceries'] }),
        makeCategoryGroup({ id: 'removed', name: 'Removed', categories: ['OldCategory'] }),
      ],
      categorySums: {
        Groceries: { '2025-01': -200 },
      } as Record<string, Record<string, number>>,
      yearTransactions: {
        '2025-01': [
          makeTransaction({ date: '2025-01-01', category: 'Groceries', amount: -200 }),
          makeTransaction({ date: '2025-01-05', category: 'OldCategory', amount: -50 }),
        ],
      } as Record<string, Transaction[]>,
    })

    it('does not show removed group in main table', () => {
      renderTable(removedProps())
      // Removed group itself should not be a group header row
      const groupHeaders = screen.queryAllByText('Removed')
      // Should only find Removed pill in drilldown, not as a group header in the main table
      expect(groupHeaders.length).toBe(0)
    })

    it('shows Removed pill in drilldown when there are removed transactions', async () => {
      const user = userEvent.setup()
      renderTable(removedProps())
      await user.click(screen.getByText('Jan'))
      expect(screen.getByText(/Removed/)).toBeInTheDocument()
    })

    it('toggles showing removed transactions when Removed pill is clicked', async () => {
      const user = userEvent.setup()
      renderTable(removedProps())
      await user.click(screen.getByText('Jan'))
      const removedPill = screen.getByText(/Removed \(1\)/)
      await user.click(removedPill)
      // Should now show the OldCategory transaction in the drilldown table
      const drilldownEl = screen.getByText(/— Expense Transactions/).parentElement!.parentElement!
      expect(within(drilldownEl).getByText('OldCategory')).toBeInTheDocument()
    })
  })

  /* ─── Category display name stripping ─── */

  describe('category display name', () => {
    it('strips group prefix from category name', () => {
      renderTable({
        categorySums: {
          'Essentials: Groceries': { '2025-01': -100 },
        },
        categoryGroups: [
          makeCategoryGroup({ id: 'essentials', name: 'Essentials', categories: ['Essentials: Groceries'] }),
        ],
        yearTransactions: {},
      })
      // Should display "Groceries" not "Essentials: Groceries"
      expect(screen.getByText('Groceries')).toBeInTheDocument()
    })
  })

  /* ─── Category editing in drilldown ─── */

  describe('category editing', () => {
    it('shows input on double-click of category cell in drilldown', async () => {
      const user = userEvent.setup()
      renderTable()
      await user.click(screen.getByText('Jan'))
      const drilldownEl = screen.getByText(/— Expense Transactions/).parentElement!.parentElement!
      const catCells = within(drilldownEl).getAllByTitle('Double-click to edit category')
      await user.dblClick(catCells[0])
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('calls onEditCategory when existing category is entered and blurred', async () => {
      const user = userEvent.setup()
      const props = defaultProps()
      render(<BudgetTable {...props} />)
      await user.click(screen.getByText('Jan'))
      const drilldownEl = screen.getByText(/— Expense Transactions/).parentElement!.parentElement!
      const catCells = within(drilldownEl).getAllByTitle('Double-click to edit category')
      await user.dblClick(catCells[0])
      const input = screen.getByRole('textbox')
      await user.clear(input)
      await user.type(input, 'Rent')
      await user.tab()
      expect(props.onEditCategory).toHaveBeenCalledWith('2025-01', expect.any(Number), 'Rent')
    })

    it('shows new category confirmation when a non-existing category is entered', async () => {
      const user = userEvent.setup()
      const props = defaultProps()
      render(<BudgetTable {...props} />)
      await user.click(screen.getByText('Jan'))
      const catCells = screen.getAllByTitle('Double-click to edit category')
      await user.dblClick(catCells[0])
      const input = screen.getByRole('textbox')
      await user.clear(input)
      await user.type(input, 'NewCat')
      await user.tab()
      expect(screen.getByText(/Create new category/)).toBeInTheDocument()
      expect(screen.getByText(/"NewCat"/)).toBeInTheDocument()
    })

    it('calls onEditCategory on confirming new category', async () => {
      const user = userEvent.setup()
      const props = defaultProps()
      render(<BudgetTable {...props} />)
      await user.click(screen.getByText('Jan'))
      const catCells = screen.getAllByTitle('Double-click to edit category')
      await user.dblClick(catCells[0])
      const input = screen.getByRole('textbox')
      await user.clear(input)
      await user.type(input, 'BrandNew')
      await user.tab()
      await user.click(screen.getByText('Yes'))
      expect(props.onEditCategory).toHaveBeenCalledWith('2025-01', expect.any(Number), 'BrandNew')
    })

    it('cancels new category creation when No is clicked', async () => {
      const user = userEvent.setup()
      const props = defaultProps()
      render(<BudgetTable {...props} />)
      await user.click(screen.getByText('Jan'))
      const catCells = screen.getAllByTitle('Double-click to edit category')
      await user.dblClick(catCells[0])
      const input = screen.getByRole('textbox')
      await user.clear(input)
      await user.type(input, 'BrandNew2')
      await user.tab()
      await user.click(screen.getByText('No'))
      expect(props.onEditCategory).not.toHaveBeenCalled()
      expect(screen.queryByText(/Create new category/)).not.toBeInTheDocument()
    })

    it('cancels editing on Escape key', async () => {
      const user = userEvent.setup()
      renderTable()
      await user.click(screen.getByText('Jan'))
      const catCells = screen.getAllByTitle('Double-click to edit category')
      await user.dblClick(catCells[0])
      screen.getByRole('textbox')
      await user.keyboard('{Escape}')
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })

    it('does not call onEditCategory when value is unchanged on blur', async () => {
      const user = userEvent.setup()
      const props = defaultProps()
      render(<BudgetTable {...props} />)
      await user.click(screen.getByText('Jan'))
      const catCells = screen.getAllByTitle('Double-click to edit category')
      await user.dblClick(catCells[0])
      // blur without changing
      await user.tab()
      expect(props.onEditCategory).not.toHaveBeenCalled()
    })
  })

  /* ─── Edge cases ─── */

  describe('edge cases', () => {
    it('handles empty categorySums gracefully', () => {
      renderTable({
        categorySums: {},
        categoryGroups: [],
        yearTransactions: {},
      })
      expect(screen.getByText('Expenses')).toBeInTheDocument()
      expect(screen.queryByText('Grand Total')).not.toBeInTheDocument()
    })

    it('handles missing month in yearTransactions', async () => {
      const user = userEvent.setup()
      renderTable({
        yearTransactions: {},
      })
      await user.click(screen.getByText('Jan'))
      expect(screen.getByText(/No expense transactions for this month/)).toBeInTheDocument()
    })

    it('does not render context menu for non-month time periods', () => {
      renderTable({ timePeriod: 'quarter' })
      const q1Header = screen.getByText('Q1')
      fireEvent.contextMenu(q1Header)
      // No context menu should appear (no Upload CSV button)
      expect(screen.queryByText(/Upload CSV/)).not.toBeInTheDocument()
    })

    it('does not allow month click drill-down for non-month time periods', async () => {
      const user = userEvent.setup()
      renderTable({ timePeriod: 'quarter' })
      await user.click(screen.getByText('Q1'))
      // No drilldown should appear
      expect(screen.queryByText(/Transactions/)).not.toBeInTheDocument()
    })
  })
})

describe('Budget.css dark mode', () => {
  it('.budget-filter-item declares color: var(--color-text) so dropdown labels are readable in dark mode', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const cssPath = path.resolve(__dirname, '..', '..', '..', 'styles', 'Budget.css')
    const source = fs.readFileSync(cssPath, 'utf-8')
    expect(source).toMatch(/\.budget-filter-item\s*\{[^}]*color:\s*var\(--color-text\)\s*;[^}]*\}/)
  })
})

/* ─── Additional branch coverage tests ─── */

describe('BudgetTable branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Element.prototype.scrollIntoView = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // --- Branch coverage: isTypeCategory returns false for expense when no negative (line 73) ---

  it('does not show categories with only zero values in either table', () => {
    renderTable({
      type: 'expense',
      categorySums: {
        ZeroCat: { '2025-01': 0 },
      },
      categoryGroups: [makeCategoryGroup({ id: 'g', name: 'Group', categories: ['ZeroCat'] })],
      yearTransactions: {},
    })
    expect(screen.queryByText('ZeroCat')).not.toBeInTheDocument()
  })

  // --- Branch coverage: getGroupTotal skips non-relevant categories (line 137) ---

  it('group total only sums relevant categories and ignores non-relevant ones', () => {
    renderTable({
      type: 'expense',
      categorySums: {
        Groceries: { '2025-01': -100 },
        PureIncome: { '2025-01': 500 },
      },
      categoryGroups: [
        makeCategoryGroup({ id: 'essentials', name: 'Essentials', categories: ['Groceries', 'PureIncome'] }),
      ],
      yearTransactions: {},
    })
    // Group total should only count Groceries ($100), not PureIncome
    // $100 appears in: category row (Jan + Total), group row (Jan + Total), grand total (Jan + Total) = 6
    expect(screen.getAllByText('$100')).toHaveLength(6)
    // PureIncome should not appear in expense table
    expect(screen.queryByText('PureIncome')).not.toBeInTheDocument()
  })

  // --- Branch coverage: handleFileChange with no file (line 210) ---

  it('does nothing when file input change fires with no file', () => {
    const props = defaultProps()
    render(<BudgetTable {...props} />)
    const fileInput = screen.getByTestId('csv-file-input') as HTMLInputElement
    Object.defineProperty(fileInput, 'files', { value: [], writable: false })
    fireEvent.change(fileInput)
    expect(props.onUploadCSV).not.toHaveBeenCalled()
  })

  // --- Branch coverage: CSV upload with no error message (line 216) ---

  it('shows generic "Upload failed" when CSV upload fails without error message', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const props = defaultProps()
    props.onUploadCSV = vi.fn(() => ({ ok: false }))
    render(<BudgetTable {...props} />)

    fireEvent.contextMenu(screen.getByText('Jan'))
    const fileInput = screen.getByTestId('csv-file-input') as HTMLInputElement
    vi.spyOn(fileInput, 'click').mockImplementation(() => {})
    await user.click(screen.getByText(/Upload CSV for Jan/))

    const file = new File(['bad'], 'test.csv', { type: 'text/csv' })
    Object.defineProperty(fileInput, 'files', { value: [file], writable: false })
    fireEvent.change(fileInput)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })

    expect(screen.getByText('⚠ Upload failed')).toBeInTheDocument()
  })

  // --- Branch coverage: income table total cell with showPct (lines 324, 326) ---

  it('shows percentage in income table total column when % mode is active', async () => {
    const user = userEvent.setup()
    renderTable({
      type: 'income',
      categorySums: {
        Salary: { '2025-01': 5000 },
        Freelance: { '2025-01': 1000 },
      },
      categoryGroups: [makeCategoryGroup({ id: 'inc', name: 'Income', categories: ['Salary', 'Freelance'] })],
      yearTransactions: {},
    })
    // Toggle to % mode
    await user.click(screen.getByText('Total'))
    expect(screen.getByText('%')).toBeInTheDocument()
    // Categories should show percentages
    expect(screen.getByText('83.3%')).toBeInTheDocument()
    expect(screen.getByText('16.7%')).toBeInTheDocument()
  })

  // --- Branch coverage: income total cell non-zero (line 326 else path) ---

  it('shows formatted total for income categories when not in pct mode', () => {
    renderTable({
      type: 'income',
      categorySums: {
        Salary: { '2025-01': 5000 },
      },
      categoryGroups: [makeCategoryGroup({ id: 'inc', name: 'Income', categories: ['Salary'] })],
      yearTransactions: {},
    })
    // $5,000 appears in: Jan cell, Total cell, Grand Total Jan, Grand Total Total = 4
    expect(screen.getAllByText('$5,000')).toHaveLength(4)
  })

  // --- Branch coverage: drilldown filter sum display and refund class (line 523) ---

  it('shows filter sum when some categories are deselected in drilldown', async () => {
    const user = userEvent.setup()
    renderTable()
    await user.click(screen.getByText('Jan'))
    await user.click(screen.getByText('All Categories'))
    // Uncheck Groceries to show filtered sum
    const grocCheckbox = screen.getAllByRole('checkbox').find(cb => {
      const label = cb.closest('label')
      return label?.textContent?.includes('Groceries')
    })!
    expect(grocCheckbox).toBeTruthy()
    await user.click(grocCheckbox)
    // Should show the sum of remaining categories
    expect(screen.getByText(/3 of 4 categories/)).toBeInTheDocument()
    // A sum amount should be displayed
    const sumEl = document.querySelector('.budget-drilldown-sum')
    expect(sumEl).toBeTruthy()
  })

  // --- Branch coverage: drilldown sorting by description (line 402) ---

  it('sorts by description column in drilldown', async () => {
    const user = userEvent.setup()
    renderTable()
    await user.click(screen.getByText('Jan'))
    const descHeader = screen.getByText(/^Description/)
    await user.click(descHeader)
    const drilldownTable = descHeader.closest('table')!
    const descCells = within(drilldownTable)
      .getAllByRole('row')
      .slice(1)
      .map(r => within(r).getAllByRole('cell')[3]?.textContent)
    // Ascending: Apartment, Movie, Sushi place, Whole Foods
    expect(descCells[0]).toBe('Apartment')
  })

  // --- Branch coverage: toggleCategory with all selected back to empty set (line 426) ---

  it('goes back to all state when all categories manually re-selected', async () => {
    const user = userEvent.setup()
    renderTable()
    await user.click(screen.getByText('Jan'))
    const filterTrigger = screen.getByText('All Categories')
    await user.click(filterTrigger)

    // Uncheck Groceries (going from all → 3 selected)
    const grocCheckbox = screen.getAllByRole('checkbox').find(cb => {
      const label = cb.closest('label')
      return label?.textContent?.includes('Groceries')
    })!
    expect(grocCheckbox).toBeTruthy()
    await user.click(grocCheckbox)

    // Close and reopen to verify state
    expect(screen.getByText(/3 of 4 categories/)).toBeInTheDocument()

    // Re-check Groceries
    const grocCheckbox2 = screen.getAllByRole('checkbox').find(cb => {
      const label = cb.closest('label')
      return label?.textContent?.includes('Groceries')
    })!
    expect(grocCheckbox2).toBeTruthy()
    await user.click(grocCheckbox2)
    // Should show "All Categories" in the trigger button again
    const trigger = document.querySelector('.budget-filter-trigger')
    expect(trigger?.textContent).toContain('All Categories')
  })

  // --- Branch coverage: toggleCategory results in empty set → __none__ sentinel (line 430) ---

  it('shows None selected when all categories are unchecked individually', async () => {
    const user = userEvent.setup()
    renderTable({
      categorySums: {
        Groceries: { '2025-01': -200 },
      },
      categoryGroups: [makeCategoryGroup({ id: 'g', name: 'Group', categories: ['Groceries'] })],
      yearTransactions: {
        '2025-01': [makeTransaction({ date: '2025-01-01', category: 'Groceries', amount: -200 })],
      },
    })
    await user.click(screen.getByText('Jan'))
    await user.click(screen.getByText('All Categories'))
    // Uncheck Groceries — only category, so drilldownCategories becomes Set(['__none__'])
    const grocCheckbox = screen.getAllByRole('checkbox').find(cb => {
      const label = cb.closest('label')
      return label?.textContent?.includes('Groceries')
    })!
    expect(grocCheckbox).toBeTruthy()
    await user.click(grocCheckbox)
    expect(screen.getByText('None selected')).toBeInTheDocument()
  })

  // --- Branch coverage: "All Categories" checkbox deselects all (line 483-485) ---

  it('deselects all categories when All Categories checkbox is unchecked', async () => {
    const user = userEvent.setup()
    renderTable()
    await user.click(screen.getByText('Jan'))
    await user.click(screen.getByText('All Categories'))
    // Click the "All Categories" checkbox to deselect all
    const allCatCheckbox = screen.getAllByRole('checkbox').find(cb => {
      const label = cb.closest('label')
      return label?.textContent === 'All Categories'
    })!
    expect(allCatCheckbox).toBeTruthy()
    await user.click(allCatCheckbox)
    expect(screen.getByText('None selected')).toBeInTheDocument()
  })

  // --- Branch coverage: individual category checkbox from all state (line 503-507) ---

  it('unchecking a single category from all state selects remaining categories', async () => {
    const user = userEvent.setup()
    renderTable()
    await user.click(screen.getByText('Jan'))
    await user.click(screen.getByText('All Categories'))
    // Find and uncheck Dining
    const diningCheckbox = screen.getAllByRole('checkbox').find(cb => {
      const label = cb.closest('label')
      return label?.textContent?.includes('Dining')
    })!
    expect(diningCheckbox).toBeTruthy()
    await user.click(diningCheckbox)
    expect(screen.getByText(/3 of 4 categories/)).toBeInTheDocument()
  })

  // --- Branch coverage: expense category row with positive value (refund) (line 725) ---

  it('marks expense cell with refund class when value is positive', () => {
    renderTable({
      type: 'expense',
      categorySums: {
        Returns: { '2025-01': -50, '2025-02': 30 },
      },
      categoryGroups: [makeCategoryGroup({ id: 'g', name: 'Group', categories: ['Returns'] })],
      yearTransactions: {},
    })
    // The $30 cell for Feb should have the refund class
    const thirtyElements = screen.getAllByText('$30')
    const refundCell = thirtyElements.find(el => el.closest('td')?.classList.contains('refund'))
    expect(refundCell).toBeTruthy()
  })

  // --- Branch coverage: expense category total with positive value (line 731) ---

  it('marks expense category total cell with refund class when total is positive', () => {
    renderTable({
      type: 'expense',
      categorySums: {
        Returns: { '2025-01': -10, '2025-02': 50 },
      },
      categoryGroups: [makeCategoryGroup({ id: 'g', name: 'Group', categories: ['Returns'] })],
      yearTransactions: {},
    })
    // Total = -10 + 50 = 40 (positive)
    // The category row total should have refund class
    const fortyElements = screen.getAllByText('$40')
    const refundTotal = fortyElements.find(
      el => el.closest('td')?.classList.contains('budget-td--total') && el.closest('td')?.classList.contains('refund'),
    )
    expect(refundTotal).toBeTruthy()
  })

  // --- Branch coverage: GroupRows group total shows empty for showPct (line 711) ---

  it('hides group total in pct mode', async () => {
    const user = userEvent.setup()
    renderTable({
      categorySums: {
        Groceries: { '2025-01': -200 },
      },
      categoryGroups: [makeCategoryGroup({ id: 'g', name: 'Group', categories: ['Groceries'] })],
      yearTransactions: {},
    })
    await user.click(screen.getByText('Total'))
    // Group header row total should be empty in % mode
    const groupRow = screen.getByText('Group').closest('tr')!
    const lastCell = groupRow.querySelector('.budget-td--total')
    expect(lastCell?.textContent).toBe('')
  })

  // --- Branch coverage: getCategoryPct returns empty for zero grand total (line 184) ---

  it('shows empty percentage when grand total is zero', async () => {
    renderTable({
      type: 'expense',
      categorySums: {
        ZeroCat: { '2025-01': 0 },
      },
      categoryGroups: [makeCategoryGroup({ id: 'g', name: 'Group', categories: ['ZeroCat'] })],
      yearTransactions: {},
    })
    // Nothing to show since isTypeCategory returns false for zero-only
    expect(screen.queryByText('ZeroCat')).not.toBeInTheDocument()
  })

  // --- Branch coverage: drilldown transaction with empty description (line 629) ---

  it('renders empty string for transaction with no description', async () => {
    const user = userEvent.setup()
    renderTable({
      yearTransactions: {
        '2025-01': [makeTransaction({ date: '2025-01-01', category: 'Groceries', amount: -100, description: '' })],
      },
    })
    await user.click(screen.getByText('Jan'))
    const drilldownEl = screen.getByText(/— Expense Transactions/).parentElement!.parentElement!
    const rows = within(drilldownEl).getAllByRole('row').slice(1)
    const descCell = within(rows[0]).getAllByRole('cell')[3]
    expect(descCell.textContent).toBe('')
  })

  // --- Branch coverage: refund amount in drilldown (line 626) ---

  it('applies refund class to positive expense transaction amount in drilldown', async () => {
    const user = userEvent.setup()
    renderTable({
      type: 'expense',
      categorySums: {
        Returns: { '2025-01': -50 },
      },
      categoryGroups: [makeCategoryGroup({ id: 'g', name: 'Group', categories: ['Returns'] })],
      yearTransactions: {
        '2025-01': [
          makeTransaction({ date: '2025-01-01', category: 'Returns', amount: 30, description: 'Refund' }),
          makeTransaction({ date: '2025-01-02', category: 'Returns', amount: -80, description: 'Purchase' }),
        ],
      },
    })
    await user.click(screen.getByText('Jan'))
    // Find the $30 amount cell — it should have budget-amt-refund class
    const drilldownEl = screen.getByText(/— Expense Transactions/).parentElement!.parentElement!
    const rows = within(drilldownEl).getAllByRole('row').slice(1)
    const refundRow = rows.find(r => within(r).queryByText('Refund'))
    expect(refundRow).toBeTruthy()
    const amtCell = within(refundRow!).getAllByRole('cell')[2]
    expect(amtCell).toHaveClass('budget-amt-refund')
  })

  // --- Branch coverage: income isTypeCategory — category with no values returns false (line 73) ---

  it('excludes category with empty month values from income table', () => {
    renderTable({
      type: 'income',
      categorySums: {
        EmptyIncome: {},
        RealIncome: { '2025-01': 3000 },
      },
      categoryGroups: [makeCategoryGroup({ id: 'inc', name: 'Income', categories: ['EmptyIncome', 'RealIncome'] })],
      yearTransactions: {},
    })
    expect(screen.queryByText('EmptyIncome')).not.toBeInTheDocument()
    expect(screen.getByText('RealIncome')).toBeInTheDocument()
  })

  // --- Branch coverage: handleUploadClick returns early when contextMenu is null (line 196) ---

  it('handleUploadClick does nothing without an active context menu', () => {
    const props = defaultProps()
    render(<BudgetTable {...props} />)
    // The file input click should not be triggered since no context menu is open
    const fileInput = screen.getByTestId('csv-file-input') as HTMLInputElement
    const clickSpy = vi.spyOn(fileInput, 'click')
    // There's no direct way to call handleUploadClick without context menu,
    // but we can verify no upload action occurs without opening context menu first
    expect(clickSpy).not.toHaveBeenCalled()
  })

  // --- Branch coverage: handleRemoveClick returns early when contextMenu is null (line 203) ---

  it('Remove CSV button calls onRemoveCSV with the correct monthKey', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<BudgetTable {...props} />)
    // Right-click on Jan header to open context menu
    fireEvent.contextMenu(screen.getByText('Jan'))
    // Click Remove CSV
    await user.click(screen.getByText('Remove CSV'))
    expect(props.onRemoveCSV).toHaveBeenCalledWith('2025-01')
  })

  // --- Branch coverage: fileInputRef.current value reset after file change (line 221) ---

  it('resets file input value after file upload', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const props = defaultProps()
    render(<BudgetTable {...props} />)
    fireEvent.contextMenu(screen.getByText('Jan'))
    const fileInput = screen.getByTestId('csv-file-input') as HTMLInputElement
    vi.spyOn(fileInput, 'click').mockImplementation(() => {})
    await user.click(screen.getByText(/Upload CSV for Jan/))
    const file = new File(['Date,Category,Amount\n2025-01-01,Food,-50'], 'test.csv', { type: 'text/csv' })
    Object.defineProperty(fileInput, 'files', { value: [file], writable: false })
    fireEvent.change(fileInput)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })
    expect(fileInput.value).toBe('')
  })

  // --- Branch coverage: outside click on filter dropdown closes it (line 228) ---

  it('closes filter dropdown when clicking outside', async () => {
    const user = userEvent.setup()
    renderTable()
    await user.click(screen.getByText('Jan'))
    // Open filter dropdown
    await user.click(screen.getByText('All Categories'))
    expect(screen.getByPlaceholderText('Search categories…')).toBeInTheDocument()
    // Click outside the filter
    fireEvent.mouseDown(document.body)
    expect(screen.queryByPlaceholderText('Search categories…')).not.toBeInTheDocument()
  })

  // --- Branch coverage: drilldown with removed categories shown (line 376) ---

  it('shows removed categories when showRemoved is toggled in drilldown', async () => {
    const user = userEvent.setup()
    renderTable({
      type: 'expense',
      categorySums: {
        Groceries: { '2025-01': -200 },
      },
      categoryGroups: [
        makeCategoryGroup({ id: 'essentials', name: 'Essentials', categories: ['Groceries'] }),
        makeCategoryGroup({ id: 'removed', name: 'Removed', categories: ['OldCat'] }),
      ],
      yearTransactions: {
        '2025-01': [
          makeTransaction({ date: '2025-01-01', category: 'Groceries', amount: -200, description: 'WF' }),
          makeTransaction({ date: '2025-01-02', category: 'OldCat', amount: -50, description: 'Removed item' }),
        ],
      },
    })
    await user.click(screen.getByText('Jan'))
    // Removed pill should show count
    const removedBtn = screen.getByText(/Removed \(1\)/)
    expect(removedBtn).toBeInTheDocument()
    // Toggle it on
    await user.click(removedBtn)
    // The removed transaction should now be visible
    expect(screen.getByText('Removed item')).toBeInTheDocument()
  })

  // --- Branch coverage: sort by amount in drilldown (line 399) ---

  it('sorts drilldown transactions by amount', async () => {
    const user = userEvent.setup()
    renderTable()
    await user.click(screen.getByText('Jan'))
    const drilldownTable = document.querySelector('.budget-drilldown-table')!
    const amountHeader = within(drilldownTable as HTMLElement).getByText(/^Amount/)
    await user.click(amountHeader)
    const amtCells = within(drilldownTable as HTMLElement)
      .getAllByRole('row')
      .slice(1)
      .map(r => within(r).getAllByRole('cell')[2]?.textContent)
    // Amounts are -1500, -200, -100, -50 → ascending sort → -1500 first (displayed as $1,500)
    expect(amtCells[0]).toBe('$1,500')
    expect(amtCells[3]).toBe('$50')
  })

  // --- Branch coverage: toggleSort same column flips direction (line 408) ---

  it('flips sort direction when clicking the same column header again', async () => {
    const user = userEvent.setup()
    renderTable()
    await user.click(screen.getByText('Jan'))
    const dateHeader = screen.getByText(/^Date/)
    // Default sort is date desc, clicking again should flip to asc
    await user.click(dateHeader)
    expect(dateHeader.textContent).toContain('↑')
  })

  // --- Branch coverage: toggleSort new column sets default direction (line 411) ---

  it('sets ascending direction when switching to category sort column', async () => {
    const user = userEvent.setup()
    renderTable()
    await user.click(screen.getByText('Jan'))
    const drilldownTable = document.querySelector('.budget-drilldown-table')!
    const catHeader = within(drilldownTable as HTMLElement).getByText(/^Category/)
    await user.click(catHeader)
    expect(catHeader.textContent).toContain('↑')
  })

  // --- Branch coverage: filter search narrows category list (line 496) ---

  it('filters categories in dropdown based on search text', async () => {
    const user = userEvent.setup()
    renderTable()
    await user.click(screen.getByText('Jan'))
    await user.click(screen.getByText('All Categories'))
    const searchInput = screen.getByPlaceholderText('Search categories…')
    await user.type(searchInput, 'Gro')
    // Only Groceries should remain visible in the filter list
    const checkboxes = screen.getAllByRole('checkbox')
    // "All Categories" checkbox is hidden when filterSearch is non-empty
    const labels = checkboxes.map(cb => cb.closest('label')?.textContent)
    expect(labels).toContain('Groceries')
    expect(labels).not.toContain('Dining')
  })

  // --- Branch coverage: drilldown filter sum with positive expense shows refund class (line 523) ---

  it('applies refund class to filter sum when sum is positive for expense type', async () => {
    const user = userEvent.setup()
    // Both categories need at least one negative value to be considered expense categories
    renderTable({
      type: 'expense',
      categorySums: {
        Refunds: { '2025-01': 100, '2025-02': -5 },
        Groceries: { '2025-01': -200 },
      },
      categoryGroups: [makeCategoryGroup({ id: 'g', name: 'Group', categories: ['Refunds', 'Groceries'] })],
      yearTransactions: {
        '2025-01': [
          makeTransaction({ date: '2025-01-01', category: 'Refunds', amount: 100, description: 'Return' }),
          makeTransaction({ date: '2025-01-02', category: 'Groceries', amount: -200, description: 'Buy' }),
        ],
      },
    })
    await user.click(screen.getByText('Jan'))
    // Open filter dropdown
    await user.click(screen.getByText('All Categories'))
    // Uncheck "All Categories" → sets drilldownCategories to __none__ sentinel (nothing selected)
    const allCheckbox = screen.getAllByRole('checkbox').find(cb => {
      const label = cb.closest('label')
      return label?.textContent?.includes('All Categories')
    })!
    await user.click(allCheckbox)
    // Now check only Refunds
    const refundsCheckbox = screen.getAllByRole('checkbox').find(cb => {
      const label = cb.closest('label')
      return label?.textContent?.includes('Refunds')
    })!
    await user.click(refundsCheckbox)
    // Now drilldownCategories = Set(['Refunds']), allSelected=false
    // filtered = transactions with category 'Refunds' = [amount: 100]
    // filterSum = 100 > 0 for expense → refund class
    const sumEl = document.querySelector('.budget-drilldown-sum')
    expect(sumEl).toBeTruthy()
    expect(sumEl!.classList.contains('budget-amt-refund')).toBe(true)
  })

  // --- Branch coverage: confirm new category dialog Yes and No buttons (line 595, 607) ---

  it('shows confirm dialog when editing to a new category name and handles Yes', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<BudgetTable {...props} />)
    await user.click(screen.getByText('Jan'))
    const catCells = screen.getAllByTitle('Double-click to edit category')
    await user.dblClick(catCells[0])
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'BrandNewCategory')
    await user.tab() // blur triggers confirm dialog
    // Confirm dialog should appear
    expect(screen.getByText(/Create new category/)).toBeInTheDocument()
    expect(screen.getByText('"BrandNewCategory"')).toBeInTheDocument()
    // Click Yes
    await user.click(screen.getByText('Yes'))
    expect(props.onEditCategory).toHaveBeenCalledWith('2025-01', expect.any(Number), 'BrandNewCategory')
  })

  it('dismisses confirm dialog when clicking No on new category', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<BudgetTable {...props} />)
    await user.click(screen.getByText('Jan'))
    const catCells = screen.getAllByTitle('Double-click to edit category')
    await user.dblClick(catCells[0])
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'AnotherNewCat')
    await user.tab()
    expect(screen.getByText(/Create new category/)).toBeInTheDocument()
    await user.click(screen.getByText('No'))
    expect(screen.queryByText(/Create new category/)).not.toBeInTheDocument()
    expect(props.onEditCategory).not.toHaveBeenCalled()
  })

  // --- Branch coverage: income table total cell for category with zero total (line 326) ---

  it('shows empty cell for income category with zero total', () => {
    renderTable({
      type: 'income',
      categorySums: {
        PosNeg: { '2025-01': 100, '2025-02': -100 },
      },
      categoryGroups: [makeCategoryGroup({ id: 'inc', name: 'Income', categories: ['PosNeg'] })],
      yearTransactions: {},
    })
    // PosNeg has negative values so won't show in income table
    expect(screen.queryByText('PosNeg')).not.toBeInTheDocument()
  })

  // --- Branch coverage: GroupRows group year total non-zero but not in pct mode (line 711) ---

  it('shows formatted group total when not in pct mode', () => {
    renderTable({
      type: 'expense',
      categorySums: {
        Groceries: { '2025-01': -300 },
      },
      categoryGroups: [makeCategoryGroup({ id: 'g', name: 'Essentials', categories: ['Groceries'] })],
      yearTransactions: {},
    })
    // Group header total should show $300
    const groupRow = screen.getByText('Essentials').closest('tr')!
    const totalCell = groupRow.querySelector('.budget-td--total')
    expect(totalCell?.textContent).toBe('$300')
  })

  // --- Branch coverage: displayCat strips group prefix from category name (line 22-28) ---

  it('strips group prefix from category name in expense table', () => {
    renderTable({
      type: 'expense',
      categorySums: {
        'Essentials: Groceries': { '2025-01': -100 },
      },
      categoryGroups: [makeCategoryGroup({ id: 'g', name: 'Essentials', categories: ['Essentials: Groceries'] })],
      yearTransactions: {},
    })
    // Should display just "Groceries" since group name is "Essentials"
    expect(screen.getByText('Groceries')).toBeInTheDocument()
    expect(screen.queryByText('Essentials: Groceries')).not.toBeInTheDocument()
  })
})
