import { FC, FormEvent } from 'react'
import { FinancialPlan } from '../../../types'
import { FormData } from '../hooks/useFormData'
import { calculatePlanMetrics } from '../utils/planCalculations'
import { parseDate, getMonthsBetween, formatMonthYear } from '../utils/dateHelpers'
import '../../Plan.css'

interface PlanFormProps {
  formData: FormData
  error: string
  editingPlanId: number | null
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  onSubmit: (plan: FinancialPlan) => void
  onCancel: () => void
  setError: (error: string) => void
}

const PlanForm: FC<PlanFormProps> = ({
  formData,
  error,
  editingPlanId,
  onInputChange,
  onSubmit,
  onCancel,
  setError
}) => {
  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault()

    // Validation
    if (!formData.planName.trim()) {
      setError('Please enter a plan name')
      return
    }
    if (!formData.birthday) {
      setError('Please enter your birthday')
      return
    }
    if (!formData.planCreatedIn) {
      setError('Please enter the plan creation date')
      return
    }
    if (!formData.planEndYear) {
      setError('Please enter the plan end year')
      return
    }
    if (!formData.retirementAge || Number(formData.retirementAge) <= 0) {
      setError('Please enter a valid retirement age')
      return
    }
    if (!formData.expenseValue || Number(formData.expenseValue) <= 0) {
      setError('Please enter a valid annual expense')
      return
    }
    if (formData.inflationRate === '') {
      setError('Please enter the inflation rate')
      return
    }
    if (formData.safeWithdrawalRate === '') {
      setError('Please enter the safe withdrawal rate')
      return
    }
    if (formData.growth === '') {
      setError('Please enter the growth rate')
      return
    }

    // Calculate metrics
    const annualExpense = Number(formData.expenseValue) || 0
    const retirementAge = Number(formData.retirementAge)

    const metrics = calculatePlanMetrics(
      annualExpense,
      formData.birthday,
      retirementAge,
      formData.planCreatedIn,
      Number(formData.inflationRate) || 0,
      Number(formData.safeWithdrawalRate) || 0,
      getMonthsBetween,
      parseDate
    )

    const newPlan: FinancialPlan = {
      id: editingPlanId || Date.now(),
      planName: formData.planName,
      createdAt: new Date().toLocaleString(),
      birthday: formData.birthday,
      planCreatedIn: formData.planCreatedIn,
      planEndYear: formData.planEndYear,
      resetExpenseMonth: formData.resetExpenseMonth,
      retirementAge: retirementAge,
      expenseMonth: 0,
      expenseValue: annualExpense,
      monthlyExpenseValue: metrics.monthlyExpenseAtCreation,
      expenseValueMar2026: 0,
      expenseValue2047: metrics.annualExpenseAtRetirement,
      monthlyExpense2047: metrics.monthlyExpenseAtRetirement,
      inflationRate: Number(formData.inflationRate) || 0,
      safeWithdrawalRate: Number(formData.safeWithdrawalRate) || 0,
      growth: Number(formData.growth) || 0,
      retirement: metrics.retirementDateFormatted,
      fiGoal: metrics.fiGoal,
      progress: 0
    }

    onSubmit(newPlan)
  }

  return (
    <div className="plan-form-section">
      <h2>Financial Plan</h2>
      <form className="plan-form" onSubmit={handleSubmit}>
        <div className="form-section">
          <h3>Personal & Timeline</h3>

          <div className="form-group">
            <label htmlFor="planName">Plan Name</label>
            <input
              type="text"
              id="planName"
              name="planName"
              placeholder="e.g., Conservative Plan"
              value={formData.planName}
              onChange={onInputChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="birthday">Birthday</label>
            <input
              type="date"
              id="birthday"
              name="birthday"
              value={formData.birthday}
              onChange={onInputChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="planCreatedIn">Plan Created In</label>
            <input
              type="date"
              id="planCreatedIn"
              name="planCreatedIn"
              value={formData.planCreatedIn}
              onChange={onInputChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="planEndYear">Plan End Year</label>
            <input
            type="date"
              id="planEndYear"
              name="planEndYear"
              value={formData.planEndYear}
              onChange={onInputChange}

            />
          </div>

          <div className="form-group checkbox-group">
            <input
              type="checkbox"
              id="resetExpenseMonth"
              name="resetExpenseMonth"
              checked={formData.resetExpenseMonth}
              onChange={onInputChange}
            />
            <label htmlFor="resetExpenseMonth">Reset Expense Month</label>
          </div>

          <div className="form-group">
            <label htmlFor="retirementAge">Retirement Age</label>
            <input
              type="number"
              id="retirementAge"
              name="retirementAge"
              placeholder="e.g., 65"
              value={formData.retirementAge}
              onChange={onInputChange}
              min="0"
              step="1"
            />
          </div>

          {formData.planCreatedIn && (
            <div className="display-field">
              <span className="label">Expense Month:</span>
              <span className="display-value">{formatMonthYear(formData.planCreatedIn)}</span>
            </div>
          )}

          {formData.birthday && formData.retirementAge && (
            <div className="display-field">
              <span className="label">Retirement Year:</span>
              <span className="display-value">
                {(() => {
                  const birthDate = parseDate(formData.birthday)
                  const retirementDate = new Date(birthDate.getFullYear() + Number(formData.retirementAge), birthDate.getMonth(), birthDate.getDate())
                  return retirementDate.getFullYear()
                })()}
              </span>
            </div>
          )}
        </div>

        <div className="form-section">
          <h3>Expense Details</h3>

          <div className="form-group">
            <label htmlFor="expenseValue">Annual Expense</label>
            <input
              type="number"
              id="expenseValue"
              name="expenseValue"
              placeholder="e.g., 50000"
              value={formData.expenseValue}
              onChange={onInputChange}
              min="0"
              step="1"
            />
          </div>

          {formData.expenseValue && (
            <div className="display-field">
              <span className="label">Monthly Expense at creation:</span>
              <span className="display-value">
                ${(Number(formData.expenseValue) / 12).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {formData.expenseValue && formData.birthday && formData.retirementAge && formData.planCreatedIn && (
            <div className="display-field">
              <span className="label">Monthly/Annual Expense at retirement:</span>
              <span className="display-value">
                {(() => {
                  const metrics = calculatePlanMetrics(
                    Number(formData.expenseValue),
                    formData.birthday,
                    Number(formData.retirementAge),
                    formData.planCreatedIn,
                    Number(formData.inflationRate) || 0,
                    Number(formData.safeWithdrawalRate) || 0,
                    getMonthsBetween,
                    parseDate
                  )
                  return `$${metrics.monthlyExpenseAtRetirement.toLocaleString(undefined, { maximumFractionDigits: 2 })} / $${metrics.annualExpenseAtRetirement.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                })()}
              </span>
            </div>
          )}
        </div>

        <div className="form-section">
          <h3>Financial Parameters</h3>

          <div className="form-group">
            <label htmlFor="inflationRate">Inflation Rate (%)</label>
            <input
              type="number"
              id="inflationRate"
              name="inflationRate"
              placeholder="e.g., 3"
              value={formData.inflationRate}
              onChange={onInputChange}
              min="0"
              step="0.1"
            />
          </div>

          <div className="form-group">
            <label htmlFor="safeWithdrawalRate">Safe Withdrawal Rate (%)</label>
            <input
              type="number"
              id="safeWithdrawalRate"
              name="safeWithdrawalRate"
              placeholder="e.g., 4"
              value={formData.safeWithdrawalRate}
              onChange={onInputChange}
              min="0"
              step="0.1"
            />
          </div>

          <div className="form-group">
            <label htmlFor="growth">Growth (%)</label>
            <input
              type="number"
              id="growth"
              name="growth"
              placeholder="e.g., 7"
              value={formData.growth}
              onChange={onInputChange}
              min="0"
              step="0.1"
            />
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}
        <div className="form-button-group">
          <button type="submit" className="btn-create">
            {editingPlanId ? 'Update Plan' : 'Create Plan'}
          </button>
          {editingPlanId && (
            <button type="button" className="btn-cancel" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

export default PlanForm
