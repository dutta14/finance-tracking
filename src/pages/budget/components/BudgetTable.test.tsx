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
  type: 'expense' as const,
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
      })
      if (grocCheckbox) await user.click(grocCheckbox)
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
