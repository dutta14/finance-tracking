import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import LifecycleTable from './LifecycleTable'
import { ProjectionRow } from '../utils/lifecycleProjection'

vi.mock('../../../styles/GoalDiveDeep.css', () => ({}))

const buildRow = (overrides: Partial<ProjectionRow>): ProjectionRow => ({
  month: 'Jan 2050',
  expense: 0,
  remaining: 300_000,
  phase: 'accumulation',
  growthRate: 8,
  primaryLocked: true,
  partnerLocked: true,
  nonRetirement: 100_000,
  retirementPrimary: 100_000,
  retirementPartner: 100_000,
  ...overrides,
})

describe('LifecycleTable', () => {
  it('orders retirement unlock milestone rows by actual access date when both unlock on the same rendered row', () => {
    const rows: ProjectionRow[] = [
      buildRow({ month: 'Jan 2050' }),
      buildRow({ month: 'Feb 2050', primaryLocked: false, partnerLocked: false, remaining: 305_000 }),
    ]

    render(
      <LifecycleTable
        rows={rows}
        interval="yearly"
        primaryAccessDate={new Date(2052, 0, 1)}
        partnerAccessDate={new Date(2050, 0, 1)}
      />,
    )

    const rowTexts = within(screen.getByRole('table', { name: /lifecycle projection data/i }))
      .getAllByRole('row')
      .map(row => row.textContent ?? '')

    const partnerIndex = rowTexts.findIndex(text => text.includes('Partner Retirement unlocked'))
    const primaryIndex = rowTexts.findIndex(text => text.includes('Primary Retirement unlocked'))

    expect(partnerIndex).toBeGreaterThan(-1)
    expect(primaryIndex).toBeGreaterThan(-1)
    expect(partnerIndex).toBeLessThan(primaryIndex)
  })

  it('renders same-row unlock fire and growth-shift milestones in the intended chronological sequence', () => {
    const rows: ProjectionRow[] = [
      buildRow({ month: 'Jan 2050' }),
      buildRow({
        month: 'Feb 2050',
        growthRate: 6,
        primaryLocked: false,
        phase: 'drawdown',
        expense: 8_000,
        remaining: 295_000,
      }),
    ]

    render(
      <LifecycleTable
        rows={rows}
        interval="yearly"
        primaryAccessDate={new Date(2050, 0, 1)}
        partnerAccessDate={undefined}
      />,
    )

    const rowTexts = within(screen.getByRole('table', { name: /lifecycle projection data/i }))
      .getAllByRole('row')
      .map(row => row.textContent ?? '')

    const primaryIndex = rowTexts.findIndex(text => text.includes('Primary Retirement unlocked'))
    const rateShiftIndex = rowTexts.findIndex(text => text.includes('Growth rate: 8% → 6%'))
    const fireIndex = rowTexts.findIndex(text => text.includes('F.I.R.E.'))

    expect(primaryIndex).toBeGreaterThan(-1)
    expect(rateShiftIndex).toBeGreaterThan(-1)
    expect(fireIndex).toBeGreaterThan(-1)
    expect(primaryIndex).toBeLessThan(rateShiftIndex)
    expect(rateShiftIndex).toBeLessThan(fireIndex)
  })
})
