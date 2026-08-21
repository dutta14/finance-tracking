import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FinancialGoal } from '../../../types'
import { getFiTarget } from '../utils/goalCalculations'

export interface GoalFilters {
  retirementAges: number[]
  fiGoalBuckets: string[]
  expenseBuckets: string[]
}

export const DEFAULT_FILTERS: GoalFilters = {
  retirementAges: [],
  fiGoalBuckets: [],
  expenseBuckets: [],
}

export const FI_GOAL_BUCKETS = [
  { label: '< $5M', min: 0, max: 5_000_000 },
  { label: '$5M – $10M', min: 5_000_000, max: 10_000_000 },
  { label: '$10M – $15M', min: 10_000_000, max: 15_000_000 },
  { label: '$15M – $20M', min: 15_000_000, max: 20_000_000 },
  { label: '$20M+', min: 20_000_000, max: Infinity },
]

export const EXPENSE_BUCKETS = [
  { label: '< $50k', min: 0, max: 50_000 },
  { label: '$50k – $100k', min: 50_000, max: 100_000 },
  { label: '$100k – $200k', min: 100_000, max: 200_000 },
  { label: '$200k – $500k', min: 200_000, max: 500_000 },
  { label: '$500k+', min: 500_000, max: Infinity },
]

type FilterCategoryKey = keyof GoalFilters

interface FilterOption<T extends string | number = string | number> {
  value: T
  label: string
}

const FILTER_CATEGORIES: Array<{ key: FilterCategoryKey; label: string }> = [
  { key: 'retirementAges', label: 'Retirement Age' },
  { key: 'fiGoalBuckets', label: 'FI Goal' },
  { key: 'expenseBuckets', label: 'Expense at Creation' },
]

function cloneFilters(filters: GoalFilters): GoalFilters {
  return {
    retirementAges: [...filters.retirementAges],
    fiGoalBuckets: [...filters.fiGoalBuckets],
    expenseBuckets: [...filters.expenseBuckets],
  }
}

function countActiveFilters(filters: GoalFilters): number {
  return filters.retirementAges.length + filters.fiGoalBuckets.length + filters.expenseBuckets.length
}

function toggleSelection<T extends string | number>(current: T[], value: T, orderedValues: T[]): T[] {
  const next = current.includes(value) ? current.filter(item => item !== value) : [...current, value]
  const ordered = orderedValues.filter(item => next.includes(item))
  return ordered.length === orderedValues.length ? [] : ordered
}

function renderRetirementAgeLabel(age: number): string {
  return `Age ${age}`
}

function renderSummaryGroups(filters: GoalFilters): Array<{ label: string; values: Array<string | number> }> {
  return FILTER_CATEGORIES.map(category => ({
    label: category.label,
    values: filters[category.key],
  })).filter(group => group.values.length > 0)
}

interface GoalFilterBarProps {
  goals: FinancialGoal[]
  profileBirthday?: string
  filters: GoalFilters
  onChange: (f: GoalFilters) => void
}

