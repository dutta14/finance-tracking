import { FC, useMemo } from 'react'
import { FinancialGoal, GwGoal } from '../../../types'
import { getLatestGoalTotals } from '../../data/types'
import '../../../styles/GoalCompareView.css'

const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent)
const modKey = isMac ? '⌘' : 'Ctrl'

interface GoalCompareViewProps {
  goals: FinancialGoal[]
  gwGoals: GwGoal[]
  profileBirthday: string
}

const parseDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-')
  return new Date(Number(year), Number(month) - 1, Number(day))
}

const formatMonthYear = (dateString: string): string => {
  if (!dateString) return '—'
  return parseDate(dateString).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

const dollars = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

const computeGwPv = (gw: GwGoal, goal: FinancialGoal, profileBirthday: string): number => {
  if (!profileBirthday) return gw.disburseAmount
  const [birthYear, birthMonth] = profileBirthday.split('-').map(Number)
  const created = new Date(goal.goalCreatedIn)
  const disburseYear = birthYear + gw.disburseAge
  const monthsToDisburse = Math.max(
    0,
    (disburseYear - created.getFullYear()) * 12 + (birthMonth - (created.getMonth() + 1)),
  )
  const disbursementTarget = gw.disburseAmount * Math.pow(1 + goal.inflationRate / 100 / 12, monthsToDisburse)
  const monthsRetToDisburse = Math.max(0, (gw.disburseAge - goal.retirementAge) * 12)
  return monthsRetToDisburse > 0
    ? disbursementTarget / Math.pow(1 + gw.growthRate / 100 / 12, monthsRetToDisburse)
    : disbursementTarget
}

interface FiRow {
  label: string
  render: (goal: FinancialGoal) => string
}

const FI_ROWS: FiRow[] = [
  { label: 'Goal Created', render: p => formatMonthYear(p.goalCreatedIn) },
  { label: 'Goal End Year', render: p => (p.goalEndYear ? String(new Date(p.goalEndYear).getFullYear()) : '—') },
  { label: 'Retirement Age', render: p => String(p.retirementAge) },
  { label: 'Retirement Date', render: p => p.retirement },
  { label: 'Inflation Rate', render: p => `${p.inflationRate}%` },
  { label: 'Safe Withdrawal Rate', render: p => `${p.safeWithdrawalRate}%` },
  { label: 'Growth Rate', render: p => `${p.growth}%` },
  { label: 'Annual Expense (at creation)', render: p => dollars(p.expenseValue) },
  { label: 'Annual Expense (at retirement)', render: p => dollars(p.expenseValue2047) },
  { label: 'FI Goal', render: p => dollars(p.fiGoal) },
]

const GoalCompareView: FC<GoalCompareViewProps> = ({ goals, gwGoals, profileBirthday }) => {
  const colCount = goals.length + 1
  const { fiTotal } = useMemo(() => getLatestGoalTotals(), [])

  const fiRows: FiRow[] = useMemo(
    () => [
      ...FI_ROWS,
      {
        label: 'Progress',
        render: p => {
          if (p.fiGoal <= 0) return '0.0%'
          return `${Math.min(100, Math.max(0, (fiTotal / p.fiGoal) * 100)).toFixed(1)}%`
        },
      },
    ],
    [fiTotal],
  )

  const gwByGoal = goals.map(goal => gwGoals.filter(g => g.fiGoalId === goal.id))

  const allLabels: string[] = []
  gwByGoal.forEach(goals =>
    goals.forEach(g => {
      if (!allLabels.includes(g.label)) allLabels.push(g.label)
    }),
  )

  const gwPvMaps = goals.map((goal, i) => {
    const map: Record<string, number> = {}
    gwByGoal[i].forEach(g => {
      map[g.label] = computeGwPv(g, goal, profileBirthday)
    })
    return map
  })

  const gwTotals = goals.map((_, i) => Object.values(gwPvMaps[i]).reduce((a, v) => a + v, 0))
  const hasAnyGw = gwByGoal.some(goals => goals.length > 0)

  return (
    <div className="compare-view">
      <p className="compare-hint">
        Comparing {goals.length} goals — {modKey}+Click a card to add or remove it
      </p>
      <div className="compare-table-wrapper">
        <table className="compare-table" aria-label={`Comparison of ${goals.length} goals`}>
          <thead>
            <tr>
              <th className="compare-label-col" scope="col">
                <span className="sr-only">Metric</span>
              </th>
              {goals.map(goal => (
                <th key={goal.id} className="compare-goal-col" scope="col">
                  {goal.goalName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="compare-section-header">
              <th colSpan={colCount} scope="colgroup">
                Financial Independence
              </th>
            </tr>
            {fiRows.map(row => (
              <tr key={row.label}>
                <th className="compare-row-label" scope="row">
                  {row.label}
                </th>
                {goals.map(goal => (
                  <td key={goal.id} className="compare-row-value">
                    {row.render(goal)}
                  </td>
                ))}
              </tr>
            ))}
            {hasAnyGw && (
              <>
                <tr className="compare-section-header compare-section-header--gw">
                  <th colSpan={colCount} scope="colgroup">
                    Generational Wealth
                  </th>
                </tr>
                <tr>
                  <th className="compare-row-label" scope="row">
                    # of Goals
                  </th>
                  {goals.map((goal, i) => (
                    <td key={goal.id} className="compare-row-value">
                      {gwByGoal[i].length > 0 ? gwByGoal[i].length : '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th className="compare-row-label" scope="row">
                    Total PV at Retirement
                  </th>
                  {goals.map((_, i) => (
                    <td key={goals[i].id} className="compare-row-value">
                      {gwTotals[i] > 0 ? dollars(gwTotals[i]) : '—'}
                    </td>
                  ))}
                </tr>
                {allLabels.map(label => (
                  <tr key={label}>
                    <th className="compare-row-label compare-row-label--indent" scope="row">
                      {label}
                    </th>
                    {goals.map((goal, i) => (
                      <td key={goal.id} className="compare-row-value">
                        {gwPvMaps[i][label] != null ? dollars(gwPvMaps[i][label]) : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default GoalCompareView
