import { describe, it, expect, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../test/renderWithProviders'
import Allocation from './Allocation'

beforeEach(() => {
  localStorage.clear()
})

describe('Allocation', () => {
  it('renders the Breakdown section scope tabs', () => {
    renderWithProviders(<Allocation tab="breakdown" />)
    expect(screen.getByText('Total')).toBeInTheDocument()
  })

  it('renders the + New Ratio button on ratios tab', () => {
    renderWithProviders(<Allocation tab="ratios" />)
    expect(screen.getByText('+')).toBeInTheDocument()
  })

  it('shows empty state when no custom ratios exist', () => {
    renderWithProviders(<Allocation tab="ratios" />)
    expect(screen.getByText(/No allocations yet/)).toBeInTheDocument()
  })

  it('renders the + New Ratio button', () => {
    renderWithProviders(<Allocation tab="ratios" />)
    expect(screen.getByText('+')).toBeInTheDocument()
  })

  it('renders scope tabs in the breakdown section', () => {
    renderWithProviders(<Allocation tab="breakdown" />)
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.getByText('FI')).toBeInTheDocument()
    expect(screen.getByText('GW')).toBeInTheDocument()
  })

  it('shows breakdown chart area with No data when no accounts exist', () => {
    renderWithProviders(<Allocation tab="breakdown" />)
    expect(screen.getByText('No data')).toBeInTheDocument()
  })

  it('opens create menu when + New Ratio is clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Allocation tab="ratios" />)
    await user.click(screen.getByText('+'))
    expect(screen.getByText('Blank')).toBeInTheDocument()
    expect(screen.getByText('Stock vs Bond')).toBeInTheDocument()
  })

  it('creates a new ratio when Blank is clicked from the create menu', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Allocation tab="ratios" />)
    await user.click(screen.getByText('+'))
    await user.click(screen.getByText('Blank'))
    expect(screen.queryByText(/No allocations yet/)).not.toBeInTheDocument()
  })

  it('switches breakdown scope when FI tab is clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Allocation tab="breakdown" />)
    const fiButtons = screen.getAllByText('FI')
    await user.click(fiButtons[0])
    expect(screen.getByText('No data')).toBeInTheDocument()
  })

  it('selects a ratio tab when clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Allocation tab="ratios" />)
    // Create two ratios so we can switch between them
    await user.click(screen.getByText('+'))
    await user.click(screen.getByText('Blank'))
    await user.click(screen.getByText('+'))
    await user.click(screen.getByText('Blank'))
    // Click the first ratio tab — the tabs render ratio names
    const tabs = document.querySelectorAll('.alloc-ratio-tab')
    await user.click(tabs[0] as HTMLElement)
    expect(tabs[0]).toHaveClass('active')
  })

  it('creates a ratio from a preset when a preset option is selected', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Allocation tab="ratios" />)
    await user.click(screen.getByText('+'))
    await user.click(screen.getByText('Stock vs Bond'))
    // A ratio was created and is active
    expect(screen.queryByText(/No allocations yet/)).not.toBeInTheDocument()
  })

  it('adds pressed states and a label for ratio scope controls', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Allocation tab="ratios" />)
    await user.click(screen.getByText('+'))
    await user.click(screen.getByText('Blank'))

    expect(screen.getByLabelText('Ratio name')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Total' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'FI' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'GW' })).toHaveAttribute('aria-pressed', 'false')
  })
})
