import { FC, useMemo } from 'react'
import { FinancialGoal, GwGoal } from '../../../types'
import { getLatestGoalTotals } from '../../data/types'
import '../../../styles/GoalMiniCard.css'

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

function calcRetirementYear(birthday: string, retirementAge: number): number {
  const [by] = birthday.split('-').map(Number)
  return by + retirementAge
}

interface GoalMiniCardProps {
  goal: FinancialGoal
  isSelected: boolean
  onClick: (e: React.MouseEvent) => void
  viewMode?: 'grid' | 'list'
  gwGoals: GwGoal[]
  profileBirthday: string
}

const GoalMiniCard: FC<GoalMiniCardProps> = ({ goal, isSelected, onClick, viewMode = 'grid', gwGoals, profileBirthday }) => {
  const gwTotal = calcGwTotal(goal, gwGoals, profileBirthday)
  const hasGw = gwTotal > 0
  const totalGoals = goal.fiGoal + gwTotal
  const birthday = goal.birthday || profileBirthday
  const retirementYear = calcRetirementYear(birthday, goal.retirementAge)

  const fiProgress = useMemo(() => {
    if (goal.fiGoal <= 0) return 0
    const { fiTotal } = getLatestGoalTotals()
    return Math.min(100, Math.max(0, (fiTotal / goal.fiGoal) * 100))
  }, [goal.fiGoal])

  return (
    <div
      className={`goal-mini-card${isSelected ? ' selected' : ''}${viewMode === 'list' ? ' list' : ''}`}
      onClick={onClick}
    >
      <div className="mini-card-top">
        <h4>{goal.goalName}</h4>
        <span className="mini-retire-year">{retirementYear}</span>
      </div>
      <div className="mini-progress">
        <div className="mini-progress-track">
          <div className="mini-progress-fill" style={{ width: `${fiProgress}%` }} />
        </div>
        <span className="mini-progress-pct">{fiProgress.toFixed(0)}%</span>
      </div>
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
      {!hasGw && (
        <span className="mini-no-gw">FI only</span>
      )}
    </div>
  )
}

export default GoalMiniCard
