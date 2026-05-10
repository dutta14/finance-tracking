import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DonutChart, Legend, RatioBar } from './ChartHelpers'

const mockData = [
  { name: 'Stocks', value: 7000, color: '#6366f1' },
  { name: 'Bonds', value: 3000, color: '#0ea5e9' },
]

describe('DonutChart', () => {
  it('renders empty message when data is empty', () => {
    render(<DonutChart data={[]} />)
    expect(screen.getByText('No data for this scope')).toBeInTheDocument()
  })

  it('renders without crashing when data is provided', () => {
    render(<DonutChart data={mockData} />)
    expect(screen.queryByText('No data for this scope')).not.toBeInTheDocument()
  })
})

describe('Legend', () => {
  it('renders each data item name', () => {
    render(<Legend data={mockData} total={10000} mode="pct" />)
    expect(screen.getByText('Stocks')).toBeInTheDocument()
    expect(screen.getByText('Bonds')).toBeInTheDocument()
  })

  it('renders percentage values in pct mode', () => {
    render(<Legend data={mockData} total={10000} mode="pct" />)
    expect(screen.getByText('70.0%')).toBeInTheDocument()
    expect(screen.getByText('30.0%')).toBeInTheDocument()
  })
})

describe('RatioBar', () => {
  it('renders null when data is empty', () => {
    const { container } = render(<RatioBar data={[]} total={0} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders segment labels with name and percentage', () => {
    render(<RatioBar data={mockData} total={10000} />)
    expect(screen.getByText(/Stocks: 70.0%/)).toBeInTheDocument()
    expect(screen.getByText(/Bonds: 30.0%/)).toBeInTheDocument()
  })
})
