import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Budget from './Budget'
import type { BudgetViewMode, SpreadsheetMode } from './types'

const mockUseBudget = {
  selectedYear: 2025,
  setSelectedYear: vi.fn(),
  viewMode: 'spreadsheet' as BudgetViewMode,
  setViewMode: vi.fn(),
  spreadsheetMode: 'aggregated' as SpreadsheetMode,
  setSpreadsheetMode: vi.fn(),
  uploadCSV: vi.fn(),
  removeCSV: vi.fn(),
  createYear: vi.fn(),
  updateCategoryGroups: vi.fn(),
  updateIncomeCategoryGroups: vi.fn(),
  mergeCategories: vi.fn(),
  editCategory: vi.fn(),
  categoryHasTransactions: vi.fn(() => false),
  deleteCategory: vi.fn(),
  addTransaction: vi.fn(),
  years: [2024, 2025],
  yearTransactions: {},
  categoryGroups: [],
  incomeCategoryGroups: [],
  removedCategories: new Set<string>(),
  incomeRemovedCategories: new Set<string>(),
  incomeCatSet: new Set<string>(),
  categorySums: {},
  summary: { totalIncome: 0, totalExpense: 0, saveRate: 0 },
  monthsWithData: new Set<string>(),
}

const manualTransactionEntrySpy = vi.fn()
const budgetTableSpy = vi.fn()
const budgetAggregatedViewSpy = vi.fn()

vi.mock('./hooks/useBudget', () => ({
  useBudget: () => mockUseBudget,
}))

vi.mock('./hooks/useCSVUpload', () => ({
  useCSVUpload: () => ({
    csvPreview: null,
    toastMsg: null,
    quickUploadRef: { current: { click: vi.fn() } },
    bulkUploadRef: { current: { click: vi.fn() } },
    handleQuickUpload: vi.fn(),
    handleBulkUpload: vi.fn(),
    handlePreviewConfirm: vi.fn(),
    handlePreviewCancel: vi.fn(),
  }),
}))

vi.mock('../tools/components/PdfToCsv', () => ({
  default: () => <div data-testid="pdf-to-csv-tool">PdfToCsv Tool</div>,
}))

vi.mock('./components/BudgetSummary', () => ({
  default: () => <div data-testid="budget-summary" />,
}))

vi.mock('./components/ManualTransactionEntry', () => ({
  default: (props: { isOpen?: boolean }) => {
    manualTransactionEntrySpy(props)
    return <div data-testid="manual-transaction-entry">{props.isOpen ? 'open' : 'closed'}</div>
  },
}))

vi.mock('./components/BudgetTable', () => ({
  default: (props: { type: 'income' | 'expense' }) => {
    budgetTableSpy(props)
    return <div data-testid="budget-table">table:{props.type}</div>
  },
}))

vi.mock('./components/BudgetAggregatedView', () => ({
  default: (props: { type: 'income' | 'expense' }) => {
    budgetAggregatedViewSpy(props)
    return <div data-testid="budget-aggregated">aggregated:{props.type}</div>
  },
}))

vi.mock('./components/CategoryGroupManager', () => ({
  default: () => <div data-testid="category-group-manager" />,
}))

vi.mock('./components/CSVPreviewModal', () => ({
  default: () => <div data-testid="csv-preview-modal" />,
}))

vi.mock('./components/CashflowBarChart', () => ({
  default: () => <div data-testid="cashflow-bar-chart" />,
}))

vi.mock('./components/CashflowSankey', () => ({
  default: () => <div data-testid="cashflow-sankey" />,
}))

function renderBudget(initialRoute = '/budget/spreadsheet') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Budget />
    </MemoryRouter>,
  )
}

async function openMoreActions(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'More actions' }))
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mockUseBudget.selectedYear = 2025
  mockUseBudget.viewMode = 'spreadsheet'
  mockUseBudget.spreadsheetMode = 'aggregated'
  mockUseBudget.yearTransactions = {}
  mockUseBudget.monthsWithData = new Set<string>()
})

describe('Budget PDF → CSV upload menu item', () => {
  beforeEach(() => {
    mockUseBudget.yearTransactions = {
      '2025-01': [{ date: '2025-01-15', category: 'Salary', amount: 5000 }],
    }
    mockUseBudget.monthsWithData = new Set(['2025-01'])
  })

  afterEach(() => {
    mockUseBudget.yearTransactions = {}
    mockUseBudget.monthsWithData = new Set<string>()
  })

  it('does not show "PDF → CSV" in the more actions menu when the labs flag is off', async () => {
    const user = userEvent.setup()
    renderBudget()
    await openMoreActions(user)

    expect(screen.getByText('Bulk Upload')).toBeInTheDocument()
    expect(screen.queryByText('PDF → CSV')).not.toBeInTheDocument()
  })

  it('shows "PDF → CSV" in the more actions menu when the labs flag is on', async () => {
    localStorage.setItem('lab-pdf-to-csv', '1')
    const user = userEvent.setup()
    renderBudget()
    await openMoreActions(user)

    expect(screen.getByText('PDF → CSV')).toBeInTheDocument()
  })

  it('does not show "PDF → CSV" when labs flag has a non-"1" value', async () => {
    localStorage.setItem('lab-pdf-to-csv', 'true')
    const user = userEvent.setup()
    renderBudget()
    await openMoreActions(user)

    expect(screen.queryByText('PDF → CSV')).not.toBeInTheDocument()
  })
})

