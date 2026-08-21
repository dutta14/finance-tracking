import { FC, useMemo, useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { loadBudgetStore, getIncomeGroups } from '../../budget/utils/budgetStorage'
import { parseCSV } from '../../budget/utils/csvParser'
import { useData } from '../../../contexts/DataContext'
import type { Account, BalanceEntry } from '../../data/types'
import { useFileStore } from '../../../contexts/FileStoreContext'
import { delta } from '../utils/savingsCalc'
import '../../../styles/SavingsGrowthTracker.css'

const REMOVED_GROUP_ID = 'removed'

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })

const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`

function getYearEndNetWorths(_accounts: Account[], balances: BalanceEntry[]): Map<number, number> {
  const byMonth = new Map<string, Map<number, number>>()
  for (const b of balances) {
    if (!byMonth.has(b.month)) byMonth.set(b.month, new Map())
    byMonth.get(b.month)!.set(b.accountId, b.balance)
  }

  const monthsByYear = new Map<number, string[]>()
  for (const m of byMonth.keys()) {
    const yr = parseInt(m.split('-')[0], 10)
    if (!monthsByYear.has(yr)) monthsByYear.set(yr, [])
    monthsByYear.get(yr)!.push(m)
  }

  const result = new Map<number, number>()
  for (const [yr, months] of monthsByYear) {
    months.sort()
    const dec = months.find(m => m.endsWith('-12'))
    const pick = dec || months[months.length - 1]
    const accBals = byMonth.get(pick)!
    let total = 0
    for (const bal of accBals.values()) total += bal
    result.set(yr, total)
  }
  return result
}

interface BudgetYearData {
  netIncome: number | null
  totalIncome: number | null
  totalExpense: number | null
  hasData: boolean
}

async function getBudgetYearlyData(
  fileStore: import('../../../utils/fileStoreTypes').FileStore,
): Promise<Map<number, BudgetYearData>> {
  const result = new Map<number, BudgetYearData>()
  try {
    const store = await loadBudgetStore(fileStore)
    const groups = store.categoryGroups || []
    const removedCats = new Set(groups.find(g => g.id === REMOVED_GROUP_ID)?.categories || [])

    // Use income group membership as source of truth (same as Budget page)
    const incomeGroups = getIncomeGroups(groups)
    const incomeCatSet = new Set(incomeGroups.flatMap(g => (g.id !== REMOVED_GROUP_ID ? g.categories : [])))

    const yearSet = new Set<number>()
    for (const key of Object.keys(store.csvs)) {
      yearSet.add(parseInt(key.split('-')[0], 10))
    }

    for (const year of yearSet) {
      const txns: { category: string; amount: number; monthKey: string }[] = []
      for (let m = 1; m <= 12; m++) {
        const key = `${year}-${String(m).padStart(2, '0')}`
        const csvData = store.csvs[key]
        if (!csvData) continue
        try {
          const parsed = parseCSV(csvData.csv)
          txns.push(...parsed.map(t => ({ category: t.category, amount: t.amount, monthKey: key })))
        } catch {
          /* skip */
        }
      }
      if (txns.length === 0) continue

      const catMonthSums: Record<string, Record<string, number>> = {}
      txns.forEach(t => {
        if (removedCats.has(t.category)) return
        if (!catMonthSums[t.category]) catMonthSums[t.category] = {}
        catMonthSums[t.category][t.monthKey] = (catMonthSums[t.category][t.monthKey] || 0) + t.amount
      })

      let totalIncome = 0
      let totalExpense = 0
      Object.entries(catMonthSums).forEach(([cat, months]) => {
        const sum = Object.values(months).reduce((s, v) => s + v, 0)
        if (incomeCatSet.has(cat)) {
          totalIncome += sum
        } else {
          totalExpense += Math.abs(sum)
        }
      })

      result.set(year, {
        totalIncome,
        totalExpense,
        netIncome: totalIncome,
        hasData: true,
      })
    }
  } catch {
    /* empty */
  }
  return result
}

const OVERRIDES_PATH = 'savings-tracker-overrides.json'

interface YearOverrides {
  grossIncome?: number
  taxes?: number
  netIncome?: number
  savings?: number
}

interface YearRow {
  year: number
  netWorth: number | null
  nwChange: number | null
  totalIncome: number | null
  totalExpense: number | null
  netIncome: number | null
  savings: number | null
  growth: number | null
  grossIncome: number | null
  taxes: number | null
  hasBudgetData: boolean
}

type TabMode = 'savings' | 'income'

const SavingsGrowthTracker: FC = () => {
  const [showPct, setShowPct] = useState(false)
  const [overrides, setOverrides] = useState<Record<number, YearOverrides>>({})
  const [editCell, setEditCell] = useState<{ year: number; field: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const location = useLocation()
  const tab: TabMode = location.pathname.endsWith('/income') ? 'income' : 'savings'
  const { fileStore } = useFileStore()

  const { accounts, balances } = useData()
  const nwByYear = useMemo(() => getYearEndNetWorths(accounts, balances), [accounts, balances])

  const [budgetData, setBudgetData] = useState<Map<number, BudgetYearData>>(new Map())

  useEffect(() => {
    fileStore
      .readJSON<Record<number, YearOverrides>>(OVERRIDES_PATH, {})
      .then(setOverrides)
      .catch(() => setOverrides({}))
  }, [fileStore])

  useEffect(() => {
    getBudgetYearlyData(fileStore)
      .then(setBudgetData)
      .catch(() => setBudgetData(new Map()))
  }, [fileStore])

  const persistOverrides = useCallback(
    (o: Record<number, YearOverrides>) => {
      fileStore.writeJSON(OVERRIDES_PATH, o).catch(console.error)
      window.dispatchEvent(new Event('tools-changed'))
    },
    [fileStore],
  )

  const rows: YearRow[] = useMemo(() => {
    const allYears = new Set<number>()
    for (const yr of nwByYear.keys()) allYears.add(yr)
    for (const yr of budgetData.keys()) allYears.add(yr)
    for (const yr of Object.keys(overrides).map(Number)) allYears.add(yr)

    const sorted = [...allYears].sort()
    const result: YearRow[] = []

    for (let i = 0; i < sorted.length; i++) {
      const year = sorted[i]
      const nw = nwByYear.get(year) ?? null
      const prevNw = i > 0 ? (nwByYear.get(sorted[i - 1]) ?? null) : null
      const nwChange = nw !== null && prevNw !== null ? nw - prevNw : null

      const bd = budgetData.get(year)
      const ov = overrides[year] || {}

      const totalIncome = bd?.totalIncome ?? null
      const totalExpense = bd?.totalExpense ?? null
      const netIncome = ov.netIncome ?? bd?.netIncome ?? null
      const savings = ov.savings ?? (netIncome !== null && totalExpense !== null ? netIncome - totalExpense : null)
      const growth = nwChange !== null && savings !== null ? nwChange - savings : null

      result.push({
        year,
        netWorth: nw,
        nwChange,
        totalIncome,
        totalExpense,
        netIncome,
        savings,
        growth,
        grossIncome: ov.grossIncome ?? null,
        taxes: ov.taxes ?? null,
        hasBudgetData: bd?.hasData ?? false,
      })
    }
    return result
  }, [nwByYear, budgetData, overrides])

  const canEdit = (row: YearRow, field: string) => {
    if (field === 'grossIncome' || field === 'taxes') return true
    if (field === 'netIncome' || field === 'savings') return !row.hasBudgetData
    return false
  }

  const startEdit = (year: number, field: string, current: number | null) => {
    setEditCell({ year, field })
    setEditValue(current !== null ? String(current) : '')
  }

  const commitEdit = () => {
    if (!editCell) return
    const { year, field } = editCell
    const val = editValue.trim() === '' ? undefined : parseFloat(editValue.replace(/[,$]/g, ''))
    const updated = { ...overrides }
    if (!updated[year]) updated[year] = {}
    ;(updated[year] as Record<string, number | undefined>)[field] = val !== undefined && !isNaN(val) ? val : undefined
    if (Object.values(updated[year]).every(v => v === undefined)) delete updated[year]
    setOverrides(updated)
    persistOverrides(updated)
    setEditCell(null)
    setEditValue('')
  }

  const cancelEdit = () => {
    setEditCell(null)
    setEditValue('')
  }

  const renderCell = (row: YearRow, field: string, value: number | null, editable: boolean) => {
    const isEditing = editCell?.year === row.year && editCell?.field === field
    if (isEditing) {
      return (
        <input
          className="sgt-edit-input"
          type="text"
          autoFocus
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => {
            if (e.key === 'Enter') commitEdit()
            if (e.key === 'Escape') cancelEdit()
          }}
        />
      )
    }
    if (value === null) {
      if (editable) {
        return (
          <span
            className="sgt-na sgt-editable"
            role="button"
            tabIndex={0}
            onClick={() => startEdit(row.year, field, null)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                startEdit(row.year, field, null)
              }
            }}
          >
            —
          </span>
        )
      }
      return <span className="sgt-na">N/A</span>
    }
    if (editable) {
      return (
        <span
          className="sgt-editable"
          role="button"
          tabIndex={0}
          onClick={() => startEdit(row.year, field, value)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              startEdit(row.year, field, value)
            }
          }}
        >
          {fmt(value)}
        </span>
      )
    }
    return fmt(value)
  }

  const renderDeltaValue = (cur: number | null, prev: number | null, invertColors = false) => {
    if (cur === null || prev === null) return <span className="sgt-na">—</span>

    if (showPct) {
      const d = delta(cur, prev)
      if (d === null || d === 0) return <span className="sgt-na">—</span>
      const isPositive = d > 0
      const className = invertColors ? (isPositive ? 'sgt-down' : 'sgt-up') : isPositive ? 'sgt-up' : 'sgt-down'
      return (
        <span className={className}>
          {isPositive ? '▲' : '▼'} {pct(Math.abs(d)).replace('+', '')}
        </span>
      )
    }

    const raw = cur - prev
    if (raw === 0) return <span className="sgt-na">—</span>
    const isPositive = raw > 0
    const className = invertColors ? (isPositive ? 'sgt-down' : 'sgt-up') : isPositive ? 'sgt-up' : 'sgt-down'
    return (
      <span className={className}>
        {isPositive ? '▲' : '▼'} {fmt(Math.abs(raw))}
      </span>
    )
  }

  const renderRateDelta = (cur: number | null, prev: number | null) => {
    if (cur === null || prev === null) return <span className="sgt-na">—</span>

    if (showPct) {
      const d = delta(cur, prev)
      if (d === null || d === 0) return <span className="sgt-na">—</span>
      const isPositive = d > 0
      return (
        <span className={isPositive ? 'sgt-down' : 'sgt-up'}>
          {isPositive ? '▲' : '▼'} {pct(Math.abs(d)).replace('+', '')}
        </span>
      )
    }

    const raw = cur - prev
    if (raw === 0) return <span className="sgt-na">—</span>
    const isPositive = raw > 0
    return (
      <span className={isPositive ? 'sgt-down' : 'sgt-up'}>
        {isPositive ? '▲' : '▼'} {Math.abs(raw).toFixed(1)} pts
      </span>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="sgt">
        <p className="sgt-empty">
          No data available. Add account balances in the Accounts tab and/or upload budget CSVs to get started.
        </p>
      </div>
    )
  }

  const rowsDescending = [...rows].reverse()

  return (
    <div className="sgt">
      <div className="sgt-toolbar">
        <div className="sgt-toggle-row">
          <span className="sgt-toggle-label">YoY change</span>
          <div className="tab-bar">
            <button
              className={`tab-btn tab-btn--sm${!showPct ? ' active' : ''}`}
              onClick={() => setShowPct(false)}
              aria-label="Show YoY change in dollars"
            >
              $
            </button>
            <button
              className={`tab-btn tab-btn--sm${showPct ? ' active' : ''}`}
              onClick={() => setShowPct(true)}
              aria-label="Show YoY change as percentage"
            >
              %
            </button>
          </div>
        </div>
      </div>

      <div className="sgt-card-list">
        {rowsDescending.map(row => {
          const index = rows.findIndex(candidate => candidate.year === row.year)
          const prevRow = index > 0 ? rows[index - 1] : null
          const taxRate = row.grossIncome && row.taxes != null ? (row.taxes / row.grossIncome) * 100 : null
          const prevTaxRate =
            prevRow?.grossIncome && prevRow.taxes != null ? (prevRow.taxes / prevRow.grossIncome) * 100 : null

          return (
            <section
              key={row.year}
              className="sgt-year-card"
              data-testid={`year-card-${row.year}`}
              data-sgt-year={row.year}
              aria-label={`Year ${row.year}`}
            >
              <div className="sgt-year-card__header">
                <h2 className="sgt-year-card__year" data-sgt-field="year">
                  {row.year}
                </h2>
                {tab === 'savings' ? (
                  <div className="sgt-year-card__networth">
                    <span className="sgt-year-card__networth-label">Net Worth</span>
                    <span className="sgt-year-card__networth-value" data-sgt-field="netWorth">
                      {row.netWorth !== null ? fmt(row.netWorth) : <span className="sgt-na">N/A</span>}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="sgt-metric-grid">
                {tab === 'savings' ? (
                  <>
                    <div className="sgt-metric-card">
                      <span className="sgt-metric-label">Net Income</span>
                      <div className="sgt-metric-value" data-sgt-field="netIncome">
                        {renderCell(row, 'netIncome', row.netIncome, canEdit(row, 'netIncome'))}
                      </div>
                      <div className="sgt-metric-delta">
                        {renderDeltaValue(row.netIncome, prevRow?.netIncome ?? null)}
                      </div>
                    </div>
                    <div className="sgt-metric-card">
                      <span className="sgt-metric-label">Expenses</span>
                      <div className="sgt-metric-value" data-sgt-field="expense">
                        {row.totalExpense !== null ? fmt(row.totalExpense) : <span className="sgt-na">N/A</span>}
                      </div>
                      <div className="sgt-metric-delta">
                        {renderDeltaValue(row.totalExpense, prevRow?.totalExpense ?? null, true)}
                      </div>
                    </div>
                    <div className="sgt-metric-card">
                      <span className="sgt-metric-label">Savings</span>
                      <div className="sgt-metric-value" data-sgt-field="savings">
                        {renderCell(row, 'savings', row.savings, canEdit(row, 'savings'))}
                      </div>
                      <div className="sgt-metric-delta">{renderDeltaValue(row.savings, prevRow?.savings ?? null)}</div>
                    </div>
                    <div className="sgt-metric-card">
                      <span className="sgt-metric-label">Growth</span>
                      <div className="sgt-metric-value" data-sgt-field="growth">
                        {row.growth !== null ? fmt(row.growth) : <span className="sgt-na">N/A</span>}
                      </div>
                      <div className="sgt-metric-delta">{renderDeltaValue(row.growth, prevRow?.growth ?? null)}</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="sgt-metric-card">
                      <span className="sgt-metric-label">Gross Income</span>
                      <div className="sgt-metric-value" data-sgt-field="grossIncome">
                        {renderCell(row, 'grossIncome', row.grossIncome, true)}
                      </div>
                      <div className="sgt-metric-delta">
                        {renderDeltaValue(row.grossIncome, prevRow?.grossIncome ?? null)}
                      </div>
                    </div>
                    <div className="sgt-metric-card">
                      <span className="sgt-metric-label">Taxes</span>
                      <div className="sgt-metric-value" data-sgt-field="taxes">
                        {renderCell(row, 'taxes', row.taxes, true)}
                      </div>
                      <div className="sgt-metric-delta">
                        {renderDeltaValue(row.taxes, prevRow?.taxes ?? null, true)}
                      </div>
                    </div>
                    <div className="sgt-metric-card">
                      <span className="sgt-metric-label">Tax Rate</span>
                      <div className="sgt-metric-value" data-sgt-field="taxRate">
                        {taxRate !== null ? `${taxRate.toFixed(1)}%` : <span className="sgt-na">—</span>}
                      </div>
                      <div className="sgt-metric-delta">{renderRateDelta(taxRate, prevTaxRate)}</div>
                    </div>
                    <div className="sgt-metric-card">
                      <span className="sgt-metric-label">Net Income</span>
                      <div className="sgt-metric-value" data-sgt-field="netIncome">
                        {renderCell(row, 'netIncome', row.netIncome, canEdit(row, 'netIncome'))}
                      </div>
                      <div className="sgt-metric-delta">
                        {renderDeltaValue(row.netIncome, prevRow?.netIncome ?? null)}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>
          )
        })}
      </div>

      <p className="sgt-hint">
        {tab === 'savings'
          ? 'Savings = Net Income from budget. Growth = Net Worth change − Savings. Click "—" to enter missing data.'
          : 'Gross income and taxes are user-entered. Net income is derived from budget data when available.'}
      </p>
    </div>
  )
}

export default SavingsGrowthTracker
