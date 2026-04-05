import { FC } from 'react'
import { FinancialPlan } from '../../../types'
import PlanMiniCard from '../../../components/PlanMiniCard'

interface PlansMiniGridProps {
  plans: FinancialPlan[]
  selectedPlanIds: number[]
  onSelectPlan: (planId: number, multi: boolean) => void
  viewMode?: 'grid' | 'list'
}

const PlansMiniGrid: FC<PlansMiniGridProps> = ({ plans, selectedPlanIds, onSelectPlan, viewMode = 'grid' }) => {
  return (
    <div className={viewMode === 'list' ? 'plans-mini-list' : 'plans-mini-grid'}>
      {plans.map(plan => (
        <PlanMiniCard
          key={plan.id}
          plan={plan}
          isSelected={selectedPlanIds.includes(plan.id)}
          onClick={(e) => onSelectPlan(plan.id, e.metaKey || e.ctrlKey)}
          viewMode={viewMode}
        />
      ))}
    </div>
  )
}

export default PlansMiniGrid