describe('Budget PDF → CSV fullscreen modal', () => {
  beforeEach(() => {
    localStorage.setItem('lab-pdf-to-csv', '1')
    mockUseBudget.yearTransactions = {
      '2025-01': [{ date: '2025-01-15', category: 'Salary', amount: 5000 }],
    }
    mockUseBudget.monthsWithData = new Set(['2025-01'])
  })

  afterEach(() => {
    mockUseBudget.yearTransactions = {}
    mockUseBudget.monthsWithData = new Set<string>()
  })

  it('opens the fullscreen modal when clicking "PDF → CSV" in the more actions menu', async () => {
    const user = userEvent.setup()
    renderBudget()
    await openMoreActions(user)
    await user.click(screen.getByText('PDF → CSV'))

    expect(await screen.findByText('PdfToCsv Tool')).toBeInTheDocument()
  })

  it('dismisses the modal when clicking the close button', async () => {
    const user = userEvent.setup()
    renderBudget()
    await openMoreActions(user)
    await user.click(screen.getByText('PDF → CSV'))

    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('heading', { name: 'PDF → CSV' })).not.toBeInTheDocument()
  })

  it('dismisses the modal when clicking the overlay backdrop', async () => {
    const user = userEvent.setup()
    const { container } = renderBudget()
    await openMoreActions(user)
    await user.click(screen.getByText('PDF → CSV'))

    await user.click(container.querySelector('.budget-pdf-overlay')!)

    expect(screen.queryByRole('heading', { name: 'PDF → CSV' })).not.toBeInTheDocument()
  })

  it('does not dismiss the modal when clicking inside the modal content', async () => {
    const user = userEvent.setup()
    const { container } = renderBudget()
    await openMoreActions(user)
    await user.click(screen.getByText('PDF → CSV'))

    await user.click(container.querySelector('.budget-pdf-modal-body')!)

    expect(screen.getByRole('heading', { name: 'PDF → CSV' })).toBeInTheDocument()
  })

  it('dismisses the modal when pressing Escape', async () => {
    const user = userEvent.setup()
    renderBudget()
    await openMoreActions(user)
    await user.click(screen.getByText('PDF → CSV'))

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('heading', { name: 'PDF → CSV' })).not.toBeInTheDocument()
  })
})

describe('Budget empty state', () => {
  it('renders empty state when there are no transactions and no months with data', () => {
    renderBudget()
    expect(screen.getByText('No data for 2025')).toBeInTheDocument()
  })

  it('shows an "Import CSV" button for current or past years', () => {
    mockUseBudget.selectedYear = new Date().getFullYear()
    renderBudget()
    expect(screen.getByRole('button', { name: 'Import CSV' })).toBeInTheDocument()
  })

  it('hides "Import CSV" button for future years', () => {
    mockUseBudget.selectedYear = new Date().getFullYear() + 5
    renderBudget()
    expect(screen.queryByRole('button', { name: 'Import CSV' })).not.toBeInTheDocument()
  })
})

