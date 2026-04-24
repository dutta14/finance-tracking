import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import TrajectorySparkline from './TrajectorySparkline'
import type { TrajectoryStatus } from './TrajectorySparkline'

const defaultProps = {
  currentNetWorth: 500_000,
  fiGoal: 2_000_000,
  annualSavings: 60_000,
  growthRate: 5,
  months: 120,
  dateLabel: 'Jan 2035',
  trajectoryStatus: 'ahead' as TrajectoryStatus,
  caption: 'On track to reach goal by Jan 2035',
}

function renderSparkline(overrides: Partial<typeof defaultProps> = {}) {
  return render(<TrajectorySparkline {...defaultProps} {...overrides} />)
}

describe('TrajectorySparkline', () => {
  it('renders a <figure> with role="figure"', () => {
    renderSparkline()
    expect(screen.getByRole('figure', { name: /savings trajectory projection/i })).toBeInTheDocument()
  })

  it('renders "Goal" label text in the SVG', () => {
    renderSparkline()
    expect(screen.getByText('Goal')).toBeInTheDocument()
  })

  it('renders "Now" label text in the SVG', () => {
    renderSparkline()
    expect(screen.getByText('Now')).toBeInTheDocument()
  })

  it('renders the date label', () => {
    renderSparkline({ dateLabel: 'Mar 2040' })
    expect(screen.getByText('Mar 2040')).toBeInTheDocument()
  })

  it('sets data-status attribute on the figure for ahead', () => {
    renderSparkline({ trajectoryStatus: 'ahead' })
    const figure = screen.getByRole('figure')
    expect(figure).toHaveAttribute('data-status', 'ahead')
  })

  it('sets data-status attribute on the figure for behind', () => {
    renderSparkline({ trajectoryStatus: 'behind' })
    const figure = screen.getByRole('figure')
    expect(figure).toHaveAttribute('data-status', 'behind')
  })

  it('sets data-status attribute on the figure for on-track', () => {
    renderSparkline({ trajectoryStatus: 'on-track' })
    const figure = screen.getByRole('figure')
    expect(figure).toHaveAttribute('data-status', 'on-track')
  })

  it('renders the sr-only figcaption with the caption text', () => {
    renderSparkline({ caption: 'Projected to reach FI by Jan 2035' })
    expect(screen.getByText('Projected to reach FI by Jan 2035')).toBeInTheDocument()
  })

  it('SVG has aria-hidden="true"', () => {
    renderSparkline()
    const figure = screen.getByRole('figure')
    const svg = figure.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })
})
