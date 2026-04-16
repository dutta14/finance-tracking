import { FC, useState, useMemo } from 'react'
import { loadBudgetStore } from '../../budget/utils/budgetStorage'
import { parseCSV } from '../../budget/utils/csvParser'
import type { Account, BalanceEntry } from '../../data/types'
import '../../../styles/SavingsGrowthTracker.css'

const REMOVED_GROUP_ID = 'removed'

/* ── helpers ── */

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })

const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`

const delta = (cur: number, prev: number) =>
  prev === 0 ? null : ((cur - prev) / Math.abs(prev)) * 100

function loadAccountData(): { accounts: Account[]; balances: BalanceEntry[] } {
  try {
    const accounts: Account[] = JSON.parse(localStorage.getItem('data-accounts') || '[]')
    const balances: BalanceEntry[] = JSON.parse(localStorage.getItem('data-balances') || '[]')
    return { accounts, balances }
  } catch {
    return { accounts: [], balances: [] }
  }
}

/** Net worth at end of each December (or latest available month in each year).
 *  Matches the Data tab's "Total" column: all accounts, raw balance sum. */
function getYearEndNetWorths(_accounts: Account[], balances: BalanceEntry[]): Map<number, number> {
  // Group balances by month (include ALL accounts — same as Data tab Total)
  const byMonth = new Map<string, Map<number, number>>()
  for (const b of balances) {
    if (!byMonth.has(b.month)) byMonth.set(b.month, new Map())
    byMonth.get(b.month)!.set(b.accountId, b.balance)
  }

  // Find the best month per year (prefer December, else latest available)
  const monthsByYear = new Map<number, string[]>()
  for (const m of byMonth.keys()) {
    const yr = parseInt(m.split('-')[0], 10)
    if (!monthsByYear.has(yr)) monthsByYear.set(yr, [])
    monthsByYear.get(yr)!.push(m)
  }

  const result = new Map<number, number>()
  for (const [yr, months] of monthsByYear) {
    months.sort()
    // prefer December
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
  netIncome: number | null   // income - expense (from budget)
  totalIncome: number | null
  totalExpense: number | null
  hasData: boolean
}

/** For each year that has budget CSVs, compute income, expense */
function getBudgetYearlyData(): Map<number, BudgetYearData> {
  const result = new Map<number, BudgetYearData>()
  try {
    const store = loadBudgetStore()
    const groups = store.categoryGroups || []
    const removedCats = new Set(groups.find(g => g.id === REMOVED_GROUP_ID)?.categories || [])

    // Gather all years from CSV keys
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
        } catch { /* skip */ }
      }
      if (txns.length === 0) continue

      // Classify categories: group by category+month, category is expense if any monthly sum < 0
      const catMonthSums: Record<string, Record<string, number>> = {}
      txns.forEach(t => {
        if (removedCats.has(t.category)) return
        if (!catMonthSums[t.category]) catMonthSums[t.category] = {}
        catMonthSums[t.category][t.monthKey] = (catMonthSums[t.category][t.monthKey] || 0) + t.amount
      })

      let totalIncome = 0
      let totalExpense = 0
      Object.entries(catMonthSums).forEach(([, months]) => {
        const monthVals = Object.values(months)
        const hasNeg = monthVals.some(v => v < 0)
        const sum = monthVals.reduce((s, v) => s + v, 0)
        if (hasNeg) {
          totalExpense += Math.abs(sum)
        } else {
          totalIncome += sum
        }
      })

      result.set(year, {
        totalIncome,
        totalExpense,
        netIncome: totalIncome,
        hasData: true,
      })
    }
  } catch { /* empty */ }
  return result
}

/* ── Editable overrides (user can fill in missing data) ── */
const OVERRIDES_KEY = 'sgt-overrides'

interface YearOverrides {
  grossIncome?: number
  taxes?: number
  netIncome?: number
  savings?: number
}

function loadOverrides(): Record<number, YearOverrides> {
  try {
    return JSON.parse(localStorage.getItem(OVERRIDES_KEY) || '{}')
  } catch { return {} }
}

function saveOverrides(o: Record<number, YearOverrides>) {
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(o))
}

/* ── Row data type ── */
interface YearRow {
  year: number
  netWorth: number | null
  nwChange: number | null
  // Budget-derived
  totalIncome: number | null   // from budget
  totalExpense: number | null  // from budget
  netIncome: number | null     // total income from budget
  savings: number | null       // netIncome - expense = amount saved
  growth: number | null        // nwChange - savings = capital growth
  // Overrides
  grossIncome: number | null
  taxes: number | null
  hasBudgetData: boolean
}

/* ── Component ── */

type TabMode = 'savings' | 'income'

const SavingsGrowthTracker: FC = () => {
  const [tab, setTab] = useState<TabMode>('savings')
  const [showPct, setShowPct] = useState(false)
  const [overrides, setOverrides] = useState<Record<number, YearOverrides>>(loadOverrides)
  const [editCell, setEditCell] = useState<{ year: number; field: string } | null>(null)
  const [editValue, setEditValue] = useState('')

  const { accounts, balances } = useMemo(() => loadAccountData(), [])
  const nwByYear = useMemo(() => getYearEndNetWorths(accounts, balances), [accounts, balances])
  const budgetData = useMemo(() => getBudgetYearlyData(), [])

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

  /* ── Inline editing ── */
  const canEdit = (row: YearRow, field: string) => {
    if (field === 'grossIncome' || field === 'taxes') return true
    // Allow editing netIncome / savings only if no budget data
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
    ;(updated[year] as any)[field] = val !== undefined && !isNaN(val) ? val : undefined
    // Clean empty
    if (Object.values(updated[year]).every(v => v === undefined)) delete updated[year]
    setOverrides(updated)
    saveOverrides(updated)
    setEditCell(null)
    setEditValue('')
  }

  const cancelEdit = () => { setEditCell(null); setEditValue('') }

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
          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }}
        />
      )
    }
    if (value === null) {
      if (editable) {
        return <span className="sgt-na sgt-editable" onClick={() => startEdit(row.year, field, null)}>—</span>
      }
      return <span className="sgt-na">N/A</span>
    }
    if (editable) {
      return <span className="sgt-editable" onClick={() => startEdit(row.year, field, value)}>{fmt(value)}</span>
    }
    return fmt(value)
  }

  const renderDelta = (cur: number | null, prev: number | null) => {
    if (cur === null || prev === null) return <span className="sgt-na">—</span>
    const d = delta(cur, prev)
    if (d === null) return <span className="sgt-na">—</span>
    if (showPct) {
      return <span className={d > 0 ? 'sgt-up' : d < 0 ? 'sgt-down' : ''}>{pct(d)}</span>
    }
    const raw = cur - prev
    return <span className={raw > 0 ? 'sgt-up' : raw < 0 ? 'sgt-down' : ''}>{fmt(raw)}</span>
  }

  const renderDeltaExpense = (cur: number | null, prev: number | null) => {
    // For expenses, increase is bad (red), decrease is good (green)
    if (cur === null || prev === null) return <span className="sgt-na">—</span>
    const d = delta(cur, prev)
    if (d === null) return <span className="sgt-na">—</span>
    if (showPct) {
      return <span className={d > 0 ? 'sgt-down' : d < 0 ? 'sgt-up' : ''}>{pct(d)}</span>
    }
    const raw = cur - prev
    return <span className={raw > 0 ? 'sgt-down' : raw < 0 ? 'sgt-up' : ''}>{fmt(raw)}</span>
  }

  const getPrev = (i: number, field: keyof YearRow) => i > 0 ? (rows[i - 1][field] as number | null) : null

  if (rows.length === 0) {
    return (
      <div className="sgt">
        <p className="sgt-empty">No data available. Add account balances in the Data tab and/or upload budget CSVs to get started.</p>
      </div>
    )
  }

  return (
    <div className="sgt">
      {/* Tab selector */}
      <div className="sgt-tabs">
        <button className={`sgt-tab${tab === 'savings' ? ' sgt-tab--active' : ''}`} onClick={() => setTab('savings')}>Savings</button>
        <button className={`sgt-tab${tab === 'income' ? ' sgt-tab--active' : ''}`} onClick={() => setTab('income')}>Income</button>
      </div>

      {/* Toggle: % vs $ */}
      <div className="sgt-toggle-row">
        <span className="sgt-toggle-label">YoY change</span>
        <button className="sgt-toggle-btn" onClick={() => setShowPct(!showPct)}>
          {showPct ? '%' : '$'}
        </button>
      </div>

      <div className="sgt-table-wrap">
        <table className="sgt-table">
          <thead>
            {tab === 'savings' ? (
              <tr>
                <th className="sgt-th sgt-th--year">Year</th>
                <th className="sgt-th sgt-th--num">Net Income</th>
                <th className="sgt-th sgt-th--num">Expense</th>
                <th className="sgt-th sgt-th--num sgt-th--delta">Exp Δ</th>
                <th className="sgt-th sgt-th--num">Savings</th>
                <th className="sgt-th sgt-th--num sgt-th--delta">Sav Δ</th>
                <th className="sgt-th sgt-th--num">Growth</th>
                <th className="sgt-th sgt-th--num sgt-th--delta">Gro Δ</th>
                <th className="sgt-th sgt-th--num sgt-th--nw">Net Worth</th>
              </tr>
            ) : (
              <tr>
                <th className="sgt-th sgt-th--year">Year</th>
                <th className="sgt-th sgt-th--num">Gross Income</th>
                <th className="sgt-th sgt-th--num">Taxes</th>
                <th className="sgt-th sgt-th--num">Tax Rate</th>
                <th className="sgt-th sgt-th--num">Net Income</th>
              </tr>
            )}
          </thead>
          <tbody>
            {rows.map((row, i) => {
              if (tab === 'savings') {
                return (
                  <tr key={row.year} className="sgt-row">
                    <td className="sgt-td sgt-td--year">{row.year}</td>
                    <td className="sgt-td sgt-td--num">{renderCell(row, 'netIncome', row.netIncome, canEdit(row, 'netIncome'))}</td>
                    <td className="sgt-td sgt-td--num">{row.totalExpense !== null ? fmt(row.totalExpense) : <span className="sgt-na">N/A</span>}</td>
                    <td className="sgt-td sgt-td--num sgt-td--delta">{renderDeltaExpense(row.totalExpense, getPrev(i, 'totalExpense'))}</td>
                    <td className="sgt-td sgt-td--num sgt-td--highlight">{renderCell(row, 'savings', row.savings, canEdit(row, 'savings'))}</td>
                    <td className="sgt-td sgt-td--num sgt-td--delta">{renderDelta(row.savings, getPrev(i, 'savings'))}</td>
                    <td className="sgt-td sgt-td--num sgt-td--highlight">{row.growth !== null ? fmt(row.growth) : <span className="sgt-na">N/A</span>}</td>
                    <td className="sgt-td sgt-td--num sgt-td--delta">{renderDelta(row.growth, getPrev(i, 'growth'))}</td>
                    <td className="sgt-td sgt-td--num sgt-td--nw">{row.netWorth !== null ? fmt(row.netWorth) : <span className="sgt-na">N/A</span>}</td>
                  </tr>
                )
              }
              // Income tab
              const taxRate = row.grossIncome && row.taxes != null
                ? ((row.taxes / row.grossIncome) * 100).toFixed(1) + '%'
                : null
              return (
                <tr key={row.year} className="sgt-row">
                  <td className="sgt-td sgt-td--year">{row.year}</td>
                  <td className="sgt-td sgt-td--num">{renderCell(row, 'grossIncome', row.grossIncome, true)}</td>
                  <td className="sgt-td sgt-td--num">{renderCell(row, 'taxes', row.taxes, true)}</td>
                  <td className="sgt-td sgt-td--num">{taxRate ?? <span className="sgt-na">—</span>}</td>
                  <td className="sgt-td sgt-td--num">{renderCell(row, 'netIncome', row.netIncome, canEdit(row, 'netIncome'))}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="sgt-hint">
        {tab === 'savings'
          ? 'Savings = Net Income from budget. Growth = Net Worth change − Savings. Click "—" to enter missing data.'
          : 'Gross income & taxes are user-entered. Net income is derived from budget data when available.'}
      </p>
    </div>
  )
}

export default SavingsGrowthTracker
