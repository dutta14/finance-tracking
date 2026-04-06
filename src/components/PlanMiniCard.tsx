import { FC } from 'react'
import { FinancialPlan, GwPlan } from '../types'
import '../styles/PlanMiniCard.css'

const dollars = (n: number) => '$' + Math.round(n).toLocaleString()

function calcGwTotal(plan: FinancialPlan, gwPlans: GwPlan[], profileBirthday: string): number {
  const goals = gwPlans.filter(g => g.fiPlanId === plan.id)
  if (!goals.length || !profileBirthday) return 0
  const [birthYear, birthMonth] = profileBirthday.split('-').map(Number)
  const created = new Date(plan.planCreatedIn)
  return goals.reduce((sum, gw) => {
    const disburseYear = birthYear + gw.disburseAge
    const monthsToDisburse = Math.max(0,
      (disburseYear - created.getFullYear()) * 12 + (birthMonth - (created.getMonth() + 1))
    )
    const disbursementTarget = gw.disburseAmount * Math.pow(1 + plan.inflationRate / 100 / 12, monthsToDisburse)
    const monthsRetToDisburse = Math.max(0, (gw.disburseAge - plan.retirementAge) * 12)
    const pv = monthsRetToDisburse > 0
      ? disbursementTarget / Math.pow(1 + gw.growthRate / 100 / 12, monthsRetToDisburse)
      : disbursementTarget
    return sum + pv
  }, 0)
}

interface PlanMiniCardProps {
  plan: FinancialPlan
  isSelected: boolean
  onClick: (e: React.MouseEvent) => void
  viewMode?: 'grid' | 'list'
  gwPlans: GwPlan[]
  profileBirthday: string
}

const PlanMiniCard: FC<PlanMiniCardProps> = ({ plan, isSelected, onClick, viewMode = 'grid', gwPlans, profileBirthday }) => {
  const gwTotal = calcGwTotal(plan, gwPlans, profileBirthday)
  const hasGw = gwTotal > 0
  const totalGoals = plan.fiGoal + gwTotal

  return (
    <div
      className={`plan-mini-card${isSelected ? ' selected' : ''}${viewMode === 'list' ? ' list' : ''}`}
      onClick={onClick}
    >
      <h4>{plan.planName}</h4>
      <div className="mini-value">
        <span className="label">FI Goal</span>
        <span className="amount">{dollars(plan.fiGoal)}</span>
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
    </div>
  )
}

export default PlanMiniCard
