import { FC, useMemo, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine
} from 'recharts'
import { FinancialGoal } from '../../../types'
import '../../../styles/GoalDiveDeep.css'

interface GoalDiveDeepProps {
  goal: FinancialGoal
  profileBirthday: string
}

interface ProjectionRow {
  month: string   // "MMM YYYY"
  expense: number
  remaining: number
}

const dollars = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

function buildProjection(goal: FinancialGoal, profileBirthday: string): ProjectionRow[] {
  const birthday = profileBirthday || goal.birthday
  if (!birthday || !goal.goalEndYear) return []

  const [by, bm, bd] = birthday.split('-').map(Number)
  const retirementDate = new Date(by + goal.retirementAge, bm - 1, bd)
  const endDate = new Date(goal.goalEndYear)

  if (retirementDate >= endDate) return []

  const monthlyInflation = (goal.inflationRate || 0) / 100 / 12
  const monthlyGrowth = (goal.growth || 0) / 100 / 12

  const rows: ProjectionRow[] = []
  let expense = goal.monthlyExpense2047
  let remaining = goal.fiGoal
  const cursor = new Date(retirementDate.getFullYear(), retirementDate.getMonth(), 1)
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1)

  while (cursor <= end) {
    const label = cursor.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    rows.push({ month: label, expense, remaining })
    // next month
    remaining = remaining * (1 + monthlyGrowth) - expense
    expense = expense * (1 + monthlyInflation)
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return rows
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
        <span>Monthly Expense</span>
        <span>{dollars(expense)}</span>
      </div>
      <div className={`projection-tooltip-row${remaining < 0 ? ' negative' : ''}`}>
        <span>Remaining</span>
        <span>{dollars(remaining)}</span>
      </div>
    </div>
  )
}

const GoalDiveDeep: FC<GoalDiveDeepProps> = ({ goal, profileBirthday }) => {
  const [interval, setInterval] = useState<ViewInterval>('yearly')
  const [viewMode, setViewMode] = useState<ViewMode>('chart')
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set())
  const projection = useMemo(() => buildProjection(goal, profileBirthday), [goal, profileBirthday])

  const intervalMonths = INTERVAL_LABELS.find(i => i.value === interval)!.months
  const filteredRows = useMemo(() => {
    if (projection.length === 0) return []
    const last = projection.length - 1
    return projection.filter((_, idx) => idx === 0 || idx === last || idx % intervalMonths === 0)
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

  return (
    <div className="dive-deep-container">
      <h3 className="dive-deep-title">Deep Analysis — {goal.goalName}</h3>

      <div className="dive-deep-section">
        <h4>Year-by-Year Projection</h4>
        {projection.length === 0 ? (
          <p className="dive-deep-placeholder">No projection available — check retirement date and goal end year.</p>
        ) : (
          <>
            <div className="projection-controls">
              <div className="projection-interval-toggle">
                {INTERVAL_LABELS.map(opt => (
                  <button
                    key={opt.value}
                    className={`projection-interval-btn${interval === opt.value ? ' active' : ''}`}
                    onClick={() => setInterval(opt.value)}
                  >{opt.label}</button>
                ))}
              </div>
              <button
                className="projection-view-toggle"
                onClick={() => setViewMode(v => v === 'chart' ? 'table' : 'chart')}
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
                      <th>Est. Monthly Expense</th>
                      <th>Est. Remaining Money</th>
                    </tr>
                  </thead>
                  <tbody>
                    {interval === 'monthly' && groupedByYear
                      ? Array.from(groupedByYear.entries()).flatMap(([year, rows]) => [
                        <tr key={`year-${year}`} className="projection-year-header">
                          <td colSpan={3}>
                            <button
                              className="projection-year-toggle"
                              onClick={() => toggleYearExpand(year)}
                              aria-expanded={expandedYears.has(year)}
                            >
                              <svg className="projection-year-chevron" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                {expandedYears.has(year) ? (
                                  <path d="M3.5 10.5L8 6l4.5 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                ) : (
                                  <path d="M12.5 5.5L8 10l-4.5-4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                )}
                              </svg>
                              {year}
                            </button>
                          </td>
                        </tr>,
                        ...(expandedYears.has(year) ? rows.map(row => (
                          <tr key={row.month} className={row.remaining < 0 ? 'projection-row--negative' : ''}>
                            <td>{row.month}</td>
                            <td>{dollars(row.expense)}</td>
                            <td>{dollars(row.remaining)}</td>
                          </tr>
                        )) : []),
                      ])
                      : filteredRows.map(row => (
                        <tr key={row.month} className={row.remaining < 0 ? 'projection-row--negative' : ''}>
                          <td>{row.month}</td>
                          <td>{dollars(row.expense)}</td>
                          <td>{dollars(row.remaining)}</td>
                        </tr>
                      ))
                    }
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
