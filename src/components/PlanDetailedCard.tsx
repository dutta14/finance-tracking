import { FC, useState, useMemo } from 'react'
import { FinancialPlan } from '../types'
import PlanCardActions from './PlanCardActions'
import '../styles/PlanDetailedCard.css'

interface PlanDetailedCardProps {
  plan: FinancialPlan
  profileBirthday: string
  onEdit?: (plan: FinancialPlan) => void
  onCopy?: (plan: FinancialPlan) => void
  onDelete?: (planId: number) => void
  showActions?: boolean
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

const formatFullDate = (dateString: string): string => {
  const date = parseDate(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatRetirementDate = (date: Date): string =>
  date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const dollars = (n: number) => '$' + Math.round(n).toLocaleString()

const findDepletionMonth = (plan: FinancialPlan, profileBirthday: string): string | null => {
  const birthday = profileBirthday || plan.birthday
  if (!birthday || !plan.planEndYear || !plan.fiGoal) return null
  const [by, bm, bd] = birthday.split('-').map(Number)
  const retirementDate = new Date(by + plan.retirementAge, bm - 1, bd)
  const endDate = new Date(plan.planEndYear)
  if (retirementDate >= endDate) return null
  const monthlyInflation = (plan.inflationRate || 0) / 100 / 12
  const monthlyGrowth = (plan.growth || 0) / 100 / 12
  let expense = plan.monthlyExpense2047
  let remaining = plan.fiGoal
  const cursor = new Date(retirementDate.getFullYear(), retirementDate.getMonth(), 1)
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1)
  while (cursor <= end) {
    if (remaining < 0) {
      return cursor.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    }
    remaining = remaining * (1 + monthlyGrowth) - expense
    expense = expense * (1 + monthlyInflation)
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return null
}

const InfoIcon: FC<{ tooltip: React.ReactNode; align?: 'right' | 'left' }> = ({ tooltip, align = 'right' }) => (
  <span className="fi-goal-info">
    <svg className="fi-goal-info-icon" width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="7.25" y="7" width="1.5" height="5" rx="0.75" fill="currentColor"/>
      <rect x="7.25" y="4" width="1.5" height="1.5" rx="0.75" fill="currentColor"/>
    </svg>
    <span className={`fi-goal-tooltip${align === 'left' ? ' fi-goal-tooltip--left' : ''}`}>{tooltip}</span>
  </span>
)

const PlanDetailedCard: FC<PlanDetailedCardProps> = ({ plan, profileBirthday, onEdit, onCopy, onDelete, showActions = true }) => {
  const [expenseView, setExpenseView] = useState<'creation' | 'retirement'>('creation')
  const birthDate = parseDate(profileBirthday)
  const retirementDate = new Date(birthDate.getFullYear() + plan.retirementAge, birthDate.getMonth(), birthDate.getDate())
  const retirementDateLabel = formatRetirementDate(retirementDate)
  const depletionMonth = useMemo(() => findDepletionMonth(plan, profileBirthday), [plan, profileBirthday])

  return (
    <div className="plan-card">
      {depletionMonth && (
        <div className="plan-card-warning">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M8 1.5L1 14.5h14L8 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
            <rect x="7.25" y="6.5" width="1.5" height="4" rx="0.75" fill="currentColor"/>
            <rect x="7.25" y="11.5" width="1.5" height="1.5" rx="0.75" fill="currentColor"/>
          </svg>
          Not sustainable beyond {depletionMonth}
        </div>
      )}
      <div className="plan-card-header">
        <h3>{plan.planName}</h3>
        {showActions && onEdit && onCopy && onDelete && (
          <PlanCardActions plan={plan} onEdit={onEdit} onCopy={onCopy} onDelete={onDelete} />
        )}
      </div>

      <div className="plan-card-details">
        <div className="detail-row">
          <span className="label">Plan Creation Date</span>
          <span className="value">{plan.planCreatedIn ? formatMonthYear(plan.planCreatedIn) : 'N/A'}</span>
        </div>
        <div className="detail-row">
          <span className="label">Retirement Date</span>
          <span className="value">
            {retirementDateLabel}
            <InfoIcon tooltip={<>Birthday ({formatFullDate(profileBirthday)}) + retirement age ({plan.retirementAge})</>} align="left" />
          </span>
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
        <div className="expense-analysis-header">
          <h4>Expense Analysis</h4>
          <div className="expense-toggle">
            <button
              className={`expense-toggle-btn${expenseView === 'creation' ? ' active' : ''}`}
              onClick={() => setExpenseView('creation')}
              title={`Values as of ${new Date(plan.planCreatedIn).getFullYear()}`}
            >At Creation</button>
            <button
              className={`expense-toggle-btn${expenseView === 'retirement' ? ' active' : ''}`}
              onClick={() => setExpenseView('retirement')}
              title={`Values as of ${retirementDate.getFullYear()}`}
            >At Retirement</button>
          </div>
        </div>
        {expenseView === 'creation' ? (
          <>
            <div className="detail-row">
              <span className="label">Monthly Expense</span>
              <span className="value">{dollars(plan.monthlyExpenseValue)}</span>
            </div>
            <div className="detail-row">
              <span className="label">Annual Expense</span>
              <span className="value">{dollars(plan.expenseValue)}</span>
            </div>
          </>
        ) : (
          <>
            <div className="detail-row">
              <span className="label">
                Monthly Expense
                <InfoIcon tooltip={<>Monthly expense at creation inflated at {plan.inflationRate}% for {Math.round((retirementDate.getFullYear() - new Date(plan.planCreatedIn).getFullYear()))} yrs.<br/>{dollars(plan.monthlyExpenseValue)} → {dollars(plan.monthlyExpense2047)}</>} />
              </span>
              <span className="value">{dollars(plan.monthlyExpense2047)}</span>
            </div>
            <div className="detail-row">
              <span className="label">
                Annual Expense
                <InfoIcon tooltip={<>Annual expense at creation inflated at {plan.inflationRate}% for {Math.round((retirementDate.getFullYear() - new Date(plan.planCreatedIn).getFullYear()))} yrs.<br/>{dollars(plan.expenseValue)} → {dollars(plan.expenseValue2047)}</>} />
              </span>
              <span className="value">{dollars(plan.expenseValue2047)}</span>
            </div>
          </>
        )}
      </div>

      <div className="plan-card-calculations">
        <h4>Financial Goals</h4>
        <div className="detail-row">
          <span className="label">
            FI Goal
            <InfoIcon tooltip={<>Annual expense at retirement ÷ safe withdrawal rate.<br/>{dollars(plan.expenseValue2047)} ÷ {plan.safeWithdrawalRate}% = {dollars(plan.fiGoal)}</>} />
          </span>
          <span className="value">{dollars(plan.fiGoal)}</span>
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
