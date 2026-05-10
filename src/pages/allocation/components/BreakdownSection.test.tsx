import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BreakdownSection from './BreakdownSection'

const mockSlices = [
  { name: 'US Stock', value: 60000, color: '#6366f1' },
  { name: 'Bonds', value: 40000, color: '#0ea5e9' },
]

describe('BreakdownSection', () => {
  it('renders scope tabs for Total, FI, GW', () => {
    render(<BreakdownSection getSlices={() => mockSlices} />)
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.getByText('FI')).toBeInTheDocument()
    expect(screen.getByText('GW')).toBeInTheDocument()
  })

  it('renders legend with slice names when data exists', () => {
    render(<BreakdownSection getSlices={() => mockSlices} />)
    expect(screen.getByText('US Stock')).toBeInTheDocument()
    expect(screen.getByText('Bonds')).toBeInTheDocument()
  })

  it('shows No data when getSlices returns empty array', () => {
    render(<BreakdownSection getSlices={() => []} />)
    expect(screen.getByText('No data')).toBeInTheDocument()
  })

  it('switches between % and $ legend modes', async () => {
    const user = userEvent.setup()
    render(<BreakdownSection getSlices={() => mockSlices} />)
    // Default is %
    expect(screen.getByText('60.0%')).toBeInTheDocument()
    // Switch to $
    await user.click(screen.getByText('$'))
    expect(screen.getByText('$60,000')).toBeInTheDocument()
    expect(screen.getByText('$40,000')).toBeInTheDocument()
  })

  it('switches to FI scope when FI tab is clicked', async () => {
    const user = userEvent.setup()
    const getSlices = vi.fn(scope =>
      scope === 'fi' ? [{ name: 'FI Stock', value: 5000, color: '#6366f1' }] : mockSlices,
    )
    render(<BreakdownSection getSlices={getSlices} />)
    await user.click(screen.getByText('FI'))
    expect(getSlices).toHaveBeenCalledWith('fi')
    expect(screen.getByText('FI Stock')).toBeInTheDocument()
  })
})
