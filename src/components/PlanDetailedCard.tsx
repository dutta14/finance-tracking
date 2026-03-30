import { FC } from 'react'
import { FinancialPlan } from '../types'
import PlanCardActions from './PlanCardActions'
import '../styles/PlanDetailedCard.css'

interface PlanDetailedCardProps {
  plan: FinancialPlan
  onEdit: (plan: FinancialPlan) => void
  onCopy: (plan: FinancialPlan) => void
  onDelete: (planId: number) => void
}

// Helper functions
const parseDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-')
  return new Date(Number(year), Number(month) - 1, Number(day))
}

const formatMonthYear = (dateString: string): string => {
  const date = parseDate(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

const PlanDetailedCard: FC<PlanDetailedCardProps> = ({ plan, onEdit, onCopy, onDelete }) => {
  const createdMonthYear = formatMonthYear(plan.planCreatedIn)
  const birthDate = parseDate(plan.birthday)
  const retirementDate = new Date(birthDate.getFullYear() + plan.retirementAge, birthDate.getMonth(), birthDate.getDate())
  const retirementMonthYear = retirementDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

  return (
    <div className="plan-card">
      <div className="plan-card-header">
        <h3>{plan.planName}</h3>
        <PlanCardActions plan={plan} onEdit={onEdit} onCopy={onCopy} onDelete={onDelete} />
      </div>

      <div className="plan-card-details">
        <div className="detail-row">
          <span className="label">Birthday</span>
          <span className="value">{plan.birthday ? parseDate(plan.birthday).toLocaleDateString() : 'N/A'}</span>
        </div>
        <div className="detail-row">
          <span className="label">Plan Creation Date</span>
          <span className="value">{plan.planCreatedIn ? formatMonthYear(plan.planCreatedIn) : 'N/A'}</span>
        </div>
        <div className="detail-row">
          <span className="label">Retirement Age</span>
          <span className="value">{plan.retirementAge}</span>
        </div>
        <div className="detail-row">
          <span className="label">Retirement Date</span>
          <span className="value">{plan.retirement}</span>
        </div>
        <div className="detail-row">
          <span className="label">Inflation Rate</span>
          <span className="value">{plan.inflationRate}%</span>
        </div>
        <div className="detail-row">
          <span className="label">Safe Withdrawal Rate</span>
          <span className="value">{plan.safeWithdrawalRate}%</span>
        </div>
        <div className="detail-row">
          <span className="label">Growth</span>
          <span className="value">{plan.growth}%</span>
        </div>
      </div>

      <div className="plan-card-calculations">
        <h4>Expense Analysis</h4>
        <div className="detail-row">
          <span className="label">Expense ({createdMonthYear})</span>
          <span className="value">${plan.expenseValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
        </div>
        <div className="detail-row">
          <span className="label">Monthly Expense ({createdMonthYear})</span>
          <span className="value">${plan.monthlyExpenseValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
        </div>
        <div className="detail-row">
          <span className="label">Monthly Expense ({retirementMonthYear})</span>
          <span className="value">${plan.monthlyExpense2047.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
        </div>
        <div className="detail-row">
          <span className="label">Expense ({retirementMonthYear})</span>
          <span className="value">${plan.expenseValue2047.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
        </div>
      </div>

      <div className="plan-card-calculations">
        <h4>Financial Goals</h4>
        <div className="detail-row">
          <span className="label">FI Goal</span>
          <span className="value">${plan.fiGoal.toLocaleString()}</span>
        </div>
        <div className="detail-row">
          <span className="label">Progress</span>
          <span className="value">{plan.progress.toFixed(1)}%</span>
        </div>
      </div>

      <div className="plan-meta">
        <small>Created {plan.createdAt}</small>
      </div>
    </div>
  )
}

export default PlanDetailedCard
