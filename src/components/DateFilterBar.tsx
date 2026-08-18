import { FC, useState, useRef, useEffect } from 'react'
import { DateFilter, DATE_FILTER_OPTIONS, UseDateFilterResult } from '../hooks/useDateFilter'
import '../styles/MonthPicker.css'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface DateFilterBarProps {
  dateFilter: DateFilter
  setDateFilter: (f: DateFilter) => void
  customFrom?: string
  customTo?: string
  onFromChange?: (month: string) => void
  onToChange?: (month: string) => void
  allMonths?: string[]
  size?: 'sm' | 'md'
}

/* ─── Inline month grid (used for From / To inside the flyout) ─── */
const InlineMonthGrid: FC<{
  label: string
  allMonths: string[]
  selectedMonth: string
  onSelect: (month: string) => void
}> = ({ label, allMonths, selectedMonth, onSelect }) => {
  const availableYears = Array.from(new Set(allMonths.map(m => parseInt(m.slice(0, 4), 10)))).sort()
  const initialYear = selectedMonth
    ? parseInt(selectedMonth.slice(0, 4), 10)
    : (availableYears[availableYears.length - 1] ?? new Date().getFullYear())
  const [year, setYear] = useState(initialYear)
  const availableSet = new Set(allMonths)
  const yearIdx = availableYears.indexOf(year)

  return (
    <div className="date-flyout-section">
      <span className="date-flyout-label">{label}</span>
      <div className="details-month-picker-year">
        <button
          className="details-month-chevron"
          type="button"
          disabled={yearIdx <= 0}
          onClick={() => setYear(availableYears[yearIdx - 1])}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 2L4 7L9 12" />
          </svg>
        </button>
        <span>{year}</span>
        <button
          className="details-month-chevron"
          type="button"
          disabled={yearIdx >= availableYears.length - 1}
          onClick={() => setYear(availableYears[yearIdx + 1])}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 2L10 7L5 12" />
          </svg>
        </button>
      </div>
      <div className="details-month-picker-grid">
        {MONTHS.map((m, i) => {
          const key = `${year}-${String(i + 1).padStart(2, '0')}`
          const isEnabled = availableSet.has(key)
          const isSelected = selectedMonth === key
          return (
            <button
              key={key}
              type="button"
              className={`details-month-picker-cell${isSelected ? ' details-month-picker-cell--selected' : ''}`}
              disabled={!isEnabled}
              onClick={() => onSelect(key)}
            >
              {m}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export const DateFilterBar: FC<DateFilterBarProps> = ({
  dateFilter,
  setDateFilter,
  customFrom = '',
  customTo = '',
  onFromChange,
  onToChange,
  allMonths = [],
  size = 'sm',
}) => {
  const [flyoutOpen, setFlyoutOpen] = useState(false)
  const flyoutRef = useRef<HTMLDivElement>(null)
  const customBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!flyoutOpen) return
    const handleClick = (e: MouseEvent) => {
      if (!flyoutRef.current?.contains(e.target as Node) && !customBtnRef.current?.contains(e.target as Node)) {
        setFlyoutOpen(false)
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFlyoutOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [flyoutOpen])

  return (
    <div className="date-filter-wrap">
      <div className="tab-bar">
        {DATE_FILTER_OPTIONS.map(({ key, label }) =>
          key === 'custom' ? (
            <div key={key} className="date-filter-custom-wrap">
              <button
                ref={customBtnRef}
                className={`tab-btn tab-btn--${size}${dateFilter === 'custom' ? ' active' : ''}`}
                onClick={() => {
                  setDateFilter('custom')
                  setFlyoutOpen(o => !o)
                }}
              >
                {label}
              </button>
              {flyoutOpen && dateFilter === 'custom' && onFromChange && onToChange && (
                <div ref={flyoutRef} className="date-filter-range-flyout">
                  <InlineMonthGrid
                    label="From"
                    allMonths={allMonths}
                    selectedMonth={customFrom}
                    onSelect={onFromChange}
                  />
                  <div className="date-flyout-divider" />
                  <InlineMonthGrid label="To" allMonths={allMonths} selectedMonth={customTo} onSelect={onToChange} />
                </div>
              )}
            </div>
          ) : (
            <button
              key={key}
              className={`tab-btn tab-btn--${size}${dateFilter === key ? ' active' : ''}`}
              onClick={() => {
                setDateFilter(key)
                setFlyoutOpen(false)
              }}
            >
              {label}
            </button>
          ),
        )}
      </div>
    </div>
  )
}

/** Convenience: pass entire useDateFilter result */
export const DateFilterBarFromHook: FC<{ hook: UseDateFilterResult; allMonths: string[]; size?: 'sm' | 'md' }> = ({
  hook,
  allMonths,
  size,
}) => (
  <DateFilterBar
    dateFilter={hook.dateFilter}
    setDateFilter={hook.setDateFilter}
    customFrom={hook.customFrom}
    customTo={hook.customTo}
    onFromChange={hook.setCustomFrom}
    onToChange={hook.setCustomTo}
    allMonths={allMonths}
    size={size}
  />
)
