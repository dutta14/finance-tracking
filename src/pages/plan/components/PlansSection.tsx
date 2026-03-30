import { FC } from 'react'
import { FinancialPlan } from '../../../types'
import PlansMiniGrid from './PlansMiniGrid'
import PlanDetailView from './PlanDetailView'
import PlanCompareView from './PlanCompareView'
import '../../../styles/Plan.css'
import './PlanCompareView.css'

interface PlansSectionProps {
  plans: FinancialPlan[]
  selectedPlanIds: number[]
  onSelectPlan: (planId: number, multi: boolean) => void
  onEditPlan: (plan: FinancialPlan) => void
  onCopyPlan: (plan: FinancialPlan) => void
  onDeletePlan: (planId: number) => void
}

const PlansSection: FC<PlansSectionProps> = ({
  plans,
  selectedPlanIds,
  onSelectPlan,
  onEditPlan,
  onCopyPlan,
  onDeletePlan
}) => {
  const selectedPlans = plans.filter(p => selectedPlanIds.includes(p.id))

  return (
    <div className="plan-results-section">
      <h2>Saved Plans ({plans.length})</h2>
      {plans.length === 0 ? (
        <div className="empty-state">
          <p>No plans created yet. Fill in the form and click "Create Plan" to get started.</p>
        </div>
      ) : (
        <>
          <PlansMiniGrid
            plans={plans}
            selectedPlanIds={selectedPlanIds}
            onSelectPlan={onSelectPlan}
          />
          {selectedPlans.length > 1 ? (
            <PlanCompareView plans={selectedPlans} />
          ) : (
            <PlanDetailView
              plans={plans}
              selectedPlanIds={selectedPlanIds}
              onEditPlan={onEditPlan}
              onCopyPlan={onCopyPlan}
              onDeletePlan={onDeletePlan}
            />
          )}
        </>
      )}
    </div>
  )
}

export default PlansSection

