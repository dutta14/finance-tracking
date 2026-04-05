import { FC, useState, useRef, useEffect } from 'react'
import { FinancialPlan } from '../../../types'

export interface PlanFilters {
  retirementAges: number[]       // selected retirement ages
  fiGoalBuckets: string[]        // e.g. '0-5M', '5M-10M', ...
  expenseBuckets: string[]       // e.g. '0-50k', '50k-100k', ...
}

export const DEFAULT_FILTERS: PlanFilters = {
  retirementAges: [],
  fiGoalBuckets: [],
  expenseBuckets: [],
}

export const FI_GOAL_BUCKETS = [
  { label: '< $5M',         min: 0,        max: 5_000_000 },
  { label: '$5M – $10M',    min: 5_000_000, max: 10_000_000 },
  { label: '$10M – $15M',   min: 10_000_000, max: 15_000_000 },
  { label: '$15M – $20M',   min: 15_000_000, max: 20_000_000 },
  { label: '$20M+',         min: 20_000_000, max: Infinity },
]

export const EXPENSE_BUCKETS = [
  { label: '< $50k',        min: 0,       max: 50_000 },
  { label: '$50k – $100k',  min: 50_000,  max: 100_000 },
  { label: '$100k – $200k', min: 100_000, max: 200_000 },
  { label: '$200k – $500k', min: 200_000, max: 500_000 },
  { label: '$500k+',        min: 500_000, max: Infinity },
]

interface DropdownProps {
  label: string
  active: boolean
  children: React.ReactNode
  onClose: () => void
  triggerRef: React.RefObject<HTMLButtonElement>
}

const FilterDropdown: FC<DropdownProps> = ({ active, children, onClose, triggerRef }) => {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active) return
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [active, onClose, triggerRef])

  return (
    <div className="filter-dropdown-wrapper">
      {active && (
        <div className="filter-dropdown-panel" ref={panelRef}>
          {children}
          <button className="filter-dropdown-clear" onClick={onClose}>Done</button>
        </div>
      )}
    </div>
  )
}

interface PlanFilterBarProps {
  plans: FinancialPlan[]
  filters: PlanFilters
  onChange: (f: PlanFilters) => void
}

