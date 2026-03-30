import { FC } from 'react'
import { FinancialPlan } from '../../../types'
import PlanMiniCard from '../../../components/PlanMiniCard'
import PlanDetailedCard from '../../../components/PlanDetailedCard'
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
          {/* Mini Plan Cards (Top Row) */}
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

          {/* Detailed Plan View (Bottom) */}
          {selectedPlanId && (
            <div className="plan-detail-container">
              {plans.map(plan => {
                if (plan.id !== selectedPlanId) return null
                return (
                  <PlanDetailedCard
                    key={plan.id}
                    plan={plan}
                    onEdit={onEditPlan}
                    onCopy={onCopyPlan}
                    onDelete={onDeletePlan}
                  />
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default PlansSection
