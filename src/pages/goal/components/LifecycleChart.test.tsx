import type { ReactNode } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import LifecycleChart from './LifecycleChart'
import { ProjectionRow } from '../utils/lifecycleProjection'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children }: { children: ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
  ReferenceLine: ({ label }: { x?: string; label?: { value: string; dy: number } }) =>
    label ? <div data-testid="reference-line" data-label={label.value} data-dy={label.dy} /> : null,
}))

describe('LifecycleChart', () => {
  it('adds an accessible chart description and milestone summary through aria-describedby', () => {
    const rows: ProjectionRow[] = [
      { month: 'May 2035', expense: 0, remaining: 1_000_000, phase: 'accumulation' },
      { month: 'Jun 2035', expense: 5_000, remaining: 995_000, phase: 'drawdown' },
    ]

    const { container } = render(<LifecycleChart rows={rows} />)

    const description = screen
      .getAllByText((_, element) => {
        const text = element?.textContent ?? ''
        return text.includes('Lifecycle projection chart') && text.includes('F.I.R.E. at Jun 2035')
      })
      .find(element => element.id)
    const chartWrapper = container.querySelector('[aria-describedby]')

    expect(description).toBeInTheDocument()
    expect(chartWrapper).not.toBeNull()
    expect(chartWrapper).toHaveAttribute('aria-describedby', description!.id)
  })

  it('renders milestone reference labels for unlock fire and growth-shift transitions', () => {
    const rows: ProjectionRow[] = [
      {
        month: 'Jan 2035',
        expense: 0,
        remaining: 1_000_000,
        phase: 'accumulation',
        growthRate: 8,
        primaryLocked: true,
      },
      {
        month: 'Feb 2035',
        expense: 0,
        remaining: 1_050_000,
        phase: 'accumulation',
        growthRate: 6,
        primaryLocked: false,
      },
      {
        month: 'Mar 2035',
        expense: 6_000,
        remaining: 1_020_000,
        phase: 'drawdown',
        growthRate: 6,
        primaryLocked: false,
      },
    ]

    render(<LifecycleChart rows={rows} />)

    const referenceLines = screen.getAllByTestId('reference-line')
    const labels = referenceLines.map(line => line.getAttribute('data-label'))

    expect(referenceLines).toHaveLength(3)
    expect(labels).toEqual(expect.arrayContaining(['8%→6%', 'Primary', 'F.I.R.E.']))
  })

  it('staggers same-month milestone labels with increasing dy offsets', () => {
    const rows: ProjectionRow[] = [
      {
        month: 'Jan 2035',
        expense: 0,
        remaining: 1_000_000,
        phase: 'accumulation',
        growthRate: 8,
        primaryLocked: true,
      },
      {
        month: 'Feb 2035',
        expense: 7_000,
        remaining: 980_000,
        phase: 'drawdown',
        growthRate: 8,
        primaryLocked: false,
      },
    ]

    render(<LifecycleChart rows={rows} />)

    const milestones = screen.getAllByTestId('reference-line')
    const primaryLine = milestones.find(line => line.getAttribute('data-label') === 'Primary')
    const fireLine = milestones.find(line => line.getAttribute('data-label') === 'F.I.R.E.')

    expect(primaryLine).toHaveAttribute('data-dy', '0')
    expect(fireLine).toHaveAttribute('data-dy', '14')
  })
})
