import { FC } from 'react'

interface BudgetSummaryProps {
  totalIncome: number
  totalExpense: number
  saveRate: number
  year: number
}

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })

const BudgetSummary: FC<BudgetSummaryProps> = ({ totalIncome, totalExpense, saveRate, year }) => {
  const hasData = totalIncome > 0 || totalExpense > 0
  return (
    <div className="budget-summary">
      <div className="budget-summary-card budget-summary-card--income">
        <span className="budget-summary-label">Total Income {year}</span>
        <span className="budget-summary-value">{hasData ? fmt(totalIncome) : '—'}</span>
      </div>
      <div className="budget-summary-card budget-summary-card--expense">
        <span className="budget-summary-label">Total Expenses {year}</span>
        <span className="budget-summary-value">{hasData ? fmt(totalExpense) : '—'}</span>
      </div>
      <div className="budget-summary-card budget-summary-card--save">
        <span className="budget-summary-label">Save Rate {year}</span>
        <span className="budget-summary-value">{hasData ? `${(saveRate * 100).toFixed(1)}%` : '—'}</span>
      </div>
    </div>
  )
}

export default BudgetSummary
