import { FC, useState } from 'react'
import { FinancialGoal, GwGoal } from '../../../types'
import GoalsMiniGrid from './GoalsMiniGrid'
import GoalDetailPane from './GoalDetailPane'
import GoalCompareView from './GoalCompareView'
import GoalFilterBar, { GoalFilters, DEFAULT_FILTERS, applyFilters } from './GoalFilterBar'
import '../../../styles/Goal.css'
import '../../../styles/GoalFilterBar.css'
import './GoalCompareView.css'

interface GoalsSectionProps {
  goals: FinancialGoal[]
  profileBirthday: string
  gwGoals: GwGoal[]
  selectedGoalIds: number[]
  onSelectGoal: (goalId: number, multi: boolean) => void
  onUpdateGoal: (goalId: number, goal: FinancialGoal) => void
  onCopyGoal: (goal: FinancialGoal) => void
  onDeleteGoal: (goalId: number) => void
  onDeleteMultiple: (ids: number[]) => void
  onClearSelection: () => void
  onGoToGoal: (goalId: number) => void
  onGoToGoalEdit: (goalId: number) => void
  onGoToGoalAddGw: (goalId: number) => void
  onReorderGoals: (orderedIds: number[]) => void
  onRenameGoal: (goalId: number, name: string) => void
}

const GoalsSection: FC<GoalsSectionProps> = ({
  goals,
  profileBirthday,
  gwGoals,
  selectedGoalIds,
  onSelectGoal,
  onUpdateGoal,
  onCopyGoal,
  onDeleteGoal,
  onDeleteMultiple,
  onClearSelection,
  onGoToGoal,
  onGoToGoalEdit,
  onGoToGoalAddGw,
  onReorderGoals,
  onRenameGoal,
}) => {
  const selectedGoals = goals.filter(p => selectedGoalIds.includes(p.id))
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    const stored = localStorage.getItem('goal-view-mode')
    return stored === 'list' ? 'list' : 'grid'
  })
  const [filters, setFilters] = useState<GoalFilters>(DEFAULT_FILTERS)

  const filteredGoals = applyFilters(goals, filters)
  const isFiltered = filteredGoals.length !== goals.length

  return (
    <div className={`goal-results-section${selectedGoals.length === 1 ? ' goal-results-section--pane-open' : ''}`}>
      <div className="goal-results-header">
        <h2>Saved Goals ({isFiltered ? `${filteredGoals.length} of ${goals.length}` : goals.length})</h2>
        <div className="view-mode-toggle">
          <button
            className={`view-mode-btn${viewMode === 'grid' ? ' active' : ''}`}
            onClick={() => { setViewMode('grid'); localStorage.setItem('goal-view-mode', 'grid') }}
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
            onClick={() => { setViewMode('list'); localStorage.setItem('goal-view-mode', 'list') }}
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
      <GoalFilterBar goals={goals} filters={filters} onChange={setFilters} />
      {selectedGoalIds.length > 1 && (
        <div className="goal-selection-bar">
          <span className="goal-selection-count">{selectedGoalIds.length} goals selected</span>
          <div className="goal-selection-actions">
            <button className="goal-selection-btn goal-selection-btn--danger" onClick={() => onDeleteMultiple(selectedGoalIds)}>
              Delete selected
            </button>
            <button className="goal-selection-btn" onClick={onClearSelection}>
              Clear selection
            </button>
          </div>
        </div>
      )}
      {goals.length === 0 ? (
        <div className="empty-state">
          <p>No goals created yet. Fill in the form and click "Create Goal" to get started.</p>
        </div>
      ) : filteredGoals.length === 0 ? (
        <div className="empty-state">
          <p>No goals match the current filters.</p>
        </div>
      ) : (
        <>
          <div className="goals-grid-wrapper">
            <GoalsMiniGrid
              goals={filteredGoals}
              selectedGoalIds={selectedGoalIds}
              onSelectGoal={onSelectGoal}
              viewMode={viewMode}
              onReorderGoals={isFiltered ? undefined : onReorderGoals}
              onGoToGoal={onGoToGoal}
              onGoToGoalEdit={onGoToGoalEdit}
              onGoToGoalAddGw={onGoToGoalAddGw}
              onRenameGoal={onRenameGoal}
              onCopyGoal={onCopyGoal}
              onDeleteGoal={onDeleteGoal}
              gwGoals={gwGoals}
              profileBirthday={profileBirthday}
            />
          </div>
          {selectedGoals.length > 1 && (
            <GoalCompareView goals={selectedGoals} gwGoals={gwGoals} profileBirthday={profileBirthday} />
          )}
        </>
      )}
      {selectedGoals.length === 1 && (
        <GoalDetailPane
          goal={selectedGoals[0]}
          profileBirthday={profileBirthday}
          gwGoals={gwGoals}
          onClose={onClearSelection}
          onGoToGoal={onGoToGoal}
          onGoToGoalEdit={onGoToGoalEdit}
          onUpdateGoal={onUpdateGoal}
          onCopyGoal={onCopyGoal}
          onDeleteGoal={onDeleteGoal}
          onRenameGoal={onRenameGoal}
        />
      )}
    </div>
  )
}

export default GoalsSection

