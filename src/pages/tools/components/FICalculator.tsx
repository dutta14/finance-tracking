import { FC, useState, useMemo, useCallback, useRef, useEffect } from 'react'
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

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

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
}

const ProjectionTooltip: FC<ProjectionTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null

  const row = payload[0].payload

  return (
    <div className="projection-tooltip">
      <div className="projection-tooltip-month">{label}</div>
      <div className="projection-tooltip-row">
        <span>Phase</span>
        <span>{row.phase === 'saving' ? 'Saving' : 'Drawdown'}</span>
      </div>
      {row.monthlySaved > 0 && (
        <div className="projection-tooltip-row">
          <span>Saved</span>
          <span>{fmt(row.monthlySaved)}</span>
        </div>
      )}
      {row.expense > 0 && (
        <div className="projection-tooltip-row negative">
          <span>Expense</span>
          <span>{fmt(row.expense)}</span>
        </div>
      )}
      <div className="projection-tooltip-row">
        <span>Balance</span>
        <span>{fmt(row.netWorth)}</span>
      </div>
      <div className="projection-tooltip-row projection-tooltip-row--pct">
        <span>Growth rate</span>
        <span>{row.growthRate}%</span>
      </div>
    </div>
  )
}

interface FISim {
  name: string
  annualExpense: number
  inflationRate: number
  growthRate: number
  lastYear: number
  retireYear: number
  primary401kYear: number
  partner401kYear: number
  includeGwLiquid: boolean
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
  const primary401kEarliestMonth = profile.primaryBirthYear
    ? ((profile.primaryBirthMonth - 1 + 6) % 12) + 1
    : 1
  const primary401kEarliestYear = profile.primaryBirthYear
    ? profile.primaryBirthYear + 59 + (profile.primaryBirthMonth - 1 + 6 >= 12 ? 1 : 0)
    : thisYear + 30
  const partner401kEarliestMonth = profile.partnerBirthYear
    ? ((profile.partnerBirthMonth - 1 + 6) % 12) + 1
    : 1
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
  const [savingView, setSavingView] = useState<'mo' | 'yr' | 'total'>('total')
  const [interval, setInterval] = useState<ViewInterval>('yearly')
  const [viewMode, setViewMode] = useState<ViewMode>('chart')
  const [activeSim, setActiveSim] = useState<string | null>(null)
  const [showSaveInput, setShowSaveInput] = useState(false)
  const [saveNameInput, setSaveNameInput] = useState('')

  const applySnapshot = useCallback((s: FISim) => {
    setAnnualExpense(s.annualExpense)
    setExpenseDisplay(Math.round(s.annualExpense).toLocaleString())
    updateSettings({ inflation: s.inflationRate, preBoundaryGrowth: s.growthRate })
    setLastYear(s.lastYear)
    setRetireYear(s.retireYear)
    setPrimary401kYear(s.primary401kYear)
    setPartner401kYear(s.partner401kYear)
    setIncludeGwLiquid(s.includeGwLiquid)
    setActiveSim(s.name)
  }, [updateSettings])

