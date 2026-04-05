import { FC, useState } from 'react'
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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  return (
    <div className="plan-results-section">
      <div className="plan-results-header">
        <h2>Saved Plans ({plans.length})</h2>
        <div className="view-mode-toggle">
          <button
            className={`view-mode-btn${viewMode === 'grid' ? ' active' : ''}`}
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
            title="Grid view"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="1" y="1" width="6" height="6" rx="1"/>
              <rect x="9" y="1" width="6" height="6" rx="1"/>
              <rect x="1" y="9" width="6" height="6" rx="1"/>
              <rect x="9" y="9" width="6" height="6" rx="1"/>
            </svg>
          </button>
          <button
            className={`view-mode-btn${viewMode === 'list' ? ' active' : ''}`}
            onClick={() => setViewMode('list')}
            aria-label="List view"
            title="List view"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="1" y="2" width="14" height="2.5" rx="1"/>
              <rect x="1" y="6.75" width="14" height="2.5" rx="1"/>
              <rect x="1" y="11.5" width="14" height="2.5" rx="1"/>
            </svg>
          </button>
        </div>
      </div>
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
            viewMode={viewMode}
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

