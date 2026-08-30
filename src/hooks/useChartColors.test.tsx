import { describe, it, expect } from 'vitest'
import type { CSSProperties } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { useChartColors } from './useChartColors'

type ChartStyle = CSSProperties & {
  '--chart-positive'?: string
  '--chart-negative'?: string
  '--chart-nw-line'?: string
}

function ChartColorsProbe({ style }: { style?: ChartStyle }) {
  const [chartRef, colors] = useChartColors()

  return (
    <div
      ref={chartRef}
      data-testid="chart-colors-probe"
      data-positive={colors.positive}
      data-negative={colors.negative}
      data-nw-line={colors.nwLine}
      style={style}
    />
  )
}

describe('useChartColors', () => {
  it('returns fallback chart colors when the CSS variables are missing', async () => {
    render(<ChartColorsProbe />)

    await waitFor(() => expect(screen.getByTestId('chart-colors-probe')).toHaveAttribute('data-positive', '#15803d'))
    expect(screen.getByTestId('chart-colors-probe')).toHaveAttribute('data-negative', '#b91c1c')
    expect(screen.getByTestId('chart-colors-probe')).toHaveAttribute('data-nw-line', '#0f766e')
  })

  it('reads chart colors from CSS variables on the attached element and updates when they change', async () => {
    const { rerender } = render(
      <ChartColorsProbe
        style={{
          '--chart-positive': '#22c55e',
          '--chart-negative': '#ef4444',
          '--chart-nw-line': '#0ea5e9',
        }}
      />,
    )

    await waitFor(() => expect(screen.getByTestId('chart-colors-probe')).toHaveAttribute('data-positive', '#22c55e'))
    expect(screen.getByTestId('chart-colors-probe')).toHaveAttribute('data-negative', '#ef4444')
    expect(screen.getByTestId('chart-colors-probe')).toHaveAttribute('data-nw-line', '#0ea5e9')

    rerender(
      <ChartColorsProbe
        style={{
          '--chart-positive': '#16a34a',
          '--chart-negative': '#dc2626',
          '--chart-nw-line': '#8b5cf6',
        }}
      />,
    )

    await waitFor(() => expect(screen.getByTestId('chart-colors-probe')).toHaveAttribute('data-positive', '#16a34a'))
    expect(screen.getByTestId('chart-colors-probe')).toHaveAttribute('data-negative', '#dc2626')
    expect(screen.getByTestId('chart-colors-probe')).toHaveAttribute('data-nw-line', '#8b5cf6')
  })
})
