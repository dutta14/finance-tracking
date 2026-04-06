import { FC } from 'react'
import { FinancialPlan, GwPlan } from '../../../types'
import './PlanCompareView.css'

interface PlanCompareViewProps {
  plans: FinancialPlan[]
  gwPlans: GwPlan[]
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

const computeGwPv = (gw: GwPlan, plan: FinancialPlan, profileBirthday: string): number => {
  if (!profileBirthday) return gw.disburseAmount
  const [birthYear, birthMonth] = profileBirthday.split('-').map(Number)
  const created = new Date(plan.planCreatedIn)
  const disburseYear = birthYear + gw.disburseAge
  const monthsToDisburse = Math.max(
    0,
    (disburseYear - created.getFullYear()) * 12 + (birthMonth - (created.getMonth() + 1))
  )
  const disbursementTarget = gw.disburseAmount * Math.pow(1 + plan.inflationRate / 100 / 12, monthsToDisburse)
  const monthsRetToDisburse = Math.max(0, (gw.disburseAge - plan.retirementAge) * 12)
  return monthsRetToDisburse > 0
    ? disbursementTarget / Math.pow(1 + gw.growthRate / 100 / 12, monthsRetToDisburse)
    : disbursementTarget
}

interface FiRow {
  label: string
  render: (plan: FinancialPlan) => string
}

const FI_ROWS: FiRow[] = [
  { label: 'Plan Created',                   render: p => formatMonthYear(p.planCreatedIn) },
  { label: 'Plan End Year',                  render: p => p.planEndYear ? String(new Date(p.planEndYear).getFullYear()) : '—' },
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

const PlanCompareView: FC<PlanCompareViewProps> = ({ plans, gwPlans, profileBirthday }) => {
  const colCount = plans.length + 1

  const gwByPlan = plans.map(plan => gwPlans.filter(g => g.fiPlanId === plan.id))

  const allLabels: string[] = []
  gwByPlan.forEach(goals => goals.forEach(g => {
    if (!allLabels.includes(g.label)) allLabels.push(g.label)
  }))

  const gwPvMaps = plans.map((plan, i) => {
    const map: Record<string, number> = {}
    gwByPlan[i].forEach(g => { map[g.label] = computeGwPv(g, plan, profileBirthday) })
    return map
  })

  const gwTotals = plans.map((_, i) => Object.values(gwPvMaps[i]).reduce((a, v) => a + v, 0))
  const hasAnyGw = gwByPlan.some(goals => goals.length > 0)

  return (
    <div className="compare-view">
      <div className="compare-hint">Comparing {plans.length} plans — Cmd+Click a card to add or remove it</div>
      <div className="compare-table-wrapper">
        <table className="compare-table">
          <thead>
            <tr>
              <th className="compare-label-col"></th>
              {plans.map(plan => (
                <th key={plan.id} className="compare-plan-col">{plan.planName}</th>
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
                {plans.map(plan => (
                  <td key={plan.id} className="compare-row-value">{row.render(plan)}</td>
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
                  {plans.map((plan, i) => (
                    <td key={plan.id} className="compare-row-value">{gwByPlan[i].length > 0 ? gwByPlan[i].length : '—'}</td>
                  ))}
                </tr>
                <tr>
                  <td className="compare-row-label">Total PV at Retirement</td>
                  {plans.map((_, i) => (
                    <td key={plans[i].id} className="compare-row-value">{gwTotals[i] > 0 ? dollars(gwTotals[i]) : '—'}</td>
                  ))}
                </tr>
                {allLabels.map(label => (
                  <tr key={label}>
                    <td className="compare-row-label compare-row-label--indent">{label}</td>
                    {plans.map((plan, i) => (
                      <td key={plan.id} className="compare-row-value">
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

export default PlanCompareView
