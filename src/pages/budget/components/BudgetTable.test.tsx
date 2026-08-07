import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BudgetTable from './BudgetTable'
import { makeCategoryGroup } from '../../../test/factories'
import type { TimePeriod } from '../types'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const defaultProps = () => ({
  year: 2025,
  type: 'expense' as 'income' | 'expense',
  categoryGroups: [
    makeCategoryGroup({ id: 'essentials', name: 'Essentials', categories: ['Groceries', 'Rent'] }),
    makeCategoryGroup({ id: 'lifestyle', name: 'Lifestyle', categories: ['Dining'] }),
  ],
  categorySums: {
    Groceries: { '2025-01': -200, '2025-02': -180 },
    Rent: { '2025-01': -1500, '2025-02': -1500 },
    Dining: { '2025-01': -100, '2025-02': -120 },
  } as Record<string, Record<string, number>>,
  monthsWithData: new Set(['2025-01', '2025-02']),
  onUploadCSV: vi.fn(() => ({ ok: true })),
  onRemoveCSV: vi.fn(),
  timePeriod: 'month' as TimePeriod,
})

const renderTable = (overrides: Partial<ReturnType<typeof defaultProps>> = {}) =>
  render(<BudgetTable {...defaultProps()} {...overrides} />)

function setupMockFileReader(content: string) {
  class MockFileReader {
    result: string | ArrayBuffer | null = null
    onload: ((ev: ProgressEvent<FileReader>) => void) | null = null

    readAsText() {
      this.result = content
      this.onload?.({ target: this } as unknown as ProgressEvent<FileReader>)
    }
  }

  vi.stubGlobal('FileReader', MockFileReader)
}

