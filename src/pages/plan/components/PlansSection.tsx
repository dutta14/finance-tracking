import { FC, useState } from 'react'
import { FinancialPlan, GwPlan } from '../../../types'
import PlansMiniGrid from './PlansMiniGrid'
import PlanDetailPane from './PlanDetailPane'
import PlanCompareView from './PlanCompareView'
import PlanFilterBar, { PlanFilters, DEFAULT_FILTERS, applyFilters } from './PlanFilterBar'
import '../../../styles/Plan.css'
import '../../../styles/PlanFilterBar.css'
import './PlanCompareView.css'

interface PlansSectionProps {
  plans: FinancialPlan[]
  profileBirthday: string
  gwPlans: GwPlan[]
  selectedPlanIds: number[]
  onSelectPlan: (planId: number, multi: boolean) => void
  onUpdatePlan: (planId: number, plan: FinancialPlan) => void
  onCopyPlan: (plan: FinancialPlan) => void
  onDeletePlan: (planId: number) => void
  onDeleteMultiple: (ids: number[]) => void
  onClearSelection: () => void
  onGoToPlan: (planId: number) => void
  onGoToPlanEdit: (planId: number) => void
  onReorderPlans: (orderedIds: number[]) => void
  onRenamePlan: (planId: number, name: string) => void
}

const PlansSection: FC<PlansSectionProps> = ({
  plans,
  profileBirthday,
  gwPlans,
  selectedPlanIds,
  onSelectPlan,
  onUpdatePlan,
  onCopyPlan,
  onDeletePlan,
  onDeleteMultiple,
  onClearSelection,
  onGoToPlan,
  onGoToPlanEdit,
  onReorderPlans,
  onRenamePlan,
}) => {
  const selectedPlans = plans.filter(p => selectedPlanIds.includes(p.id))
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    const stored = localStorage.getItem('plan-view-mode')
    return stored === 'list' ? 'list' : 'grid'
  })
  const [filters, setFilters] = useState<PlanFilters>(DEFAULT_FILTERS)

  const filteredPlans = applyFilters(plans, filters)
  const isFiltered = filteredPlans.length !== plans.length

  return (
    <div className={`plan-results-section${selectedPlans.length === 1 ? ' plan-results-section--pane-open' : ''}`}>
      <div className="plan-results-header">
        <h2>Saved Plans ({isFiltered ? `${filteredPlans.length} of ${plans.length}` : plans.length})</h2>
        <div className="view-mode-toggle">
          <button
            className={`view-mode-btn${viewMode === 'grid' ? ' active' : ''}`}
            onClick={() => { setViewMode('grid'); localStorage.setItem('plan-view-mode', 'grid') }}
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
            onClick={() => { setViewMode('list'); localStorage.setItem('plan-view-mode', 'list') }}
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
      <PlanFilterBar plans={plans} filters={filters} onChange={setFilters} />
      {selectedPlanIds.length > 1 && (
        <div className="plan-selection-bar">
          <span className="plan-selection-count">{selectedPlanIds.length} plans selected</span>
          <div className="plan-selection-actions">
            <button className="plan-selection-btn plan-selection-btn--danger" onClick={() => onDeleteMultiple(selectedPlanIds)}>
              Delete selected
            </button>
            <button className="plan-selection-btn" onClick={onClearSelection}>
              Clear selection
            </button>
          </div>
        </div>
      )}
      {plans.length === 0 ? (
        <div className="empty-state">
          <p>No plans created yet. Fill in the form and click "Create Plan" to get started.</p>
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="empty-state">
          <p>No plans match the current filters.</p>
        </div>
      ) : (
        <>
          <div className="plans-grid-wrapper">
            <PlansMiniGrid
              plans={filteredPlans}
              selectedPlanIds={selectedPlanIds}
              onSelectPlan={onSelectPlan}
              viewMode={viewMode}
              onReorderPlans={isFiltered ? undefined : onReorderPlans}
              onGoToPlan={onGoToPlan}
              onRenamePlan={onRenamePlan}
              onCopyPlan={onCopyPlan}
              onDeletePlan={onDeletePlan}
              gwPlans={gwPlans}
              profileBirthday={profileBirthday}
            />
          </div>
          {selectedPlans.length > 1 && (
            <PlanCompareView plans={selectedPlans} gwPlans={gwPlans} profileBirthday={profileBirthday} />
          )}
        </>
      )}
      {selectedPlans.length === 1 && (
        <PlanDetailPane
          plan={selectedPlans[0]}
          profileBirthday={profileBirthday}
          gwPlans={gwPlans}
          onClose={onClearSelection}
          onGoToPlan={onGoToPlan}
          onGoToPlanEdit={onGoToPlanEdit}
          onUpdatePlan={onUpdatePlan}
          onCopyPlan={onCopyPlan}
          onDeletePlan={onDeletePlan}
          onRenamePlan={onRenamePlan}
        />
      )}
    </div>
  )
}

export default PlansSection

