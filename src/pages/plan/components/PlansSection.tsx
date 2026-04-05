import { FC } from 'react'
import { FinancialPlan } from '../../../types'
import PlansMiniGrid from './PlansMiniGrid'
import PlanDetailView from './PlanDetailView'
import PlanCompareView from './PlanCompareView'
import '../../../styles/Plan.css'
import './PlanCompareView.css'

interface PlansSectionProps {
  plans: FinancialPlan[]
  profileBirthday: string
  selectedPlanIds: number[]
  onSelectPlan: (planId: number, multi: boolean) => void
  onGoToPlan: (planId: number) => void
  onEditPlan: (plan: FinancialPlan) => void
  onCopyPlan: (plan: FinancialPlan) => void
  onDeletePlan: (planId: number) => void
  onUpdatePlan: (planId: number, plan: FinancialPlan) => void
  onRenamePlan: (planId: number, name: string) => void
  reorderPlans: (orderedIds: number[]) => void
}

const PlansSection: FC<PlansSectionProps> = ({
  plans,
  profileBirthday,
  selectedPlanIds,
  onSelectPlan,
  onGoToPlan,
  onEditPlan,
  onCopyPlan,
  onDeletePlan,
  onUpdatePlan,
  onRenamePlan,
  reorderPlans,
}) => {
  const selectedPlans = plans.filter(p => selectedPlanIds.includes(p.id))

  return (
    <div className="plan-results-section">
      <h2>Saved Plans ({plans.length})</h2>
      {plans.length === 0 ? (
        <div className="empty-state">
          <p>No plans created yet. Click "New Plan" to get started.</p>
        </div>
      ) : (
        <>
          <PlansMiniGrid
            plans={plans}
            selectedPlanIds={selectedPlanIds}
            onSelectPlan={onSelectPlan}
            onGoToPlan={onGoToPlan}
            onRenamePlan={onRenamePlan}
            onCopyPlan={onCopyPlan}
            onDeletePlan={onDeletePlan}
            onReorderPlans={reorderPlans}
          />
          {selectedPlans.length > 1 ? (
            <PlanCompareView plans={selectedPlans} />
          ) : (
            <PlanDetailView
              plans={plans}
              selectedPlanIds={selectedPlanIds}
              profileBirthday={profileBirthday}
              onEditPlan={onEditPlan}
              onCopyPlan={onCopyPlan}
              onDeletePlan={onDeletePlan}
              onUpdatePlan={onUpdatePlan}
            />
          )}
        </>
      )}
    </div>
  )
}

export default PlansSection

