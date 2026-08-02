import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Budget from './Budget'
import type { BudgetViewMode, SpreadsheetMode } from './types'

/* ─── Mocks ─── */

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
  mergeCategories: vi.fn(),
  editCategory: vi.fn(),
  categoryHasTransactions: vi.fn(() => false),
  deleteCategory: vi.fn(),
  yearTransactions: {},
  categoryGroups: [],
  removedCategories: [],
  categorySums: {},
  summary: { totalIncome: 0, totalExpense: 0, saveRate: 0 },
  monthsWithData: new Set<string>(),
}

vi.mock('./hooks/useBudget', () => ({
  useBudget: () => mockUseBudget,
}))

vi.mock('./hooks/useCSVUpload', () => ({
  useCSVUpload: () => ({
    csvPreview: null,
    toastMsg: null,
    quickUploadRef: { current: null },
    bulkUploadRef: { current: null },
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

vi.mock('./components/BudgetTable', () => ({
  default: () => <div data-testid="budget-table" />,
}))

vi.mock('./components/BudgetAggregatedView', () => ({
  default: () => <div data-testid="budget-aggregated" />,
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

/* ─── Helpers ─── */

function renderBudget(initialRoute = '/budget/spreadsheet') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Budget />
    </MemoryRouter>,
  )
}

async function openUploadMenu(user: ReturnType<typeof userEvent.setup>) {
  // The dropdown toggle is the small arrow button next to "Upload CSV"
  const buttons = screen.getAllByRole('button')
  const dropdownBtn = buttons.find(btn => {
    // The split-drop button contains an SVG chevron and no text
    return btn.classList.contains('budget-split-drop')
  })
  expect(dropdownBtn).toBeTruthy()
  await user.click(dropdownBtn!)
}

beforeEach(() => {
  localStorage.clear()
})

/* ─── PDF → CSV labs flag ─── */

describe('Budget PDF → CSV upload menu item', () => {
  it('does not show "PDF → CSV" in the upload dropdown when the labs flag is off', async () => {
    const user = userEvent.setup()
    renderBudget()
    await openUploadMenu(user)

    expect(screen.getByText('Bulk Upload')).toBeInTheDocument()
    expect(screen.queryByText('PDF → CSV')).not.toBeInTheDocument()
  })

  it('shows "PDF → CSV" in the upload dropdown when the labs flag is on', async () => {
    localStorage.setItem('lab-pdf-to-csv', '1')
    const user = userEvent.setup()
    renderBudget()
    await openUploadMenu(user)

    expect(screen.getByText('PDF → CSV')).toBeInTheDocument()
  })

  it('does not show "PDF → CSV" when labs flag has a non-"1" value', async () => {
    localStorage.setItem('lab-pdf-to-csv', 'true')
    const user = userEvent.setup()
    renderBudget()
    await openUploadMenu(user)

    expect(screen.queryByText('PDF → CSV')).not.toBeInTheDocument()
  })
})

/* ─── PDF → CSV modal ─── */

describe('Budget PDF → CSV fullscreen modal', () => {
  beforeEach(() => {
    localStorage.setItem('lab-pdf-to-csv', '1')
  })

  it('opens the fullscreen modal when clicking "PDF → CSV" in the upload menu', async () => {
    const user = userEvent.setup()
    renderBudget()
    await openUploadMenu(user)
    await user.click(screen.getByText('PDF → CSV'))

    expect(await screen.findByText('PdfToCsv Tool')).toBeInTheDocument()
  })

  it('displays the modal title "PDF → CSV"', async () => {
    const user = userEvent.setup()
    renderBudget()
    await openUploadMenu(user)
    await user.click(screen.getByText('PDF → CSV'))

    const title = screen.getByRole('heading', { name: 'PDF → CSV' })
    expect(title).toBeInTheDocument()
  })

  it('displays a close button with aria-label "Close"', async () => {
    const user = userEvent.setup()
    renderBudget()
    await openUploadMenu(user)
    await user.click(screen.getByText('PDF → CSV'))

    const closeBtn = screen.getByRole('button', { name: 'Close' })
    expect(closeBtn).toBeInTheDocument()
  })

  it('dismisses the modal when clicking the close button', async () => {
    const user = userEvent.setup()
    renderBudget()
    await openUploadMenu(user)
    await user.click(screen.getByText('PDF → CSV'))

    // Modal is open
    expect(screen.getByRole('heading', { name: 'PDF → CSV' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Close' }))

    // Modal is dismissed — the title in the modal header should be gone
    expect(screen.queryByRole('heading', { name: 'PDF → CSV' })).not.toBeInTheDocument()
  })

  it('dismisses the modal when clicking the overlay backdrop', async () => {
    const user = userEvent.setup()
    const { container } = renderBudget()
    await openUploadMenu(user)
    await user.click(screen.getByText('PDF → CSV'))

    // Modal is open
    expect(screen.getByRole('heading', { name: 'PDF → CSV' })).toBeInTheDocument()

    // Click the overlay backdrop (the outermost div with class budget-pdf-overlay)
    const overlay = container.querySelector('.budget-pdf-overlay')!
    await user.click(overlay)

    // Modal is dismissed
    expect(screen.queryByRole('heading', { name: 'PDF → CSV' })).not.toBeInTheDocument()
  })

  it('does not dismiss the modal when clicking inside the modal content', async () => {
    const user = userEvent.setup()
    const { container } = renderBudget()
    await openUploadMenu(user)
    await user.click(screen.getByText('PDF → CSV'))

    // Click inside the modal body
    const modalBody = container.querySelector('.budget-pdf-modal-body')!
    await user.click(modalBody)

    // Modal remains open
    expect(screen.getByRole('heading', { name: 'PDF → CSV' })).toBeInTheDocument()
  })

  it('dismisses the modal when pressing Escape', async () => {
    const user = userEvent.setup()
    renderBudget()
    await openUploadMenu(user)
    await user.click(screen.getByText('PDF → CSV'))

    expect(screen.getByRole('heading', { name: 'PDF → CSV' })).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('heading', { name: 'PDF → CSV' })).not.toBeInTheDocument()
  })
})

/* ─── Empty state ─── */

describe('Budget empty state', () => {
  it('renders empty state when there are no transactions and no months with data', () => {
    renderBudget()
    expect(screen.getByText('No data for 2025')).toBeInTheDocument()
  })

  it('shows an "Import CSV" button for current or past years', () => {
    mockUseBudget.selectedYear = new Date().getFullYear()
    renderBudget()
    expect(screen.getByRole('button', { name: 'Import CSV' })).toBeInTheDocument()
    mockUseBudget.selectedYear = 2025
  })

  it('hides "Import CSV" button for future years', () => {
    mockUseBudget.selectedYear = new Date().getFullYear() + 5
    renderBudget()
    expect(screen.queryByRole('button', { name: 'Import CSV' })).not.toBeInTheDocument()
    mockUseBudget.selectedYear = 2025
  })

  it('shows future-year message when selected year is in the future', () => {
    mockUseBudget.selectedYear = new Date().getFullYear() + 5
    renderBudget()
    expect(screen.getByText("This year hasn't started yet. Data will appear as you add it.")).toBeInTheDocument()
    mockUseBudget.selectedYear = 2025
  })

  it('shows import prompt message for past years', () => {
    mockUseBudget.selectedYear = 2020
    renderBudget()
    expect(
      screen.getByText('Import a bank CSV or add transactions manually to start tracking this year.'),
    ).toBeInTheDocument()
    mockUseBudget.selectedYear = 2025
  })
})

/* ─── Data present: summary, view modes, toast ─── */

describe('Budget with data', () => {
  beforeEach(() => {
    mockUseBudget.yearTransactions = {
      '2025-01': [{ date: '2025-01-15', category: 'Salary', amount: 5000 }],
    }
    mockUseBudget.monthsWithData = new Set(['2025-01'])
    mockUseBudget.viewMode = 'spreadsheet'
    mockUseBudget.spreadsheetMode = 'aggregated'
  })

  afterEach(() => {
    mockUseBudget.yearTransactions = {}
    mockUseBudget.monthsWithData = new Set<string>()
    mockUseBudget.viewMode = 'spreadsheet'
    mockUseBudget.spreadsheetMode = 'aggregated'
  })

  it('renders BudgetSummary when transactions exist', () => {
    renderBudget()
    expect(screen.getByTestId('budget-summary')).toBeInTheDocument()
  })

  it('renders aggregated spreadsheet view', () => {
    renderBudget()
    expect(document.querySelector('.budget-spreadsheet-toolbar')).toBeInTheDocument()
    expect(screen.getAllByTestId('budget-aggregated')).toHaveLength(2)
    expect(screen.queryByTestId('budget-table')).not.toBeInTheDocument()
  })

  it('renders detailed spreadsheet view when spreadsheetMode is detailed', () => {
    mockUseBudget.spreadsheetMode = 'detailed'
    renderBudget()
    expect(screen.getAllByTestId('budget-table')).toHaveLength(2)
    expect(screen.queryByTestId('budget-aggregated')).not.toBeInTheDocument()
  })

  it('renders cashflow charts when viewMode is cashflow', () => {
    renderBudget('/budget/cashflow')
    expect(document.querySelector('.budget-spreadsheet-toolbar')).not.toBeInTheDocument()
    expect(screen.getByTestId('cashflow-bar-chart')).toBeInTheDocument()
    expect(screen.getByTestId('cashflow-sankey')).toBeInTheDocument()
    expect(screen.queryByTestId('budget-table')).not.toBeInTheDocument()
  })

  it('does not render empty state when data exists', () => {
    renderBudget()
    expect(screen.queryByText(/No data for/)).not.toBeInTheDocument()
  })

  it('renders CategoryGroupManager on the groups route', () => {
    renderBudget('/budget/groups')
    expect(screen.getByTestId('category-group-manager')).toBeInTheDocument()
    expect(screen.queryByTestId('budget-aggregated')).not.toBeInTheDocument()
    expect(screen.queryByTestId('cashflow-bar-chart')).not.toBeInTheDocument()
  })

  it('shows format help panel when ? button is clicked', async () => {
    const user = userEvent.setup()
    renderBudget()
    await user.click(screen.getByText('?'))
    expect(document.querySelector('.budget-format-help')).toBeInTheDocument()
  })

  it('shows Upload CSV button only on spreadsheet tab', () => {
    renderBudget()
    expect(screen.getByText('Upload CSV')).toBeInTheDocument()
  })

  it('hides Upload CSV button on cashflow tab', () => {
    renderBudget('/budget/cashflow')
    expect(screen.queryByText('Upload CSV')).not.toBeInTheDocument()
  })

  it('hides Upload CSV button on groups tab', () => {
    renderBudget('/budget/groups')
    expect(screen.queryByText('Upload CSV')).not.toBeInTheDocument()
  })

})

/* ─── Year navigation ─── */

describe('Budget year navigation', () => {
  it('calls setSelectedYear when clicking previous year button', async () => {
    mockUseBudget.yearTransactions = {}
    mockUseBudget.monthsWithData = new Set<string>()
    const user = userEvent.setup()
    renderBudget()

    const prevBtn = screen.getByTitle('Previous year')
    await user.click(prevBtn)

    expect(mockUseBudget.setSelectedYear).toHaveBeenCalledTimes(1)
    const prevUpdater = mockUseBudget.setSelectedYear.mock.calls[0][0]
    expect(prevUpdater(2025)).toBe(2024)
  })

  it('calls setSelectedYear when clicking next year button', async () => {
    mockUseBudget.yearTransactions = {}
    mockUseBudget.monthsWithData = new Set<string>()
    const user = userEvent.setup()
    renderBudget()

    const nextBtn = screen.getByTitle('Next year')
    await user.click(nextBtn)

    const nextUpdater = mockUseBudget.setSelectedYear.mock.calls.at(-1)![0]
    expect(nextUpdater(2025)).toBe(2026)
  })
})

/* ─── View mode toggle ─── */

describe('Budget view mode toggle', () => {
  it('navigates to the spreadsheet route when clicking Spreadsheet button', async () => {
    const user = userEvent.setup()
    mockUseBudget.yearTransactions = {
      '2025-01': [{ date: '2025-01-15', category: 'Salary', amount: 5000 }],
    }
    mockUseBudget.monthsWithData = new Set(['2025-01'])
    renderBudget('/budget/cashflow')

    await user.click(screen.getByRole('button', { name: 'Spreadsheet' }))
    expect(await screen.findByTestId('budget-summary')).toBeInTheDocument()
    expect(screen.getAllByTestId('budget-aggregated')).toHaveLength(2)
    expect(screen.queryByTestId('cashflow-bar-chart')).not.toBeInTheDocument()
  })

  it('navigates to the cashflow route when clicking Cashflow button', async () => {
    const user = userEvent.setup()
    mockUseBudget.yearTransactions = {
      '2025-01': [{ date: '2025-01-15', category: 'Salary', amount: 5000 }],
    }
    mockUseBudget.monthsWithData = new Set(['2025-01'])
    renderBudget('/budget/spreadsheet')

    await user.click(screen.getByRole('button', { name: 'Cashflow' }))
    expect(await screen.findByTestId('cashflow-bar-chart')).toBeInTheDocument()
    expect(screen.getByTestId('cashflow-sankey')).toBeInTheDocument()
    expect(screen.queryByTestId('budget-aggregated')).not.toBeInTheDocument()
  })

  it('navigates to the groups route when clicking Groups button', async () => {
    const user = userEvent.setup()
    mockUseBudget.yearTransactions = {
      '2025-01': [{ date: '2025-01-15', category: 'Salary', amount: 5000 }],
    }
    mockUseBudget.monthsWithData = new Set(['2025-01'])
    renderBudget('/budget/cashflow')

    await user.click(screen.getByRole('button', { name: 'Groups' }))
    expect(await screen.findByTestId('category-group-manager')).toBeInTheDocument()
    expect(screen.queryByTestId('cashflow-bar-chart')).not.toBeInTheDocument()
    expect(screen.queryByTestId('budget-aggregated')).not.toBeInTheDocument()
  })

  it('calls setSpreadsheetMode with "aggregated" when clicking Aggregated button', async () => {
    const user = userEvent.setup()
    mockUseBudget.viewMode = 'spreadsheet'
    mockUseBudget.yearTransactions = {
      '2025-01': [{ date: '2025-01-15', category: 'Salary', amount: 5000 }],
    }
    mockUseBudget.monthsWithData = new Set(['2025-01'])
    renderBudget()

    await user.click(screen.getByRole('button', { name: 'Aggregated' }))
    expect(mockUseBudget.setSpreadsheetMode).toHaveBeenCalledWith('aggregated')
  })

  it('calls setSpreadsheetMode with "detailed" when clicking Detailed button', async () => {
    const user = userEvent.setup()
    mockUseBudget.viewMode = 'spreadsheet'
    mockUseBudget.spreadsheetMode = 'aggregated'
    mockUseBudget.yearTransactions = {
      '2025-01': [{ date: '2025-01-15', category: 'Salary', amount: 5000 }],
    }
    mockUseBudget.monthsWithData = new Set(['2025-01'])
    renderBudget()

    await user.click(screen.getByRole('button', { name: 'Detailed' }))
    expect(mockUseBudget.setSpreadsheetMode).toHaveBeenCalledWith('detailed')
  })
})
