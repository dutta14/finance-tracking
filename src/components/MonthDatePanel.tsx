import { FC, useEffect, useMemo, useRef, useState } from 'react'
import '../styles/Transactions.css'
import '../styles/MonthPicker.css'

interface MonthDatePanelProps {
  allMonths: string[]
  fromMonth: string
  toMonth: string
  preset: PresetKey
  onApply: (preset: PresetKey, from: string, to: string) => void
}

export type PresetKey = 'all' | 'ytd' | 'last-12' | 'eoy' | 'custom'

interface Preset {
  key: PresetKey
  label: string
  from: string
  to: string
}

function formatMonthLabel(m: string): string {
  if (!m) return ''
  const [y, mo] = m.split('-')
  const name = new Date(Number(y), Number(mo) - 1).toLocaleString('default', { month: 'short' })
  return `${name} ${y}`
}

const MonthDatePanel: FC<MonthDatePanelProps> = ({ allMonths, fromMonth, toMonth, preset: appliedPreset, onApply }) => {
  const triggerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [draftFrom, setDraftFrom] = useState(fromMonth)
  const [draftTo, setDraftTo] = useState(toMonth)
  const [activePreset, setActivePreset] = useState<PresetKey>(appliedPreset)

  useEffect(() => {
    if (!isOpen) {
      setDraftFrom(fromMonth)
      setDraftTo(toMonth)
      setActivePreset(appliedPreset)
    }
  }, [fromMonth, toMonth, appliedPreset, isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return
      setIsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  const ascending = useMemo(() => [...allMonths].sort(), [allMonths])

  const presets = useMemo((): Preset[] => {
    if (ascending.length === 0) return []
    const now = new Date()
    const yr = now.getFullYear().toString()
    const curMonth = `${yr}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const last = ascending[ascending.length - 1]
    const first = ascending[0]
    const last12Start = ascending.length > 12 ? ascending[ascending.length - 12] : first

    return [
      { key: 'all', label: 'All time', from: '', to: '' },
      { key: 'ytd', label: 'Year to date', from: `${yr}-01`, to: curMonth > last ? last : curMonth },
      { key: 'last-12', label: 'Last 12 months', from: last12Start, to: last },
      { key: 'eoy', label: 'Year-end only', from: '', to: '' },
      { key: 'custom', label: 'Custom range', from: '', to: '' },
    ]
  }, [ascending])

  const selectPreset = (p: Preset) => {
    setActivePreset(p.key)
    if (p.key !== 'custom') {
      setDraftFrom(p.from)
      setDraftTo(p.to)
    }
  }

  const handleApply = () => {
    onApply(activePreset, draftFrom, draftTo)
    setIsOpen(false)
  }

  const handleClear = () => {
    setDraftFrom('')
    setDraftTo('')
    setActivePreset('all')
  }

  const dateSummaryLabel = useMemo(() => {
    if (appliedPreset === 'all') return null
    if (appliedPreset === 'eoy') return 'Year-end'
    if (appliedPreset === 'ytd') return 'YTD'
    if (appliedPreset === 'last-12') return 'Last 12 mo'
    if (fromMonth && toMonth) return `${formatMonthLabel(fromMonth)} – ${formatMonthLabel(toMonth)}`
    if (fromMonth) return `From ${formatMonthLabel(fromMonth)}`
    if (toMonth) return `Until ${formatMonthLabel(toMonth)}`
    return null
  }, [appliedPreset, fromMonth, toMonth])

  const isCustom = activePreset === 'custom'

  return (
    <div className="txn-date-picker" ref={triggerRef} style={{ position: 'relative' }}>
      <button
        className="txn-filter-btn"
        type="button"
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="txn-filter-btn-key">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>{' '}
          Date
        </span>
        {dateSummaryLabel && <span className="txn-filter-btn-value">{dateSummaryLabel}</span>}
      </button>

      {isOpen && (
        <div className="txn-date-panel" ref={panelRef} role="dialog" aria-label="Month range picker">
          <div className="txn-date-panel-presets">
            <h3 className="txn-date-panel-heading">Date Range</h3>
            <ul className="txn-date-panel-preset-list">
              {presets.map(p => (
                <li key={p.key}>
                  <button
                    type="button"
                    className={`txn-date-preset-btn${activePreset === p.key ? ' txn-date-preset-btn--active' : ''}`}
                    onClick={() => selectPreset(p)}
                  >
                    {p.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="txn-date-panel-custom">
            {isCustom ? (
              <>
                <div className="txn-date-panel-field">
                  <div className="txn-date-panel-field-header">
                    <label>From month</label>
                    {draftFrom && (
                      <button type="button" className="txn-date-clear-btn" onClick={() => setDraftFrom('')}>Clear</button>
                    )}
                  </div>
                  <InlineMonthGrid allMonths={ascending} selected={draftFrom} onSelect={setDraftFrom} defaultToFirst />
                </div>
                <div className="txn-date-panel-field">
                  <div className="txn-date-panel-field-header">
                    <label>To month</label>
                    {draftTo && (
                      <button type="button" className="txn-date-clear-btn" onClick={() => setDraftTo('')}>Clear</button>
                    )}
                  </div>
                  <InlineMonthGrid allMonths={ascending} selected={draftTo} onSelect={setDraftTo} />
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)', fontSize: 'var(--fs-sm)' }}>
                {activePreset === 'all' && 'Showing all months'}
                {activePreset === 'ytd' && 'Showing months from January to now'}
                {activePreset === 'last-12' && 'Showing the last 12 months'}
                {activePreset === 'eoy' && 'Showing December of each year'}
              </div>
            )}
          </div>

          <div className="txn-date-panel-footer">
            <button type="button" className="txn-date-panel-btn txn-date-panel-clear" onClick={handleClear}>Clear</button>
            <div className="txn-date-panel-actions">
              <button type="button" className="txn-date-panel-btn" onClick={() => setIsOpen(false)}>Cancel</button>
              <button type="button" className="txn-date-panel-btn txn-date-panel-apply" onClick={handleApply}>Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Inline Month Grid ── */
interface InlineMonthGridProps {
  allMonths: string[]
  selected: string
  onSelect: (month: string) => void
  defaultToFirst?: boolean
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const InlineMonthGrid: FC<InlineMonthGridProps> = ({ allMonths, selected, onSelect, defaultToFirst }) => {
  const availableYears = useMemo(() => {
    const years = new Set(allMonths.map(m => m.slice(0, 4)))
    return [...years].sort()
  }, [allMonths])

  const [viewYear, setViewYear] = useState(() => {
    if (selected) return selected.slice(0, 4)
    return (defaultToFirst ? availableYears[0] : availableYears[availableYears.length - 1]) || new Date().getFullYear().toString()
  })

  const availableSet = useMemo(() => new Set(allMonths), [allMonths])

  const yearIdx = availableYears.indexOf(viewYear)
  const canPrev = yearIdx > 0
  const canNext = yearIdx < availableYears.length - 1

  return (
    <div className="details-month-picker" style={{ position: 'relative', top: 'auto', left: 'auto', right: 'auto', zIndex: 'auto', marginTop: 0, boxShadow: 'none', border: '1px solid var(--color-border)' }}>
      <div className="details-month-picker-year">
        <button
          type="button"
          className="details-month-chevron"
          disabled={!canPrev}
          onClick={() => canPrev && setViewYear(availableYears[yearIdx - 1])}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 2L4 7L9 12" />
          </svg>
        </button>
        <span>{viewYear}</span>
        <button
          type="button"
          className="details-month-chevron"
          disabled={!canNext}
          onClick={() => canNext && setViewYear(availableYears[yearIdx + 1])}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 2L10 7L5 12" />
          </svg>
        </button>
      </div>
      <div className="details-month-picker-grid">
        {MONTH_LABELS.map((label, i) => {
          const month = `${viewYear}-${String(i + 1).padStart(2, '0')}`
          const available = availableSet.has(month)
          const isSelected = month === selected
          return (
            <button
              key={month}
              type="button"
              className={`details-month-picker-cell${isSelected ? ' details-month-picker-cell--selected' : ''}${!available ? ' details-month-picker-cell--disabled' : ''}`}
              disabled={!available}
              onClick={() => onSelect(month)}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default MonthDatePanel
