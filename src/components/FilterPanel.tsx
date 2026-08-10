import { FC, useCallback, useEffect, useRef, useState } from 'react'
import '../styles/GoalFilterBar.css'
import '../styles/Transactions.css'

export interface FilterCategory {
  key: string
  label: string
  options: { value: string; label: string }[]
}

export interface FilterState {
  [categoryKey: string]: string[]
}

interface FilterPanelProps {
  categories: FilterCategory[]
  filters: FilterState
  onChange: (filters: FilterState) => void
}

function countActive(filters: FilterState): number {
  return Object.values(filters).reduce((sum, arr) => sum + arr.length, 0)
}

function cloneState(filters: FilterState): FilterState {
  const out: FilterState = {}
  for (const key of Object.keys(filters)) out[key] = [...filters[key]]
  return out
}

const FilterPanel: FC<FilterPanelProps> = ({ categories, filters, onChange }) => {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.key ?? '')
  const [draft, setDraft] = useState<FilterState>(() => cloneState(filters))

  useEffect(() => {
    if (!isOpen) setDraft(cloneState(filters))
  }, [filters, isOpen])

  const handleCancel = useCallback(() => {
    setDraft(cloneState(filters))
    setIsOpen(false)
  }, [filters])

  useEffect(() => {
    if (!isOpen) return
    const handleMouseDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return
      handleCancel()
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [isOpen, handleCancel])

  const openPanel = () => {
    setDraft(cloneState(filters))
    setIsOpen(true)
  }

  const handleApply = () => {
    onChange(cloneState(draft))
    setIsOpen(false)
  }

  const handleSelectAll = (key: string) => {
    setDraft(prev => ({ ...prev, [key]: [] }))
  }

  const handleToggle = (key: string, value: string) => {
    setDraft(prev => {
      const current = prev[key] || []
      const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value]
      const cat = categories.find(c => c.key === key)
      // If all are selected, treat as "select all" (empty = no filter)
      if (cat && next.length === cat.options.length) return { ...prev, [key]: [] }
      return { ...prev, [key]: next }
    })
  }

  const handleRemove = (key: string, value: string) => {
    setDraft(prev => ({ ...prev, [key]: (prev[key] || []).filter(v => v !== value) }))
  }

  const appliedCount = countActive(filters)
  const stagedCount = countActive(draft)
  const currentCat = categories.find(c => c.key === selectedCategory)
  const selectedValues = draft[selectedCategory] || []

  const summaryGroups = categories
    .map(c => ({ label: c.label, key: c.key, values: draft[c.key] || [] }))
    .filter(g => g.values.length > 0)

  return (
    <div className="goal-filter-bar">
      <div className="goal-filter-trigger-wrap">
        <button
          ref={triggerRef}
          type="button"
          className="txn-filter-btn"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={() => (isOpen ? handleCancel() : openPanel())}
        >
          <span className="txn-filter-btn-key">
            <span className="goal-filter-trigger-icon" aria-hidden="true">
              ≡
            </span>{' '}
            Filters
          </span>
          {appliedCount > 0 && <span className="txn-filter-btn-value">({appliedCount})</span>}
        </button>

        {isOpen && (
          <div ref={panelRef} className="goal-filter-panel" role="dialog" aria-label="Filters">
            <div className="goal-filter-panel-body">
              <div className="goal-filter-categories" role="tablist" aria-label="Filter categories">
                {categories.map(cat => {
                  const count = (draft[cat.key] || []).length
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      role="tab"
                      aria-selected={selectedCategory === cat.key}
                      className={`goal-filter-category${selectedCategory === cat.key ? ' goal-filter-category--active' : ''}`}
                      onClick={() => setSelectedCategory(cat.key)}
                    >
                      <span>{cat.label}</span>
                      {count > 0 && <span className="goal-filter-category-count">{count}</span>}
                    </button>
                  )
                })}
              </div>

              <div className="goal-filter-values-column">
                <div className="goal-filter-column-header">
                  <h3>{currentCat?.label}</h3>
                </div>
                {currentCat && currentCat.options.length === 0 ? (
                  <p className="goal-filter-empty">No filter values available.</p>
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
                      {currentCat?.options.map(opt => (
                        <label key={opt.value} className="goal-filter-checkbox">
                          <input
                            type="checkbox"
                            checked={selectedValues.includes(opt.value)}
                            onChange={() => handleToggle(selectedCategory, opt.value)}
                          />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="goal-filter-summary-column">
                <div className="goal-filter-column-header">
                  <h3>
                    {stagedCount} filter{stagedCount === 1 ? '' : 's'} selected
                  </h3>
                </div>
                {summaryGroups.length === 0 ? (
                  <p className="goal-filter-empty">No filters selected.</p>
                ) : (
                  <div className="goal-filter-summary-groups">
                    {summaryGroups.map(g => (
                      <div key={g.key} className="goal-filter-summary-group">
                        <h4>{g.label}</h4>
                        <ul>
                          {g.values.map(val => {
                            const opt = categories.find(c => c.key === g.key)?.options.find(o => o.value === val)
                            return (
                              <li key={val}>
                                <span>{opt?.label ?? val}</span>
                                <button
                                  type="button"
                                  className="goal-filter-remove"
                                  aria-label={`Remove ${g.label} ${opt?.label ?? val}`}
                                  onClick={() => handleRemove(g.key, val)}
                                >
                                  ×
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="goal-filter-footer">
              <button
                type="button"
                className="goal-filter-footer-btn"
                onClick={() => {
                  const empty: FilterState = {}
                  for (const c of categories) empty[c.key] = []
                  setDraft(empty)
                }}
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

export default FilterPanel
