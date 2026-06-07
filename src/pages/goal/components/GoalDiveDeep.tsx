import { FC, useMemo, useState } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts'
import { FinancialGoal } from '../../../types'
import { projectFIDateWithDrawdown, computeRequiredCorpus } from '../utils/goalCalculations'
import '../../../styles/GoalDiveDeep.css'

interface GoalDiveDeepProps {
  goal: FinancialGoal
  profileBirthday: string
  currentBalance?: number
  monthlyContribution?: number
  currentMonth?: string
}

type DataMode = 'projected' | 'planned'

interface ProjectionRow {
  month: string // "MMM YYYY"
  expense: number
  remaining: number
  phase: 'accumulation' | 'drawdown'
  growthRate?: number // annual % applied this month
}

const dollars = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

function buildLifecycle(
  currentBalance: number,
  monthlyContribution: number,
  accumulationGrowthRate: number,
  drawdownGrowthRate: number,
  inflationRate: number,
  monthlyExpenseAtFI: number,
  endYear: number,
  fiDate: Date,
  retirementDate?: Date,
  corpusCapAtFI?: number,
  initialWithdrawal?: number,
): ProjectionRow[] {
  const monthlyAccGrowth = accumulationGrowthRate / 100 / 12
  const monthlyDrawGrowth = drawdownGrowthRate / 100 / 12

  const rows: ProjectionRow[] = []
  const now = new Date()
  const cursor = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(endYear, 11, 1)
  let balance = currentBalance
  let fiReached = false
  let expense = 0
  const fiYear = fiDate.getFullYear()
  let lastExpenseYear = fiYear

  while (cursor <= end && rows.length < 1200) {
    const label = cursor.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

    if (!fiReached) {
      const pastRetirement = retirementDate && cursor >= retirementDate
      const growth = pastRetirement ? monthlyDrawGrowth : monthlyAccGrowth
      const annualRate = pastRetirement ? drawdownGrowthRate : accumulationGrowthRate

      if (cursor >= fiDate) {
        fiReached = true
        balance = balance * (1 + growth) + monthlyContribution
        if (corpusCapAtFI && balance > corpusCapAtFI) balance = corpusCapAtFI
        rows.push({ month: label, expense: 0, remaining: balance, phase: 'accumulation', growthRate: annualRate })
        // Initial expense: monthlyExpenseAtFI is already for the FI year
        expense = initialWithdrawal || monthlyExpenseAtFI
        lastExpenseYear = fiYear
      } else {
        rows.push({ month: label, expense: 0, remaining: balance, phase: 'accumulation', growthRate: annualRate })
        balance = balance * (1 + growth) + monthlyContribution
        if (corpusCapAtFI && balance > corpusCapAtFI) balance = corpusCapAtFI
      }
    } else {
      // Annual inflation: expense steps up at year boundary
      const curYear = cursor.getFullYear()
      if (curYear > lastExpenseYear) {
        const yearsFromFI = curYear - fiYear
        expense = (initialWithdrawal || monthlyExpenseAtFI) * Math.pow(1 + inflationRate / 100, yearsFromFI)
        lastExpenseYear = curYear
      }

      const pastRetirement = retirementDate && cursor >= retirementDate
      const drawRate = pastRetirement ? monthlyDrawGrowth : monthlyAccGrowth
      const annualRate = pastRetirement ? drawdownGrowthRate : accumulationGrowthRate
      rows.push({ month: label, expense, remaining: balance, phase: 'drawdown', growthRate: annualRate })
      balance = balance * (1 + drawRate) - expense
    }

    cursor.setMonth(cursor.getMonth() + 1)
  }

  const lastRow = rows[rows.length - 1]
  const firstNeg = rows.find(r => r.remaining < 0)
  console.log(
    '[BUILD-LIFECYCLE] total rows:',
    rows.length,
    'last row:',
    lastRow?.month,
    lastRow?.remaining.toFixed(0),
    'first negative:',
    firstNeg?.month,
    firstNeg?.remaining.toFixed(0),
  )

  return rows
}