describe('BudgetTable', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders grouped expense rows and the grand total', () => {
    renderTable()

    expect(screen.getByRole('heading', { name: 'Expenses' })).toBeInTheDocument()
    expect(screen.getByText('Essentials')).toBeInTheDocument()
    expect(screen.getByText('Lifestyle')).toBeInTheDocument()
    expect(screen.getByText('Groceries')).toBeInTheDocument()
    expect(screen.getByText('Rent')).toBeInTheDocument()
    expect(screen.getByText('Dining')).toBeInTheDocument()
    expect(screen.getByText('Grand Total')).toBeInTheDocument()
  })

  it('renders grouped income rows for income tables', () => {
    renderTable({
      type: 'income',
      categoryGroups: [makeCategoryGroup({ id: 'income', name: 'Paychecks', categories: ['Salary'], type: 'income' })],
      categorySums: { Salary: { '2025-01': 5000, '2025-02': 5000 } },
    })

    expect(screen.getByRole('heading', { name: 'Income' })).toBeInTheDocument()
    expect(screen.getByText('Paychecks')).toBeInTheDocument()
    expect(screen.getAllByText('$5,000')).not.toHaveLength(0)
  })

  it('strips the group prefix from displayed category names', () => {
    renderTable({
      categoryGroups: [makeCategoryGroup({ id: 'food', name: 'Food', categories: ['Food: Groceries'] })],
      categorySums: { 'Food: Groceries': { '2025-01': -200 } },
    })

    expect(screen.getByRole('button', { name: 'Groceries' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Food: Groceries' })).not.toBeInTheDocument()
  })

  it('renders quarter headers when time period is quarter', () => {
    renderTable({ timePeriod: 'quarter' })

    expect(screen.getByText('Q1')).toBeInTheDocument()
    expect(screen.getByText('Q2')).toBeInTheDocument()
    expect(screen.getByText('Q3')).toBeInTheDocument()
    expect(screen.getByText('Q4')).toBeInTheDocument()
    expect(screen.queryByText('Jan')).not.toBeInTheDocument()
  })

  it('renders half-year headers when time period is half', () => {
    renderTable({ timePeriod: 'half' })

    expect(screen.getByText('H1')).toBeInTheDocument()
    expect(screen.getByText('H2')).toBeInTheDocument()
    expect(screen.queryByText('Q1')).not.toBeInTheDocument()
  })

  it('toggles the total column into percentage mode', async () => {
    const user = userEvent.setup()
    renderTable()

    await user.click(screen.getByText('Total'))

    expect(screen.getByText('%')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('navigates to the transactions page with the clicked month range', async () => {
    const user = userEvent.setup()
    renderTable()

    await user.click(screen.getByText('Jan'))

    expect(mockNavigate).toHaveBeenCalledWith('/transactions?from=2025-01-01&to=2025-01-31')
  })

  it('uses the last day of the clicked month when navigating', async () => {
    const user = userEvent.setup()
    renderTable({
      year: 2024,
      monthsWithData: new Set(['2024-02']),
      categorySums: { Groceries: { '2024-02': -200 } },
      categoryGroups: [makeCategoryGroup({ id: 'essentials', name: 'Essentials', categories: ['Groceries'] })],
    })

    await user.click(screen.getByText('Feb'))

    expect(mockNavigate).toHaveBeenCalledWith('/transactions?from=2024-02-01&to=2024-02-29')
  })

  it('navigates to whole-year transactions for a clicked category', async () => {
    const user = userEvent.setup()
    renderTable()

    await user.click(screen.getByRole('button', { name: 'Groceries' }))

    expect(mockNavigate).toHaveBeenCalledWith('/transactions?from=2025-01-01&to=2025-12-31&categories=Groceries')
  })

  it('navigates to whole-year transactions for all categories in a clicked group', async () => {
    const user = userEvent.setup()
    renderTable()

    await user.click(screen.getByRole('button', { name: 'Essentials' }))

    expect(mockNavigate).toHaveBeenCalledWith('/transactions?from=2025-01-01&to=2025-12-31&categories=Groceries%2CRent')
  })

  it('navigates to month-filtered transactions for a clicked category cell', async () => {
    const user = userEvent.setup()
    renderTable()

    await user.click(screen.getByRole('button', { name: 'View Groceries transactions for Jan' }))

    expect(mockNavigate).toHaveBeenCalledWith('/transactions?from=2025-01-01&to=2025-01-31&categories=Groceries')
  })

  it('navigates to month-filtered transactions for a clicked group cell', async () => {
    const user = userEvent.setup()
    renderTable()

    await user.click(screen.getByRole('button', { name: 'View Essentials transactions for Feb' }))

    expect(mockNavigate).toHaveBeenCalledWith('/transactions?from=2025-02-01&to=2025-02-28&categories=Groceries%2CRent')
  })

  it('opens the month context menu and removes a CSV for that month', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<BudgetTable {...props} />)

    fireEvent.contextMenu(screen.getByText('Jan'))
    await user.click(screen.getByRole('button', { name: 'Remove CSV' }))

    expect(props.onRemoveCSV).toHaveBeenCalledWith('2025-01')
  })

  it('does not show the remove action for months without uploaded data', () => {
    renderTable({ monthsWithData: new Set(['2025-01']) })

    fireEvent.contextMenu(screen.getByText('Mar'))

    expect(screen.queryByRole('button', { name: 'Remove CSV' })).not.toBeInTheDocument()
  })

  it('renders quarter totals as plain text instead of month drilldown buttons', () => {
    renderTable({ timePeriod: 'quarter' })

    expect(screen.getAllByText('$3,380')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'View Essentials transactions for Q1' })).not.toBeInTheDocument()
  })

  it('does not upload when the file picker change event has no file', () => {
    const onUploadCSV = vi.fn(() => ({ ok: true }))
    renderTable({ onUploadCSV })

    fireEvent.change(screen.getByTestId('csv-file-input'), { target: { files: [] } })

    expect(onUploadCSV).not.toHaveBeenCalled()
  })

  it('shows and dismisses a CSV upload error returned by the uploader', async () => {
    const user = userEvent.setup()
    const onUploadCSV = vi.fn(() => ({ ok: false, error: 'Bad CSV format' }))
    setupMockFileReader('Date,Category,Amount\n2025-01-01,Food,-10')
    renderTable({ onUploadCSV })

    fireEvent.contextMenu(screen.getByText('Jan'))
    await user.click(screen.getByRole('button', { name: 'Upload CSV for Jan' }))
    fireEvent.change(screen.getByTestId('csv-file-input'), {
      target: { files: [new File(['ignored'], 'budget.csv', { type: 'text/csv' })] },
    })

    expect(onUploadCSV).toHaveBeenCalledWith('2025-01', 'Date,Category,Amount\n2025-01-01,Food,-10')
    expect(screen.getByRole('alert')).toHaveTextContent('Bad CSV format')

    await user.click(screen.getByRole('button', { name: 'Dismiss error' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('falls back to a default upload error message when the uploader omits one', async () => {
    const user = userEvent.setup()
    setupMockFileReader('Date,Category,Amount\n2025-01-01,Food,-10')
    renderTable({ onUploadCSV: vi.fn(() => ({ ok: false })) })

    fireEvent.contextMenu(screen.getByText('Jan'))
    await user.click(screen.getByRole('button', { name: 'Upload CSV for Jan' }))
    fireEvent.change(screen.getByTestId('csv-file-input'), {
      target: { files: [new File(['ignored'], 'budget.csv', { type: 'text/csv' })] },
    })

    expect(screen.getByRole('alert')).toHaveTextContent('Upload failed')
  })

  it('closes the month context menu when the backdrop is clicked', async () => {
    const user = userEvent.setup()
    renderTable()

    fireEvent.contextMenu(screen.getByText('Jan'))
    expect(screen.getByRole('button', { name: 'Upload CSV for Jan' })).toBeInTheDocument()

    await user.click(screen.getByTestId('ctx-menu-backdrop'))

    expect(screen.queryByRole('button', { name: 'Upload CSV for Jan' })).not.toBeInTheDocument()
  })

  it('marks positive expense values as refunds in month and total cells', async () => {
    renderTable({
      categorySums: {
        Groceries: { '2025-01': 25, '2025-02': -10 },
        Rent: { '2025-01': -1500, '2025-02': -1500 },
        Dining: { '2025-01': -100, '2025-02': -120 },
      },
    })

    const groceriesMonthCell = screen.getByRole('button', { name: 'View Groceries transactions for Jan' }).closest('td')
    const groceriesTotalCell = screen.getByRole('button', { name: 'Groceries' }).closest('tr')?.lastElementChild

    expect(groceriesMonthCell).toHaveClass('refund')
    expect(groceriesTotalCell).toHaveClass('refund')
    expect(groceriesTotalCell).toHaveTextContent('$15')
  })

  it('omits grouped rows and the grand total when no categories match the table type', () => {
    renderTable({
      type: 'expense',
      categoryGroups: [makeCategoryGroup({ id: 'income', name: 'Paychecks', categories: ['Salary'], type: 'income' })],
      categorySums: { Salary: { '2025-01': 5000 } },
    })

    expect(screen.queryByText('Paychecks')).not.toBeInTheDocument()
    expect(screen.queryByText('Grand Total')).not.toBeInTheDocument()
  })
})