describe('Budget with data', () => {
  beforeEach(() => {
    mockUseBudget.yearTransactions = {
      '2025-01': [{ date: '2025-01-15', category: 'Salary', amount: 5000 }],
    }
    mockUseBudget.monthsWithData = new Set(['2025-01'])
  })

  afterEach(() => {
    mockUseBudget.yearTransactions = {}
    mockUseBudget.monthsWithData = new Set<string>()
  })

  it('renders BudgetSummary when transactions exist on spreadsheet view', () => {
    renderBudget()
    expect(screen.getByTestId('budget-summary')).toBeInTheDocument()
  })

  it('renders aggregated spreadsheet view for expenses by default', () => {
    renderBudget()
    expect(screen.getByTestId('budget-aggregated')).toHaveTextContent('aggregated:expense')
    expect(screen.queryByTestId('budget-table')).not.toBeInTheDocument()
  })

  it('switches aggregated spreadsheet view to income when Income is clicked', async () => {
    const user = userEvent.setup()
    renderBudget()

    await user.click(screen.getByRole('button', { name: 'Income' }))

    expect(screen.getByTestId('budget-aggregated')).toHaveTextContent('aggregated:income')
    expect(budgetAggregatedViewSpy).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'income' }))
  })

  it('renders detailed spreadsheet view when spreadsheetMode is detailed', () => {
    mockUseBudget.spreadsheetMode = 'detailed'
    renderBudget()
    expect(screen.getByTestId('budget-table')).toHaveTextContent('table:expense')
    expect(screen.queryByTestId('budget-aggregated')).not.toBeInTheDocument()
  })

  it('switches detailed spreadsheet view to income when Income is clicked', async () => {
    const user = userEvent.setup()
    mockUseBudget.spreadsheetMode = 'detailed'
    renderBudget()

    await user.click(screen.getByRole('button', { name: 'Income' }))

    expect(screen.getByTestId('budget-table')).toHaveTextContent('table:income')
    expect(budgetTableSpy).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'income' }))
  })

  it('renders cashflow charts on the cashflow route', () => {
    renderBudget('/budget/cashflow')
    expect(screen.getByTestId('cashflow-bar-chart')).toBeInTheDocument()
    expect(screen.getByTestId('cashflow-sankey')).toBeInTheDocument()
    expect(screen.queryByTestId('budget-table')).not.toBeInTheDocument()
  })

  it('renders CategoryGroupManager on the groups route', () => {
    renderBudget('/budget/groups')
    expect(screen.getByTestId('category-group-manager')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument()
  })

  it('shows format help panel when CSV Format Help is clicked from the menu', async () => {
    const user = userEvent.setup()
    renderBudget()

    await openMoreActions(user)
    await user.click(screen.getByRole('menuitem', { name: 'CSV Format Help' }))

    expect(document.querySelector('.budget-format-help-panel')).toBeInTheDocument()
  })

  it('closes format help panel when clicking outside', async () => {
    const user = userEvent.setup()
    renderBudget()

    await openMoreActions(user)
    await user.click(screen.getByRole('menuitem', { name: 'CSV Format Help' }))
    await user.click(screen.getByText('Budget'))

    expect(document.querySelector('.budget-format-help-panel')).not.toBeInTheDocument()
  })

  it('opens the manual transaction entry from the more actions menu', async () => {
    const user = userEvent.setup()
    renderBudget()

    expect(screen.getByTestId('manual-transaction-entry')).toHaveTextContent('closed')
    await openMoreActions(user)
    await user.click(screen.getByRole('menuitem', { name: 'Add Transaction' }))

    expect(screen.getByTestId('manual-transaction-entry')).toHaveTextContent('open')
  })

  it('shows the more actions button only on spreadsheet view', () => {
    renderBudget()
    expect(screen.getByRole('button', { name: 'More actions' })).toBeInTheDocument()
  })

  it('hides the more actions button on cashflow view', () => {
    renderBudget('/budget/cashflow')
    expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument()
  })

  it('hides the more actions button on groups view', () => {
    renderBudget('/budget/groups')
    expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument()
  })
})

describe('Budget year navigation', () => {
  it('calls setSelectedYear when clicking previous year button', async () => {
    const user = userEvent.setup()
    renderBudget()

    await user.click(screen.getByTitle('Previous year'))

    const prevUpdater = mockUseBudget.setSelectedYear.mock.calls[0][0]
    expect(prevUpdater(2025)).toBe(2024)
  })

  it('calls setSelectedYear when clicking next year button', async () => {
    const user = userEvent.setup()
    renderBudget()

    await user.click(screen.getByTitle('Next year'))

    const nextUpdater = mockUseBudget.setSelectedYear.mock.calls.at(-1)![0]
    expect(nextUpdater(2025)).toBe(2026)
  })
})

describe('Budget view mode toggle', () => {
  beforeEach(() => {
    mockUseBudget.yearTransactions = {
      '2025-01': [{ date: '2025-01-15', category: 'Salary', amount: 5000 }],
    }
    mockUseBudget.monthsWithData = new Set(['2025-01'])
  })

  it('navigates to the spreadsheet route when clicking Spreadsheet button', async () => {
    const user = userEvent.setup()
    renderBudget('/budget/cashflow')

    await user.click(screen.getByRole('button', { name: 'Spreadsheet' }))

    expect(await screen.findByTestId('budget-aggregated')).toBeInTheDocument()
  })

  it('navigates to the cashflow route when clicking Cashflow button', async () => {
    const user = userEvent.setup()
    renderBudget('/budget/spreadsheet')

    await user.click(screen.getByRole('button', { name: 'Cashflow' }))

    expect(await screen.findByTestId('cashflow-bar-chart')).toBeInTheDocument()
  })

  it('navigates to the groups route when clicking Groups button', async () => {
    const user = userEvent.setup()
    renderBudget('/budget/cashflow')

    await user.click(screen.getByRole('button', { name: 'Groups' }))

    expect(await screen.findByTestId('category-group-manager')).toBeInTheDocument()
  })

  it('calls setSpreadsheetMode with "aggregated" when clicking Aggregated button', async () => {
    const user = userEvent.setup()
    renderBudget()

    await user.click(screen.getByRole('button', { name: 'Aggregated' }))
    expect(mockUseBudget.setSpreadsheetMode).toHaveBeenCalledWith('aggregated')
  })

  it('calls setSpreadsheetMode with "detailed" when clicking Detailed button', async () => {
    const user = userEvent.setup()
    renderBudget()

    await user.click(screen.getByRole('button', { name: 'Detailed' }))
    expect(mockUseBudget.setSpreadsheetMode).toHaveBeenCalledWith('detailed')
  })
})
