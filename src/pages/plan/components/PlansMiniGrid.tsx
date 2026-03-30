import { FC } from 'react'
import { FinancialPlan } from '../../../types'
import PlanMiniCard from '../../../components/PlanMiniCard'

interface PlansMiniGridProps {
  plans: FinancialPlan[]
  selectedPlanId: number | null
  onSelectPlan: (planId: number) => void
}

const PlansMiniGrid: FC<PlansMiniGridProps> = ({ plans, selectedPlanId, onSelectPlan }) => {
  return (
    <div className="plans-mini-grid">
      {plans.map(plan => (
        <PlanMiniCard
          key={plan.id}
          plan={plan}
          isSelected={selectedPlanId === plan.id}
          onClick={() => onSelectPlan(plan.id)}
        />
      ))}
    </div>
  )
}

export default PlansMiniGrid
