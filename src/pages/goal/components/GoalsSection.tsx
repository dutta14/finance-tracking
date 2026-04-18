import { FC, useState } from 'react'
import { FinancialGoal, GwGoal } from '../../../types'
import GoalsMiniGrid from './GoalsMiniGrid'
import GoalDrawer from './GoalDrawer'
import GoalCompareView from './GoalCompareView'
import GoalFilterBar, { GoalFilters, DEFAULT_FILTERS, applyFilters } from './GoalFilterBar'
import '../../../styles/Goal.css'
import '../../../styles/GoalFilterBar.css'
import '../../../styles/GoalCompareView.css'

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
  onReorderGoals: (orderedIds: number[]) => void
  onRenameGoal: (goalId: number, name: string) => void
  onCreateGwGoal: (goal: Omit<GwGoal, 'id' | 'createdAt'>) => void
  onUpdateGwGoal: (id: number, updates: Partial<Omit<GwGoal, 'id' | 'createdAt' | 'fiGoalId'>>) => void
  onDeleteGwGoal: (id: number) => void
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
  onReorderGoals,
  onRenameGoal,
  onCreateGwGoal,
  onUpdateGwGoal,
  onDeleteGwGoal,
}) => {
  const selectedGoals = goals.filter(p => selectedGoalIds.includes(p.id))
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    const stored = localStorage.getItem('goal-view-mode')
    return stored === 'list' ? 'list' : 'grid'
  })
  const [filters, setFilters] = useState<GoalFilters>(DEFAULT_FILTERS)

  const filteredGoals = applyFilters(goals, filters)
  const isFiltered = filteredGoals.length !== goals.length

  const countLabel = isFiltered
    ? `${filteredGoals.length} of ${goals.length}`
    : `${goals.length} goal${goals.length !== 1 ? 's' : ''}`

  return (
    <div className="goal-results-section">
      <div className="goal-toolbar">
        <GoalFilterBar goals={goals} filters={filters} onChange={setFilters} />
        <div className="goal-toolbar-right">
          <span className="goal-count-label">{countLabel}</span>
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
      </div>
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
        <GoalDrawer
          goal={selectedGoals[0]}
          goals={goals}
          profileBirthday={profileBirthday}
          gwGoals={gwGoals}
          onClose={onClearSelection}
          onNavigate={(goalId) => onSelectGoal(goalId, false)}
          onUpdateGoal={onUpdateGoal}
          onCopyGoal={onCopyGoal}
          onDeleteGoal={onDeleteGoal}
          onRenameGoal={onRenameGoal}
          onCreateGwGoal={onCreateGwGoal}
          onUpdateGwGoal={onUpdateGwGoal}
          onDeleteGwGoal={onDeleteGwGoal}
        />
      )}
    </div>
  )
}

export default GoalsSection

