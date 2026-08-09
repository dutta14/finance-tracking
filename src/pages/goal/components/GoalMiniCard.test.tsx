import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { MouseEvent } from 'react'
import GoalMiniCard from './GoalMiniCard'
import { makeGoal } from '../../../test/factories'
import { FinancialGoal } from '../../../types'
import { getFiTarget } from '../utils/goalCalculations'

const defaultGoal = makeGoal({ id: 1, goalName: 'Retire Early', retirementAge: 50 })
const profileBirthday = '1990-01-15'
const fiTarget = getFiTarget(defaultGoal, profileBirthday, 8)
const fiProgress = Math.min(100, Math.max(0, (500_000 / fiTarget) * 100))
const dollars = (n: number) => '$' + Math.round(n).toLocaleString()

interface RenderOptions {
  goal?: FinancialGoal
  fiProgress?: number
  gwTotal?: number
  isSelected?: boolean
  onClick?: (e: MouseEvent) => void
  viewMode?: 'grid' | 'list'
  compareMode?: boolean
}

function renderCard(overrides: RenderOptions = {}) {
  const goal = overrides.goal ?? defaultGoal
  const onClick = overrides.onClick ?? vi.fn()
  return {
    onClick,
    ...render(
      <GoalMiniCard
        goalName={goal.goalName}
        retirementYear={1990 + goal.retirementAge}
        fiTarget={getFiTarget(goal, profileBirthday, 8)}
        fiProgress={overrides.fiProgress ?? fiProgress}
        gwTotal={overrides.gwTotal ?? 0}
        isSelected={overrides.isSelected ?? false}
        onClick={onClick}
        viewMode={overrides.viewMode ?? 'grid'}
        compareMode={overrides.compareMode ?? false}
      />,
    ),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GoalMiniCard', () => {
  it('renders the goal name and FI goal amount', () => {
    renderCard()
    expect(screen.getByText('Retire Early')).toBeInTheDocument()
    expect(screen.getByText(dollars(fiTarget))).toBeInTheDocument()
  })

  it('displays progress percentage based on current totals', () => {
    renderCard()
    expect(screen.getByText(`${fiProgress.toFixed(0)}%`)).toBeInTheDocument()
  })

  it('shows "FI only" when there are no GW goals', () => {
    renderCard()
    expect(screen.getByText('FI only')).toBeInTheDocument()
  })

  it('shows GW goals total and combined total when GW goals exist', () => {
    renderCard({ gwTotal: 100_000 })
    expect(screen.getByText('GW Goals')).toBeInTheDocument()
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.queryByText('FI only')).not.toBeInTheDocument()
  })

  it('calls onClick when the card is clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    renderCard({ onClick })

    await user.click(screen.getByRole('button', { name: /retire early/i }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('has an accessible label with goal name and progress in compare mode', () => {
    renderCard({ compareMode: true, isSelected: true })
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(btn).toHaveAccessibleName(
      new RegExp(`retire early.*${fiProgress.toFixed(0)}%.*selected for comparison`, 'i'),
    )
  })

  it('sets aria-pressed to undefined outside compare mode', () => {
    renderCard({ compareMode: false, isSelected: true })
    const btn = screen.getByRole('button')
    expect(btn).not.toHaveAttribute('aria-pressed')
  })

  it('handles zero computed fi target without crashing (progress capped at 0%)', () => {
    const zeroGoal = makeGoal({ expenseValue: 0, monthlyExpenseRetirement: 0 })
    renderCard({ goal: zeroGoal, fiProgress: 0 })
    expect(screen.getByText('0%')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('triggers onClick when Enter key is pressed', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    renderCard({ onClick })

    const btn = screen.getByRole('button', { name: /retire early/i })
    btn.focus()
    await user.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('triggers onClick when Space key is pressed', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    renderCard({ onClick })

    const btn = screen.getByRole('button', { name: /retire early/i })
    btn.focus()
    await user.keyboard(' ')
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
