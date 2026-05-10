import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRef } from 'react'
import BudgetHeader from './BudgetHeader'
import { BudgetViewMode, TimePeriod } from '../types'

function defaultProps(overrides: Partial<React.ComponentProps<typeof BudgetHeader>> = {}) {
  return {
    selectedYear: 2025,
    viewMode: 'aggregated' as BudgetViewMode,
    timePeriod: 'month' as TimePeriod,
    showGroupMgr: false,
    showFormatHelp: false,
    showUploadMenu: false,
    quickUploadRef: createRef<HTMLInputElement>(),
    bulkUploadRef: createRef<HTMLInputElement>(),
    onPrevYear: vi.fn(),
    onNextYear: vi.fn(),
    onSetViewMode: vi.fn(),
    onSetTimePeriod: vi.fn(),
    onToggleGroupMgr: vi.fn(),
    onToggleFormatHelp: vi.fn(),
    onToggleUploadMenu: vi.fn(),
    onQuickUpload: vi.fn(),
    onBulkUpload: vi.fn(),
    ...overrides,
  }
}

function renderHeader(overrides: Partial<React.ComponentProps<typeof BudgetHeader>> = {}) {
  const props = defaultProps(overrides)
  const result = render(<BudgetHeader {...props} />)
  return { props, ...result }
}

