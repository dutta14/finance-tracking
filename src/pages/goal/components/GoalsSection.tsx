import { FC, useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FinancialGoal, GwGoal } from '../../../types'
import GoalsMiniGrid from './GoalsMiniGrid'
import GoalCompareView from './GoalCompareView'
import GoalFilterBar, { GoalFilters, DEFAULT_FILTERS, applyFilters } from './GoalFilterBar'
import '../../../styles/Goal.css'
import '../../../styles/GoalFilterBar.css'
import '../../../styles/GoalCompareView.css'

const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent)
const modKey = isMac ? '⌘' : 'Ctrl'

interface GoalsSectionProps {
  goals: FinancialGoal[]
  profileBirthday: string
  gwGoals: GwGoal[]
  onUpdateGoal: (goalId: number, goal: FinancialGoal) => void
  onCopyGoal: (goal: FinancialGoal) => void
  onDeleteGoal: (goalId: number) => void
  onDeleteMultiple: (ids: number[]) => void
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
  onUpdateGoal,
  onCopyGoal,
  onDeleteGoal,
  onDeleteMultiple,
  onReorderGoals,
  onRenameGoal,
  onCreateGwGoal,
  onUpdateGwGoal,
  onDeleteGwGoal,
}) => {
  const navigate = useNavigate()
  const [selectedGoalIds, setSelectedGoalIds] = useState<number[]>([])
  const [compareMode, setCompareMode] = useState(false)
  const compareBtnRef = useRef<HTMLButtonElement>(null)
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

  const handleSelectGoal = (goalId: number, multi: boolean): void => {
    if (multi || compareMode) {
      // Cmd+Click or Compare mode: toggle selection
      setSelectedGoalIds(prev => (prev.includes(goalId) ? prev.filter(id => id !== goalId) : [...prev, goalId]))
      if (!compareMode) setCompareMode(true)
    } else {
      navigate(`/goal/${goalId}`)
    }
  }

  const exitCompareMode = (): void => {
    setCompareMode(false)
    setSelectedGoalIds([])
    requestAnimationFrame(() => compareBtnRef.current?.focus())
  }

  // Escape key exits compare mode
  useEffect(() => {
    if (!compareMode) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCompareMode(false)
        setSelectedGoalIds([])
        requestAnimationFrame(() => compareBtnRef.current?.focus())
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [compareMode])

  const handleDeleteSelected = (): void => {
    onDeleteMultiple(selectedGoalIds)
    exitCompareMode()
  }

  return (
    <div className="goal-results-section">
      <div className="goal-toolbar">
        <GoalFilterBar goals={goals} filters={filters} onChange={setFilters} />
        <div className="goal-toolbar-right">
          <span className="goal-count-label">{countLabel}</span>
          {goals.length >= 2 && (
            <button
              ref={compareBtnRef}
              className={`goal-compare-btn${compareMode ? ' active' : ''}`}
              onClick={() => (compareMode ? exitCompareMode() : setCompareMode(true))}
              aria-pressed={compareMode}
              title={compareMode ? 'Exit compare mode' : 'Compare goals'}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="1" y="2" width="5.5" height="12" rx="1" />
                <rect x="9.5" y="2" width="5.5" height="12" rx="1" />
              </svg>
              {compareMode ? 'Exit Compare' : 'Compare'}
            </button>
          )}
          <div className="view-mode-toggle">
            <button
              className={`view-mode-btn${viewMode === 'grid' ? ' active' : ''}`}
              onClick={() => {
                setViewMode('grid')
                localStorage.setItem('goal-view-mode', 'grid')
              }}
              aria-label="Grid view"
              title="Grid view"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <rect x="1" y="1" width="6" height="6" rx="1" />
                <rect x="9" y="1" width="6" height="6" rx="1" />
                <rect x="1" y="9" width="6" height="6" rx="1" />
                <rect x="9" y="9" width="6" height="6" rx="1" />
              </svg>
            </button>
            <button
              className={`view-mode-btn${viewMode === 'list' ? ' active' : ''}`}
              onClick={() => {
                setViewMode('list')
                localStorage.setItem('goal-view-mode', 'list')
              }}
              aria-label="List view"
              title="List view"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <rect x="1" y="2" width="14" height="2.5" rx="1" />
                <rect x="1" y="6.75" width="14" height="2.5" rx="1" />
                <rect x="1" y="11.5" width="14" height="2.5" rx="1" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      {/* Persistent live region for screen reader announcements */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {compareMode &&
          selectedGoalIds.length === 0 &&
          `Compare mode active. Click goals to select them for comparison, or use ${modKey}+Click anytime. Press Escape to exit.`}
        {compareMode &&
          selectedGoalIds.length > 0 &&
          `${selectedGoalIds.length} goal${selectedGoalIds.length !== 1 ? 's' : ''} selected for comparison.`}
      </div>
      {compareMode && selectedGoalIds.length > 0 && (
        <div className="goal-selection-bar" aria-label="Selection actions">
          <span className="goal-selection-count">
            {selectedGoalIds.length} goal{selectedGoalIds.length !== 1 ? 's' : ''} selected
          </span>
          <div className="goal-selection-actions">
            <button className="goal-selection-btn goal-selection-btn--danger" onClick={handleDeleteSelected}>
              Delete selected
            </button>
            <button className="goal-selection-btn" onClick={exitCompareMode}>
              Done
            </button>
          </div>
        </div>
      )}
      {compareMode && selectedGoalIds.length === 0 && (
        <div className="goal-compare-hint" aria-hidden="true">
          Click goals to select them for comparison, or use {modKey}+Click anytime
        </div>
      )}
      {goals.length === 0 ? (
        <div className="empty-state">
          <p>No goals created yet. Click "New Goal" to get started.</p>
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
              onSelectGoal={handleSelectGoal}
              viewMode={viewMode}
              compareMode={compareMode}
              onReorderGoals={isFiltered || compareMode ? undefined : onReorderGoals}
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
    </div>
  )
}

export default GoalsSection
