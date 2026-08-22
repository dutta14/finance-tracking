import React, { FC, useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { loadBudgetStore, getIncomeGroups } from '../../budget/utils/budgetStorage'
import { parseCSV } from '../../budget/utils/csvParser'
import { useData } from '../../../contexts/DataContext'
import type { Account, BalanceEntry } from '../../data/types'
import { useFileStore } from '../../../contexts/FileStoreContext'
import { useProfile } from '../../../hooks/useProfile'
import { calculateFI, type FICalcProjectionRow } from '../utils/fiCalculations'
import { useGrowthSettings } from '../../../hooks/useGrowthSettings'
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'
import '../../../styles/FICalculator.css'

/** Load last year's total expense from budget store, using group-membership classification (same as Budget page) */
async function getLastYearExpense(fileStore: import('../../../utils/fileStoreTypes').FileStore): Promise<number> {
  try {
    const store = await loadBudgetStore(fileStore)
    const lastYear = new Date().getFullYear() - 1
    const groups = store.categoryGroups || []
    const removedCats = new Set(groups.find(g => g.id === 'removed')?.categories || [])
    const incomeCats = new Set(getIncomeGroups(groups).flatMap(g => (g.id !== 'removed' ? g.categories : [])))

    const catSums: Record<string, number> = {}
    for (let m = 1; m <= 12; m++) {
      const key = `${lastYear}-${String(m).padStart(2, '0')}`
      const csvData = store.csvs[key]
      if (!csvData) continue
      try {
        const parsed = parseCSV(csvData.csv)
        for (const t of parsed) {
          if (removedCats.has(t.category) || incomeCats.has(t.category)) continue
          catSums[t.category] = (catSums[t.category] || 0) + t.amount
        }
      } catch {
        /* skip bad CSV */
      }
    }

    return Math.abs(Object.values(catSums).reduce((s, v) => s + v, 0))
  } catch {
    return 0
  }
}

function getLatestBalancesByFilter(
  accounts: Account[],
  balances: BalanceEntry[],
  filter: (a: Account) => boolean,
): number {
  const matching = new Set(accounts.filter(a => a.status === 'active' && filter(a)).map(a => a.id))
  if (matching.size === 0) return 0
  const months = [...new Set(balances.map(b => b.month))].sort()
  if (months.length === 0) return 0
  const latest = months[months.length - 1]
  let total = 0
  for (const b of balances) {
    if (b.month === latest && matching.has(b.accountId)) total += b.balance
  }
  return total
}

function getBirthYear(birthday: string): number | null {
  if (!birthday) return null
  const match = birthday.match(/(\d{4})/)
  if (match) return parseInt(match[1], 10)
  const d = new Date(birthday)
  if (!isNaN(d.getTime())) return d.getFullYear()
  return null
}

function getBirthMonth(birthday: string): number {
  if (!birthday) return 1
  const d = new Date(birthday)
  if (!isNaN(d.getTime())) return d.getMonth() + 1 // 1-based
  return 1
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })

