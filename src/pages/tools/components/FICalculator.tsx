import { FC, useState, useMemo, useCallback } from 'react'
import { loadBudgetStore } from '../../budget/utils/budgetStorage'
import { parseCSV } from '../../budget/utils/csvParser'
import type { Account, BalanceEntry } from '../../data/types'

const REMOVED_GROUP_ID = 'removed'

/** Load last year's total expense from budget store */
function getLastYearExpense(): number {
  try {
    const store = loadBudgetStore()
    const lastYear = new Date().getFullYear() - 1
    const groups = store.categoryGroups || []
    const removedCats = new Set(groups.find(g => g.id === REMOVED_GROUP_ID)?.categories || [])

    // Parse all CSVs for last year
    const txns: { category: string; amount: number; monthKey: string }[] = []
    for (let m = 1; m <= 12; m++) {
      const key = `${lastYear}-${String(m).padStart(2, '0')}`
      const csvData = store.csvs[key]
      if (!csvData) continue
      try {
        const parsed = parseCSV(csvData.csv)
        txns.push(...parsed.map(t => ({ category: t.category, amount: t.amount, monthKey: key })))
      } catch { /* skip bad CSV */ }
    }

    // Classify categories same as budget table: group by category+month, then
    // a category is "expense" if any monthly sum is negative
    const catMonthSums: Record<string, Record<string, number>> = {}
    txns.forEach(t => {
      if (removedCats.has(t.category)) return
      if (!catMonthSums[t.category]) catMonthSums[t.category] = {}
      catMonthSums[t.category][t.monthKey] = (catMonthSums[t.category][t.monthKey] || 0) + t.amount
    })

    let totalExpense = 0
    Object.entries(catMonthSums).forEach(([, months]) => {
      const monthVals = Object.values(months)
      const hasNeg = monthVals.some(v => v < 0)
      if (hasNeg) {
        totalExpense += Math.abs(monthVals.reduce((s, v) => s + v, 0))
      }
    })
    return totalExpense
  } catch {
    return 0
  }
}

/** Load accounts/balances from localStorage for breakdowns */
function loadAccountData(): { accounts: Account[]; balances: BalanceEntry[] } {
  try {
    const accounts: Account[] = JSON.parse(localStorage.getItem('data-accounts') || '[]')
    const balances: BalanceEntry[] = JSON.parse(localStorage.getItem('data-balances') || '[]')
    return { accounts, balances }
  } catch {
    return { accounts: [], balances: [] }
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
  // Try parsing as date
  const d = new Date(birthday)
  if (!isNaN(d.getTime())) return d.getFullYear()
  return null
}

interface ProfileData {
  primaryBirthYear: number | null
  partnerBirthYear: number | null
}

function loadProfile(): ProfileData {
  try {
    const raw = JSON.parse(localStorage.getItem('user-profile') || '{}')
    return {
      primaryBirthYear: getBirthYear(raw.birthday || ''),
      partnerBirthYear: raw.partner ? getBirthYear(raw.partner.birthday || '') : null,
    }
  } catch {
    return { primaryBirthYear: null, partnerBirthYear: null }
  }
}

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })

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

const SIMS_KEY = 'fi-simulations'
function loadSims(): FISim[] {
  try { return JSON.parse(localStorage.getItem(SIMS_KEY) || '[]') } catch { return [] }
}
function saveSims(sims: FISim[]) { localStorage.setItem(SIMS_KEY, JSON.stringify(sims)) }

