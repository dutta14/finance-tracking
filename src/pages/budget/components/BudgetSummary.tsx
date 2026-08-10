import { FC } from 'react'

interface BudgetSummaryProps {
  totalIncome: number
  totalExpense: number
  saveRate: number
  year: number
}

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })

const BudgetSummary: FC<BudgetSummaryProps> = ({ totalIncome, totalExpense, saveRate }) => {
  const hasData = totalIncome > 0 || totalExpense > 0
  const netIncome = totalIncome - totalExpense
  return (
    <div className="budget-summary">
      <div className="budget-summary-card budget-summary-card--income">
        <span className="budget-summary-value">{hasData ? fmt(totalIncome) : '—'}</span>
        <span className="budget-summary-label">TOTAL INCOME</span>
      </div>
      <div className="budget-summary-card budget-summary-card--expense">
        <span className="budget-summary-value">{hasData ? fmt(totalExpense) : '—'}</span>
        <span className="budget-summary-label">TOTAL EXPENSES</span>
      </div>
      <div className="budget-summary-card budget-summary-card--net">
        <span className="budget-summary-value">{hasData ? fmt(netIncome) : '—'}</span>
        <span className="budget-summary-label">TOTAL NET INCOME</span>
      </div>
      <div className="budget-summary-card budget-summary-card--save">
        <span className="budget-summary-value">{hasData ? `${(saveRate * 100).toFixed(1)}%` : '—'}</span>
        <span className="budget-summary-label">SAVINGS RATE</span>
      </div>
    </div>
  )
}

export default BudgetSummary
