import { FC } from 'react'
import { FinancialPlan } from '../../../types'
import './PlanCompareView.css'

interface PlanCompareViewProps {
  plans: FinancialPlan[]
}

const parseDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-')
  return new Date(Number(year), Number(month) - 1, Number(day))
}

const formatMonthYear = (dateString: string): string => {
  if (!dateString) return '—'
  return parseDate(dateString).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

const fmt = (n: number, decimals = 2) => n.toLocaleString(undefined, { maximumFractionDigits: decimals })

interface Row {
  label: string
  render: (plan: FinancialPlan) => string
}

const ROWS: Row[] = [
  { label: 'Plan Name',             render: p => p.planName },
  { label: 'Plan Created',          render: p => formatMonthYear(p.planCreatedIn) },
  { label: 'Plan End Year',         render: p => p.planEndYear ? String(new Date(p.planEndYear).getFullYear()) : '—' },
  { label: 'Retirement Age',        render: p => String(p.retirementAge) },
  { label: 'Retirement Date',       render: p => p.retirement },
  { label: 'Inflation Rate',        render: p => `${p.inflationRate}%` },
  { label: 'Safe Withdrawal Rate',  render: p => `${p.safeWithdrawalRate}%` },
  { label: 'Growth Rate',           render: p => `${p.growth}%` },
  { label: 'Annual Expense (at creation)', render: p => `$${fmt(p.expenseValue)}` },
  { label: 'Monthly Expense (at creation)', render: p => `$${fmt(p.monthlyExpenseValue)}` },
  { label: 'Annual Expense (at retirement)', render: p => `$${fmt(p.expenseValue2047)}` },
  { label: 'Monthly Expense (at retirement)', render: p => `$${fmt(p.monthlyExpense2047)}` },
  { label: 'FI Goal',               render: p => `$${fmt(p.fiGoal, 0)}` },
  { label: 'Progress',              render: p => `${p.progress.toFixed(1)}%` },
]

const PlanCompareView: FC<PlanCompareViewProps> = ({ plans }) => {
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
            {ROWS.map(row => (
              <tr key={row.label}>
                <td className="compare-row-label">{row.label}</td>
                {plans.map(plan => (
                  <td key={plan.id} className="compare-row-value">{row.render(plan)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default PlanCompareView