// Original planned drawdown — unchanged from before today's rewrite
// Planned: accumulate from today to retirement at planned age, then drawdown with SWR
function buildPlannedProjection(
  goal: FinancialGoal,
  profileBirthday: string,
  currentBalance: number,
  monthlyContribution: number,
): ProjectionRow[] {
  const birthday = profileBirthday || goal.birthday
  if (!birthday || !goal.goalEndYear) return []

  const accGrowth = 8
  const drawGrowth = goal.growth || 6
  const inflation = goal.inflationRate || 3
  const endYear = new Date(goal.goalEndYear).getFullYear()

  const [by, bm] = birthday.split('-').map(Number)
  const retirementDate = new Date(by + goal.retirementAge, bm - 1, 1)

  const endOfLife = new Date(endYear, 11, 1)
  // monthlyExpense2047 IS the expense at retirement year — use directly
  const monthlyExpenseAtFI = goal.monthlyExpense2047

  // Compute corpus needed at retirement to deplete to $0 at death
  console.log(
    '[PLANNED] monthlyExpenseAtFI:',
    monthlyExpenseAtFI,
    'retirementDate:',
    retirementDate.toISOString(),
    'endOfLife:',
    endOfLife.toISOString(),
  )
  const corpusCap = computeRequiredCorpus(
    retirementDate,
    endOfLife,
    retirementDate,
    monthlyExpenseAtFI,
    inflation,
    accGrowth,
    drawGrowth,
  )
  console.log('[PLANNED] corpusCap:', corpusCap)

  // PMT: required monthly contribution to reach corpusCap by retirement
  const now = new Date()
  const monthsToRetirement =
    (retirementDate.getFullYear() - now.getFullYear()) * 12 + (retirementDate.getMonth() - now.getMonth())
  const r = accGrowth / 100 / 12
  const fvOfCurrent = currentBalance * Math.pow(1 + r, monthsToRetirement)
  const needed = corpusCap - fvOfCurrent
  const plannedContribution = needed > 0 ? (needed * r) / (Math.pow(1 + r, monthsToRetirement) - 1) : 0
  console.log('[PLANNED] plannedContribution:', plannedContribution, 'monthsToRetirement:', monthsToRetirement)

  return buildLifecycle(
    currentBalance,
    plannedContribution,
    accGrowth,
    drawGrowth,
    inflation,
    monthlyExpenseAtFI,
    endYear,
    retirementDate,
    retirementDate,
    corpusCap,
  )
}

// Projected lifecycle — new depletion-to-zero model with accumulation + drawdown
function buildProjectedLifecycle(
  goal: FinancialGoal,
  profileBirthday: string,
  currentBalance: number,
  monthlyContribution: number,
): ProjectionRow[] {
  const birthday = profileBirthday || goal.birthday
  if (!birthday || !goal.goalEndYear) return []

  const accGrowth = 8
  const drawGrowth = goal.growth || 6
  const inflation = goal.inflationRate || 3
  const endYear = new Date(goal.goalEndYear).getFullYear()

  const now = new Date()
  const [by, bm] = birthday.split('-').map(Number)
  const retirementDate = new Date(by + goal.retirementAge, bm - 1, 1)
  // Annual inflation: expense this year → expense at FI year
  const retirementYear = retirementDate.getFullYear()
  const nowYear = now.getFullYear()
  const monthlyExpenseThisYear = goal.monthlyExpense2047 / Math.pow(1 + inflation / 100, retirementYear - nowYear)

  const endOfLife = new Date(endYear, 11, 1)
  const fiResult = projectFIDateWithDrawdown(
    currentBalance,
    monthlyContribution * 12,
    accGrowth,
    drawGrowth,
    monthlyExpenseThisYear,
    inflation,
    endOfLife,
    retirementDate,
  )
  const fiDate = fiResult ? fiResult.date : endOfLife
  const corpusCap = fiResult?.requiredCorpus

  // Expense at the FI year
  const fiYear = fiDate.getFullYear()
  const monthlyExpenseAtFI = monthlyExpenseThisYear * Math.pow(1 + inflation / 100, fiYear - nowYear)

  return buildLifecycle(
    currentBalance,
    monthlyContribution,
    accGrowth,
    drawGrowth,
    inflation,
    monthlyExpenseAtFI,
    endYear,
    fiDate,
    retirementDate,
    corpusCap,
  )
}

