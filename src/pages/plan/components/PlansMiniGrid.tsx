import { FC } from 'react'
import { FinancialPlan } from '../../../types'
import PlanMiniCard from '../../../components/PlanMiniCard'

interface PlansMiniGridProps {
  plans: FinancialPlan[]
  selectedPlanIds: number[]
  onSelectPlan: (planId: number, multi: boolean) => void
}

const PlansMiniGrid: FC<PlansMiniGridProps> = ({ plans, selectedPlanIds, onSelectPlan }) => {
  return (
    <div className="plans-mini-grid">
      {plans.map(plan => (
        <PlanMiniCard
          key={plan.id}
          plan={plan}
          isSelected={selectedPlanIds.includes(plan.id)}
          onClick={(e) => onSelectPlan(plan.id, e.metaKey || e.ctrlKey)}
        />
      ))}
    </div>
  )
}

export default PlansMiniGrid