const FICalculator: FC = () => {
  const thisYear = new Date().getFullYear()
  const lastYearExpense = useMemo(() => getLastYearExpense(), [])
  const profile = useMemo(() => loadProfile(), [])
  const { accounts, balances } = useMemo(() => loadAccountData(), [])

  // Derived defaults
  const defaultLastYear = useMemo(() => {
    const years = [profile.primaryBirthYear, profile.partnerBirthYear]
      .filter((y): y is number => y !== null)
      .map(y => y + 100)
    return years.length > 0 ? Math.max(...years) : thisYear + 60
  }, [profile, thisYear])

  const primary401kEarliestYear = profile.primaryBirthYear ? profile.primaryBirthYear + 60 : thisYear + 30
  const partner401kEarliestYear = profile.partnerBirthYear ? profile.partnerBirthYear + 60 : thisYear + 30

  // Inputs
  const [annualExpense, setAnnualExpense] = useState<number>(lastYearExpense || 60000)
  const [expenseDisplay, setExpenseDisplay] = useState<string>(
    Math.round(lastYearExpense || 60000).toLocaleString()
  )
  const [inflationRate, setInflationRate] = useState<number>(3)
  const [growthRate, setGrowthRate] = useState<number>(8)
  const [lastYear, setLastYear] = useState<number>(defaultLastYear)
  const [retireYear, setRetireYear] = useState<number>(thisYear + 1)
  const [primary401kYear, setPrimary401kYear] = useState<number>(primary401kEarliestYear)
  const [partner401kYear, setPartner401kYear] = useState<number>(partner401kEarliestYear)
  const [includeGwLiquid, setIncludeGwLiquid] = useState<boolean>(false)
  const [showYearByYear, setShowYearByYear] = useState<boolean>(false)
  const [savedSims, setSavedSims] = useState<FISim[]>(() => loadSims())
  const [activeSim, setActiveSim] = useState<string | null>(null)
  const [showSaveInput, setShowSaveInput] = useState(false)
  const [saveNameInput, setSaveNameInput] = useState('')

  const applySnapshot = useCallback((s: FISim) => {
    setAnnualExpense(s.annualExpense)
    setExpenseDisplay(Math.round(s.annualExpense).toLocaleString())
    setInflationRate(s.inflationRate)
    setGrowthRate(s.growthRate)
    setLastYear(s.lastYear)
    setRetireYear(s.retireYear)
    setPrimary401kYear(s.primary401kYear)
    setPartner401kYear(s.partner401kYear)
    setIncludeGwLiquid(s.includeGwLiquid)
    setActiveSim(s.name)
  }, [])

  const handleSave = useCallback((name: string) => {
    const sim: FISim = {
      name, annualExpense, inflationRate, growthRate, lastYear,
      retireYear, primary401kYear, partner401kYear, includeGwLiquid,
    }
    const next = [...savedSims.filter(s => s.name !== name), sim]
    setSavedSims(next)
    saveSims(next)
    setActiveSim(name)
    setShowSaveInput(false)
    setSaveNameInput('')
  }, [annualExpense, inflationRate, growthRate, lastYear, retireYear,
      primary401kYear, partner401kYear, includeGwLiquid, savedSims])

  const handleDeleteSim = useCallback((name: string) => {
    const next = savedSims.filter(s => s.name !== name)
    setSavedSims(next)
    saveSims(next)
    if (activeSim === name) setActiveSim(null)
  }, [savedSims, activeSim])

  // Current balances
  const fiRetirementPrimary = useMemo(() =>
    getLatestBalancesByFilter(accounts, balances, a => a.goalType === 'fi' && a.type === 'retirement' && a.owner === 'primary'),
    [accounts, balances])
  const fiRetirementPartner = useMemo(() =>
    getLatestBalancesByFilter(accounts, balances, a => a.goalType === 'fi' && a.type === 'retirement' && (a.owner === 'partner' || a.owner === 'joint')),
    [accounts, balances])
  const fiNonRetirement = useMemo(() =>
    getLatestBalancesByFilter(accounts, balances, a => a.goalType === 'fi' && a.type === 'non-retirement'),
    [accounts, balances])
  const gwLiquid = useMemo(() =>
    getLatestBalancesByFilter(accounts, balances, a => a.goalType === 'gw' && a.type === 'liquid'),
    [accounts, balances])

  // Core FI calculation
  const result = useMemo(() => {
    const g = growthRate / 100
    const inf = inflationRate / 100
    const yearsToRetire = retireYear - thisYear
    const yearsInRetirement = lastYear - retireYear

    if (yearsInRetirement <= 0) return null

    // Step 1: What expense will be in the retirement year?
    const expenseAtRetirement = annualExpense * Math.pow(1 + inf, yearsToRetire)

    // Step 2: Grow retirement accounts to their respective access years
    const primary401kAtAccess = fiRetirementPrimary * Math.pow(1 + g, primary401kYear - thisYear)
    const partner401kAtAccess = fiRetirementPartner * Math.pow(1 + g, partner401kYear - thisYear)

    // Step 3: Simulate year-by-year backwards from lastYear to retireYear
    // C[y] = E[y] + C[y+1]/(1+g), starting from C[lastYear+1]=0
    // Expense at year y: expenseAtRetirement * (1+inf)^(y - retireYear)
    // Clamp to 0 at each step: non-retirement corpus can never be negative.
    // This ensures excess 401k money doesn't reduce corpus needed before access year.
    let corpus = 0
    for (let y = lastYear; y >= retireYear; y--) {
      corpus = corpus / (1 + g)
      const yearIdx = y - retireYear
      const expenseThisYear = expenseAtRetirement * Math.pow(1 + inf, yearIdx)
      corpus += expenseThisYear

      // If a 401k becomes accessible this year, it reduces what corpus needs to cover
      if (y === primary401kYear) corpus -= primary401kAtAccess
      if (y === partner401kYear) corpus -= partner401kAtAccess

      // Can't need negative money — excess 401k is surplus, not a reduction of earlier needs
      corpus = Math.max(0, corpus)
    }

    // corpus is now the amount needed from non-retirement sources at retirement year
    const corpusNeededFromNonRetirement = Math.max(0, corpus)

    // Step 4: Grow non-retirement FI accounts to retirement year
    const fiNonRetAtRetire = fiNonRetirement * Math.pow(1 + g, yearsToRetire)

    // Step 5: Optionally include GW liquid
    const gwLiquidAtRetire = includeGwLiquid ? gwLiquid * Math.pow(1 + g, yearsToRetire) : 0

    const existingAtRetire = fiNonRetAtRetire + gwLiquidAtRetire
    const gap = Math.max(0, corpusNeededFromNonRetirement - existingAtRetire)

    // Step 6: How much to save per year until retirement?
    // Future value of annuity: FV = PMT * ((1+g)^n - 1) / g
    let annualSaving = 0
    if (yearsToRetire > 0 && gap > 0) {
      if (g === 0) {
        annualSaving = gap / yearsToRetire
      } else {
        const fvFactor = (Math.pow(1 + g, yearsToRetire) - 1) / g
        annualSaving = gap / fvFactor
      }
    }

    // Step 7: Forward simulation for year-by-year breakdown
    // Start with the corpus at retirement (assuming gap is filled)
    const startingCorpus = corpusNeededFromNonRetirement
    const yearByYear: { year: number; expense: number; netWorth: number; injection: string | null }[] = []
    let nw = startingCorpus
    for (let y = retireYear; y <= lastYear; y++) {
      const yearIdx = y - retireYear
      let injection: string | null = null

      // 401k injections
      if (y === primary401kYear) { nw += primary401kAtAccess; injection = 'Primary 401(k)' }
      if (y === partner401kYear) {
        nw += partner401kAtAccess
        injection = injection ? injection + ' + Partner 401(k)' : 'Partner 401(k)'
      }

      const expense = expenseAtRetirement * Math.pow(1 + inf, yearIdx)
      nw -= expense

      yearByYear.push({ year: y, expense, netWorth: Math.abs(nw) < 1 ? 0 : nw, injection })

      // Grow for next year
      nw *= (1 + g)
    }

    return {
      corpusNeededFromNonRetirement,
      primary401kAtAccess,
      partner401kAtAccess,
      fiNonRetAtRetire,
      gwLiquidAtRetire,
      existingAtRetire,
      gap,
      annualSaving,
      expenseAtRetirement,
      yearsToRetire,
      yearByYear,
    }
  }, [annualExpense, inflationRate, growthRate, lastYear, retireYear, thisYear,
      fiRetirementPrimary, fiRetirementPartner, fiNonRetirement, gwLiquid,
      includeGwLiquid, primary401kYear, partner401kYear])

  return (
    <div className="fi-calc">
      {/* Saved simulations */}
      <div className="fi-sim-bar">
        <div className="fi-sim-chips">
          {savedSims.map(s => (
            <button
              key={s.name}
              className={`fi-sim-chip ${activeSim === s.name ? 'fi-sim-chip--active' : ''}`}
              onClick={() => applySnapshot(s)}
            >
              {s.name}
              <span className="fi-sim-chip-x" onClick={e => { e.stopPropagation(); handleDeleteSim(s.name) }}>×</span>
            </button>
          ))}
        </div>
        {showSaveInput ? (
          <form className="fi-sim-save-form" onSubmit={e => { e.preventDefault(); if (saveNameInput.trim()) handleSave(saveNameInput.trim()) }}>
            <input
              className="fi-sim-save-input"
              placeholder="Simulation name"
              value={saveNameInput}
              onChange={e => setSaveNameInput(e.target.value)}
              autoFocus
            />
            <button type="submit" className="fi-sim-save-btn" disabled={!saveNameInput.trim()}>Save</button>
            <button type="button" className="fi-sim-cancel-btn" onClick={() => { setShowSaveInput(false); setSaveNameInput('') }}>✕</button>
          </form>
        ) : (
          <button className="fi-sim-add-btn" onClick={() => setShowSaveInput(true)}>+ Save</button>
        )}
      </div>

      {/* Annual Expense — hero input */}
      <div className="fi-calc-hero">
        <span className="fi-calc-hero-label">Annual Expense</span>
        <div className="fi-calc-hero-value">
          <span className="fi-calc-hero-dollar">$</span>
          <input
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
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            onBlur={() => setExpenseDisplay(Math.round(annualExpense).toLocaleString())}
          />
        </div>
        {lastYearExpense > 0 && annualExpense !== lastYearExpense && (
          <button className="fi-calc-link-btn" onClick={() => {
            setAnnualExpense(lastYearExpense)
            setExpenseDisplay(Math.round(lastYearExpense).toLocaleString())
          }}>
            Use last year's ({fmt(lastYearExpense)})
          </button>
        )}
      </div>

      {/* Rate sliders */}
      <div className="fi-calc-slider-group">
        <div className="fi-calc-slider-item">
          <div className="fi-calc-slider-header">
            <span>Inflation</span>
            <span className="fi-calc-slider-value">{inflationRate}%</span>
          </div>
          <input type="range" className="fi-calc-range" min="0" max="10" step="0.5"
            value={inflationRate} onChange={e => setInflationRate(Number(e.target.value))} />
        </div>
        <div className="fi-calc-slider-item">
          <div className="fi-calc-slider-header">
            <span>Growth</span>
            <span className="fi-calc-slider-value">{growthRate}%</span>
          </div>
          <input type="range" className="fi-calc-range" min="0" max="15" step="0.5"
            value={growthRate} onChange={e => setGrowthRate(Number(e.target.value))} />
        </div>
      </div>

      {/* Year sliders */}
      <div className="fi-calc-slider-group">
        <div className="fi-calc-slider-item">
          <div className="fi-calc-slider-header">
            <span>Retire in</span>
            <span className="fi-calc-slider-value">{retireYear} <span className="fi-calc-slider-sub">({retireYear - thisYear}yr)</span></span>
          </div>
          <input type="range" className="fi-calc-range" min={thisYear + 1} max={lastYear - 1} step="1"
            value={retireYear} onChange={e => setRetireYear(Number(e.target.value))} />
        </div>
        <div className="fi-calc-slider-item">
          <div className="fi-calc-slider-header">
            <span>Plan until</span>
            <span className="fi-calc-slider-value">{lastYear}</span>
          </div>
          <input type="range" className="fi-calc-range" min={retireYear + 1} max={defaultLastYear + 20} step="1"
            value={lastYear} onChange={e => setLastYear(Number(e.target.value))} />
        </div>
      </div>

      {/* 401k access years */}
      <div className="fi-calc-slider-group">
        <div className="fi-calc-slider-item">
          <div className="fi-calc-slider-header">
            <span>Primary 401(k)</span>
            <span className="fi-calc-slider-value">{primary401kYear}</span>
          </div>
          <input type="range" className="fi-calc-range" min={primary401kEarliestYear} max={lastYear} step="1"
            value={primary401kYear} onChange={e => setPrimary401kYear(Number(e.target.value))} />
        </div>
        {profile.partnerBirthYear && (
          <div className="fi-calc-slider-item">
            <div className="fi-calc-slider-header">
              <span>Partner 401(k)</span>
              <span className="fi-calc-slider-value">{partner401kYear}</span>
            </div>
            <input type="range" className="fi-calc-range" min={partner401kEarliestYear} max={lastYear} step="1"
              value={partner401kYear} onChange={e => setPartner401kYear(Number(e.target.value))} />
          </div>
        )}
      </div>

      {/* GW toggle */}
      <div className="fi-calc-toggle-row">
        <button
          className={`fi-calc-toggle ${includeGwLiquid ? 'fi-calc-toggle--on' : ''}`}
          onClick={() => setIncludeGwLiquid(v => !v)}
        >
          <span className="fi-calc-toggle-track"><span className="fi-calc-toggle-thumb" /></span>
          Include GW liquid ({fmt(gwLiquid)})
        </button>
      </div>

      {/* Current holdings summary */}
      <div className="fi-calc-divider" />
      <div className="fi-calc-holdings">
        <div className="fi-calc-holding-row">
          <span>FI Retirement (Primary)</span>
          <span>{fmt(fiRetirementPrimary)}</span>
        </div>
        <div className="fi-calc-holding-row">
          <span>FI Retirement (Partner)</span>
          <span>{fmt(fiRetirementPartner)}</span>
        </div>
        <div className="fi-calc-holding-row">
          <span>FI Non-Retirement</span>
          <span>{fmt(fiNonRetirement)}</span>
        </div>
        {includeGwLiquid && (
          <div className="fi-calc-holding-row">
            <span>GW Liquid</span>
            <span>{fmt(gwLiquid)}</span>
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
                  <span className="fi-calc-result-label">Save each year until {retireYear}</span>
                  <span className="fi-calc-result-value">{fmt(result.annualSaving)}</span>
                </>
              ) : (
                <span className="fi-calc-result-value fi-calc-result--ready">You're ready to FI! 🎉</span>
              )}
            </div>

            <div className="fi-calc-breakdown">
              <div className="fi-calc-bk-row">
                <span>Expense at retirement ({retireYear})</span>
                <span>{fmt(result.expenseAtRetirement)}/yr</span>
              </div>
              <div className="fi-calc-bk-row">
                <span>Non-ret corpus needed at {retireYear}</span>
                <span>{fmt(result.corpusNeededFromNonRetirement)}</span>
              </div>
              {fiRetirementPrimary > 0 && (
                <div className="fi-calc-bk-row">
                  <span>Primary 401(k) at {primary401kYear}</span>
                  <span>{fmt(result.primary401kAtAccess)}</span>
                </div>
              )}
              {fiRetirementPartner > 0 && (
                <div className="fi-calc-bk-row">
                  <span>Partner 401(k) at {partner401kYear}</span>
                  <span>{fmt(result.partner401kAtAccess)}</span>
                </div>
              )}
              <div className="fi-calc-bk-row">
                <span>Existing non-ret at {retireYear}</span>
                <span>{fmt(result.existingAtRetire)}</span>
              </div>
              <div className="fi-calc-bk-row fi-calc-bk-row--gap">
                <span>Gap to close</span>
                <span>{fmt(result.gap)}</span>
              </div>
            </div>

            <button
              className="fi-calc-expand-btn"
              onClick={() => setShowYearByYear(v => !v)}
            >
              {showYearByYear ? '▾' : '▸'} Year-by-year projection
            </button>

            {showYearByYear && (
              <div className="fi-calc-yby">
                <table className="fi-calc-yby-table">
                  <thead>
                    <tr>
                      <th>Year</th>
                      <th>Expense</th>
                      <th>Net Worth</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.yearByYear.map(row => (
                      <tr key={row.year} className={row.netWorth < 0 ? 'fi-calc-yby--negative' : ''}>
                        <td>{row.year}</td>
                        <td>{fmt(row.expense)}</td>
                        <td>{fmt(row.netWorth)}</td>
                        <td className="fi-calc-yby-note">{row.injection ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default FICalculator
