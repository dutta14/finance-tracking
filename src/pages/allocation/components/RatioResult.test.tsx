import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import RatioResult from './RatioResult'
import type { CustomRatio } from '../types'
import { GROUP_COLORS } from '../constants'

const makeRatio = (overrides: Partial<CustomRatio> = {}): CustomRatio => ({
  id: 'r1',
  name: 'Test',
  scope: 'total',
  groups: [
    { label: 'Stocks', classes: ['us-stock'] },
    { label: 'Bonds', classes: ['bonds'] },
  ],
  ...overrides,
})

const ratioData = [
  { name: 'Stocks', value: 7000, color: GROUP_COLORS[0] },
  { name: 'Bonds', value: 3000, color: GROUP_COLORS[1] },
]

describe('RatioResult', () => {
  it('renders null when ratioData is empty', () => {
    const { container } = render(
      <RatioResult
        activeRatio={makeRatio()}
        ratioData={[]}
        ratioTotal={0}
        computeGoalPcts={() => null}
        getAge={() => null}
      />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders actual ratio bar with labels', () => {
    render(
      <RatioResult
        activeRatio={makeRatio()}
        ratioData={ratioData}
        ratioTotal={10000}
        computeGoalPcts={() => null}
        getAge={() => null}
      />,
    )
    expect(screen.getByText('Actual')).toBeInTheDocument()
    expect(screen.getByText(/Stocks: 70.0%/)).toBeInTheDocument()
    expect(screen.getByText(/Bonds: 30.0%/)).toBeInTheDocument()
  })

  it('renders goal bar when goal pcts are available', () => {
    const ratio = makeRatio({ goals: { total: { type: 'constant', pcts: [60, 40] } } })
    render(
      <RatioResult
        activeRatio={ratio}
        ratioData={ratioData}
        ratioTotal={10000}
        computeGoalPcts={() => [60, 40]}
        getAge={() => null}
      />,
    )
    expect(screen.getByText('Goal')).toBeInTheDocument()
    // Stocks actual 70% vs goal 60% = +10.0
    const stocksLabel = screen.getByText(/Stocks: 60%/)
    expect(within(stocksLabel.closest('.alloc-ratio-label')!).getByText('(+10.0%)')).toBeInTheDocument()
    // Bonds actual 30% vs goal 40% = -10.0
    const bondsLabel = screen.getByText(/Bonds: 40%/)
    expect(within(bondsLabel.closest('.alloc-ratio-label')!).getByText('(-10.0%)')).toBeInTheDocument()
  })

  it('renders goal label with age for gradual goals', () => {
    const ratio = makeRatio({
      goals: {
        total: {
          type: 'gradual',
          owner: 'primary',
          startAge: 30,
          endAge: 60,
          startPcts: [80, 20],
          endPcts: [40, 60],
        },
      },
    })
    render(
      <RatioResult
        activeRatio={ratio}
        ratioData={ratioData}
        ratioTotal={10000}
        computeGoalPcts={() => [60, 40]}
        getAge={() => 35}
      />,
    )
    expect(screen.getByText(/Goal.*age 35/)).toBeInTheDocument()
  })

  it('skips the goal column when goal percentages are unavailable', () => {
    const ratio = makeRatio({ goals: { total: { type: 'constant', pcts: [60, 40] } } })
    render(
      <RatioResult
        activeRatio={ratio}
        ratioData={ratioData}
        ratioTotal={10000}
        computeGoalPcts={() => null}
        getAge={() => null}
      />,
    )

    expect(screen.queryByText(/^Goal/)).not.toBeInTheDocument()
  })

  it('shows a fallback age and on-track or under labels for gradual goals', () => {
    const ratio = makeRatio({
      goals: {
        total: {
          type: 'gradual',
          owner: 'partner',
          startAge: 30,
          endAge: 60,
          startPcts: [70, 30],
          endPcts: [70, 30],
        },
      },
    })

    render(
      <RatioResult
        activeRatio={ratio}
        ratioData={[
          { name: 'Stocks', value: 6990, color: GROUP_COLORS[0] },
          { name: 'Bonds', value: 3010, color: GROUP_COLORS[1] },
        ]}
        ratioTotal={10000}
        computeGoalPcts={() => [70, 30]}
        getAge={() => null}
      />,
    )

    expect(screen.getByText('Goal (age ?)')).toBeInTheDocument()

    const stocksDiff = screen.getByText('(-0.1%)')
    const bondsDiff = screen.getByText('(+0.1%)')
    expect(stocksDiff).toHaveClass('on-track')
    expect(bondsDiff).toHaveClass('on-track')
  })

  it('treats missing actual groups as zero and marks them under goal', () => {
    const ratio = makeRatio({ goals: { total: { type: 'constant', pcts: [60, 40] } } })
    render(
      <RatioResult
        activeRatio={ratio}
        ratioData={[{ name: 'Stocks', value: 10000, color: GROUP_COLORS[0] }]}
        ratioTotal={10000}
        computeGoalPcts={() => [60, 40]}
        getAge={() => null}
      />,
    )

    const bondsDiff = screen.getByText('(-40.0%)')
    expect(bondsDiff).toHaveClass('under')
  })
})
