import { FC } from 'react'
import { FinancialGoal, GwGoal } from '../types'
import '../styles/GoalMiniCard.css'

const dollars = (n: number) => '$' + Math.round(n).toLocaleString()

function calcGwTotal(goal: FinancialGoal, gwGoals: GwGoal[], profileBirthday: string): number {
  const goals = gwGoals.filter(g => g.fiGoalId === goal.id)
  if (!goals.length || !profileBirthday) return 0
  const [birthYear, birthMonth] = profileBirthday.split('-').map(Number)
  const created = new Date(goal.goalCreatedIn)
  return goals.reduce((sum, gw) => {
    const disburseYear = birthYear + gw.disburseAge
    const monthsToDisburse = Math.max(0,
      (disburseYear - created.getFullYear()) * 12 + (birthMonth - (created.getMonth() + 1))
    )
    const disbursementTarget = gw.disburseAmount * Math.pow(1 + goal.inflationRate / 100 / 12, monthsToDisburse)
    const monthsRetToDisburse = Math.max(0, (gw.disburseAge - goal.retirementAge) * 12)
    const pv = monthsRetToDisburse > 0
      ? disbursementTarget / Math.pow(1 + gw.growthRate / 100 / 12, monthsRetToDisburse)
      : disbursementTarget
    return sum + pv
  }, 0)
}

interface GoalMiniCardProps {
  goal: FinancialGoal
  isSelected: boolean
  onClick: (e: React.MouseEvent) => void
  onAddGwGoal?: (goalId: number) => void
  viewMode?: 'grid' | 'list'
  gwGoals: GwGoal[]
  profileBirthday: string
}

const GoalMiniCard: FC<GoalMiniCardProps> = ({ goal, isSelected, onClick, onAddGwGoal, viewMode = 'grid', gwGoals, profileBirthday }) => {
  const gwTotal = calcGwTotal(goal, gwGoals, profileBirthday)
  const hasGw = gwTotal > 0
  const totalGoals = goal.fiGoal + gwTotal

  return (
    <div
      className={`goal-mini-card${isSelected ? ' selected' : ''}${viewMode === 'list' ? ' list' : ''}`}
      onClick={onClick}
    >
      <h4>{goal.goalName}</h4>
      <div className="mini-value">
        <span className="label">FI Goal</span>
        <span className="amount">{dollars(goal.fiGoal)}</span>
      </div>
      {hasGw && (
        <div className="mini-value">
          <span className="label">GW Goals</span>
          <span className="amount mini-amount--gw">{dollars(gwTotal)}</span>
        </div>
      )}
      {hasGw && (
        <div className="mini-value mini-value--total">
          <span className="label">Total</span>
          <span className="amount">{dollars(totalGoals)}</span>
        </div>
      )}
      {!hasGw && onAddGwGoal && (
        <button
          className="mini-card-add-gw"
          onClick={(e) => { e.stopPropagation(); onAddGwGoal(goal.id) }}
        >
          + Add GW Goal
        </button>
      )}
    </div>
  )
}

export default GoalMiniCard
