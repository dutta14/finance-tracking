import { FC, useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FinancialGoal, GwGoal } from '../../../types'
import GoalsMiniGrid from './GoalsMiniGrid'
import GoalCompareView from './GoalCompareView'
import GoalFilterBar, { GoalFilters, DEFAULT_FILTERS, applyFilters } from './GoalFilterBar'
import '../../../styles/Goal.css'
import '../../../styles/GoalFilterBar.css'
import '../../../styles/GoalCompareView.css'
import { getStorageItem, setStorageItem } from '../../../utils/storage'

const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent)
const modKey = isMac ? '⌘' : 'Ctrl'

import { useGrowthSettings } from '../hooks/useGrowthSettings'

interface GoalsSectionProps {
  goals: FinancialGoal[]
  profileBirthday: string
  gwGoals: GwGoal[]
  growthSettings: ReturnType<typeof useGrowthSettings>
  onUpdateGoal: (goalId: number, goal: FinancialGoal) => void
  onCopyGoal: (goal: FinancialGoal) => void
  onDeleteGoal: (goalId: number) => void
  onDeleteMultiple: (ids: number[]) => void
  onReorderGoals: (orderedIds: number[]) => void
  onRenameGoal: (goalId: number, name: string) => void
  onCreateGwGoal: (goal: Omit<GwGoal, 'id' | 'createdAt'>) => void
  onUpdateGwGoal: (id: number, updates: Partial<Omit<GwGoal, 'id' | 'createdAt' | 'fiGoalId'>>) => void
  onDeleteGwGoal: (id: number) => void
  onMixMatch?: () => void
  onNewGoal?: () => void
}

const GoalsSection: FC<GoalsSectionProps> = ({
  goals,
  profileBirthday,
  gwGoals,
  growthSettings: _growthSettings,
  onUpdateGoal: _onUpdateGoal,
  onCopyGoal,
  onDeleteGoal,
  onDeleteMultiple,
  onReorderGoals,
  onRenameGoal,
  onCreateGwGoal: _onCreateGwGoal,
  onUpdateGwGoal: _onUpdateGwGoal,
  onDeleteGwGoal: _onDeleteGwGoal,
  onMixMatch,
  onNewGoal,
}) => {
  const navigate = useNavigate()
  const [selectedGoalIds, setSelectedGoalIds] = useState<number[]>([])
  const [compareMode, setCompareMode] = useState(false)
  const compareBtnRef = useRef<HTMLButtonElement>(null)
  const selectedGoals = goals.filter(p => selectedGoalIds.includes(p.id))
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    const stored = getStorageItem('goal-view-mode', 'grid')
    return stored === 'list' ? 'list' : 'grid'
  })
  const [filters, setFilters] = useState<GoalFilters>(DEFAULT_FILTERS)

  const filteredGoals = applyFilters(goals, filters, profileBirthday)
  const isFiltered = filteredGoals.length !== goals.length

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
        <div className="goal-toolbar-left">
          <GoalFilterBar goals={goals} profileBirthday={profileBirthday} filters={filters} onChange={setFilters} />
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
        </div>
        <div className="goal-toolbar-right">
          {compareMode && selectedGoalIds.length > 0 && (
            <>
              <span className="goal-selection-count">{selectedGoalIds.length} selected</span>
              <button className="goal-action-btn goal-action-btn--danger" onClick={handleDeleteSelected}>
                Delete
              </button>
            </>
          )}
          {onMixMatch && goals.length > 0 && gwGoals.length > 0 && (
            <button className="goal-action-btn" onClick={onMixMatch} title="Mix & Match goals">
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M2 4h5l2 8h5M2 12h5l2-8h5" />
                <circle cx="2" cy="4" r="1" fill="currentColor" stroke="none" />
                <circle cx="2" cy="12" r="1" fill="currentColor" stroke="none" />
                <circle cx="14" cy="4" r="1" fill="currentColor" stroke="none" />
                <circle cx="14" cy="12" r="1" fill="currentColor" stroke="none" />
              </svg>
              Mix &amp; Match
            </button>
          )}
          {onNewGoal && (
            <button className="goal-action-btn goal-action-btn--accent" onClick={onNewGoal} title="Create new goal">
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              New Goal
            </button>
          )}
          <div className="tab-bar">
            <button
              className={`tab-btn tab-btn--sm${viewMode === 'grid' ? ' active' : ''}`}
              onClick={() => {
                setViewMode('grid')
                setStorageItem('goal-view-mode', 'grid')
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
              className={`tab-btn tab-btn--sm${viewMode === 'list' ? ' active' : ''}`}
              onClick={() => {
                setViewMode('list')
                setStorageItem('goal-view-mode', 'list')
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
