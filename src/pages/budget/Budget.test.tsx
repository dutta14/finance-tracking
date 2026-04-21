import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { useRef } from 'react'
import Budget from './Budget'

/* ─── Mocks ─── */

const mockUseBudget = {
  selectedYear: 2025,
  setSelectedYear: vi.fn(),
  yearExists: true,
  viewMode: 'aggregated' as const,
  setViewMode: vi.fn(),
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
  monthsWithData: [],
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

function renderBudget() {
  return render(
    <MemoryRouter initialEntries={['/budget']}>
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

    expect(screen.getByText('PdfToCsv Tool')).toBeInTheDocument()
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
})
