import { FC } from 'react'
import { FinancialPlan } from '../types'
import '../styles/PlanMiniCard.css'

interface PlanMiniCardProps {
  plan: FinancialPlan
  isSelected: boolean
  onClick: (e: React.MouseEvent) => void
  viewMode?: 'grid' | 'list'
}

const PlanMiniCard: FC<PlanMiniCardProps> = ({ plan, isSelected, onClick, viewMode = 'grid' }) => {
  return (
    <div
      className={`plan-mini-card${isSelected ? ' selected' : ''}${viewMode === 'list' ? ' list' : ''}`}
      onClick={onClick}
    >
      <h4>{plan.planName}</h4>
      <div className="mini-value">
        <span className="label">FI Goal</span>
        <span className="amount">${plan.fiGoal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
      </div>
      <div className="mini-value">
        <span className="label">Progress</span>
        <span className="amount">{plan.progress.toFixed(1)}%</span>
      </div>
    </div>
  )
}

export default PlanMiniCard
