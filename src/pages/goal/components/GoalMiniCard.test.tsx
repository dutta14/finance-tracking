import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GoalMiniCard from './GoalMiniCard'
import { makeGoal, makeGwGoal } from '../../../test/factories'
import { FinancialGoal, GwGoal } from '../../../types'

vi.mock('../../data/types', () => ({
  getLatestGoalTotals: () => ({ fiTotal: 500_000, gwTotal: 0 }),
}))

const defaultGoal = makeGoal({ id: 1, goalName: 'Retire Early', fiGoal: 2_000_000, retirementAge: 50 })

interface RenderOptions {
  goal?: FinancialGoal
  isSelected?: boolean
  onClick?: (e: React.MouseEvent) => void
  viewMode?: 'grid' | 'list'
  compareMode?: boolean
  gwGoals?: GwGoal[]
  profileBirthday?: string
}

function renderCard(overrides: RenderOptions = {}) {
  const onClick = overrides.onClick ?? vi.fn()
  return {
    onClick,
    ...render(
      <GoalMiniCard
        goal={overrides.goal ?? defaultGoal}
        isSelected={overrides.isSelected ?? false}
        onClick={onClick}
        viewMode={overrides.viewMode ?? 'grid'}
        compareMode={overrides.compareMode ?? false}
        gwGoals={overrides.gwGoals ?? []}
        profileBirthday={overrides.profileBirthday ?? '1990-01-15'}
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
    expect(screen.getByText('$2,000,000')).toBeInTheDocument()
  })

  it('displays progress percentage based on current totals', () => {
    // fiTotal=500k, fiGoal=2M → 25%
    renderCard()
    expect(screen.getByText('25%')).toBeInTheDocument()
  })

  it('shows "FI only" when there are no GW goals', () => {
    renderCard()
    expect(screen.getByText('FI only')).toBeInTheDocument()
  })

  it('shows GW goals total and combined total when GW goals exist', () => {
    const gwGoals = [makeGwGoal({ id: 1, fiGoalId: 1, disburseAge: 55, disburseAmount: 100_000, growthRate: 6 })]
    renderCard({ gwGoals })
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
    expect(btn).toHaveAccessibleName(/retire early.*25%.*selected for comparison/i)
  })

  it('sets aria-pressed to undefined outside compare mode', () => {
    renderCard({ compareMode: false, isSelected: true })
    const btn = screen.getByRole('button')
    expect(btn).not.toHaveAttribute('aria-pressed')
  })

  it('handles zero fiGoal without crashing (progress capped at 0%)', () => {
    const zeroGoal = makeGoal({ fiGoal: 0 })
    renderCard({ goal: zeroGoal })
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  // #58: Test keyboard interaction — source has handleKeyDown for Enter and Space
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