const PlanFilterBar: FC<PlanFilterBarProps> = ({ plans, filters, onChange }) => {
  const [openMenu, setOpenMenu] = useState<'age' | 'fi' | 'expense' | null>(null)

  // Unique retirement ages present in plans
  const availableAges = Array.from(new Set(plans.map(p => p.retirementAge))).sort((a, b) => a - b)

  // Buckets that actually have plans
  const availableFiBuckets = FI_GOAL_BUCKETS.filter(b => plans.some(p => p.fiGoal >= b.min && p.fiGoal < b.max))
  const availableExpenseBuckets = EXPENSE_BUCKETS.filter(b => plans.some(p => p.expenseValue >= b.min && p.expenseValue < b.max))

  const toggleAge = (age: number) => {
    const next = filters.retirementAges.includes(age)
      ? filters.retirementAges.filter(a => a !== age)
      : [...filters.retirementAges, age]
    onChange({ ...filters, retirementAges: next })
  }

  const toggleFiBucket = (label: string) => {
    const next = filters.fiGoalBuckets.includes(label)
      ? filters.fiGoalBuckets.filter(l => l !== label)
      : [...filters.fiGoalBuckets, label]
    onChange({ ...filters, fiGoalBuckets: next })
  }

  const toggleExpenseBucket = (label: string) => {
    const next = filters.expenseBuckets.includes(label)
      ? filters.expenseBuckets.filter(l => l !== label)
      : [...filters.expenseBuckets, label]
    onChange({ ...filters, expenseBuckets: next })
  }

  const clearAll = () => onChange(DEFAULT_FILTERS)
  const hasFilters = filters.retirementAges.length > 0 || filters.fiGoalBuckets.length > 0 || filters.expenseBuckets.length > 0
  const activeCount = filters.retirementAges.length + filters.fiGoalBuckets.length + filters.expenseBuckets.length

  const ageRef = useRef<HTMLButtonElement>(null!)
  const fiRef  = useRef<HTMLButtonElement>(null!)
  const expRef = useRef<HTMLButtonElement>(null!)

  return (
    <div className="plan-filter-bar">
      <div className="plan-filter-controls">
        {/* Retirement Age Filter */}
        <div className="filter-pill-group">
          <button
            ref={ageRef}
            className={`filter-pill${filters.retirementAges.length > 0 ? ' filter-pill--active' : ''}${openMenu === 'age' ? ' filter-pill--open' : ''}`}
            onClick={() => setOpenMenu(o => o === 'age' ? null : 'age')}
          >
            Retirement Age
            {filters.retirementAges.length > 0 && <span className="filter-pill-badge">{filters.retirementAges.length}</span>}
            <span className="filter-pill-chevron">▾</span>
          </button>
          <FilterDropdown label="Retirement Age" active={openMenu === 'age'} onClose={() => setOpenMenu(null)} triggerRef={ageRef}>
            {availableAges.length === 0 ? (
              <p className="filter-empty">No plans yet</p>
            ) : availableAges.map(age => (
              <label key={age} className="filter-option">
                <input
                  type="checkbox"
                  checked={filters.retirementAges.includes(age)}
                  onChange={() => toggleAge(age)}
                />
                Age {age}
              </label>
            ))}
          </FilterDropdown>
        </div>

        {/* FI Goal Filter */}
        <div className="filter-pill-group">
          <button
            ref={fiRef}
            className={`filter-pill${filters.fiGoalBuckets.length > 0 ? ' filter-pill--active' : ''}${openMenu === 'fi' ? ' filter-pill--open' : ''}`}
            onClick={() => setOpenMenu(o => o === 'fi' ? null : 'fi')}
          >
            FI Goal
            {filters.fiGoalBuckets.length > 0 && <span className="filter-pill-badge">{filters.fiGoalBuckets.length}</span>}
            <span className="filter-pill-chevron">▾</span>
          </button>
          <FilterDropdown label="FI Goal" active={openMenu === 'fi'} onClose={() => setOpenMenu(null)} triggerRef={fiRef}>
            {availableFiBuckets.length === 0 ? (
              <p className="filter-empty">No plans yet</p>
            ) : FI_GOAL_BUCKETS.map(b => (
              <label key={b.label} className={`filter-option${!availableFiBuckets.includes(b) ? ' filter-option--dim' : ''}`}>
                <input
                  type="checkbox"
                  checked={filters.fiGoalBuckets.includes(b.label)}
                  onChange={() => toggleFiBucket(b.label)}
                  disabled={!availableFiBuckets.includes(b)}
                />
                {b.label}
              </label>
            ))}
          </FilterDropdown>
        </div>

        {/* Expense at Creation Filter */}
        <div className="filter-pill-group">
          <button
            ref={expRef}
            className={`filter-pill${filters.expenseBuckets.length > 0 ? ' filter-pill--active' : ''}${openMenu === 'expense' ? ' filter-pill--open' : ''}`}
            onClick={() => setOpenMenu(o => o === 'expense' ? null : 'expense')}
          >
            Expense at Creation
            {filters.expenseBuckets.length > 0 && <span className="filter-pill-badge">{filters.expenseBuckets.length}</span>}
            <span className="filter-pill-chevron">▾</span>
          </button>
          <FilterDropdown label="Expense" active={openMenu === 'expense'} onClose={() => setOpenMenu(null)} triggerRef={expRef}>
            {availableExpenseBuckets.length === 0 ? (
              <p className="filter-empty">No plans yet</p>
            ) : EXPENSE_BUCKETS.map(b => (
              <label key={b.label} className={`filter-option${!availableExpenseBuckets.includes(b) ? ' filter-option--dim' : ''}`}>
                <input
                  type="checkbox"
                  checked={filters.expenseBuckets.includes(b.label)}
                  onChange={() => toggleExpenseBucket(b.label)}
                  disabled={!availableExpenseBuckets.includes(b)}
                />
                {b.label}
              </label>
            ))}
          </FilterDropdown>
        </div>
      </div>

      {hasFilters && (
        <div className="plan-filter-right">
          <span className="plan-filter-active-count">{activeCount} filter{activeCount > 1 ? 's' : ''} active</span>
          <button className="plan-filter-clear-all" onClick={clearAll}>Clear all</button>
        </div>
      )}
    </div>
  )
}

export function applyFilters(plans: FinancialPlan[], filters: PlanFilters): FinancialPlan[] {
  let result = plans

  if (filters.retirementAges.length > 0) {
    result = result.filter(p => filters.retirementAges.includes(p.retirementAge))
  }

  if (filters.fiGoalBuckets.length > 0) {
    result = result.filter(p =>
      FI_GOAL_BUCKETS.some(b => filters.fiGoalBuckets.includes(b.label) && p.fiGoal >= b.min && p.fiGoal < b.max)
    )
  }

  if (filters.expenseBuckets.length > 0) {
    result = result.filter(p =>
      EXPENSE_BUCKETS.some(b => filters.expenseBuckets.includes(b.label) && p.expenseValue >= b.min && p.expenseValue < b.max)
    )
  }

  return result
}

export default PlanFilterBar
