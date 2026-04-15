import { FC, useState, useRef, useCallback, useEffect } from 'react'
import { CategoryGroup, Transaction, TimePeriod } from '../types'
import { shortMonthName, buildMonthKey, getCSVFormatHelp } from '../utils/csvParser'

interface BudgetTableProps {
  year: number
  type: 'income' | 'expense'
  categoryGroups: CategoryGroup[]
  categorySums: Record<string, Record<string, number>>
  monthsWithData: Set<string>
  onUploadCSV: (monthKey: string, csv: string) => { ok: boolean; error?: string }
  onRemoveCSV: (monthKey: string) => void
  onEditCategory: (monthKey: string, transactionIdx: number, newCategory: string) => void
  yearTransactions: Record<string, Transaction[]>
  timePeriod: TimePeriod
}

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })

/** Strip group prefix from category for display: "X: Y" in group "X" → "Y" */
const displayCat = (cat: string, groupName?: string): string => {
  if (!groupName) return cat
  const prefix = groupName + ':'
  if (cat.toLowerCase().startsWith(prefix.toLowerCase())) {
    return cat.slice(prefix.length).trim()
  }
  return cat
}

const BudgetTable: FC<BudgetTableProps> = ({
  year, type, categoryGroups, categorySums, monthsWithData,
  onUploadCSV, onRemoveCSV, onEditCategory, yearTransactions, timePeriod,
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; monthKey: string } | null>(null)
  const [csvError, setCsvError] = useState<string | null>(null)
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null)
  const [drilldownCategories, setDrilldownCategories] = useState<Set<string>>(new Set())
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterSearch, setFilterSearch] = useState('')
  const filterRef = useRef<HTMLDivElement>(null)
  const [editingTxn, setEditingTxn] = useState<{ idx: number; value: string } | null>(null)
  const [confirmNewCat, setConfirmNewCat] = useState<{ idx: number; origIdx: number; name: string; monthKey: string } | null>(null)
  const [showPct, setShowPct] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingMonthRef = useRef<string>('')

  // Filter categories that belong to this table type (income or expense)
  // If a category has ANY negative month, it's an expense (positives are refunds).
  // Only purely-positive categories are income.
  const isTypeCategory = useCallback((cat: string) => {
    const monthValues = Object.values(categorySums[cat] || {})
    const hasNegative = monthValues.some(v => v < 0)
    if (type === 'expense') return hasNegative
    // Income: only if never negative
    return !hasNegative && monthValues.some(v => v > 0)
  }, [categorySums, type])

  // Get all categories for this type
  const relevantCategories = new Set<string>()
  Object.keys(categorySums).forEach(cat => {
    if (isTypeCategory(cat)) relevantCategories.add(cat)
  })

  // Get groups that have relevant categories
  const relevantGroups = categoryGroups
    .filter(g => g.id !== 'removed')
    .map(g => ({
      ...g,
      categories: g.categories.filter(c => relevantCategories.has(c)),
    }))
    .filter(g => g.categories.length > 0)

  const months = Array.from({ length: 12 }, (_, i) => buildMonthKey(year, i))

  // Build periods based on timePeriod setting
  const periods: { label: string; monthKeys: string[] }[] = (() => {
    if (timePeriod === 'quarter') {
      return [
        { label: 'Q1', monthKeys: months.slice(0, 3) },
        { label: 'Q2', monthKeys: months.slice(3, 6) },
        { label: 'Q3', monthKeys: months.slice(6, 9) },
        { label: 'Q4', monthKeys: months.slice(9, 12) },
      ]
    }
    if (timePeriod === 'half') {
      return [
        { label: 'H1', monthKeys: months.slice(0, 6) },
        { label: 'H2', monthKeys: months.slice(6, 12) },
      ]
    }
    return months.map((m, i) => ({ label: shortMonthName(i), monthKeys: [m] }))
  })()

  const getCellValue = (cat: string, monthKey: string): number => {
    return categorySums[cat]?.[monthKey] || 0
  }

  const getPeriodValue = (cat: string, period: { monthKeys: string[] }): number => {
    return period.monthKeys.reduce((sum, m) => sum + getCellValue(cat, m), 0)
  }

  const getCategoryTotal = (cat: string): number => {
    let total = 0
    months.forEach(m => { total += getCellValue(cat, m) })
    return total
  }

  const getGroupTotal = (group: CategoryGroup, monthKey: string): number => {
    let total = 0
    group.categories.forEach(cat => {
      if (relevantCategories.has(cat)) total += getCellValue(cat, monthKey)
    })
    return total
  }

  const getGroupPeriodTotal = (group: CategoryGroup, period: { monthKeys: string[] }): number => {
    return period.monthKeys.reduce((sum, m) => sum + getGroupTotal(group, m), 0)
  }

  const getGroupYearTotal = (group: CategoryGroup): number => {
    let total = 0
    months.forEach(m => { total += getGroupTotal(group, m) })
    return total
  }

  const grandTotal = (): number => {
    let total = 0
    if (type === 'income') {
      relevantCategories.forEach(cat => { total += getCategoryTotal(cat) })
    } else {
      relevantGroups.forEach(g => { total += getGroupYearTotal(g) })
    }
    return total
  }

  const grandPeriodTotal = (period: { monthKeys: string[] }): number => {
    let total = 0
    if (type === 'income') {
      relevantCategories.forEach(cat => { total += getPeriodValue(cat, period) })
    } else {
      relevantGroups.forEach(g => { total += getGroupPeriodTotal(g, period) })
    }
    return total
  }

  const getCategoryPct = (cat: string): string => {
    const gt = Math.abs(grandTotal())
    if (gt === 0) return ''
    const pct = (Math.abs(getCategoryTotal(cat)) / gt) * 100
    return `${pct.toFixed(1)}%`
  }

  // Context menu for month headers
  const handleHeaderContextMenu = (e: React.MouseEvent, monthKey: string) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, monthKey })
  }

  const handleUploadClick = () => {
    if (!contextMenu) return
    pendingMonthRef.current = contextMenu.monthKey
    setContextMenu(null)
    fileInputRef.current?.click()
  }

  const handleRemoveClick = () => {
    if (!contextMenu) return
    onRemoveCSV(contextMenu.monthKey)
    setContextMenu(null)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const result = onUploadCSV(pendingMonthRef.current, text)
      if (!result.ok) {
        setCsvError(result.error || 'Upload failed')
        setTimeout(() => setCsvError(null), 5000)
      }
    }
    reader.readAsText(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Close filter dropdown on outside click
  useEffect(() => {
    if (!filterOpen) return
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false)
        setFilterSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [filterOpen])

  // Drill-down into month transactions
  const handleMonthClick = (monthKey: string) => {
    if (expandedMonth === monthKey) {
      setExpandedMonth(null)
    } else {
      setExpandedMonth(monthKey)
      setDrilldownCategories(new Set())
    }
  }

  const getMonthTransactions = (monthKey: string): (Transaction & { origIdx: number })[] => {
    return (yearTransactions[monthKey] || [])
      .map((t, i) => ({ ...t, origIdx: i }))
      .filter(t => relevantCategories.has(t.category))
  }

  return (
    <div className="budget-table-section">
      <h3 className="budget-table-title">{type === 'income' ? 'Income' : 'Expenses'}</h3>

      {csvError && (
        <div className="budget-csv-error">
          <span>⚠ {csvError}</span>
          <button onClick={() => setCsvError(null)}>×</button>
        </div>
      )}

      <div className="budget-table-wrapper">
        <table className="budget-table">
          <thead>
            <tr>
              <th className="budget-th budget-th--category">Category</th>
              {timePeriod === 'month' ? months.map((m, i) => (
                <th
                  key={m}
                  className={`budget-th budget-th--month${monthsWithData.has(m) ? ' has-data' : ''}`}
                  onContextMenu={e => handleHeaderContextMenu(e, m)}
                  onClick={() => handleMonthClick(m)}
                  title="Right-click to upload CSV"
                >
                  {shortMonthName(i)}
                  {monthsWithData.has(m) && <span className="budget-th-dot" />}
                </th>
              )) : periods.map(p => (
                <th key={p.label} className="budget-th budget-th--month">
                  {p.label}
                </th>
              ))}
              <th className="budget-th budget-th--total budget-th--switchable" onClick={() => setShowPct(p => !p)} title="Click to toggle Total / %">
                {showPct ? '%' : 'Total'}
              </th>
            </tr>
          </thead>
          <tbody>
            {type === 'income' ? (
              // Income: flat list of categories, no group structure
              <>
                {[...relevantCategories].sort((a, b) => a.localeCompare(b)).map(cat => {
                  const total = getCategoryTotal(cat)
                  return (
                    <tr key={cat} className="budget-tr--category">
                      <td className="budget-td budget-td--category-name">{displayCat(cat)}</td>
                      {periods.map(p => {
                        const val = getPeriodValue(cat, p)
                        return (
                          <td key={p.label} className="budget-td budget-td--number">
                            {val !== 0 ? fmt(Math.abs(val)) : ''}
                          </td>
                        )
                      })}
                      <td className={`budget-td budget-td--total ${showPct ? 'budget-td--pct' : 'budget-td--number'}`}>
                        {showPct ? getCategoryPct(cat) : (total !== 0 ? fmt(Math.abs(total)) : '')}
                      </td>
                    </tr>
                  )
                })}
              </>
            ) : (
              // Expense: grouped rows
              relevantGroups.map(group => (
                <GroupRows
                  key={group.id}
                  group={group}
                  periods={periods}
                  getPeriodValue={getPeriodValue}
                  getCategoryTotal={getCategoryTotal}
                  getGroupPeriodTotal={getGroupPeriodTotal}
                  getGroupYearTotal={getGroupYearTotal}
                  getCategoryPct={getCategoryPct}
                  isExpense={true}
                  showPct={showPct}
                />
              ))
            )}
            {relevantCategories.size > 0 && (
              <tr className="budget-tr--grand-total">
                <td className="budget-td budget-td--category"><strong>Grand Total</strong></td>
                {periods.map(p => {
                  const periodTotal = grandPeriodTotal(p)
                  return (
                    <td key={p.label} className="budget-td budget-td--number">
                      <strong>{periodTotal !== 0 ? fmt(Math.abs(periodTotal)) : ''}</strong>
                    </td>
                  )
                })}
                <td className={`budget-td ${showPct ? 'budget-td--pct' : 'budget-td--number'}`}>
                  <strong>{showPct ? '100%' : fmt(Math.abs(grandTotal()))}</strong>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Drill-down panel */}
      {expandedMonth && (() => {
        const allTxns = getMonthTransactions(expandedMonth)
        const categories = [...new Set(allTxns.map(t => t.category))].sort((a, b) => a.localeCompare(b))
        const filtered = drilldownCategories.size === 0 ? allTxns : allTxns.filter(t => drilldownCategories.has(t.category))
        const filterSum = filtered.reduce((s, t) => s + t.amount, 0)
        const allSelected = drilldownCategories.size === 0
        const realSelected = categories.filter(c => drilldownCategories.has(c)).length
        const partialSelected = realSelected > 0 && realSelected < categories.length
        const toggleCategory = (cat: string) => {
          setDrilldownCategories(prev => {
            const next = new Set(prev)
            next.delete('__none__')
            if (next.has(cat)) next.delete(cat)
            else next.add(cat)
            // If all categories are now selected, go back to "all" state
            if (next.size === categories.length && categories.every(c => next.has(c))) {
              return new Set()
            }
            // If nothing left, use sentinel
            if (next.size === 0) return new Set(['__none__'])
            return next
          })
        }
        return (
          <div className="budget-drilldown">
            <div className="budget-drilldown-header">
              <h4>{shortMonthName(parseInt(expandedMonth.split('-')[1], 10) - 1)} {year} — {type === 'income' ? 'Income' : 'Expense'} Transactions</h4>
              <button className="budget-drilldown-close" onClick={() => setExpandedMonth(null)}>×</button>
            </div>
            {allTxns.length > 0 && (
              <div className="budget-drilldown-filter">
                <div className="budget-filter-dropdown" ref={filterRef}>
                  <button
                    className="budget-filter-trigger"
                    onClick={() => { setFilterOpen(v => !v); setFilterSearch('') }}
                  >
                    {allSelected
                      ? 'All Categories'
                      : (() => {
                          const count = categories.filter(c => drilldownCategories.has(c)).length
                          return count === 0 ? 'None selected' : `${count} of ${categories.length} categories`
                        })()}
                    <span className="budget-filter-chevron">{filterOpen ? '▲' : '▼'}</span>
                  </button>
                  {filterOpen && (
                    <div className="budget-filter-panel">
                      <input
                        className="budget-filter-search"
                        type="text"
                        placeholder="Search categories…"
                        value={filterSearch}
                        onChange={e => setFilterSearch(e.target.value)}
                        autoFocus
                      />
                      <div className="budget-filter-list">
                        {!filterSearch && (
                          <label className="budget-filter-item budget-filter-item--all">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              ref={el => { if (el) el.indeterminate = partialSelected }}
                              onChange={() => {
                                if (allSelected) {
                                  // Deselect all — set to full set so nothing matches except explicit picks
                                  setDrilldownCategories(new Set(['__none__']))
                                } else {
                                  // Select all
                                  setDrilldownCategories(new Set())
                                }
                              }}
                            />
                            <span>All Categories</span>
                          </label>
                        )}
                        {categories
                          .filter(c => c.toLowerCase().includes(filterSearch.toLowerCase()))
                          .map(c => (
                            <label key={c} className="budget-filter-item">
                              <input
                                type="checkbox"
                                checked={allSelected || drilldownCategories.has(c)}
                                onChange={() => {
                                  if (allSelected) {
                                    // Switching from all → deselect this one
                                    const remaining = categories.filter(x => x !== c)
                                    setDrilldownCategories(remaining.length > 0 ? new Set(remaining) : new Set(['__none__']))
                                  } else {
                                    toggleCategory(c)
                                  }
                                }}
                              />
                              <span>{c}</span>
                            </label>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
                {!allSelected && (
                  <span className={`budget-drilldown-sum ${type === 'expense' && filterSum > 0 ? 'budget-amt-refund' : ''}`}>
                    {fmt(Math.abs(filterSum))}
                  </span>
                )}
              </div>
            )}
            <div className="budget-drilldown-body">
              {filtered.length === 0 ? (
                <p className="budget-drilldown-empty">No {type} transactions for this month.</p>
              ) : (
                <table className="budget-drilldown-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Amount</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t, i) => (
                      <tr key={i}>
                        <td>{t.date}</td>
                        <td
                          className="budget-drilldown-cat-cell"
                          onDoubleClick={() => setEditingTxn({ idx: i, value: t.category })}
                          title="Double-click to edit category"
                        >
                          {editingTxn?.idx === i ? (
                            <input
                              className="budget-drilldown-cat-input"
                              value={editingTxn.value}
                              onChange={e => setEditingTxn({ idx: i, value: e.target.value })}
                              onBlur={() => {
                                const newCat = editingTxn.value.trim()
                                if (newCat && newCat !== t.category) {
                                  const allCats = new Set(
                                    Object.values(yearTransactions).flatMap(txns => txns.map(tx => tx.category))
                                  )
                                  if (!allCats.has(newCat)) {
                                    setConfirmNewCat({ idx: i, origIdx: t.origIdx, name: newCat, monthKey: expandedMonth! })
                                    setEditingTxn(null)
                                    return
                                  }
                                  onEditCategory(expandedMonth!, t.origIdx, newCat)
                                  setDrilldownCategories(new Set())
                                }
                                setEditingTxn(null)
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                                if (e.key === 'Escape') setEditingTxn(null)
                              }}
                              autoFocus
                            />
                          ) : confirmNewCat?.idx === i ? (
                            <div className="budget-confirm-newcat">
                              <span className="budget-confirm-newcat-text">
                                Create new category <strong>"{confirmNewCat.name}"</strong>?
                              </span>
                              <button
                                className="budget-confirm-newcat-btn budget-confirm-newcat-btn--yes"
                                onClick={() => {
                                  onEditCategory(confirmNewCat.monthKey, confirmNewCat.origIdx, confirmNewCat.name)
                                  setDrilldownCategories(new Set())
                                  setConfirmNewCat(null)
                                }}
                              >Yes</button>
                              <button
                                className="budget-confirm-newcat-btn budget-confirm-newcat-btn--no"
                                onClick={() => setConfirmNewCat(null)}
                              >No</button>
                            </div>
                          ) : t.category}
                        </td>
                        <td className={type === 'expense' && t.amount > 0 ? 'budget-amt-refund' : ''}>
                          {fmt(Math.abs(t.amount))}
                        </td>
                        <td>{t.description || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )
      })()}

      {/* Context menu */}
      {contextMenu && (
        <>
          <div className="budget-ctx-backdrop" onClick={() => setContextMenu(null)} />
          <div className="budget-ctx-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
            <button className="budget-ctx-item" onClick={handleUploadClick}>
              Upload CSV for {shortMonthName(parseInt(contextMenu.monthKey.split('-')[1], 10) - 1)}
            </button>
            {monthsWithData.has(contextMenu.monthKey) && (
              <button className="budget-ctx-item budget-ctx-item--danger" onClick={handleRemoveClick}>
                Remove CSV
              </button>
            )}
            <div className="budget-ctx-divider" />
            <div className="budget-ctx-hint">{getCSVFormatHelp()}</div>
          </div>
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  )
}

/** Renders a group header row + category rows */
const GroupRows: FC<{
  group: CategoryGroup & { categories: string[] }
  periods: { label: string; monthKeys: string[] }[]
  getPeriodValue: (cat: string, period: { monthKeys: string[] }) => number
  getCategoryTotal: (cat: string) => number
  getGroupPeriodTotal: (g: CategoryGroup, period: { monthKeys: string[] }) => number
  getGroupYearTotal: (g: CategoryGroup) => number
  getCategoryPct: (cat: string) => string
  isExpense: boolean
  showPct: boolean
}> = ({
  group, periods, getPeriodValue, getCategoryTotal, getGroupPeriodTotal, getGroupYearTotal,
  getCategoryPct, isExpense, showPct,
}) => {
  const groupYearTotal = getGroupYearTotal(group)

  return (
    <>
      {/* Group header */}
      <tr className="budget-tr--group-header">
        <td className="budget-td budget-td--group-name" colSpan={1}>
          {group.name}
        </td>
        {periods.map(p => {
          const val = getGroupPeriodTotal(group, p)
          return (
            <td key={p.label} className="budget-td budget-td--group-number">
              {val !== 0 ? fmt(Math.abs(val)) : ''}
            </td>
          )
        })}
        <td className="budget-td budget-td--group-number budget-td--total">
          {showPct ? '' : (groupYearTotal !== 0 ? fmt(Math.abs(groupYearTotal)) : '')}
        </td>
      </tr>
      {/* Category rows */}
      {[...group.categories].sort((a, b) => a.localeCompare(b)).map(cat => {
        const total = getCategoryTotal(cat)
        return (
          <tr key={cat} className="budget-tr--category">
            <td className="budget-td budget-td--category-name">
              {displayCat(cat, group.name)}
            </td>
            {periods.map(p => {
              const val = getPeriodValue(cat, p)
              return (
                <td key={p.label} className={`budget-td budget-td--number${isExpense && val > 0 ? ' refund' : ''}`}>
                  {val !== 0 ? fmt(Math.abs(val)) : ''}
                </td>
              )
            })}
            <td className={`budget-td budget-td--total ${showPct ? 'budget-td--pct' : `budget-td--number${isExpense && total > 0 ? ' refund' : ''}`}`}>
              {showPct ? getCategoryPct(cat) : (total !== 0 ? fmt(Math.abs(total)) : '')}
            </td>
          </tr>
        )
      })}
    </>
  )
}

export default BudgetTable
