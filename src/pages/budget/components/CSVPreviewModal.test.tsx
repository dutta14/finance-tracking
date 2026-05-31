import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import CSVPreviewModal from './CSVPreviewModal'

const SIMPLE_CSV = `Date,Category,Amount,Description
2025-01-15,Groceries,-50.00,Whole Foods
2025-01-16,Restaurants,-30.00,Sushi place
2025-01-17,Rent,-2000.00,January rent`

const MONTH_KEY = '2025-01'

function defaultProps(overrides: Partial<React.ComponentProps<typeof CSVPreviewModal>> = {}) {
  return {
    csv: SIMPLE_CSV,
    monthKey: MONTH_KEY,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  }
}

function renderModal(overrides: Partial<React.ComponentProps<typeof CSVPreviewModal>> = {}) {
  const props = defaultProps(overrides)
  const result = render(<CSVPreviewModal {...props} />)
  return { props, ...result }
}

describe('CSVPreviewModal', () => {
  it('renders the preview header with formatted month label', () => {
    renderModal()
    expect(screen.getByText('Preview — Jan 2025')).toBeInTheDocument()
  })

  it('formats different month keys correctly', () => {
    renderModal({ monthKey: '2024-12' })
    expect(screen.getByText('Preview — Dec 2024')).toBeInTheDocument()
  })

  it('displays row and column count', () => {
    renderModal()
    expect(screen.getByText('3 rows · 4 columns')).toBeInTheDocument()
  })

  it('renders column headers from CSV', () => {
    renderModal()
    expect(screen.getByText('Date')).toBeInTheDocument()
    expect(screen.getByText('Category')).toBeInTheDocument()
    expect(screen.getByText('Amount')).toBeInTheDocument()
    expect(screen.getByText('Description')).toBeInTheDocument()
  })

  it('renders data rows in the preview table', () => {
    renderModal()
    expect(screen.getByText('Whole Foods')).toBeInTheDocument()
    expect(screen.getByText('Sushi place')).toBeInTheDocument()
    expect(screen.getByText('January rent')).toBeInTheDocument()
  })

  it('renders the hint text about clicking column headers', () => {
    renderModal()
    expect(screen.getByText('Click column headers to exclude them.')).toBeInTheDocument()
  })

  it('renders Import and Cancel buttons', () => {
    renderModal()
    expect(screen.getByText('Import')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('calls onCancel when clicking the Cancel button', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()

    await user.click(screen.getByText('Cancel'))
    expect(props.onCancel).toHaveBeenCalledOnce()
  })

  it('calls onConfirm with original CSV when no columns are excluded', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()

    await user.click(screen.getByText('Import'))
    expect(props.onConfirm).toHaveBeenCalledWith(SIMPLE_CSV)
  })

  it('calls onCancel when clicking the overlay backdrop', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()

    const overlay = document.querySelector('.csv-preview-overlay') as HTMLElement
    await user.click(overlay)
    expect(props.onCancel).toHaveBeenCalled()
  })

  it('does not call onCancel when clicking inside the modal content', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()

    await user.click(screen.getByText('Preview — Jan 2025'))
    expect(props.onCancel).not.toHaveBeenCalled()
  })

  it('toggles column exclusion when clicking a header', async () => {
    const user = userEvent.setup()
    renderModal()

    const descHeader = screen.getByText('Description')
    await user.click(descHeader)

    expect(screen.getByText('Import (3 of 4 columns)')).toBeInTheDocument()
  })

  it('shows ✕ indicator on excluded column header', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.click(screen.getByText('Description'))
    expect(screen.getByText('✕')).toBeInTheDocument()
  })

  it('re-includes a column when clicking its header again', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.click(screen.getByText('Description'))
    expect(screen.getByText('Import (3 of 4 columns)')).toBeInTheDocument()

    await user.click(screen.getByText('Description'))
    expect(screen.getByText('Import')).toBeInTheDocument()
    expect(screen.queryByText('✕')).not.toBeInTheDocument()
  })

  it('excludes multiple columns and updates button text', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.click(screen.getByText('Description'))
    await user.click(screen.getByText('Amount'))
    expect(screen.getByText('Import (2 of 4 columns)')).toBeInTheDocument()
  })

  it('calls onConfirm with filtered CSV when columns are excluded', async () => {
    const user = userEvent.setup()
    const { props } = renderModal()

    await user.click(screen.getByText('Description'))
    await user.click(screen.getByText('Import (3 of 4 columns)'))

    expect(props.onConfirm).toHaveBeenCalledOnce()
    const result = (props.onConfirm as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const lines = result.split('\n')
    expect(lines[0]).toBe('Date,Category,Amount')
    expect(lines[1]).toContain('Groceries')
    expect(lines[1]).not.toContain('Whole Foods')
  })

  it('does not show "more rows" message when rows are within preview limit', () => {
    renderModal()
    expect(screen.queryByText(/more rows/)).not.toBeInTheDocument()
  })

  it('shows "more rows" message when CSV has more than 8 data rows', () => {
    const manyRows = [
      'Date,Category,Amount',
      ...Array.from({ length: 12 }, (_, i) => `2025-01-${String(i + 1).padStart(2, '0')},Food,-${i + 1}.00`),
    ].join('\n')

    renderModal({ csv: manyRows })
    expect(screen.getByText('… and 4 more rows')).toBeInTheDocument()
  })

  it('only shows up to 8 data rows in the preview table', () => {
    const manyRows = [
      'Date,Category,Amount',
      ...Array.from({ length: 12 }, (_, i) => `2025-01-${String(i + 1).padStart(2, '0')},Food,-${i + 1}.00`),
    ].join('\n')

    renderModal({ csv: manyRows })
    const table = screen.getByRole('table')
    const tbody = within(table).getAllByRole('row')
    // 1 header row + 8 data rows = 9 total
    expect(tbody).toHaveLength(9)
  })

  it('displays correct total row count even when preview is truncated', () => {
    const manyRows = [
      'Date,Category,Amount',
      ...Array.from({ length: 15 }, (_, i) => `2025-01-${String(i + 1).padStart(2, '0')},Food,-${i + 1}.00`),
    ].join('\n')

    renderModal({ csv: manyRows })
    expect(screen.getByText('15 rows · 3 columns')).toBeInTheDocument()
  })

  it('exposes dialog ARIA contract for accessibility and E2E selectors', () => {
    renderModal()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    const heading = screen.getByRole('heading', { level: 3, name: /preview/i })
    const headingId = heading.getAttribute('id')
    expect(headingId).toBeTruthy()
    expect(dialog).toHaveAttribute('aria-labelledby', headingId)
  })

  it('updates header title attribute when column is excluded', async () => {
    const user = userEvent.setup()
    renderModal()

    const allExcludable = screen.getAllByTitle('Click to exclude')
    expect(allExcludable).toHaveLength(4)

    await user.click(screen.getByText('Description'))
    expect(screen.getByTitle('Click to include')).toBeInTheDocument()
    expect(screen.getAllByTitle('Click to exclude')).toHaveLength(3)
  })
})
