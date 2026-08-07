import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import BudgetHeader from './BudgetHeader'
import { BudgetViewMode, TimePeriod } from '../types'

function defaultProps(overrides: Partial<React.ComponentProps<typeof BudgetHeader>> = {}) {
  return {
    selectedYear: 2025,
    viewMode: 'spreadsheet' as BudgetViewMode,
    timePeriod: 'month' as TimePeriod,
    onPrevYear: vi.fn(),
    onNextYear: vi.fn(),
    onSetViewMode: vi.fn(),
    onSetTimePeriod: vi.fn(),
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

  it('renders the primary view mode buttons', () => {
    renderHeader()
    expect(screen.getByText('Spreadsheet')).toBeInTheDocument()
    expect(screen.getByText('Cashflow')).toBeInTheDocument()
    expect(screen.getByText('Groups')).toBeInTheDocument()
  })

  it('calls onSetViewMode with the correct mode when clicking a view button', async () => {
    const user = userEvent.setup()
    const { props } = renderHeader()

    await user.click(screen.getByText('Spreadsheet'))
    expect(props.onSetViewMode).toHaveBeenCalledWith('spreadsheet')

    await user.click(screen.getByText('Cashflow'))
    expect(props.onSetViewMode).toHaveBeenCalledWith('cashflow')

    await user.click(screen.getByText('Groups'))
    expect(props.onSetViewMode).toHaveBeenCalledWith('groups')
  })

  it('does not render spreadsheet sub-view buttons in the header', () => {
    renderHeader()
    expect(screen.queryByRole('button', { name: 'Aggregated' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Detailed' })).not.toBeInTheDocument()
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

  it('marks the active view mode button and hides period buttons in groups mode', () => {
    renderHeader({ viewMode: 'groups' })

    expect(screen.getByText('Groups')).toHaveClass('active')
    expect(screen.getByText('Cashflow')).not.toHaveClass('active')
    expect(screen.queryByText('M')).not.toBeInTheDocument()
    expect(screen.queryByText('Q')).not.toBeInTheDocument()
    expect(screen.queryByText('H')).not.toBeInTheDocument()
  })

  it('marks the active cashflow view and half-year period buttons', () => {
    renderHeader({ viewMode: 'cashflow', timePeriod: 'half' })

    expect(screen.getByText('Cashflow')).toHaveClass('active')
    expect(screen.getByText('Spreadsheet')).not.toHaveClass('active')
    expect(screen.getByText('H')).toHaveClass('active')
    expect(screen.getByText('M')).not.toHaveClass('active')
    expect(screen.getByText('Q')).not.toHaveClass('active')
  })
})