const abbreviateCurrency = (value: number) => {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${Math.round(value)}`
}

type ViewInterval = 'monthly' | 'yearly' | '5year' | '10year'
type ViewMode = 'chart' | 'table'

const INTERVAL_OPTIONS: { value: ViewInterval; label: string; months: number }[] = [
  { value: 'monthly', label: 'Monthly', months: 1 },
  { value: 'yearly', label: 'Yearly', months: 12 },
  { value: '5year', label: 'Every 5 Yrs', months: 60 },
  { value: '10year', label: 'Every 10 Yrs', months: 120 },
]

interface ProjectionChartRow extends FICalcProjectionRow {
  accum: number | null
  draw: number | null
}

interface ProjectionTooltipProps {
  active?: boolean
  payload?: Array<{ payload: ProjectionChartRow }>
  label?: string
  chartData?: ProjectionChartRow[]
}

const ProjectionTooltip: FC<ProjectionTooltipProps> = ({ active, payload, label, chartData }) => {
  if (!active || !payload?.length) return null

  const row = payload[0].payload

  // Compute deltas from previous data point
  let prevRow: ProjectionChartRow | null = null
  if (chartData) {
    const idx = chartData.findIndex(r => r.month === row.month)
    if (idx > 0) prevRow = chartData[idx - 1]
  }

  const getDelta = (curr: number, prev: number | undefined) => {
    if (prev == null || prev === 0) return null
    const d = curr - prev
    const pct = (d / Math.abs(prev)) * 100
    return { d, pct }
  }

  const fmtD = (d: number, pct: number) => `${d >= 0 ? '+' : ''}${fmt(d)} (${d >= 0 ? '+' : ''}${pct.toFixed(1)}%)`

  const items: { label: string; value: number; delta: { d: number; pct: number } | null }[] = []

  if (row.monthlySaved > 0) {
    items.push({ label: 'Saved', value: row.monthlySaved, delta: getDelta(row.monthlySaved, prevRow?.monthlySaved) })
  }
  if (row.expense > 0) {
    items.push({ label: 'Expense', value: row.expense, delta: getDelta(row.expense, prevRow?.expense) })
  }
  if (row.bonus > 0) {
    items.push({ label: 'Bonus', value: row.bonus, delta: getDelta(row.bonus, prevRow?.bonus) })
  }
  items.push({ label: 'Balance', value: row.netWorth, delta: getDelta(row.netWorth, prevRow?.netWorth) })

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        padding: '6px 10px',
      }}
    >
      <div style={{ color: 'var(--color-text)', fontSize: 10, fontWeight: 500, marginBottom: 2 }}>{label}</div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr 1fr',
          alignItems: 'baseline',
          columnGap: 14,
          rowGap: 4,
        }}
      >
        {items.map(item => (
          <React.Fragment key={item.label}>
            <div style={{ color: 'var(--color-text-heading)', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
              {item.label}
            </div>
            <div
              style={{
                color: 'var(--color-text-heading)',
                fontSize: 11,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                textAlign: 'right',
              }}
            >
              {fmt(item.value)}
            </div>
            {item.delta ? (
              <div
                style={{
                  color: item.delta.d >= 0 ? '#15803d' : '#dc2626',
                  fontSize: 11,
                  fontWeight: 500,
                  textAlign: 'right',
                  whiteSpace: 'nowrap',
                }}
              >
                {fmtD(item.delta.d, item.delta.pct)}
              </div>
            ) : (
              <div />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

interface FISim {
  name: string
  annualExpense: number
  inflationRate: number
  growthRate: number
  postBoundaryGrowth: number
  boundaryYear: number
  lastYear: number
  retireYear: number
  primary401kYear: number
  partner401kYear: number
  includeGwLiquid: boolean
  corpusNeeded?: number
  gap?: number
}

const SIMS_PATH = 'fi-simulations.json'

/** Button that fires once on click, then repeats (accelerating) while held */
const StepBtn: FC<{ onStep: () => void; children: React.ReactNode }> = ({ onStep, children }) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const start = useCallback(() => {
    onStep()
    // After 400ms delay, start repeating at 150ms, then accelerate to 50ms after 1.2s
    timerRef.current = setTimeout(() => {
      intervalRef.current = setInterval(onStep, 150)
      timerRef.current = setTimeout(() => {
        if (intervalRef.current) clearInterval(intervalRef.current)
        intervalRef.current = setInterval(onStep, 50)
      }, 1200)
    }, 400)
  }, [onStep])

  return (
    <button
      className="fi-calc-step-btn"
      onMouseDown={start}
      onMouseUp={stop}
      onMouseLeave={stop}
      onTouchStart={start}
      onTouchEnd={stop}
    >
      {children}
    </button>
  )
}

const FICalculator: FC = () => {
  const thisYear = new Date().getFullYear()
  const { fileStore } = useFileStore()
  const { profile: rawProfile } = useProfile()
  const { accounts, balances } = useData()
  const { settings, updateSettings } = useGrowthSettings()

  const [lastYearExpense, setLastYearExpense] = useState<number>(0)
  const [savedSims, setSavedSims] = useState<FISim[]>([])

  useEffect(() => {
    getLastYearExpense(fileStore)
      .then(setLastYearExpense)
      .catch(() => setLastYearExpense(0))
  }, [fileStore])

  useEffect(() => {
    fileStore
      .readJSON<FISim[]>(SIMS_PATH, [])
      .then(setSavedSims)
      .catch(() => setSavedSims([]))
  }, [fileStore])

  const saveSims = useCallback(
    (sims: FISim[]) => {
      fileStore.writeJSON(SIMS_PATH, sims).catch(console.error)
      window.dispatchEvent(new Event('tools-changed'))
    },
    [fileStore],
  )

  const profile = useMemo(
    () => ({
      primaryBirthYear: getBirthYear(rawProfile.birthday || ''),
      primaryBirthMonth: getBirthMonth(rawProfile.birthday || ''),
      partnerBirthYear: rawProfile.partner ? getBirthYear(rawProfile.partner.birthday || '') : null,
      partnerBirthMonth: rawProfile.partner ? getBirthMonth(rawProfile.partner.birthday || '') : 1,
      primaryName: rawProfile.name || 'Primary',
      partnerName: rawProfile.partner?.name || 'Partner',
    }),
    [rawProfile],
  )

  // Derived defaults
  // defaultLastYear = max(primary+100, partner+100) — plan horizon runs
  // until the older partner reaches age 100. With a partner younger than
  // primary, this is partner+100, NOT primary+100. Intentional. See #163.
  const defaultLastYear = useMemo(() => {
    const years = [profile.primaryBirthYear, profile.partnerBirthYear]
      .filter((y): y is number => y !== null)
      .map(y => y + 100)
    return years.length > 0 ? Math.max(...years) : thisYear + 60
  }, [profile, thisYear])

  // 401(k) accessible at age 59.5 (birth + 59 years + 6 months)
  const primary401kEarliestMonth = profile.primaryBirthYear ? ((profile.primaryBirthMonth - 1 + 6) % 12) + 1 : 1
  const primary401kEarliestYear = profile.primaryBirthYear
    ? profile.primaryBirthYear + 59 + (profile.primaryBirthMonth - 1 + 6 >= 12 ? 1 : 0)
    : thisYear + 30
  const partner401kEarliestMonth = profile.partnerBirthYear ? ((profile.partnerBirthMonth - 1 + 6) % 12) + 1 : 1
  const partner401kEarliestYear = profile.partnerBirthYear
    ? profile.partnerBirthYear + 59 + (profile.partnerBirthMonth - 1 + 6 >= 12 ? 1 : 0)
    : thisYear + 30

  // Inputs
  const [annualExpense, setAnnualExpense] = useState<number>(lastYearExpense || 60000)
  const [expenseDisplay, setExpenseDisplay] = useState<string>(Math.round(lastYearExpense || 60000).toLocaleString())

  // Sync annual expense when last year's data loads asynchronously
  const prevLastYearExpense = useRef(lastYearExpense)
  useEffect(() => {
    if (lastYearExpense > 0 && lastYearExpense !== prevLastYearExpense.current) {
      setAnnualExpense(lastYearExpense)
      setExpenseDisplay(Math.round(lastYearExpense).toLocaleString())
      prevLastYearExpense.current = lastYearExpense
    }
  }, [lastYearExpense])
  const inflationRate = settings.inflation
  const growthRate = settings.preBoundaryGrowth
  const postBoundaryGrowth = settings.postBoundaryGrowth
  const boundaryYear = (profile.primaryBirthYear ?? thisYear - 30) + settings.ageBoundary
  const [lastYear, setLastYear] = useState<number>(defaultLastYear)

  // Sync plan-until when profile-derived default changes
  const prevDefaultLastYear = useRef(defaultLastYear)
  useEffect(() => {
    if (defaultLastYear !== prevDefaultLastYear.current) {
      setLastYear(defaultLastYear)
      prevDefaultLastYear.current = defaultLastYear
    }
  }, [defaultLastYear])
  const [retireYear, setRetireYear] = useState<number>(thisYear + 1)
  const [primary401kYear, setPrimary401kYear] = useState<number>(primary401kEarliestYear)
  const [partner401kYear, setPartner401kYear] = useState<number>(partner401kEarliestYear)

  // Sync 401(k) years when profile birth years load asynchronously
  const prevPrimary401k = useRef(primary401kEarliestYear)
  const prevPartner401k = useRef(partner401kEarliestYear)
  useEffect(() => {
    if (primary401kEarliestYear !== prevPrimary401k.current) {
      setPrimary401kYear(primary401kEarliestYear)
      prevPrimary401k.current = primary401kEarliestYear
    }
    if (partner401kEarliestYear !== prevPartner401k.current) {
      setPartner401kYear(partner401kEarliestYear)
      prevPartner401k.current = partner401kEarliestYear
    }
  }, [primary401kEarliestYear, partner401kEarliestYear])
  const [includeGwLiquid, setIncludeGwLiquid] = useState<boolean>(false)
  const [savingView, setSavingView] = useState<'mo' | 'yr' | 'total'>('yr')
  const [interval, setInterval] = useState<ViewInterval>('yearly')
  const [viewMode, setViewMode] = useState<ViewMode>('chart')
  const [activeSim, setActiveSim] = useState<string | null>(null)
  const [showSaveInput, setShowSaveInput] = useState(false)
  const [simMenuOpen, setSimMenuOpen] = useState<string | null>(null)
  const [simToDelete, setSimToDelete] = useState<string | null>(null)
  const [simRenaming, setSimRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [saveNameInput, setSaveNameInput] = useState('')
  const dragIndexRef = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const applySnapshot = useCallback(
    (s: FISim) => {
      setAnnualExpense(s.annualExpense)
      setExpenseDisplay(Math.round(s.annualExpense).toLocaleString())
      updateSettings({
        inflation: s.inflationRate,
        preBoundaryGrowth: s.growthRate,
        postBoundaryGrowth: s.postBoundaryGrowth ?? settings.postBoundaryGrowth,
        ageBoundary: s.boundaryYear
          ? s.boundaryYear - (profile.primaryBirthYear ?? thisYear - 30)
          : settings.ageBoundary,
      })
      setLastYear(s.lastYear)
      setRetireYear(s.retireYear)
      setPrimary401kYear(s.primary401kYear)
      setPartner401kYear(s.partner401kYear)
      setIncludeGwLiquid(s.includeGwLiquid)
      setActiveSim(s.name)
    },
    [updateSettings, settings.postBoundaryGrowth, settings.ageBoundary, profile.primaryBirthYear, thisYear],
  )

  const handleNewSim = useCallback(() => {
    const defaultExpense = lastYearExpense || 60000
    setAnnualExpense(defaultExpense)
    setExpenseDisplay(Math.round(defaultExpense).toLocaleString())
    setLastYear(defaultLastYear)
    setRetireYear(thisYear + 1)
    setPrimary401kYear(primary401kEarliestYear)
    setPartner401kYear(partner401kEarliestYear)
    setIncludeGwLiquid(false)
    setActiveSim(null)
  }, [lastYearExpense, defaultLastYear, thisYear, primary401kEarliestYear, partner401kEarliestYear])

  const handleSave = useCallback(
    (name: string) => {
      const sim: FISim = {
        name,
        annualExpense,
        inflationRate,
        growthRate,
        postBoundaryGrowth: settings.postBoundaryGrowth,
        boundaryYear,
        lastYear,
        retireYear,
        primary401kYear,
        partner401kYear,
        includeGwLiquid,
        corpusNeeded: resultRef.current?.corpusNeededFromNonRetirement,
        gap: resultRef.current?.gap,
      }
      const next = [...savedSims.filter(s => s.name !== name), sim]
      setSavedSims(next)
      saveSims(next)
      setActiveSim(name)
      setShowSaveInput(false)
      setSaveNameInput('')
    },
    [
      annualExpense,
      inflationRate,
      growthRate,
      settings.postBoundaryGrowth,
      boundaryYear,
      lastYear,
      retireYear,
      primary401kYear,
      partner401kYear,
      includeGwLiquid,
      savedSims,
      saveSims,
    ],
  )

  const handleDeleteSim = useCallback(
    (name: string) => {
      const next = savedSims.filter(s => s.name !== name)
      setSavedSims(next)
      saveSims(next)
      if (activeSim === name) setActiveSim(null)
      setSimToDelete(null)
    },
    [savedSims, activeSim, saveSims],
  )

  const handleRenameSim = useCallback(
    (oldName: string, newName: string) => {
      const trimmed = newName.trim()
      if (!trimmed || oldName === trimmed) {
        setSimRenaming(null)
        return
      }
      if (savedSims.some(s => s.name === trimmed && s.name !== oldName)) {
        setSimRenaming(null)
        return
      }
      const next = savedSims.map(s => (s.name === oldName ? { ...s, name: trimmed } : s))
      setSavedSims(next)
      saveSims(next)
      if (activeSim === oldName) setActiveSim(trimmed)
      setSimRenaming(null)
    },
    [savedSims, activeSim, saveSims],
  )

  const handleReorderSim = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return
      const next = [...savedSims]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      setSavedSims(next)
      saveSims(next)
    },
    [savedSims, saveSims],
  )

  // Current balances
  const fiRetirementPrimary = useMemo(
    () =>
      getLatestBalancesByFilter(
        accounts,
        balances,
        a => a.goalType === 'fi' && a.type === 'retirement' && a.owner === 'primary',
      ),
    [accounts, balances],
  )
  const fiRetirementPartner = useMemo(
    () =>
      getLatestBalancesByFilter(
        accounts,
        balances,
        a => a.goalType === 'fi' && a.type === 'retirement' && (a.owner === 'partner' || a.owner === 'joint'),
      ),
    [accounts, balances],
  )
  const fiNonRetirement = useMemo(
    () => getLatestBalancesByFilter(accounts, balances, a => a.goalType === 'fi' && a.type === 'non-retirement'),
    [accounts, balances],
  )
  const gwLiquid = useMemo(
    () => getLatestBalancesByFilter(accounts, balances, a => a.goalType === 'gw' && a.type === 'liquid'),
    [accounts, balances],
  )

  // Core FI calculation
  const result = useMemo(() => {
    const yearsToRetire = retireYear - thisYear
    const yearsInRetirement = lastYear - retireYear

    return calculateFI({
      annualExpense,
      inflationRate,
      growthRate,
      postBoundaryGrowth,
      boundaryYear,
      yearsToRetire,
      yearsInRetirement,
      fiRetirementPrimary,
      fiRetirementPartner,
      fiNonRetirement,
      gwLiquid,
      includeGwLiquid,
      primary401kYear,
      primary401kMonth: primary401kEarliestMonth,
      partner401kYear,
      partner401kMonth: partner401kEarliestMonth,
      retireYear,
      lastYear,
      thisYear,
      primaryName: profile.primaryName,
      partnerName: profile.partnerName,
    })
  }, [
    annualExpense,
    inflationRate,
    growthRate,
    postBoundaryGrowth,
    boundaryYear,
    lastYear,
    retireYear,
    thisYear,
    fiRetirementPrimary,
    fiRetirementPartner,
    fiNonRetirement,
    gwLiquid,
    includeGwLiquid,
    primary401kYear,
    partner401kYear,
    primary401kEarliestMonth,
    partner401kEarliestMonth,
    profile.primaryName,
    profile.partnerName,
  ])

  const resultRef = useRef(result)
  resultRef.current = result

  const intervalMonths = INTERVAL_OPTIONS.find(option => option.value === interval)?.months ?? 12

  const projectionRows = useMemo(() => {
    const rows = result?.monthByMonth ?? []
    if (rows.length === 0 || intervalMonths === 1) return rows

    const keep = new Set<number>([0, rows.length - 1])

    for (let index = intervalMonths; index < rows.length; index += intervalMonths) {
      keep.add(index)
    }

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index]
      const prev = index > 0 ? rows[index - 1] : null
      if (row.injection) keep.add(index)
      if (prev && prev.phase !== row.phase) keep.add(index)
    }

    return [...keep].sort((a, b) => a - b).map(index => rows[index])
  }, [result, intervalMonths])

  const projectionChartData = useMemo<ProjectionChartRow[]>(() => {
    const fireIndex = projectionRows.findIndex(row => row.phase === 'drawdown')

    return projectionRows.map((row, index) => ({
      ...row,
      accum: fireIndex < 0 || index <= fireIndex ? row.netWorth : null,
      draw: fireIndex >= 0 && index >= fireIndex ? row.netWorth : null,
    }))
  }, [projectionRows])

  const projectionMilestones = useMemo(() => {
    const milestones: { month: string; label: string; color: string; dx: number; dy: number }[] = []

    projectionRows.forEach((row, index) => {
      const prev = index > 0 ? projectionRows[index - 1] : null

      if (prev && prev.phase !== row.phase && row.phase === 'drawdown') {
        milestones.push({ month: row.month, label: 'F.I.R.E.', color: 'var(--accent, #0f766e)', dx: -10, dy: 0 })
      }

      if (prev && prev.growthRate !== row.growthRate) {
        milestones.push({
          month: row.month,
          label: `${prev.growthRate}%→${row.growthRate}%`,
          color: 'var(--color-text, #374151)',
          dx: 10,
          dy: 0,
        })
      }

      if (row.injection?.includes(`${profile.primaryName} 401(k)`)) {
        milestones.push({
          month: row.month,
          label: `${profile.primaryName} 401(k)`,
          color: 'var(--color-success, #15803d)',
          dx: -10,
          dy: 0,
        })
      }

      if (row.injection?.includes(`${profile.partnerName} 401(k)`)) {
        milestones.push({
          month: row.month,
          label: `${profile.partnerName} 401(k)`,
          color: 'var(--color-success, #15803d)',
          dx: -10,
          dy: 0,
        })
      }
    })

    const offsets = new Map<string, number>()
    milestones.forEach(milestone => {
      const count = offsets.get(milestone.month) ?? 0
      milestone.dy = count * 14
      offsets.set(milestone.month, count + 1)
    })

    return milestones
  }, [projectionRows, profile.primaryName, profile.partnerName])

  return (
    <>
      <div className="fi-calc-layout">
        <div className="fi-calc">
          {activeSim && <div className="fi-calc-editing-banner">Editing "{activeSim}"</div>}
          {/* Annual Expense — hero input */}
          <div className="fi-calc-hero">
            <label className="fi-calc-hero-label" htmlFor="fi-calc-annual-expense">
              Annual Expense
            </label>
            <div className="fi-calc-hero-value">
              <span className="fi-calc-hero-dollar">$</span>
              <input
                id="fi-calc-annual-expense"
                type="text"
                inputMode="numeric"
                className="fi-calc-hero-input"
                value={expenseDisplay}
                onChange={e => {
                  const raw = e.target.value.replace(/[^0-9]/g, '')
                  const num = Number(raw)
                  setExpenseDisplay(raw ? num.toLocaleString() : '')
                  if (raw) setAnnualExpense(num)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                }}
                onBlur={() => setExpenseDisplay(Math.round(annualExpense).toLocaleString())}
              />
            </div>
            {lastYearExpense > 0 && annualExpense !== lastYearExpense && (
              <button
                className="fi-calc-link-btn"
                onClick={() => {
                  setAnnualExpense(lastYearExpense)
                  setExpenseDisplay(Math.round(lastYearExpense).toLocaleString())
                }}
              >
                Use last year's ({fmt(lastYearExpense)})
              </button>
            )}
          </div>

          {/* Year steppers — single row */}
          <div className="fi-calc-years-row">
            <div className="fi-calc-year-item">
              <span className="fi-calc-year-label">Retire in</span>
              <div className="fi-calc-year-control">
                <StepBtn onStep={() => setRetireYear(v => Math.max(thisYear + 1, v - 1))}>‹</StepBtn>
                <span className="fi-calc-year-val">
                  Jan {retireYear}
                  <span className="fi-calc-step-sub">
                    ({retireYear - thisYear} yr{retireYear - thisYear !== 1 ? 's' : ''})
                  </span>
                </span>
                <StepBtn onStep={() => setRetireYear(v => Math.min(lastYear - 1, v + 1))}>›</StepBtn>
              </div>
            </div>
            <div className="fi-calc-year-item">
              <span className="fi-calc-year-label">Plan until</span>
              <div className="fi-calc-year-control">
                <StepBtn onStep={() => setLastYear(v => Math.max(retireYear + 1, v - 1))}>‹</StepBtn>
                <span className="fi-calc-year-val">
                  Dec {lastYear}
                  <span className="fi-calc-step-sub">({lastYear - thisYear} yrs)</span>
                </span>
                <StepBtn onStep={() => setLastYear(v => Math.min(defaultLastYear + 20, v + 1))}>›</StepBtn>
              </div>
            </div>
            <div className="fi-calc-year-item">
              <span className="fi-calc-year-label">{profile.primaryName} 401(k)</span>
              <div className="fi-calc-year-control">
                <StepBtn onStep={() => setPrimary401kYear(v => Math.max(primary401kEarliestYear, v - 1))}>‹</StepBtn>
                <span className="fi-calc-year-val">
                  {MONTH_ABBR[primary401kEarliestMonth - 1]} {primary401kYear}
                  <span className="fi-calc-step-sub">({primary401kYear - thisYear} yrs)</span>
                </span>
                <StepBtn onStep={() => setPrimary401kYear(v => Math.min(lastYear, v + 1))}>›</StepBtn>
              </div>
            </div>
            {profile.partnerBirthYear && (
              <div className="fi-calc-year-item">
                <span className="fi-calc-year-label">{profile.partnerName} 401(k)</span>
                <div className="fi-calc-year-control">
                  <StepBtn onStep={() => setPartner401kYear(v => Math.max(partner401kEarliestYear, v - 1))}>‹</StepBtn>
                  <span className="fi-calc-year-val">
                    {MONTH_ABBR[partner401kEarliestMonth - 1]} {partner401kYear}
                    <span className="fi-calc-step-sub">({partner401kYear - thisYear} yrs)</span>
                  </span>
                  <StepBtn onStep={() => setPartner401kYear(v => Math.min(lastYear, v + 1))}>›</StepBtn>
                </div>
              </div>
            )}
          </div>

          {/* GW toggle */}
          <div className="fi-calc-toggle-row">
            <label className="fi-calc-checkbox">
              <input type="checkbox" checked={includeGwLiquid} onChange={() => setIncludeGwLiquid(v => !v)} />
              Include GW Liquid
            </label>
          </div>

          {/* Holdings + Projections table */}
          <div className="fi-calc-divider" />
          <div className="fi-calc-holdings-table" role="table" aria-label="Holdings summary">
            <div className="fi-calc-ht-header" role="row">
              <span role="columnheader">Holdings</span>
              <span role="columnheader">Today</span>
              <span role="columnheader">At Retirement ({retireYear})</span>
              <span role="columnheader">At 401(k) Access</span>
            </div>
            <div className="fi-calc-ht-row" role="row">
              <span role="cell">FI Retirement ({profile.primaryName})</span>
              <span role="cell">{fmt(fiRetirementPrimary)}</span>
              {primary401kYear <= retireYear && result ? (
                <span role="cell">{fmt(result.primary401kAtAccess)}</span>
              ) : (
                <span role="cell" className="fi-calc-ht-na">
                  —
                </span>
              )}
              {primary401kYear > retireYear && result ? (
                <span role="cell">{`${fmt(result.primary401kAtAccess)} (${primary401kYear})`}</span>
              ) : primary401kYear > retireYear ? (
                <span role="cell" className="fi-calc-ht-na">
                  —
                </span>
              ) : (
                <span role="cell" className="fi-calc-ht-na">
                  —
                </span>
              )}
            </div>
            <div className="fi-calc-ht-row" role="row">
              <span role="cell">FI Retirement ({profile.partnerName})</span>
              <span role="cell">{fmt(fiRetirementPartner)}</span>
              {partner401kYear <= retireYear && result ? (
                <span role="cell">{fmt(result.partner401kAtAccess)}</span>
              ) : (
                <span role="cell" className="fi-calc-ht-na">
                  —
                </span>
              )}
              {partner401kYear > retireYear && result ? (
                <span role="cell">{`${fmt(result.partner401kAtAccess)} (${partner401kYear})`}</span>
              ) : partner401kYear > retireYear ? (
                <span role="cell" className="fi-calc-ht-na">
                  —
                </span>
              ) : (
                <span role="cell" className="fi-calc-ht-na">
                  —
                </span>
              )}
            </div>
            <div className="fi-calc-ht-row" role="row">
              <span role="cell">FI Non-Retirement</span>
              <span role="cell">{fmt(fiNonRetirement)}</span>
              <span role="cell">{result ? fmt(result.fiNonRetAtRetire) : '—'}</span>
              <span role="cell" className="fi-calc-ht-na">
                —
              </span>
            </div>
            <div className={`fi-calc-ht-row${!includeGwLiquid ? ' fi-calc-yby--locked' : ''}`} role="row">
              <span role="cell">GW Liquid</span>
              <span role="cell">{fmt(gwLiquid)}</span>
              <span role="cell">{result ? fmt(result.gwLiquidAtRetire) : '—'}</span>
              <span role="cell" className="fi-calc-ht-na">
                —
              </span>
            </div>
            {result && (
              <div className="fi-calc-ht-row fi-calc-ht-row--total" role="row">
                <span role="cell">Total</span>
                <span role="cell" className="fi-calc-ht-na">
                  —
                </span>
                <span role="cell">
                  {fmt(
                    result.fiNonRetAtRetire +
                      (includeGwLiquid ? result.gwLiquidAtRetire : 0) +
                      (primary401kYear <= retireYear ? result.primary401kAtAccess : 0) +
                      (partner401kYear <= retireYear ? result.partner401kAtAccess : 0),
                  )}
                </span>
                <span role="cell" className="fi-calc-ht-na">
                  —
                </span>
              </div>
            )}
            {result && (
              <div className="fi-calc-ht-row" role="row">
                <span role="cell">Required to FIRE</span>
                <span role="cell" className="fi-calc-ht-na">
                  —
                </span>
                <span role="cell">{fmt(result.corpusNeededFromNonRetirement)}</span>
                <span role="cell" className="fi-calc-ht-na">
                  —
                </span>
              </div>
            )}
            {result && (
              <div className="fi-calc-ht-row fi-calc-ht-row--total" role="row">
                <span role="cell">Gap to close</span>
                <span role="cell" />
                <span role="cell">{fmt(result.gap)}</span>
                <span role="cell" />
              </div>
            )}
          </div>

          {/* Results */}
          {result && (
            <>
              <div className="fi-calc-divider" />
              <div className="fi-calc-results">
                <div className="fi-calc-result-main">
                  {result.gap > 0 ? (
                    <>
                      <span className="fi-calc-result-label">
                        Save for {result.monthsToSave} months up to Dec {retireYear - 1}
                      </span>
                      <span className="fi-calc-result-value">
                        {savingView === 'mo' && <>{fmt(result.monthlySaving)}/mo</>}
                        {savingView === 'yr' && <>{fmt(result.monthlySaving * Math.min(12, result.monthsToSave))}/yr</>}
                        {savingView === 'total' && <>{fmt(result.gap)} total</>}
                      </span>
                      <div className="fi-calc-result-pills">
                        <button
                          className={`fi-calc-result-pill${savingView === 'mo' ? ' active' : ''}`}
                          onClick={() => setSavingView('mo')}
                        >
                          mo
                        </button>
                        <button
                          className={`fi-calc-result-pill${savingView === 'yr' ? ' active' : ''}`}
                          onClick={() => setSavingView('yr')}
                        >
                          yr
                        </button>
                        <button
                          className={`fi-calc-result-pill${savingView === 'total' ? ' active' : ''}`}
                          onClick={() => setSavingView('total')}
                        >
                          total
                        </button>
                      </div>
                    </>
                  ) : (
                    <span className="fi-calc-result-value fi-calc-result--ready">Ready for F.I.R.E.</span>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Save/Update actions */}
          {activeSim ? (
            <div className="fi-calc-save-actions">
              <button className="action-btn" onClick={() => handleSave(activeSim)}>
                Update
              </button>
              <button className="action-btn" onClick={() => setShowSaveInput(true)}>
                Save as new…
              </button>
            </div>
          ) : null}
        </div>
        <div className="fi-sim-panel">
          <h3 className="fi-sim-panel-title">Saved Simulations</h3>
          <div className="fi-sim-panel-cards">
            {savedSims.map((s, idx) => {
              const isActive = activeSim === s.name
              const gapPositive = s.gap != null && s.gap > 0
              return (
                <div
                  key={s.name}
                  className={`fi-sim-card ${isActive ? 'fi-sim-card--active' : ''}${dragOverIndex === idx ? ' fi-sim-card--drag-over' : ''}`}
                  draggable
                  onDragStart={() => {
                    dragIndexRef.current = idx
                  }}
                  onDragOver={e => {
                    e.preventDefault()
                    setDragOverIndex(idx)
                  }}
                  onDragLeave={() => setDragOverIndex(null)}
                  onDrop={e => {
                    e.preventDefault()
                    if (dragIndexRef.current != null) handleReorderSim(dragIndexRef.current, idx)
                    dragIndexRef.current = null
                    setDragOverIndex(null)
                  }}
                  onDragEnd={() => {
                    dragIndexRef.current = null
                    setDragOverIndex(null)
                  }}
                >
                  <div className="fi-sim-card-header">
                    {simRenaming === s.name ? (
                      <input
                        className="fi-sim-rename-input"
                        aria-label={`Rename simulation ${s.name}`}
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRenameSim(s.name, renameValue)
                          if (e.key === 'Escape') setSimRenaming(null)
                        }}
                        onBlur={() => handleRenameSim(s.name, renameValue)}
                        autoFocus
                      />
                    ) : (
                      <button type="button" className="fi-sim-card-name" onClick={() => applySnapshot(s)}>
                        {s.name}
                      </button>
                    )}
                    <div className="fi-sim-overflow-wrap">
                      <button
                        className="fi-sim-overflow-btn"
                        onClick={e => {
                          e.stopPropagation()
                          setSimMenuOpen(simMenuOpen === s.name ? null : s.name)
                        }}
                        aria-label={`Options for ${s.name}`}
                      >
                        ⋯
                      </button>
                      {simMenuOpen === s.name && (
                        <div className="fi-sim-overflow-menu">
                          <button
                            onClick={() => {
                              setSimRenaming(s.name)
                              setRenameValue(s.name)
                              setSimMenuOpen(null)
                            }}
                          >
                            Rename
                          </button>
                          <button
                            onClick={() => {
                              setSimToDelete(s.name)
                              setSimMenuOpen(null)
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <button type="button" className="fi-sim-card-body" onClick={() => applySnapshot(s)}>
                    <div className="fi-sim-card-stat">
                      <span className="fi-sim-card-label">Retire</span>
                      <span className="fi-sim-card-value">Jan {s.retireYear}</span>
                    </div>
                    <div className="fi-sim-card-stat">
                      <span className="fi-sim-card-label">FIRE #</span>
                      <span className="fi-sim-card-value">
                        {s.corpusNeeded != null ? abbreviateCurrency(s.corpusNeeded) : '—'}
                      </span>
                    </div>
                    <div className="fi-sim-card-stat">
                      <span className="fi-sim-card-label">Gap</span>
                      <span
                        className={`fi-sim-card-value ${gapPositive ? 'fi-sim-card-value--negative' : 'fi-sim-card-value--positive'}`}
                      >
                        {s.gap != null ? (s.gap <= 0 ? 'Ready' : abbreviateCurrency(s.gap)) : '—'}
                      </span>
                    </div>
                  </button>
                </div>
              )
            })}
            {simToDelete && (
              <div className="fi-sim-delete-confirm">
                <span>Delete &quot;{simToDelete}&quot;?</span>
                <button onClick={() => handleDeleteSim(simToDelete)}>Yes</button>
                <button onClick={() => setSimToDelete(null)}>No</button>
              </div>
            )}
            {savedSims.length === 0 && (
              <p className="fi-sim-panel-empty">
                No saved simulations yet. Adjust parameters and save to compare scenarios.
              </p>
            )}
          </div>
          {showSaveInput ? (
            <form
              className="fi-sim-save-form"
              onSubmit={e => {
                e.preventDefault()
                if (saveNameInput.trim()) handleSave(saveNameInput.trim())
              }}
            >
              <input
                className="fi-sim-save-input"
                aria-label="New simulation name"
                placeholder="Simulation name"
                value={saveNameInput}
                onChange={e => setSaveNameInput(e.target.value)}
                autoFocus
              />
              <button type="submit" className="fi-sim-save-btn" disabled={!saveNameInput.trim()}>
                Save
              </button>
              <button
                type="button"
                className="fi-sim-cancel-btn"
                onClick={() => {
                  setShowSaveInput(false)
                  setSaveNameInput('')
                }}
              >
                ✕
              </button>
            </form>
          ) : activeSim ? (
            <button className="action-btn" onClick={handleNewSim}>
              Reset
            </button>
          ) : (
            <button className="action-btn" onClick={() => setShowSaveInput(true)}>
              Save as new…
            </button>
          )}
        </div>
      </div>

      {/* Month-by-month projection — full width below the layout */}
      {result && (
        <div className="fi-calc-projection-card">
          <div className="projection-controls" role="toolbar">
            <div className="tab-bar" role="group" aria-label="Time interval">
              {INTERVAL_OPTIONS.map(option => (
                <button
                  key={option.value}
                  className={`tab-btn tab-btn--sm${interval === option.value ? ' active' : ''}`}
                  onClick={() => setInterval(option.value)}
                  aria-pressed={interval === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="tab-bar" role="group" aria-label="View mode">
              <button
                className={`tab-btn tab-btn--sm${viewMode === 'chart' ? ' active' : ''}`}
                onClick={() => setViewMode('chart')}
                aria-pressed={viewMode === 'chart'}
              >
                Chart
              </button>
              <button
                className={`tab-btn tab-btn--sm${viewMode === 'table' ? ' active' : ''}`}
                onClick={() => setViewMode('table')}
                aria-pressed={viewMode === 'table'}
              >
                Table
              </button>
            </div>
          </div>

          {viewMode === 'chart' ? (
            <div className="projection-chart-wrapper">
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={projectionChartData} margin={{ top: 28, right: 40, left: 16, bottom: 8 }}>
                  <defs>
                    <linearGradient id="fiCalcAreaAccum" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent, #0f766e)" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="var(--accent, #0f766e)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="fiCalcAreaDraw" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-warning, #d97706)" stopOpacity={0.14} />
                      <stop offset="100%" stopColor="var(--color-warning, #d97706)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--projection-grid, #e5e7eb)" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                    stroke="var(--projection-axis, var(--color-text-muted))"
                  />
                  <YAxis
                    tickFormatter={abbreviateCurrency}
                    tick={{ fontSize: 11 }}
                    stroke="var(--projection-axis, var(--color-text-muted))"
                    width={72}
                  />
                  <Tooltip content={<ProjectionTooltip chartData={projectionChartData} />} />
                  <ReferenceLine y={0} stroke="var(--color-text-muted)" strokeDasharray="4 2" strokeWidth={1} />
                  {result && result.corpusNeededFromNonRetirement > 0 && (
                    <ReferenceLine
                      y={result.corpusNeededFromNonRetirement}
                      stroke="var(--color-text-muted)"
                      strokeDasharray="4 2"
                      strokeWidth={1}
                      label={{
                        value: abbreviateCurrency(result.corpusNeededFromNonRetirement),
                        position: 'right',
                        fontSize: 11,
                        fill: 'var(--color-text-muted)',
                      }}
                    />
                  )}

                  {projectionMilestones.map(milestone => (
                    <ReferenceLine
                      key={`${milestone.month}-${milestone.label}`}
                      x={milestone.month}
                      stroke={milestone.color}
                      strokeDasharray="6 4"
                      strokeWidth={2}
                      label={{
                        value: milestone.label,
                        position: 'center',
                        fontSize: 10,
                        fill: milestone.color,
                        fontWeight: 600,
                        angle: -90,
                        dx: milestone.dx,
                        dy: milestone.dy,
                      }}
                    />
                  ))}

                  <Area
                    type="monotone"
                    dataKey="accum"
                    fill="url(#fiCalcAreaAccum)"
                    stroke="none"
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="draw"
                    fill="url(#fiCalcAreaDraw)"
                    stroke="none"
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="accum"
                    stroke="var(--accent, #0f766e)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, stroke: 'var(--color-surface, #fff)', strokeWidth: 2 }}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="draw"
                    stroke="var(--color-warning, #d97706)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, stroke: 'var(--color-surface, #fff)', strokeWidth: 2 }}
                    connectNulls={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="fi-calc-yby">
              <table className="fi-calc-yby-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Phase</th>
                    <th>Expense</th>
                    <th>Bonus Expense</th>
                    <th>Available</th>
                    <th>{profile.primaryName} 401(k)</th>
                    <th>{profile.partnerName} 401(k)</th>
                    <th>Net Worth</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {projectionRows.map(row => (
                    <tr key={`${row.month}-${row.phase}`} className={row.netWorth < 0 ? 'fi-calc-yby--negative' : ''}>
                      <td>{row.month}</td>
                      <td>{row.phase === 'saving' ? 'Saving' : 'Drawdown'}</td>
                      <td>{row.phase === 'saving' ? '—' : fmt(row.expense)}</td>
                      <td>{row.bonus > 0 ? fmt(row.bonus) : '—'}</td>
                      <td>
                        {fmt(row.nonRet)}
                        {row.phase === 'saving' && row.monthlySaved > 0 ? (
                          <span className="contrib-badge">+{fmt(row.monthlySaved)}</span>
                        ) : null}
                      </td>
                      <td className={row.primaryRet ? 'fi-calc-yby--locked' : ''}>
                        {row.primaryRet ? fmt(row.primaryRet) : '—'}
                        {row.phase === 'saving' && row.primaryRetGrowth > 0 && row.primaryRet ? null : null}
                      </td>
                      <td className={row.partnerRet ? 'fi-calc-yby--locked' : ''}>
                        {row.partnerRet ? fmt(row.partnerRet) : '—'}
                        {row.phase === 'saving' && row.partnerRetGrowth > 0 && row.partnerRet ? null : null}
                      </td>
                      <td>{fmt(row.netWorth)}</td>
                      <td className="fi-calc-yby-note">{row.injection ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  )
}

export default FICalculator
