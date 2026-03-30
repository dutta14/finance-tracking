import { FC } from 'react'
import { FinancialPlan } from '../../../types'
import PlansMiniGrid from './PlansMiniGrid'
import PlanDetailView from './PlanDetailView'
import '../../../styles/Plan.css'

interface PlansSectionProps {
  plans: FinancialPlan[]
  selectedPlanId: number | null
  onSelectPlan: (planId: number) => void
  onEditPlan: (plan: FinancialPlan) => void
  onCopyPlan: (plan: FinancialPlan) => void
  onDeletePlan: (planId: number) => void
}

const PlansSection: FC<PlansSectionProps> = ({
  plans,
  selectedPlanId,
  onSelectPlan,
  onEditPlan,
  onCopyPlan,
  onDeletePlan
}) => {
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
            selectedPlanId={selectedPlanId}
            onSelectPlan={onSelectPlan}
          />
          <PlanDetailView
            plans={plans}
            selectedPlanId={selectedPlanId}
            onEditPlan={onEditPlan}
            onCopyPlan={onCopyPlan}
            onDeletePlan={onDeletePlan}
          />
        </>
      )}
    </div>
  )
}

export default PlansSection