const GoalFilterBar: FC<GoalFilterBarProps> = ({ goals, profileBirthday = '', filters, onChange }) => {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<FilterCategoryKey>('retirementAges')
  const [draftFilters, setDraftFilters] = useState<GoalFilters>(() => cloneFilters(filters))

  const fiTargets = useMemo(
    () => new Map(goals.map(goal => [goal.id, getFiTarget(goal, profileBirthday, 8)])),
    [goals, profileBirthday],
  )
  const availableAges = useMemo(
    () => Array.from(new Set(goals.map(goal => goal.retirementAge))).sort((a, b) => a - b),
    [goals],
  )
  const availableFiBuckets = useMemo(
    () =>
      FI_GOAL_BUCKETS.filter(bucket =>
        goals.some(goal => {
          const fiTarget = fiTargets.get(goal.id) ?? 0
          return fiTarget >= bucket.min && fiTarget < bucket.max
        }),
      ),
    [goals, fiTargets],
  )
  const availableExpenseBuckets = useMemo(
    () =>
      EXPENSE_BUCKETS.filter(bucket =>
        goals.some(goal => goal.expenseValue >= bucket.min && goal.expenseValue < bucket.max),
      ),
    [goals],
  )

  const optionsByCategory = useMemo<Record<FilterCategoryKey, FilterOption[]>>(
    () => ({
      retirementAges: availableAges.map(age => ({ value: age, label: renderRetirementAgeLabel(age) })),
      fiGoalBuckets: availableFiBuckets.map(bucket => ({ value: bucket.label, label: bucket.label })),
      expenseBuckets: availableExpenseBuckets.map(bucket => ({ value: bucket.label, label: bucket.label })),
    }),
    [availableAges, availableExpenseBuckets, availableFiBuckets],
  )

  useEffect(() => {
    if (!isOpen) {
      setDraftFilters(cloneFilters(filters))
    }
  }, [filters, isOpen])

  const handleCancel = useCallback(() => {
    setDraftFilters(cloneFilters(filters))
    setIsOpen(false)
  }, [filters])

  useEffect(() => {
    if (!isOpen) return

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return
      }
      handleCancel()
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [isOpen, handleCancel])

  const openPanel = () => {
    setDraftFilters(cloneFilters(filters))
    setIsOpen(true)
  }

  const handleApply = () => {
    onChange(cloneFilters(draftFilters))
    setIsOpen(false)
  }

  const setRetirementAges = (next: number[]) => {
    setDraftFilters(current => ({ ...current, retirementAges: next }))
  }

  const setFiGoalBuckets = (next: string[]) => {
    setDraftFilters(current => ({ ...current, fiGoalBuckets: next }))
  }

  const setExpenseBuckets = (next: string[]) => {
    setDraftFilters(current => ({ ...current, expenseBuckets: next }))
  }

  const handleSelectAll = (category: FilterCategoryKey) => {
    if (category === 'retirementAges') {
      setRetirementAges([])
      return
    }

    if (category === 'fiGoalBuckets') {
      setFiGoalBuckets([])
      return
    }

    setExpenseBuckets([])
  }

  const handleOptionToggle = (category: FilterCategoryKey, value: string | number) => {
    if (category === 'retirementAges') {
      setRetirementAges(toggleSelection(draftFilters.retirementAges, Number(value), availableAges))
      return
    }

    if (category === 'fiGoalBuckets') {
      setFiGoalBuckets(
        toggleSelection(
          draftFilters.fiGoalBuckets,
          String(value),
          availableFiBuckets.map(bucket => bucket.label),
        ),
      )
      return
    }

    setExpenseBuckets(
      toggleSelection(
        draftFilters.expenseBuckets,
        String(value),
        availableExpenseBuckets.map(bucket => bucket.label),
      ),
    )
  }

  const handleRemoveSelection = (category: FilterCategoryKey, value: string | number) => {
    if (category === 'retirementAges') {
      setRetirementAges(draftFilters.retirementAges.filter(age => age !== value))
      return
    }

    if (category === 'fiGoalBuckets') {
      setFiGoalBuckets(draftFilters.fiGoalBuckets.filter(bucket => bucket !== value))
      return
    }

    setExpenseBuckets(draftFilters.expenseBuckets.filter(bucket => bucket !== value))
  }

  const appliedFilterCount = countActiveFilters(filters)
  const stagedFilterCount = countActiveFilters(draftFilters)
  const selectedOptions = optionsByCategory[selectedCategory]
  const selectedValues = draftFilters[selectedCategory] as Array<string | number>
  const summaryGroups = renderSummaryGroups(draftFilters)

  return (
    <div className="goal-filter-bar">
      <div className="goal-filter-trigger-wrap">
        <button
          ref={triggerRef}
          type="button"
          className={`action-btn goal-filter-trigger${isOpen ? ' goal-filter-trigger--open' : ''}`}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls="goal-filters-panel"
          onClick={() => (isOpen ? handleCancel() : openPanel())}
        >
          <span className="goal-filter-trigger-icon" aria-hidden="true">
            ≡
          </span>
          <span>Filters</span>
          {appliedFilterCount > 0 && <span className="goal-filter-trigger-count">({appliedFilterCount})</span>}
        </button>

        {isOpen && (
          <div ref={panelRef} id="goal-filters-panel" className="goal-filter-panel" role="dialog" aria-label="Filters">
            <div className="goal-filter-panel-body">
              <div className="goal-filter-categories" role="tablist" aria-label="Filter categories">
                {FILTER_CATEGORIES.map(category => {
                  const count = draftFilters[category.key].length
                  return (
                    <button
                      key={category.key}
                      type="button"
                      role="tab"
                      aria-selected={selectedCategory === category.key}
                      className={`goal-filter-category${selectedCategory === category.key ? ' goal-filter-category--active' : ''}`}
                      onClick={() => setSelectedCategory(category.key)}
                    >
                      <span>{category.label}</span>
                      {count > 0 && <span className="goal-filter-category-count">{count}</span>}
                    </button>
                  )
                })}
              </div>

              <div className="goal-filter-values-column">
                <div className="goal-filter-column-header">
                  <h3>{FILTER_CATEGORIES.find(category => category.key === selectedCategory)?.label}</h3>
                </div>

                {selectedOptions.length === 0 ? (
                  <p className="goal-filter-empty">No filter values available yet.</p>
                ) : (
                  <>
                    <label className="goal-filter-checkbox goal-filter-checkbox--select-all">
                      <input
                        type="checkbox"
                        checked={selectedValues.length === 0}
                        onChange={() => handleSelectAll(selectedCategory)}
                      />
                      <span>Select all</span>
                    </label>

                    <div className="goal-filter-values-list">
                      {selectedOptions.map(option => {
                        const checked = selectedValues.includes(option.value)
                        return (
                          <label key={`${selectedCategory}-${String(option.value)}`} className="goal-filter-checkbox">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleOptionToggle(selectedCategory, option.value)}
                            />
                            <span>{option.label}</span>
                          </label>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className="goal-filter-summary-column">
                <div className="goal-filter-column-header">
                  <h3>
                    {stagedFilterCount} filter{stagedFilterCount === 1 ? '' : 's'} selected
                  </h3>
                </div>

                {summaryGroups.length === 0 ? (
                  <p className="goal-filter-empty">No filters selected.</p>
                ) : (
                  <div className="goal-filter-summary-groups">
                    {summaryGroups.map(group => {
                      const categoryKey = FILTER_CATEGORIES.find(category => category.label === group.label)?.key
                      if (!categoryKey) return null

                      return (
                        <div key={group.label} className="goal-filter-summary-group">
                          <h4>{group.label}</h4>
                          <ul>
                            {group.values.map(value => (
                              <li key={`${group.label}-${String(value)}`}>
                                <span>
                                  {categoryKey === 'retirementAges'
                                    ? renderRetirementAgeLabel(Number(value))
                                    : String(value)}
                                </span>
                                <button
                                  type="button"
                                  className="goal-filter-remove"
                                  aria-label={`Remove ${group.label} ${String(value)}`}
                                  onClick={() => handleRemoveSelection(categoryKey, value)}
                                >
                                  ×
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="goal-filter-footer">
              <button
                type="button"
                className="goal-filter-footer-btn"
                onClick={() => setDraftFilters(cloneFilters(DEFAULT_FILTERS))}
              >
                Clear
              </button>
              <div className="goal-filter-footer-actions">
                <button type="button" className="goal-filter-footer-btn" onClick={handleCancel}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="goal-filter-footer-btn goal-filter-footer-btn--apply"
                  onClick={handleApply}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function applyFilters(goals: FinancialGoal[], filters: GoalFilters, profileBirthday = ''): FinancialGoal[] {
  let result = goals

  if (filters.retirementAges.length > 0) {
    result = result.filter(goal => filters.retirementAges.includes(goal.retirementAge))
  }

  if (filters.fiGoalBuckets.length > 0) {
    result = result.filter(goal =>
      FI_GOAL_BUCKETS.some(bucket => {
        const fiTarget = getFiTarget(goal, profileBirthday, 8)
        return filters.fiGoalBuckets.includes(bucket.label) && fiTarget >= bucket.min && fiTarget < bucket.max
      }),
    )
  }

  if (filters.expenseBuckets.length > 0) {
    result = result.filter(goal =>
      EXPENSE_BUCKETS.some(
        bucket =>
          filters.expenseBuckets.includes(bucket.label) &&
          goal.expenseValue >= bucket.min &&
          goal.expenseValue < bucket.max,
      ),
    )
  }

  return result
}

export default GoalFilterBar
