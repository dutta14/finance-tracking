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
    const tabs = document.querySelectorAll('.alloc-ratio-tabs .tab-btn')
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

  it('updates the active ratio name from the header input', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Allocation tab="ratios" />)
    await user.click(screen.getByText('+'))
    await user.click(screen.getByText('Blank'))

    const nameInput = screen.getByRole('textbox', { name: 'Ratio name' })
    await user.clear(nameInput)
    await user.type(nameInput, 'Retirement split')

    expect(nameInput).toHaveValue('Retirement split')
  })

  it('switches the active ratio scope from the header tabs', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Allocation tab="ratios" />)
    await user.click(screen.getByText('+'))
    await user.click(screen.getByText('Blank'))

    await user.click(screen.getByRole('button', { name: 'FI' }))
    expect(screen.getByRole('button', { name: 'FI' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'GW' }))
    expect(screen.getByRole('button', { name: 'GW' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows and cancels the delete confirmation state for the active ratio', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Allocation tab="ratios" />)
    await user.click(screen.getByText('+'))
    await user.click(screen.getByText('Blank'))

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Are you sure?')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'No' }))
    expect(screen.queryByText('Are you sure?')).not.toBeInTheDocument()
  })

  it('deletes the active ratio after confirmation', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Allocation tab="ratios" />)
    await user.click(screen.getByText('+'))
    await user.click(screen.getByText('Blank'))

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Yes' }))

    expect(screen.getByText(/No allocations yet/)).toBeInTheDocument()
  })
})