describe('BudgetHeader', () => {
  it('renders the Budget title', () => {
    renderHeader()
    expect(screen.getByText('Budget')).toBeInTheDocument()
  })

  it('displays the selected year', () => {
    renderHeader({ selectedYear: 2024 })
    expect(screen.getByText('2024')).toBeInTheDocument()
  })

  it('calls onPrevYear when clicking the previous year button', async () => {
    const user = userEvent.setup()
    const { props } = renderHeader()

    await user.click(screen.getByTitle('Previous year'))
    expect(props.onPrevYear).toHaveBeenCalledOnce()
  })

  it('calls onNextYear when clicking the next year button', async () => {
    const user = userEvent.setup()
    const { props } = renderHeader()

    await user.click(screen.getByTitle('Next year'))
    expect(props.onNextYear).toHaveBeenCalledOnce()
  })

  it('renders all three view mode buttons', () => {
    renderHeader()
    expect(screen.getByText('Aggregated')).toBeInTheDocument()
    expect(screen.getByText('Detailed')).toBeInTheDocument()
    expect(screen.getByText('Cashflow')).toBeInTheDocument()
  })

  it('calls onSetViewMode with the correct mode when clicking a view button', async () => {
    const user = userEvent.setup()
    const { props } = renderHeader()

    await user.click(screen.getByText('Detailed'))
    expect(props.onSetViewMode).toHaveBeenCalledWith('detailed')

    await user.click(screen.getByText('Cashflow'))
    expect(props.onSetViewMode).toHaveBeenCalledWith('cashflow')

    await user.click(screen.getByText('Aggregated'))
    expect(props.onSetViewMode).toHaveBeenCalledWith('aggregated')
  })

  it('renders the time period selector buttons', () => {
    renderHeader()
    expect(screen.getByText('M')).toBeInTheDocument()
    expect(screen.getByText('Q')).toBeInTheDocument()
    expect(screen.getByText('H')).toBeInTheDocument()
  })

  it('calls onSetTimePeriod with the correct period when clicking a period button', async () => {
    const user = userEvent.setup()
    const { props } = renderHeader()

    await user.click(screen.getByText('Q'))
    expect(props.onSetTimePeriod).toHaveBeenCalledWith('quarter')

    await user.click(screen.getByText('H'))
    expect(props.onSetTimePeriod).toHaveBeenCalledWith('half')

    await user.click(screen.getByText('M'))
    expect(props.onSetTimePeriod).toHaveBeenCalledWith('month')
  })

  it('renders Groups button when showGroupMgr is false', () => {
    renderHeader({ showGroupMgr: false })
    expect(screen.getByText('Groups')).toBeInTheDocument()
  })

  it('renders Hide Groups button when showGroupMgr is true', () => {
    renderHeader({ showGroupMgr: true })
    expect(screen.getByText('Hide Groups')).toBeInTheDocument()
  })

  it('calls onToggleGroupMgr when clicking the Groups button', async () => {
    const user = userEvent.setup()
    const { props } = renderHeader()

    await user.click(screen.getByText('Groups'))
    expect(props.onToggleGroupMgr).toHaveBeenCalledOnce()
  })

  it('renders the Upload CSV button', () => {
    renderHeader()
    expect(screen.getByText('Upload CSV')).toBeInTheDocument()
  })

  it('renders the upload options dropdown toggle with correct aria attributes', () => {
    renderHeader({ showUploadMenu: false })
    const toggle = screen.getByLabelText('Upload options')
    expect(toggle).toHaveAttribute('aria-haspopup', 'true')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('sets aria-expanded to true when upload menu is open', () => {
    renderHeader({ showUploadMenu: true })
    const toggle = screen.getByLabelText('Upload options')
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  it('calls onToggleUploadMenu when clicking the dropdown toggle', async () => {
    const user = userEvent.setup()
    const { props } = renderHeader()

    await user.click(screen.getByLabelText('Upload options'))
    expect(props.onToggleUploadMenu).toHaveBeenCalledOnce()
  })

  it('renders upload menu with Bulk Upload when showUploadMenu is true', () => {
    renderHeader({ showUploadMenu: true })
    const menu = screen.getByRole('menu')
    expect(within(menu).getByText('Bulk Upload')).toBeInTheDocument()
    const menuItems = within(menu).getAllByRole('menuitem')
    expect(menuItems).toHaveLength(1)
    expect(menuItems[0]).toHaveTextContent('Bulk Upload')
  })

  it('does not render upload menu when showUploadMenu is false', () => {
    renderHeader({ showUploadMenu: false })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('renders PDF → CSV menu item when onOpenPdfToCsv is provided', () => {
    renderHeader({ showUploadMenu: true, onOpenPdfToCsv: vi.fn() })
    expect(screen.getByText('PDF → CSV')).toBeInTheDocument()
    const menu = screen.getByRole('menu')
    const menuItems = within(menu).getAllByRole('menuitem')
    expect(menuItems).toHaveLength(2)
    expect(menuItems[0]).toHaveTextContent('Bulk Upload')
    expect(menuItems[1]).toHaveTextContent('PDF → CSV')
  })

  it('does not render PDF → CSV menu item when onOpenPdfToCsv is not provided', () => {
    renderHeader({ showUploadMenu: true })
    expect(screen.queryByText('PDF → CSV')).not.toBeInTheDocument()
  })

  it('calls onOpenPdfToCsv and closes menu when clicking PDF → CSV', async () => {
    const user = userEvent.setup()
    const onOpenPdfToCsv = vi.fn()
    const { props } = renderHeader({ showUploadMenu: true, onOpenPdfToCsv })

    await user.click(screen.getByText('PDF → CSV'))
    expect(onOpenPdfToCsv).toHaveBeenCalledOnce()
    expect(props.onToggleUploadMenu).toHaveBeenCalledOnce()
  })

  it('calls onToggleUploadMenu and triggers bulkUploadRef when clicking Bulk Upload', async () => {
    const user = userEvent.setup()
    const bulkUploadRef = createRef<HTMLInputElement>()
    const { props } = renderHeader({ showUploadMenu: true, bulkUploadRef })

    const bulkInput = screen.getByTestId('bulk-upload-input') as HTMLInputElement
    const clickSpy = vi.spyOn(bulkInput, 'click')

    await user.click(screen.getByText('Bulk Upload'))
    expect(props.onToggleUploadMenu).toHaveBeenCalledOnce()
    expect(clickSpy).toHaveBeenCalledOnce()
  })

  it('renders the format help button', () => {
    renderHeader()
    expect(screen.getByText('?')).toBeInTheDocument()
  })

  it('calls onToggleFormatHelp when clicking the ? button', async () => {
    const user = userEvent.setup()
    const { props } = renderHeader()

    await user.click(screen.getByText('?'))
    expect(props.onToggleFormatHelp).toHaveBeenCalledOnce()
  })

  it('renders format help content when showFormatHelp is true', () => {
    renderHeader({ showFormatHelp: true })
    expect(screen.getByText('×')).toBeInTheDocument()
  })

  it('does not render format help content when showFormatHelp is false', () => {
    renderHeader({ showFormatHelp: false })
    expect(screen.queryByText('×')).not.toBeInTheDocument()
  })

  it('calls onToggleFormatHelp when clicking the close button on format help', async () => {
    const user = userEvent.setup()
    const { props } = renderHeader({ showFormatHelp: true })

    await user.click(screen.getByText('×'))
    expect(props.onToggleFormatHelp).toHaveBeenCalledOnce()
  })

  it('renders hidden file inputs for CSV upload', () => {
    renderHeader()
    const inputs = screen.getAllByTestId(/upload-input/)
    expect(inputs).toHaveLength(2)
    inputs.forEach(input => {
      expect(input).toHaveAttribute('accept', '.csv')
    })
  })

  it('renders the bulk upload input with multiple attribute', () => {
    renderHeader()
    const multipleInput = screen.getByTestId('bulk-upload-input')
    expect(multipleInput).toBeInTheDocument()
  })
})
