import { FC, useMemo, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine
} from 'recharts'
import { FinancialPlan } from '../../../types'
import './PlanDiveDeep.css'

interface PlanDiveDeepProps {
  plan: FinancialPlan
  profileBirthday: string
}

interface ProjectionRow {
  month: string   // "MMM YYYY"
  expense: number
  remaining: number
}

const dollars = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

function buildProjection(plan: FinancialPlan, profileBirthday: string): ProjectionRow[] {
  const birthday = profileBirthday || plan.birthday
  if (!birthday || !plan.planEndYear) return []

  const [by, bm, bd] = birthday.split('-').map(Number)
  const retirementDate = new Date(by + plan.retirementAge, bm - 1, bd)
  const endDate = new Date(plan.planEndYear)

  if (retirementDate >= endDate) return []

  const monthlyInflation = (plan.inflationRate || 0) / 100 / 12
  const monthlyGrowth = (plan.growth || 0) / 100 / 12

  const rows: ProjectionRow[] = []
  let expense = plan.monthlyExpense2047
  let remaining = plan.fiGoal
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

const PlanDiveDeep: FC<PlanDiveDeepProps> = ({ plan, profileBirthday }) => {
  const [interval, setInterval] = useState<ViewInterval>('yearly')
  const [viewMode, setViewMode] = useState<ViewMode>('chart')
  const projection = useMemo(() => buildProjection(plan, profileBirthday), [plan, profileBirthday])

  const intervalMonths = INTERVAL_LABELS.find(i => i.value === interval)!.months
  const filteredRows = useMemo(() => {
    if (projection.length === 0) return []
    const last = projection.length - 1
    return projection.filter((_, idx) => idx === 0 || idx === last || idx % intervalMonths === 0)
  }, [projection, intervalMonths])

  return (
    <div className="dive-deep-container">
      <h3 className="dive-deep-title">Deep Analysis — {plan.planName}</h3>

      <div className="dive-deep-section">
        <h4>Year-by-Year Projection</h4>
        {projection.length === 0 ? (
          <p className="dive-deep-placeholder">No projection available — check retirement date and plan end year.</p>
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
                      stroke="var(--projection-axis, #9ca3af)"
                    />
                    <YAxis
                      tickFormatter={v => {
                        if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
                        if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
                        return `$${v}`
                      }}
                      tick={{ fontSize: 11 }}
                      stroke="var(--projection-axis, #9ca3af)"
                      width={72}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="4 2" strokeWidth={1} />
                    <Line
                      type="monotone"
                      dataKey="remaining"
                      stroke="#2563eb"
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
                    {filteredRows.map(row => (
                      <tr key={row.month} className={row.remaining < 0 ? 'projection-row--negative' : ''}>
                        <td>{row.month}</td>
                        <td>{dollars(row.expense)}</td>
                        <td>{dollars(row.remaining)}</td>
                      </tr>
                    ))}
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

export default PlanDiveDeep