type ViewInterval = 'monthly' | 'yearly' | '5year' | '10year'
type ViewMode = 'chart' | 'table'

const INTERVAL_LABELS: { value: ViewInterval; label: string; months: number }[] = [
  { value: 'monthly', label: 'Monthly', months: 1 },
  { value: 'yearly', label: 'Yearly', months: 12 },
  { value: '5year', label: 'Every 5 Yrs', months: 60 },
  { value: '10year', label: 'Every 10 Yrs', months: 120 },
]

interface CustomTooltipProps {
  active?: boolean
  payload?: { value: number; payload: ProjectionRow }[]
  label?: string
}

const CustomTooltip: FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const { expense, remaining } = payload[0].payload
  return (
    <div className="projection-tooltip">
      <div className="projection-tooltip-month">{label}</div>
      <div className="projection-tooltip-row">
        <span>Expense</span>
        <span>{dollars(expense)}</span>
      </div>
      <div className={`projection-tooltip-row${remaining < 0 ? ' negative' : ''}`}>
        <span>Remaining</span>
        <span>{dollars(remaining)}</span>
      </div>
    </div>
  )
}

const GoalDiveDeep: FC<GoalDiveDeepProps> = ({
  goal,
  profileBirthday,
  currentBalance = 0,
  monthlyContribution = 0,
  currentMonth,
}) => {
  const [interval, setInterval] = useState<ViewInterval>('yearly')
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set())
  const [scenario, setScenario] = useState<DataMode>('projected')

  // Compute planned monthly contribution (required to hit FI by retirement date)
  // Uses same 8% accumulation growth as savings plan and summary card
  const plannedMonthly = useMemo(() => {
    const birthday = profileBirthday || goal.birthday
    if (!birthday) return 0
    const [by, bm] = birthday.split('-').map(Number)
    const retYear = by + goal.retirementAge
    const retMonth = `${retYear}-${String(bm).padStart(2, '0')}`
    // Use currentMonth string (same reference as summary card) or fall back to today
    let months: number
    if (currentMonth) {
      const [fy, fm] = currentMonth.split('-').map(Number)
      const [ty, tm] = retMonth.split('-').map(Number)
      months = (ty - fy) * 12 + (tm - fm)
    } else {
      const now = new Date()
      const retDate = new Date(retYear, bm - 1, 1)
      months = (retDate.getFullYear() - now.getFullYear()) * 12 + (retDate.getMonth() - now.getMonth())
    }
    if (months <= 0) return 0
    const accRate = 8 // same as accumulation growth
    const r = accRate / 100 / 12
    const factor = Math.pow(1 + r, months)
    const needed = goal.fiGoal - currentBalance * factor
    if (needed <= 0) return 0
    return (needed * r) / (factor - 1)
  }, [goal, profileBirthday, currentBalance, currentMonth])

  const projection = useMemo(
    () =>
      scenario === 'planned'
        ? buildPlannedProjection(goal, profileBirthday, currentBalance, monthlyContribution)
        : buildProjectedLifecycle(goal, profileBirthday, currentBalance, monthlyContribution),
    [goal, profileBirthday, currentBalance, monthlyContribution, scenario],
  )

  const intervalMonths = INTERVAL_LABELS.find(i => i.value === interval)!.months
  const filteredRows = useMemo(() => {
    if (projection.length === 0) return []
    if (intervalMonths === 1) return projection
    const result: ProjectionRow[] = []
    for (let i = 0; i < projection.length; i += intervalMonths) {
      const bucketEnd = Math.min(i + intervalMonths, projection.length)
      const endRow = projection[bucketEnd - 1]
      let bucketExpense = 0
      for (let j = i; j < bucketEnd; j++) {
        bucketExpense += projection[j].expense
      }
      result.push({ ...endRow, expense: bucketExpense })
    }
    return result
  }, [projection, intervalMonths])

  // Group rows by year for monthly collapse view
  const groupedByYear = useMemo(() => {
    if (interval !== 'monthly') return null
    const groups = new Map<string, ProjectionRow[]>()
    filteredRows.forEach(row => {
      const year = row.month.split(' ')[1] // Extract year from "MMM YYYY"
      if (!groups.has(year)) groups.set(year, [])
      groups.get(year)!.push(row)
    })
    return groups
  }, [filteredRows, interval])

  const toggleYearExpand = (year: string) => {
    setExpandedYears(prev => {
      const next = new Set(prev)
      if (next.has(year)) next.delete(year)
      else next.add(year)
      return next
    })
  }

  const allYears = groupedByYear ? Array.from(groupedByYear.keys()) : []
  const allExpanded = allYears.length > 0 && allYears.every(y => expandedYears.has(y))

  const toggleAll = () => {
    if (allExpanded) {
      setExpandedYears(new Set())
    } else {
      setExpandedYears(new Set(allYears))
    }
  }

  return (
    <div className="dive-deep-container">
      <h3 className="dive-deep-title">Analysis — {goal.goalName}</h3>

      <div className="dive-deep-section">
        <h4>Full Lifecycle — {scenario === 'projected' ? 'Projected' : 'Planned'}</h4>
        {projection.length === 0 ? (
          <p className="dive-deep-placeholder">No projection available — check retirement date and goal end year.</p>
        ) : (
          <>
            <div className="projection-controls">
              <div className="projection-scenario-toggle">
                <button
                  className={`projection-interval-btn${scenario === 'projected' ? ' active' : ''}`}
                  onClick={() => setScenario('projected')}
                >
                  Projected ({dollars(monthlyContribution)}/mo)
                </button>
                <button
                  className={`projection-interval-btn${scenario === 'planned' ? ' active' : ''}`}
                  onClick={() => setScenario('planned')}
                >
                  Planned ({dollars(plannedMonthly)}/mo)
                </button>
              </div>
              <div className="projection-interval-toggle">
                {INTERVAL_LABELS.map(opt => (
                  <button
                    key={opt.value}
                    className={`projection-interval-btn${interval === opt.value ? ' active' : ''}`}
                    onClick={() => setInterval(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <button
                className="projection-view-toggle"
                onClick={() => setViewMode(v => (v === 'chart' ? 'table' : 'chart'))}
              >
                {viewMode === 'chart' ? 'View Table' : 'View Chart'}
              </button>
            </div>

            {viewMode === 'chart' ? (
              <div className="projection-chart-wrapper">
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={filteredRows} margin={{ top: 8, right: 24, left: 16, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--projection-grid, #e5e7eb)" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11 }}
                      interval="preserveStartEnd"
                      stroke="var(--projection-axis)"
                    />
                    <YAxis
                      tickFormatter={v => {
                        if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
                        if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
                        return `$${v}`
                      }}
                      tick={{ fontSize: 11 }}
                      stroke="var(--projection-axis)"
                      width={72}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={0} stroke="var(--color-text-muted)" strokeDasharray="4 2" strokeWidth={1} />
                    <Line
                      type="monotone"
                      dataKey="remaining"
                      stroke="var(--accent-hover)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="projection-table-wrapper">
                <table className="projection-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Phase</th>
                      <th>
                        {interval === 'monthly'
                          ? 'Monthly Expense'
                          : interval === 'yearly'
                            ? 'Yearly Expense'
                            : interval === '5year'
                              ? '5-Year Expense'
                              : '10-Year Expense'}
                      </th>
                      <th>Portfolio Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {interval === 'monthly' && groupedByYear && (
                      <tr className="projection-expand-all-row">
                        <td colSpan={4}>
                          <button className="projection-expand-all-btn" onClick={toggleAll}>
                            {allExpanded ? 'Collapse All' : 'Expand All'}
                          </button>
                        </td>
                      </tr>
                    )}
                    {interval === 'monthly' && groupedByYear
                      ? Array.from(groupedByYear.entries()).flatMap(([year, rows], yearIdx, yearEntries) => {
                          const prevYearRows = yearIdx > 0 ? yearEntries[yearIdx - 1][1] : null
                          const lastRowOfPrevYear = prevYearRows ? prevYearRows[prevYearRows.length - 1] : null
                          return [
                            <tr key={`year-${year}`} className="projection-year-header">
                              <td colSpan={4}>
                                <button
                                  className="projection-year-toggle"
                                  onClick={() => toggleYearExpand(year)}
                                  aria-expanded={expandedYears.has(year)}
                                >
                                  <svg
                                    className="projection-year-chevron"
                                    width="16"
                                    height="16"
                                    viewBox="0 0 16 16"
                                    fill="currentColor"
                                  >
                                    {expandedYears.has(year) ? (
                                      <path
                                        d="M3.5 10.5L8 6l4.5 4.5"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    ) : (
                                      <path
                                        d="M12.5 5.5L8 10l-4.5-4.5"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    )}
                                  </svg>
                                  {year}
                                </button>
                              </td>
                            </tr>,
                            ...(expandedYears.has(year)
                              ? rows.flatMap((row, idx) => {
                                  const elements = []
                                  const prev = idx > 0 ? rows[idx - 1] : lastRowOfPrevYear
                                  if (
                                    prev &&
                                    prev.growthRate !== undefined &&
                                    row.growthRate !== undefined &&
                                    prev.growthRate !== row.growthRate
                                  ) {
                                    elements.push(
                                      <tr key={`rate-shift-${row.month}`} className="projection-rate-shift-row">
                                        <td colSpan={4}>
                                          <span className="projection-rate-shift-label">
                                            Growth rate: {prev.growthRate}% → {row.growthRate}%
                                          </span>
                                        </td>
                                      </tr>,
                                    )
                                  }
                                  elements.push(
                                    <tr key={row.month} className={row.remaining < 0 ? 'projection-row--negative' : ''}>
                                      <td>{row.month}</td>
                                      <td className={`phase-badge phase-badge--${row.phase}`}>
                                        {row.phase === 'accumulation' ? 'Saving' : 'Spending'}
                                      </td>
                                      <td>{row.phase === 'drawdown' ? dollars(row.expense) : '—'}</td>
                                      <td>{dollars(row.remaining)}</td>
                                    </tr>,
                                  )
                                  return elements
                                })
                              : []),
                          ]
                        })
                      : filteredRows.flatMap((row, idx) => {
                          const elements = []
                          const prev = idx > 0 ? filteredRows[idx - 1] : null
                          if (
                            prev &&
                            prev.growthRate !== undefined &&
                            row.growthRate !== undefined &&
                            prev.growthRate !== row.growthRate
                          ) {
                            elements.push(
                              <tr key={`rate-shift-${row.month}`} className="projection-rate-shift-row">
                                <td colSpan={4}>
                                  <span className="projection-rate-shift-label">
                                    Growth rate: {prev.growthRate}% → {row.growthRate}%
                                  </span>
                                </td>
                              </tr>,
                            )
                          }
                          elements.push(
                            <tr key={row.month} className={row.remaining < 0 ? 'projection-row--negative' : ''}>
                              <td>{row.month}</td>
                              <td className={`phase-badge phase-badge--${row.phase}`}>
                                {row.phase === 'accumulation' ? 'Saving' : 'Spending'}
                              </td>
                              <td>{row.phase === 'drawdown' ? dollars(row.expense) : '—'}</td>
                              <td>{dollars(row.remaining)}</td>
                            </tr>,
                          )
                          return elements
                        })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default GoalDiveDeep
