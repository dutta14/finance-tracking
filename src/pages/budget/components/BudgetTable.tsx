import { FC, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { CategoryGroup, TimePeriod } from '../types'
import { shortMonthName, buildMonthKey, getCSVFormatHelp } from '../utils/csvParser'

interface BudgetTableProps {
  year: number
  type: 'income' | 'expense'
  categoryGroups: CategoryGroup[]
  categorySums: Record<string, Record<string, number>>
  monthsWithData: Set<string>
  onUploadCSV: (monthKey: string, csv: string) => { ok: boolean; error?: string }
  onRemoveCSV: (monthKey: string) => void
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
  year,
  type,
  categoryGroups,
  categorySums,
  monthsWithData,
  onUploadCSV,
  onRemoveCSV,
  timePeriod,
}) => {
  const navigate = useNavigate()
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; monthKey: string } | null>(null)
  const [csvError, setCsvError] = useState<string | null>(null)
  const [showPct, setShowPct] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingMonthRef = useRef<string>('')

  // Filter categories that belong to this table type (income or expense)
  // If a category has ANY negative month, it's an expense (positives are refunds).
  // Only purely-positive categories are income.
  const isTypeCategory = useCallback(
    (cat: string) => {
      const monthValues = Object.values(categorySums[cat] || {})
      const hasNegative = monthValues.some(v => v < 0)
      if (type === 'expense') return hasNegative
      // Income: only if never negative
      return !hasNegative && monthValues.some(v => v > 0)
    },
    [categorySums, type],
  )

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
    months.forEach(m => {
      total += getCellValue(cat, m)
    })
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
    months.forEach(m => {
      total += getGroupTotal(group, m)
    })
    return total
  }

  const grandTotal = (): number => {
    let total = 0
    if (type === 'income') {
      relevantCategories.forEach(cat => {
        total += getCategoryTotal(cat)
      })
    } else {
      relevantGroups.forEach(g => {
        total += getGroupYearTotal(g)
      })
    }
    return total
  }

  const grandPeriodTotal = (period: { monthKeys: string[] }): number => {
    let total = 0
    if (type === 'income') {
      relevantCategories.forEach(cat => {
        total += getPeriodValue(cat, period)
      })
    } else {
      relevantGroups.forEach(g => {
        total += getGroupPeriodTotal(g, period)
      })
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
    reader.onload = ev => {
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

  const navigateToTransactions = (monthKey: string | null, categories: string[]) => {
    const params = new URLSearchParams()

    if (monthKey) {
      const [y, m] = monthKey.split('-')
      const monthNum = parseInt(m, 10)
      const yearNum = parseInt(y, 10)
      const lastDay = new Date(yearNum, monthNum, 0).getDate()
      params.set('from', `${y}-${m}-01`)
      params.set('to', `${y}-${m}-${String(lastDay).padStart(2, '0')}`)
    } else {
      params.set('from', `${year}-01-01`)
      params.set('to', `${year}-12-31`)
    }

    if (categories.length > 0) {
      params.set('categories', categories.join(','))
    }

    navigate(`/transactions?${params.toString()}`)
  }

  const handleMonthClick = (monthKey: string) => {
    navigateToTransactions(monthKey, [])
  }

  return (
    <div className="budget-table-section">
      <h3 className="budget-table-title">{type === 'income' ? 'Income' : 'Expenses'}</h3>

      {csvError && (
        <div className="budget-csv-error" role="alert" aria-live="polite">
          <span>⚠ {csvError}</span>
          <button aria-label="Dismiss error" onClick={() => setCsvError(null)}>
            ×
          </button>
        </div>
      )}

      <div className="budget-table-wrapper">
        <table className="budget-table">
          <thead>
            <tr>
              <th className="budget-th budget-th--category">Category</th>
              {timePeriod === 'month'
                ? months.map((m, i) => (
                    <th
                      key={m}
                      className={`budget-th budget-th--month${monthsWithData.has(m) ? ' has-data' : ''}`}
                      onContextMenu={e => handleHeaderContextMenu(e, m)}
                      onClick={() => handleMonthClick(m)}
                      title="Click to view transactions. Right-click to upload CSV"
                    >
                      {shortMonthName(i)}
                      {monthsWithData.has(m) && <span className="budget-th-dot" />}
                    </th>
                  ))
                : periods.map(p => (
                    <th key={p.label} className="budget-th budget-th--month">
                      {p.label}
                    </th>
                  ))}
              <th
                className="budget-th budget-th--total budget-th--switchable"
                onClick={() => setShowPct(p => !p)}
                title="Click to toggle Total / %"
              >
                {showPct ? '%' : 'Total'}
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Both income and expense use grouped rows */}
            {relevantGroups.map(group => (
              <GroupRows
                key={group.id}
                group={group}
                periods={periods}
                getPeriodValue={getPeriodValue}
                getCategoryTotal={getCategoryTotal}
                getGroupPeriodTotal={getGroupPeriodTotal}
                getGroupYearTotal={getGroupYearTotal}
                getCategoryPct={getCategoryPct}
                isExpense={type === 'expense'}
                showPct={showPct}
                onNavigateToTransactions={navigateToTransactions}
              />
            ))}
            {relevantCategories.size > 0 && (
              <tr className="budget-tr--grand-total">
                <td className="budget-td budget-td--category">
                  <strong>Grand Total</strong>
                </td>
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

      {/* Context menu */}
      {contextMenu && (
        <>
          <div className="budget-ctx-backdrop" data-testid="ctx-menu-backdrop" onClick={() => setContextMenu(null)} />
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
        data-testid="csv-file-input"
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
  onNavigateToTransactions: (monthKey: string | null, categories: string[]) => void
}> = ({
  group,
  periods,
  getPeriodValue,
  getCategoryTotal,
  getGroupPeriodTotal,
  getGroupYearTotal,
  getCategoryPct,
  isExpense,
  showPct,
  onNavigateToTransactions,
}) => {
  const groupYearTotal = getGroupYearTotal(group)

  return (
    <>
      {/* Group header */}
      <tr className="budget-tr--group-header">
        <td className="budget-td budget-td--group-name" colSpan={1}>
          <button
            type="button"
            className="budget-table-link budget-table-link--label"
            onClick={() => onNavigateToTransactions(null, group.categories)}
            title={`View ${group.name} transactions for the year`}
          >
            {group.name}
          </button>
        </td>
        {periods.map(p => {
          const val = getGroupPeriodTotal(group, p)
          const monthKey = p.monthKeys.length === 1 ? p.monthKeys[0] : null
          return (
            <td key={p.label} className="budget-td budget-td--group-number">
              {val !== 0 && monthKey ? (
                <button
                  type="button"
                  className="budget-table-link budget-table-link--cell"
                  onClick={() => onNavigateToTransactions(monthKey, group.categories)}
                  aria-label={`View ${group.name} transactions for ${p.label}`}
                  title={`View ${group.name} transactions for ${p.label}`}
                >
                  {fmt(Math.abs(val))}
                </button>
              ) : val !== 0 ? (
                fmt(Math.abs(val))
              ) : (
                ''
              )}
            </td>
          )
        })}
        <td className="budget-td budget-td--group-number budget-td--total">
          {showPct ? '' : groupYearTotal !== 0 ? fmt(Math.abs(groupYearTotal)) : ''}
        </td>
      </tr>
      {/* Category rows */}
      {[...group.categories]
        .sort((a, b) => a.localeCompare(b))
        .map(cat => {
          const total = getCategoryTotal(cat)
          const categoryLabel = displayCat(cat, group.name)
          return (
            <tr key={cat} className="budget-tr--category">
              <td className="budget-td budget-td--category-name">
                <button
                  type="button"
                  className="budget-table-link budget-table-link--label"
                  onClick={() => onNavigateToTransactions(null, [cat])}
                  title={`View ${categoryLabel} transactions for the year`}
                >
                  {categoryLabel}
                </button>
              </td>
              {periods.map(p => {
                const val = getPeriodValue(cat, p)
                const monthKey = p.monthKeys.length === 1 ? p.monthKeys[0] : null
                return (
                  <td key={p.label} className={`budget-td budget-td--number${isExpense && val > 0 ? ' refund' : ''}`}>
                    {val !== 0 && monthKey ? (
                      <button
                        type="button"
                        className="budget-table-link budget-table-link--cell"
                        onClick={() => onNavigateToTransactions(monthKey, [cat])}
                        aria-label={`View ${categoryLabel} transactions for ${p.label}`}
                        title={`View ${categoryLabel} transactions for ${p.label}`}
                      >
                        {fmt(Math.abs(val))}
                      </button>
                    ) : val !== 0 ? (
                      fmt(Math.abs(val))
                    ) : (
                      ''
                    )}
                  </td>
                )
              })}
              <td
                className={`budget-td budget-td--total ${showPct ? 'budget-td--pct' : `budget-td--number${isExpense && total > 0 ? ' refund' : ''}`}`}
              >
                {showPct ? getCategoryPct(cat) : total !== 0 ? fmt(Math.abs(total)) : ''}
              </td>
            </tr>
          )
        })}
    </>
  )
}

export default BudgetTable
