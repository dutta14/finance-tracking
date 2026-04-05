import { FC, FormEvent, useEffect } from 'react'
import { FinancialPlan } from '../../../types'
import { FormData } from '../hooks/useFormData'
import { calculatePlanMetrics } from '../utils/planCalculations'
import { parseDate, getMonthsBetween, formatMonthYear } from '../utils/dateHelpers'
import '../../../styles/Plan.css'

interface PlanFormProps {
  formData: FormData
  error: string
  editingPlanId: number | null
  profileBirthday: string
  onOpenProfile: () => void
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  onSubmit: (plan: FinancialPlan) => void
  onCancel: () => void
  setError: (error: string) => void
}

const PlanForm: FC<PlanFormProps> = ({
  formData,
  error,
  editingPlanId,
  profileBirthday,
  onOpenProfile,
  onInputChange,
  onSubmit,
  onCancel,
  setError
}) => {
  const formatCurrency = (value: string): string => {
    if (!value) return ''
    const numeric = Number(value)
    if (Number.isNaN(numeric)) return ''
    return numeric.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  }

  // Clear birthday error once profile birthday is set
  useEffect(() => {
    if (profileBirthday && error === 'Please add your birthday in your profile before creating a plan') {
      setError('')
    }
  }, [profileBirthday])

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault()

    // Validation
    if (!formData.planName.trim()) {
      setError('Please enter a plan name')
      return
    }
    if (!profileBirthday) {
      setError('Please add your birthday in your profile before creating a plan')
      onOpenProfile()
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
      profileBirthday,
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
      birthday: profileBirthday,
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
      <h2>Create New Plan</h2>
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
            <label htmlFor="planCreatedIn">Plan Created on</label>
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

          {profileBirthday && formData.retirementAge && (
            <div className="display-field">
              <span className="label">Retirement Year:</span>
              <span className="display-value">
                {(() => {
                  const birthDate = parseDate(profileBirthday)
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
            <label htmlFor="expenseValue">Annual Expense ({formatMonthYear(formData.planCreatedIn)}) </label>
            <input
              type="text"
              inputMode="numeric"
              id="expenseValue"
              name="expenseValue"
              placeholder="e.g., $50,000"
              value={formData.expenseValue ? formatCurrency(formData.expenseValue) : ''}
              onChange={onInputChange}
            />
          </div>

          {formData.expenseValue && formData.planCreatedIn && (
            <>
              <div className="display-field">
                <span className="label">Monthly Expense at creation ({formatMonthYear(formData.planCreatedIn)}):</span>
                <span className="display-value">
                  ${(Number(formData.expenseValue) / 12).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="display-field">
                <span className="label">Annual Expense at creation ({new Date(formData.planCreatedIn).getFullYear()}):</span>
                <span className="display-value">
                  ${Number(formData.expenseValue).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
              
            </>
          )}

         

          {formData.expenseValue && profileBirthday && formData.retirementAge && formData.planCreatedIn && (
            (() => {
              const metrics = calculatePlanMetrics(
                Number(formData.expenseValue),
                profileBirthday,
                Number(formData.retirementAge),
                formData.planCreatedIn,
                Number(formData.inflationRate) || 0,
                Number(formData.safeWithdrawalRate) || 0,
                getMonthsBetween,
                parseDate
              )
              return (
                <>
                  <div className="display-field">
                    <span className="label">Monthly Expense at retirement ({metrics.retirementDateFormatted}):</span>
                    <span className="display-value">
                      ${metrics.monthlyExpenseAtRetirement.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="display-field">
                    <span className="label">Annual Expense at retirement ({new Date(metrics.retirementDate).getFullYear()}):</span>
                    <span className="display-value">
                      ${metrics.annualExpenseAtRetirement.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </>
              )
            })()
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
          <button type="button" className="btn-cancel" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

export default PlanForm
