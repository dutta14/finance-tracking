import { describe, it, expect, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../test/renderWithProviders'
import Allocation from './Allocation'

beforeEach(() => {
  localStorage.clear()
})

describe('Allocation', () => {
  it('renders the Breakdown section heading', () => {
    renderWithProviders(<Allocation />)
    expect(screen.getByText('Breakdown')).toBeInTheDocument()
  })

  it('renders the My Allocations section heading', () => {
    renderWithProviders(<Allocation />)
    expect(screen.getByText('My Allocations')).toBeInTheDocument()
  })

  it('shows empty state when no custom ratios exist', () => {
    renderWithProviders(<Allocation />)
    expect(screen.getByText(/No allocations yet/)).toBeInTheDocument()
  })

  it('renders the + New Ratio button', () => {
    renderWithProviders(<Allocation />)
    expect(screen.getByText('+ New Ratio')).toBeInTheDocument()
  })

  it('renders scope tabs in the breakdown section', () => {
    renderWithProviders(<Allocation />)
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.getByText('FI')).toBeInTheDocument()
    expect(screen.getByText('GW')).toBeInTheDocument()
  })

  it('shows breakdown chart area with No data when no accounts exist', () => {
    renderWithProviders(<Allocation />)
    expect(screen.getByText('No data')).toBeInTheDocument()
  })

  it('opens create menu when + New Ratio is clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Allocation />)
    await user.click(screen.getByText('+ New Ratio'))
    expect(screen.getByText('Blank')).toBeInTheDocument()
    expect(screen.getByText('Stock vs Bond')).toBeInTheDocument()
  })

  it('creates a new ratio when Blank is clicked from the create menu', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Allocation />)
    await user.click(screen.getByText('+ New Ratio'))
    await user.click(screen.getByText('Blank'))
    expect(screen.queryByText(/No allocations yet/)).not.toBeInTheDocument()
  })

  it('switches breakdown scope when FI tab is clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Allocation />)
    const fiButtons = screen.getAllByText('FI')
    await user.click(fiButtons[0])
    expect(screen.getByText('Breakdown')).toBeInTheDocument()
  })
})
