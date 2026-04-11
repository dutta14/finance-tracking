import { FC } from 'react'
import { FinancialGoal, GwGoal } from '../../../types'
import './GoalCompareView.css'

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

const dollars = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

const computeGwPv = (gw: GwGoal, goal: FinancialGoal, profileBirthday: string): number => {
  if (!profileBirthday) return gw.disburseAmount
  const [birthYear, birthMonth] = profileBirthday.split('-').map(Number)
  const created = new Date(goal.goalCreatedIn)
  const disburseYear = birthYear + gw.disburseAge
  const monthsToDisburse = Math.max(
    0,
    (disburseYear - created.getFullYear()) * 12 + (birthMonth - (created.getMonth() + 1))
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
  { label: 'Goal Created',                   render: p => formatMonthYear(p.goalCreatedIn) },
  { label: 'Goal End Year',                  render: p => p.goalEndYear ? String(new Date(p.goalEndYear).getFullYear()) : '—' },
  { label: 'Retirement Age',                 render: p => String(p.retirementAge) },
  { label: 'Retirement Date',                render: p => p.retirement },
  { label: 'Inflation Rate',                 render: p => `${p.inflationRate}%` },
  { label: 'Safe Withdrawal Rate',           render: p => `${p.safeWithdrawalRate}%` },
  { label: 'Growth Rate',                    render: p => `${p.growth}%` },
  { label: 'Annual Expense (at creation)',   render: p => dollars(p.expenseValue) },
  { label: 'Annual Expense (at retirement)', render: p => dollars(p.expenseValue2047) },
  { label: 'FI Goal',                        render: p => dollars(p.fiGoal) },
  { label: 'Progress',                       render: p => `${p.progress.toFixed(1)}%` },
]

const GoalCompareView: FC<GoalCompareViewProps> = ({ goals, gwGoals, profileBirthday }) => {
  const colCount = goals.length + 1

  const gwByGoal = goals.map(goal => gwGoals.filter(g => g.fiGoalId === goal.id))

  const allLabels: string[] = []
  gwByGoal.forEach(goals => goals.forEach(g => {
    if (!allLabels.includes(g.label)) allLabels.push(g.label)
  }))

  const gwPvMaps = goals.map((goal, i) => {
    const map: Record<string, number> = {}
    gwByGoal[i].forEach(g => { map[g.label] = computeGwPv(g, goal, profileBirthday) })
    return map
  })

  const gwTotals = goals.map((_, i) => Object.values(gwPvMaps[i]).reduce((a, v) => a + v, 0))
  const hasAnyGw = gwByGoal.some(goals => goals.length > 0)

  return (
    <div className="compare-view">
      <div className="compare-hint">Comparing {goals.length} goals — Cmd+Click a card to add or remove it</div>
      <div className="compare-table-wrapper">
        <table className="compare-table">
          <thead>
            <tr>
              <th className="compare-label-col"></th>
              {goals.map(goal => (
                <th key={goal.id} className="compare-goal-col">{goal.goalName}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="compare-section-header">
              <td colSpan={colCount}>Financial Independence</td>
            </tr>
            {FI_ROWS.map(row => (
              <tr key={row.label}>
                <td className="compare-row-label">{row.label}</td>
                {goals.map(goal => (
                  <td key={goal.id} className="compare-row-value">{row.render(goal)}</td>
                ))}
              </tr>
            ))}
            {hasAnyGw && (
              <>
                <tr className="compare-section-header compare-section-header--gw">
                  <td colSpan={colCount}>Generational Wealth</td>
                </tr>
                <tr>
                  <td className="compare-row-label"># of Goals</td>
                  {goals.map((goal, i) => (
                    <td key={goal.id} className="compare-row-value">{gwByGoal[i].length > 0 ? gwByGoal[i].length : '—'}</td>
                  ))}
                </tr>
                <tr>
                  <td className="compare-row-label">Total PV at Retirement</td>
                  {goals.map((_, i) => (
                    <td key={goals[i].id} className="compare-row-value">{gwTotals[i] > 0 ? dollars(gwTotals[i]) : '—'}</td>
                  ))}
                </tr>
                {allLabels.map(label => (
                  <tr key={label}>
                    <td className="compare-row-label compare-row-label--indent">{label}</td>
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
