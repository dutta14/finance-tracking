import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BreakdownSection from './BreakdownSection'

vi.mock('./ChartHelpers', () => {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)

  return {
    DonutChart: ({
      data,
      selectedIndex = -1,
      onClickSlice,
    }: {
      data: { name: string }[]
      selectedIndex?: number
      onClickSlice?: (index: number) => void
    }) => (
      <div>
        <div data-testid="selected-index">{selectedIndex}</div>
        {data.map((slice, index) => (
          <button key={slice.name} onClick={() => onClickSlice?.(index)}>
            Select {slice.name}
          </button>
        ))}
      </div>
    ),
    Legend: ({
      data,
      total,
      mode,
    }: {
      data: { name: string; value: number }[]
      total: number
      mode: 'pct' | 'val'
    }) => (
      <div>
        {data.map(slice => (
          <div key={slice.name}>
            {slice.name}: {mode === 'pct' ? `${((slice.value / total) * 100).toFixed(1)}%` : formatCurrency(slice.value)}
          </div>
        ))}
      </div>
    ),
  }
})

const mockSlices = [
  { key: 'us-stock', name: 'US Stock', value: 60000, color: '#6366f1' },
  { key: 'bonds', name: 'Bonds', value: 40000, color: '#0ea5e9' },
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
    expect(screen.getByText(/US Stock:\s+60\.0%/)).toBeInTheDocument()
    expect(screen.getByText(/Bonds:\s+40\.0%/)).toBeInTheDocument()
  })

  it('shows No data when getSlices returns empty array', () => {
    render(<BreakdownSection getSlices={() => []} />)
    expect(screen.getByText('No data')).toBeInTheDocument()
  })

  it('switches between % and $ legend modes', async () => {
    const user = userEvent.setup()
    render(<BreakdownSection getSlices={() => mockSlices} />)
    // Default is %
    expect(screen.getByText(/US Stock:\s+60\.0%/)).toBeInTheDocument()
    // Switch to $
    await user.click(screen.getByText('$'))
    expect(screen.getByText(/US Stock:\s+\$60,000/)).toBeInTheDocument()
    expect(screen.getByText(/Bonds:\s+\$40,000/)).toBeInTheDocument()
  })

  it('switches to FI scope when FI tab is clicked', async () => {
    const user = userEvent.setup()
    const getSlices = vi.fn(scope =>
      scope === 'fi' ? [{ key: 'fi-stock', name: 'FI Stock', value: 5000, color: '#6366f1' }] : mockSlices,
    )
    render(<BreakdownSection getSlices={getSlices} />)
    await user.click(screen.getByText('FI'))
    expect(getSlices).toHaveBeenCalledWith('fi')
    expect(screen.getByText(/FI Stock:\s+100\.0%/)).toBeInTheDocument()
  })

  it('shows a drilldown for the selected class and hides it when the same slice is clicked again', async () => {
    const user = userEvent.setup()
    const getAccountsForClass = vi.fn(() => [
      { name: 'Brokerage', value: 60000, isDebt: false, owner: 'primary', ownerName: 'Alice' },
      { name: 'Margin Loan', value: 5000, isDebt: true, owner: 'joint', ownerName: 'Joint' },
    ])

    render(<BreakdownSection getSlices={() => mockSlices} getAccountsForClass={getAccountsForClass} />)

    await user.click(screen.getByRole('button', { name: 'Select US Stock' }))

    expect(getAccountsForClass).toHaveBeenCalledWith('total', 'us-stock')
    expect(screen.getByText('Brokerage')).toBeInTheDocument()
    expect(screen.getByText('Margin Loan')).toBeInTheDocument()
    expect(screen.getByText('Debt')).toBeInTheDocument()
    expect(screen.getByText('-$5,000')).toBeInTheDocument()
    expect(screen.getByText('$55,000')).toBeInTheDocument()
    expect(screen.getByTestId('selected-index')).toHaveTextContent('0')

    await user.click(screen.getByRole('button', { name: 'Select US Stock' }))

    expect(screen.queryByText('Brokerage')).not.toBeInTheDocument()
    expect(screen.getByTestId('selected-index')).toHaveTextContent('-1')
  })

  it('does not open a drilldown when the clicked slice has no key or no accounts', async () => {
    const user = userEvent.setup()
    const getAccountsForClass = vi.fn(() => [])

    const { rerender } = render(
      <BreakdownSection
        getSlices={() => [{ name: 'Unassigned', value: 2000, color: '#6b7280' }]}
        getAccountsForClass={getAccountsForClass}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Select Unassigned' }))
    expect(getAccountsForClass).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Select Unassigned' })).toBeInTheDocument()
    expect(screen.queryByText('Joint')).not.toBeInTheDocument()

    rerender(<BreakdownSection getSlices={() => mockSlices} getAccountsForClass={getAccountsForClass} />)
    await user.click(screen.getByRole('button', { name: 'Select Bonds' }))
    expect(getAccountsForClass).toHaveBeenCalledWith('total', 'bonds')
    expect(screen.queryByText('Debt')).not.toBeInTheDocument()
  })

  it('clears the selected class when the scope changes or when the selected slice disappears', async () => {
    const user = userEvent.setup()
    const getAccountsForClass = vi.fn(() => [{ name: 'Brokerage', value: 60000, isDebt: false, owner: 'primary', ownerName: 'Alice' }])

    const { rerender } = render(
      <BreakdownSection getSlices={() => mockSlices} getAccountsForClass={getAccountsForClass} />,
    )

    await user.click(screen.getByRole('button', { name: 'Select US Stock' }))
    expect(screen.getByText('Brokerage')).toBeInTheDocument()

    rerender(
      <BreakdownSection
        getSlices={() => [{ key: 'cash', name: 'Cash', value: 1000, color: '#6b7280' }]}
        getAccountsForClass={getAccountsForClass}
      />,
    )
    expect(screen.queryByText('Brokerage')).not.toBeInTheDocument()

    rerender(<BreakdownSection getSlices={() => mockSlices} getAccountsForClass={getAccountsForClass} />)
    expect(screen.getByText('Brokerage')).toBeInTheDocument()

    await user.click(screen.getByText('FI'))
    expect(screen.queryByText('Brokerage')).not.toBeInTheDocument()
    expect(screen.getByTestId('selected-index')).toHaveTextContent('-1')
  })
})