  const handleSave = useCallback(
    (name: string) => {
      const sim: FISim = {
        name,
        annualExpense,
        inflationRate,
        growthRate,
        lastYear,
        retireYear,
        primary401kYear,
        partner401kYear,
        includeGwLiquid,
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
    },
    [savedSims, activeSim, saveSims],
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
          color: 'var(--color-success, #16a34a)',
          dx: -10,
          dy: 0,
        })
      }

      if (row.injection?.includes(`${profile.partnerName} 401(k)`)) {
        milestones.push({
          month: row.month,
          label: `${profile.partnerName} 401(k)`,
          color: 'var(--color-success, #16a34a)',
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
                <span className="fi-calc-step-sub">({retireYear - thisYear} yr{retireYear - thisYear !== 1 ? 's' : ''})</span>
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
          <button
            className={`fi-calc-toggle ${includeGwLiquid ? 'fi-calc-toggle--on' : ''}`}
            onClick={() => setIncludeGwLiquid(v => !v)}
          >
            Include GW liquid ({fmt(gwLiquid)})
            <span className="fi-calc-toggle-track">
              <span className="fi-calc-toggle-thumb" />
            </span>
          </button>
        </div>

        {/* Holdings + Projections table */}
        <div className="fi-calc-divider" />
        <div className="fi-calc-holdings-table">
          <div className="fi-calc-ht-header">
            <span>Holdings</span>
            <span>Today</span>
            <span>At Retirement ({retireYear})</span>
            <span>At 401(k) Access</span>
          </div>
          <div className="fi-calc-ht-row">
            <span>FI Retirement ({profile.primaryName})</span>
            <span>{fmt(fiRetirementPrimary)}</span>
            <span className="fi-calc-ht-na">—</span>
            <span>{result ? `${fmt(result.primary401kAtAccess)} (${primary401kYear})` : '—'}</span>
          </div>
          <div className="fi-calc-ht-row">
            <span>FI Retirement ({profile.partnerName})</span>
            <span>{fmt(fiRetirementPartner)}</span>
            <span className="fi-calc-ht-na">—</span>
            <span>{result ? `${fmt(result.partner401kAtAccess)} (${partner401kYear})` : '—'}</span>
          </div>
          <div className="fi-calc-ht-row">
            <span>FI Non-Retirement</span>
            <span>{fmt(fiNonRetirement)}</span>
            <span>{result ? fmt(result.fiNonRetAtRetire) : '—'}</span>
            <span className="fi-calc-ht-na">—</span>
          </div>
          {result && (
            <div className="fi-calc-ht-row">
              <span>FI Non-Retirement (required)</span>
              <span className="fi-calc-ht-na">—</span>
              <span>{fmt(result.corpusNeededFromNonRetirement)}</span>
              <span className="fi-calc-ht-na">—</span>
            </div>
          )}
          {includeGwLiquid && (
            <div className="fi-calc-ht-row">
              <span>GW Liquid</span>
              <span>{fmt(gwLiquid)}</span>
              <span>{result ? fmt(result.gwLiquidAtRetire) : '—'}</span>
              <span className="fi-calc-ht-na">—</span>
            </div>
          )}
          {result && (
            <div className="fi-calc-ht-row fi-calc-ht-row--total">
              <span>Gap to close</span>
              <span />
              <span>{fmt(result.gap)}</span>
              <span />
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
                    <span className="fi-calc-result-label">Save for {result.monthsToSave} months up to Dec {retireYear - 1}</span>
                    <span className="fi-calc-result-value">
                      {savingView === 'mo' && <>{fmt(result.monthlySaving)}/mo</>}
                      {savingView === 'yr' && <>{fmt(result.monthlySaving * Math.min(12, result.monthsToSave))}/yr</>}
                      {savingView === 'total' && <>{fmt(result.gap)} total</>}
                    </span>
                    <div className="fi-calc-result-pills">
                      <button className={`fi-calc-result-pill${savingView === 'mo' ? ' active' : ''}`} onClick={() => setSavingView('mo')}>mo</button>
                      <button className={`fi-calc-result-pill${savingView === 'yr' ? ' active' : ''}`} onClick={() => setSavingView('yr')}>yr</button>
                      <button className={`fi-calc-result-pill${savingView === 'total' ? ' active' : ''}`} onClick={() => setSavingView('total')}>total</button>
                    </div>
                  </>
                ) : (
                  <span className="fi-calc-result-value fi-calc-result--ready">You're ready to FI! 🎉</span>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Saved Simulations Panel */}
      <div className="fi-sim-panel">
        <h3 className="fi-sim-panel-title">Saved Simulations</h3>
        <div className="fi-sim-panel-list">
          {savedSims.map(s => (
            <div
              key={s.name}
              className={`fi-sim-panel-item-row ${activeSim === s.name ? 'fi-sim-panel-item-row--active' : ''}`}
            >
              <button
                type="button"
                className={`fi-sim-panel-item ${activeSim === s.name ? 'fi-sim-panel-item--active' : ''}`}
                onClick={() => applySnapshot(s)}
              >
                <span className="fi-sim-panel-item-name">{s.name}</span>
              </button>
              <button
                className="fi-sim-panel-item-delete"
                onClick={e => {
                  e.stopPropagation()
                  handleDeleteSim(s.name)
                }}
                aria-label={`Delete ${s.name}`}
              >
                ×
              </button>
            </div>
          ))}
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
        ) : (
          <button className="action-btn" onClick={() => setShowSaveInput(true)}>
            + Save current
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
                <Tooltip content={<ProjectionTooltip />} />
                <ReferenceLine y={0} stroke="var(--color-text-muted)" strokeDasharray="4 2" strokeWidth={1} />

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
                    <td>
                      {fmt(row.nonRet)}
                      {row.phase === 'saving' && row.monthlySaved > 0 ? (
                        <span className="contrib-badge">+{fmt(row.monthlySaved)}</span>
                      ) : null}
                    </td>
                    <td className={row.primaryRet ? 'fi-calc-yby--locked' : ''}>
                      {row.primaryRet ? fmt(row.primaryRet) : '—'}
                      {row.phase === 'saving' && row.primaryRetGrowth > 0 && row.primaryRet ? (
                        <span className="contrib-badge">+{fmt(row.primaryRetGrowth)}</span>
                      ) : null}
                    </td>
                    <td className={row.partnerRet ? 'fi-calc-yby--locked' : ''}>
                      {row.partnerRet ? fmt(row.partnerRet) : '—'}
                      {row.phase === 'saving' && row.partnerRetGrowth > 0 && row.partnerRet ? (
                        <span className="contrib-badge">+{fmt(row.partnerRetGrowth)}</span>
                      ) : null}
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
