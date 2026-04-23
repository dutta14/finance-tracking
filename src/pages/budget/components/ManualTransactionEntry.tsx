import { FC, useState, useRef, useEffect, useCallback, useMemo, FormEvent } from 'react'
import { CategoryGroup } from '../types'
import { monthKeyFromDate } from '../utils/csvParser'

const REMOVED_GROUP_ID = 'removed'

interface ManualTransactionEntryProps {
  categoryGroups: CategoryGroup[]
  years: number[]
  onAdd: (monthKey: string, csvLine: string) => void
}

function csvEscape(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return '"' + field.replace(/"/g, '""') + '"'
  }
  return field
}

function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}



const ManualTransactionEntry: FC<ManualTransactionEntryProps> = ({
  categoryGroups,
  years,
  onAdd,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [date, setDate] = useState(todayISO)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [catQuery, setCatQuery] = useState('')
  const [catOpen, setCatOpen] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showSuccess, setShowSuccess] = useState(false)

  const dateRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const catInputRef = useRef<HTMLInputElement>(null)
  const catListRef = useRef<HTMLUListElement>(null)
  const catWrapperRef = useRef<HTMLDivElement>(null)
  const successTimer = useRef<ReturnType<typeof setTimeout>>()

  const visibleGroups = categoryGroups.filter(g => g.id !== REMOVED_GROUP_ID && g.categories.length > 0)

  // Filtered groups based on search query
  const filteredGroups = useMemo(() => {
    const q = catQuery.trim().toLowerCase()
    if (!q) return visibleGroups
    return visibleGroups
      .map(g => ({ ...g, categories: g.categories.filter(c => c.toLowerCase().includes(q)) }))
      .filter(g => g.categories.length > 0)
  }, [visibleGroups, catQuery])

  // Flat list of selectable options for keyboard navigation
  const selectableOptions = useMemo(() => {
    return filteredGroups.flatMap(g => g.categories)
  }, [filteredGroups])

  // Close dropdown on outside click
  useEffect(() => {
    if (!catOpen) return
    const handler = (e: MouseEvent) => {
      if (catWrapperRef.current && !catWrapperRef.current.contains(e.target as Node)) {
        setCatOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [catOpen])

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightIdx < 0 || !catListRef.current) return
    const el = catListRef.current.querySelector(`[data-idx="${highlightIdx}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlightIdx])

  const selectCategory = useCallback((value: string) => {
    setCategory(value)
    setCatQuery(value)
    setCatOpen(false)
    setHighlightIdx(-1)
    setErrors(prev => { const { category: _, ...rest } = prev; return rest })
  }, [])

  const handleCatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!catOpen) { setCatOpen(true); setHighlightIdx(0); return }
      setHighlightIdx(prev => Math.min(prev + 1, selectableOptions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (catOpen && highlightIdx >= 0 && highlightIdx < selectableOptions.length) {
        selectCategory(selectableOptions[highlightIdx])
      } else if (!catOpen && category) {
        // Enter on filled field → submit form
        handleSubmit()
      }
    } else if (e.key === 'Escape') {
      if (catOpen) { e.stopPropagation(); setCatOpen(false) }
    } else if (e.key === 'Tab') {
      setCatOpen(false)
    }
  }

  const toggle = useCallback(() => {
    setIsOpen(prev => !prev)
  }, [])

  // Focus date input when form opens
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => dateRef.current?.focus())
    }
  }, [isOpen])

  // Escape key collapses form (unless combobox is open)
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !catOpen) {
        setIsOpen(false)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, catOpen])

  useEffect(() => {
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current)
    }
  }, [])

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!date) errs.date = 'Date is required'
    if (!amount.trim()) {
      errs.amount = 'Amount is required'
    } else {
      const cleaned = amount.trim().replace(/[$,\s]/g, '')
      if (isNaN(parseFloat(cleaned))) errs.amount = 'Enter a valid number'
    }
    if (!category) errs.category = 'Category is required'

    if (date) {
      const year = parseInt(date.slice(0, 4), 10)
      if (!years.includes(year)) {
        errs.date = `Budget for ${year} doesn't exist yet. Create it first.`
      }
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault()
    if (!validate()) return

    const monthKey = monthKeyFromDate(date)
    const cleanAmount = amount.trim().replace(/[$,\s]/g, '')
    const parsedAmount = parseFloat(cleanAmount)
    const csvLine = [
      csvEscape(date),
      csvEscape(category),
      String(parsedAmount),
      csvEscape(description.trim()),
    ].join(',')

    onAdd(monthKey, csvLine)

    setShowSuccess(true)
    if (successTimer.current) clearTimeout(successTimer.current)
    successTimer.current = setTimeout(() => setShowSuccess(false), 1500)

    setDate(todayISO())
    setDescription('')
    setAmount('')
    setCategory('')
    setCatQuery('')
    setErrors({})

    requestAnimationFrame(() => dateRef.current?.focus())
  }

  // Build a running option index for keyboard nav across groups
  const renderCatDropdown = () => {
    let optIdx = 0
    return filteredGroups.map(group => (
      <li key={group.id} role="presentation">
        <span className="budget-cat-group-label">{group.name}</span>
        <ul role="group" aria-label={group.name}>
          {group.categories.map(cat => {
            const idx = optIdx++
            const isHighlighted = idx === highlightIdx
            return (
              <li
                key={cat}
                role="option"
                id={`txn-cat-opt-${idx}`}
                data-idx={idx}
                aria-selected={isHighlighted}
                className={`budget-cat-option${isHighlighted ? ' budget-cat-option--hl' : ''}${cat === category ? ' budget-cat-option--selected' : ''}`}
                onMouseDown={e => { e.preventDefault(); selectCategory(cat) }}
                onMouseEnter={() => setHighlightIdx(idx)}
              >
                {cat}
              </li>
            )
          })}
        </ul>
      </li>
    ))
  }

  return (
    <div className="budget-manual-entry">
      <button
        className="budget-add-txn-btn"
        onClick={toggle}
        aria-expanded={isOpen}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Add Transaction
      </button>

      <div
        ref={formRef}
        className={`budget-txn-form-wrapper${isOpen ? ' budget-txn-form-wrapper--open' : ''}`}
      >
        {isOpen && (
          <form className="budget-txn-form" onSubmit={handleSubmit} noValidate>
            <div className="budget-txn-form-grid">
              <div className="budget-txn-field">
                <label className="budget-txn-label" htmlFor="txn-date">Date</label>
                <input
                  ref={dateRef}
                  id="txn-date"
                  type="date"
                  className={`budget-txn-input${errors.date ? ' budget-txn-input--error' : ''}`}
                  value={date}
                  onChange={e => { setDate(e.target.value); setErrors(prev => { const { date: _, ...rest } = prev; return rest }) }}
                  required
                />
                {errors.date && <span className="budget-txn-error">{errors.date}</span>}
              </div>

              <div className="budget-txn-field">
                <label className="budget-txn-label" htmlFor="txn-desc">Description</label>
                <input
                  id="txn-desc"
                  type="text"
                  className="budget-txn-input"
                  placeholder="e.g., Trader Joes"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>

              <div className="budget-txn-field">
                <label className="budget-txn-label" htmlFor="txn-amount">Amount</label>
                <input
                  id="txn-amount"
                  type="text"
                  inputMode="decimal"
                  className={`budget-txn-input${errors.amount ? ' budget-txn-input--error' : ''}`}
                  placeholder="$0.00"
                  value={amount}
                  onChange={e => { setAmount(e.target.value); setErrors(prev => { const { amount: _, ...rest } = prev; return rest }) }}
                  required
                />
                {errors.amount && <span className="budget-txn-error">{errors.amount}</span>}
              </div>

              <div className="budget-txn-field" ref={catWrapperRef}>
                <label className="budget-txn-label" htmlFor="txn-category">Category</label>
                <div className="budget-cat-combobox">
                  <input
                    ref={catInputRef}
                    id="txn-category"
                    type="text"
                    role="combobox"
                    autoComplete="off"
                    aria-expanded={catOpen}
                    aria-controls="txn-cat-listbox"
                    aria-activedescendant={catOpen && highlightIdx >= 0 ? `txn-cat-opt-${highlightIdx}` : undefined}
                    className={`budget-txn-input${errors.category ? ' budget-txn-input--error' : ''}`}
                    placeholder="e.g., Groceries"
                    value={catQuery}
                    onChange={e => {
                      const val = e.target.value
                      setCatQuery(val)
                      setCategory('')
                      setCatOpen(true)
                      setHighlightIdx(0)
                      setErrors(prev => { const { category: _, ...rest } = prev; return rest })
                    }}
                    onFocus={() => { if (!catOpen) { setCatOpen(true); setHighlightIdx(-1) } }}
                    onKeyDown={handleCatKeyDown}
                    required
                  />
                  {catQuery && (
                    <button
                      type="button"
                      className="budget-cat-clear"
                      aria-label="Clear category"
                      tabIndex={-1}
                      onMouseDown={e => {
                        e.preventDefault()
                        setCategory('')
                        setCatQuery('')
                        setCatOpen(true)
                        catInputRef.current?.focus()
                      }}
                    >
                      ×
                    </button>
                  )}
                  {catOpen && (
                    <ul
                      ref={catListRef}
                      id="txn-cat-listbox"
                      role="listbox"
                      className="budget-cat-listbox"
                    >
                      {filteredGroups.length > 0 ? renderCatDropdown() : (
                        <li className="budget-cat-empty" role="presentation">
                          {visibleGroups.length === 0
                            ? 'No categories — upload a CSV first'
                            : `No match for "${catQuery}"`}
                        </li>
                      )}
                    </ul>
                  )}
                </div>
                {errors.category && <span className="budget-txn-error">{errors.category}</span>}
              </div>
            </div>

            <div className="budget-txn-actions">
              <button
                type="submit"
                className={`budget-txn-save${showSuccess ? ' budget-txn-save--success' : ''}`}
              >
                {showSuccess ? 'Added ✓' : 'Save'}
              </button>
              <button
                type="button"
                className="budget-txn-cancel"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default ManualTransactionEntry
