import { FC, FormEvent, useEffect, useState, useRef, useCallback } from 'react'
import { FinancialGoal } from '../../../types'
import { FormData } from '../hooks/useFormData'
import { calculateGoalMetrics } from '../utils/goalCalculations'
import { parseDate, getMonthsBetween, formatMonthYear } from '../utils/dateHelpers'
import '../../../styles/Goal.css'

interface GoalFormProps {
  formData: FormData
  error: string
  editingGoalId: number | null
  profileBirthday: string
  onOpenProfile: () => void
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  onSetFormFields: (fields: Partial<FormData>) => void
  onSubmit: (goal: FinancialGoal) => void
  onCancel: () => void
  setError: (error: string) => void
}

const STEPS = ['Name', 'Timeline', 'Expenses', 'Parameters', 'Review'] as const
type Step = (typeof STEPS)[number]

const GoalForm: FC<GoalFormProps> = ({
  formData,
  error,
  editingGoalId,
  profileBirthday,
  onOpenProfile,
  onInputChange,
  onSetFormFields,
  onSubmit,
  onCancel,
  setError,
}) => {
  const [step, setStep] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const RANDOM_NAMES = [
    'Retire to a Beach',
    'Golden Years Express',
    'The Great Escape',
    'Freedom Fund',
    'Coast to FIRE',
    'Hammock Mode',
    'Savings Speedrun',
    'FI or Bust',
    'Early Bird Special',
    'Nest Egg Supreme',
    'Operation Chill',
    'The Money Garden',
    'Passport to Freedom',
    'Zero Alarm Clocks',
    'Latte & Leisure',
    'Compound Interest Club',
    'Debt-Free Dreams',
    'Mountain Retreat Fund',
    'Sunflower Savings',
    'Wanderlust Wallet',
    'Cabin in the Woods',
    'Coastline Goal',
    'Rainy Day Rocket',
    'Tropical Endgame',
  ]

  const pickRandomName = useCallback(() => {
    const name = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)]
    onSetFormFields({ goalName: name })
    setError('')
  }, [onSetFormFields, setError])

  const setEndTo100thBirthday = useCallback(() => {
    if (!profileBirthday) return
    const bd = new Date(profileBirthday)
    const y = bd.getFullYear() + 100
    const m = String(bd.getMonth() + 1).padStart(2, '0')
    const d = String(bd.getDate()).padStart(2, '0')
    onSetFormFields({ goalEndYear: `${y}-${m}-${d}` })
    setError('')
  }, [profileBirthday, onSetFormFields, setError])

  const formatCurrency = (value: string): string => {
    if (!value) return ''
    const numeric = Number(value)
    if (Number.isNaN(numeric)) return ''
    return numeric.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  }

  useEffect(() => {
    if (profileBirthday && error === 'Please add your birthday in your profile before creating a goal') {
      setError('')
    }
  }, [profileBirthday])

  // Auto-focus first input on step change
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80)
  }, [step])

  const validateStep = (): boolean => {
    setError('')
    switch (step) {
      case 0:
        if (!formData.goalName.trim()) {
          setError('Please enter a goal name')
          return false
        }
        if (!profileBirthday) {
          setError('Please add your birthday in your profile first')
          onOpenProfile()
          return false
        }
        return true
      case 1:
        if (!formData.goalCreatedIn) {
          setError('Please enter the goal creation date')
          return false
        }
        if (!formData.goalEndYear) {
          setError('Please enter the goal end year')
          return false
        }
        if (formData.goalCreatedIn && formData.goalEndYear && formData.goalEndYear <= formData.goalCreatedIn) {
          setError('Goal end date must be after the start date')
          return false
        }
        if (profileBirthday && formData.goalEndYear) {
          const bYear = new Date(profileBirthday).getFullYear()
          const eYear = new Date(formData.goalEndYear).getFullYear()
          if (eYear - bYear > 100) {
            setError('Goal end date must be within 100 years of your date of birth')
            return false
          }
        }
        if (!formData.retirementAge || Number(formData.retirementAge) <= 0) {
          setError('Please enter a valid retirement age')
          return false
        }
        return true
      case 2:
        if (!formData.expenseValue || Number(formData.expenseValue) <= 0) {
          setError('Please enter a valid annual expense')
          return false
        }
        return true
      case 3:
        if (formData.inflationRate === '') {
          setError('Please enter the inflation rate')
          return false
        }
        if (formData.safeWithdrawalRate === '') {
          setError('Please enter the safe withdrawal rate')
          return false
        }
        if (formData.growth === '') {
          setError('Please enter the growth rate')
          return false
        }
        return true
      default:
        return true
    }
  }

  const goNext = () => {
    if (validateStep()) {
      setStep(s => Math.min(s + 1, STEPS.length - 1))
    }
  }

  const goBack = () => {
    setError('')
    setStep(s => Math.max(s - 1, 0))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (step < STEPS.length - 1) goNext()
    }
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault()
    if (step < STEPS.length - 1) {
      goNext()
      return
    }
    if (!validateStep()) return

    const annualExpense = Number(formData.expenseValue) || 0
    const retirementAge = Number(formData.retirementAge)
    const metrics = calculateGoalMetrics(
      annualExpense,
      profileBirthday,
      retirementAge,
      formData.goalCreatedIn,
      Number(formData.inflationRate) || 0,
      Number(formData.safeWithdrawalRate) || 0,
      getMonthsBetween,
      parseDate,
    )

    onSubmit({
      id: editingGoalId || Date.now(),
      goalName: formData.goalName,
      createdAt: new Date().toLocaleString(),
      birthday: profileBirthday,
      goalCreatedIn: formData.goalCreatedIn,
      goalEndYear: formData.goalEndYear,
      resetExpenseMonth: formData.resetExpenseMonth,
      retirementAge,
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
      progress: 0,
    })
  }

  const dollars = (n: number) => '$' + Math.round(n).toLocaleString()

  const renderReview = () => {
    const retAge = Number(formData.retirementAge)
    const expense = Number(formData.expenseValue)
    const canCalc =
      profileBirthday &&
      formData.goalCreatedIn &&
      retAge > 0 &&
      expense > 0 &&
      formData.inflationRate !== '' &&
      formData.safeWithdrawalRate !== ''
    let metrics: ReturnType<typeof calculateGoalMetrics> | null = null
    if (canCalc) {
      metrics = calculateGoalMetrics(
        expense,
        profileBirthday,
        retAge,
        formData.goalCreatedIn,
        Number(formData.inflationRate) || 0,
        Number(formData.safeWithdrawalRate) || 0,
        getMonthsBetween,
        parseDate,
      )
    }
    return (
      <div className="wizard-review">
        <div className="wizard-review-row">
          <span className="wizard-review-label">Goal Name</span>
          <span className="wizard-review-value">{formData.goalName}</span>
        </div>
        <div className="wizard-review-row">
          <span className="wizard-review-label">Created On</span>
          <span className="wizard-review-value">{formatMonthYear(formData.goalCreatedIn)}</span>
        </div>
        <div className="wizard-review-row">
          <span className="wizard-review-label">Retirement Age</span>
          <span className="wizard-review-value">{formData.retirementAge}</span>
        </div>
        <div className="wizard-review-row">
          <span className="wizard-review-label">Annual Expense</span>
          <span className="wizard-review-value">{formatCurrency(formData.expenseValue)}</span>
        </div>
        <div className="wizard-review-row">
          <span className="wizard-review-label">Inflation</span>
          <span className="wizard-review-value">{formData.inflationRate}%</span>
        </div>
        <div className="wizard-review-row">
          <span className="wizard-review-label">SWR</span>
          <span className="wizard-review-value">{formData.safeWithdrawalRate}%</span>
        </div>
        <div className="wizard-review-row">
          <span className="wizard-review-label">Growth</span>
          <span className="wizard-review-value">{formData.growth}%</span>
        </div>
        {metrics && (
          <>
            <div className="wizard-review-divider" />
            <div className="wizard-review-row wizard-review-row--highlight">
              <span className="wizard-review-label">Retirement</span>
              <span className="wizard-review-value">{metrics.retirementDateFormatted}</span>
            </div>
            <div className="wizard-review-row wizard-review-row--highlight">
              <span className="wizard-review-label">FI Goal</span>
              <span className="wizard-review-value">{dollars(metrics.fiGoal)}</span>
            </div>
            <div className="wizard-review-row">
              <span className="wizard-review-label">Expense at Retirement</span>
              <span className="wizard-review-value">{dollars(metrics.annualExpenseAtRetirement)}/yr</span>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="goal-form-section goal-wizard">
      <div className="wizard-header">
        <h2>{editingGoalId ? 'Edit Goal' : 'New Goal'}</h2>
        <div className="wizard-progress">
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              className={`wizard-dot${i === step ? ' active' : ''}${i < step ? ' done' : ''}`}
              onClick={() => {
                if (i < step) setStep(i)
              }}
              title={label}
            >
              {i < step ? '✓' : i + 1}
            </button>
          ))}
        </div>
        <span className="wizard-step-label">{STEPS[step]}</span>
      </div>

      <form className="goal-form wizard-body" onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
        {step === 0 && (
          <div className="wizard-step">
            <label className="wizard-field-label" htmlFor="goalName">
              What do you want to call this goal?
            </label>
            <input
              ref={inputRef}
              className="wizard-input"
              type="text"
              id="goalName"
              name="goalName"
              placeholder="e.g., Conservative Goal"
              value={formData.goalName}
              onChange={onInputChange}
              autoFocus
            />
          </div>
        )}

        {step === 1 && (
          <div className="wizard-step">
            <div className="wizard-field">
              <label className="wizard-field-label" htmlFor="goalCreatedIn">
                When are you creating this goal?
              </label>
              <input
                ref={inputRef}
                className="wizard-input"
                type="date"
                id="goalCreatedIn"
                name="goalCreatedIn"
                value={formData.goalCreatedIn}
                onChange={onInputChange}
              />
            </div>
            <div className="wizard-field">
              <label className="wizard-field-label" htmlFor="goalEndYear">
                When should this goal end?
              </label>
              <input
                className="wizard-input"
                type="date"
                id="goalEndYear"
                name="goalEndYear"
                value={formData.goalEndYear}
                onChange={onInputChange}
              />
            </div>
            <div className="wizard-field">
              <label className="wizard-field-label" htmlFor="retirementAge">
                At what age do you want to retire?
              </label>
              <input
                className="wizard-input"
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
          </div>
        )}

        {step === 2 && (
          <div className="wizard-step">
            <label className="wizard-field-label" htmlFor="expenseValue">
              What are your annual expenses?{' '}
              <span className="wizard-hint">({formatMonthYear(formData.goalCreatedIn)} dollars)</span>
            </label>
            <input
              ref={inputRef}
              className="wizard-input wizard-input--large"
              type="text"
              inputMode="numeric"
              id="expenseValue"
              name="expenseValue"
              placeholder="e.g., $50,000"
              value={formData.expenseValue ? formatCurrency(formData.expenseValue) : ''}
              onChange={onInputChange}
            />
          </div>
        )}

        {step === 3 && (
          <div className="wizard-step">
            <div className="wizard-field-header">
              <label className="wizard-field-label">Set your financial parameters</label>
              <button
                type="button"
                className="btn-use-recommended"
                onClick={() => onSetFormFields({ inflationRate: '3', safeWithdrawalRate: '4', growth: '6' })}
              >
                Use Recommended
              </button>
            </div>
            <div className="wizard-param-grid">
              <div className="wizard-param-card">
                <label className="wizard-param-icon" htmlFor="inflationRate">
                  📈
                </label>
                <label className="wizard-param-name" htmlFor="inflationRate">
                  Inflation
                </label>
                <div className="wizard-param-input-wrap">
                  <input
                    ref={inputRef}
                    className="wizard-param-input"
                    type="number"
                    id="inflationRate"
                    name="inflationRate"
                    placeholder="3"
                    value={formData.inflationRate}
                    onChange={onInputChange}
                    min="0"
                    step="0.1"
                  />
                  <span className="wizard-param-unit">%</span>
                </div>
              </div>
              <div className="wizard-param-card">
                <label className="wizard-param-icon" htmlFor="safeWithdrawalRate">
                  🛡️
                </label>
                <span className="wizard-param-name-row">
                  <label className="wizard-param-name" htmlFor="safeWithdrawalRate">
                    SWR
                  </label>
                  <span
                    className="wizard-param-info"
                    title='Safe Withdrawal Rate — the percentage of your portfolio you withdraw annually in retirement. 4% is a common benchmark (the "4% rule").'
                  >
                    ⓘ
                  </span>
                </span>
                <div className="wizard-param-input-wrap">
                  <input
                    className="wizard-param-input"
                    type="number"
                    id="safeWithdrawalRate"
                    name="safeWithdrawalRate"
                    placeholder="4"
                    value={formData.safeWithdrawalRate}
                    onChange={onInputChange}
                    min="0"
                    step="0.1"
                  />
                  <span className="wizard-param-unit">%</span>
                </div>
              </div>
              <div className="wizard-param-card">
                <label className="wizard-param-icon" htmlFor="growth">
                  🚀
                </label>
                <label className="wizard-param-name" htmlFor="growth">
                  Growth
                </label>
                <div className="wizard-param-input-wrap">
                  <input
                    className="wizard-param-input"
                    type="number"
                    id="growth"
                    name="growth"
                    placeholder="6"
                    value={formData.growth}
                    onChange={onInputChange}
                    min="0"
                    step="0.1"
                  />
                  <span className="wizard-param-unit">%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="wizard-step">
            <label className="wizard-field-label">Everything look good?</label>
            {renderReview()}
          </div>
        )}

        {error && (
          <div className="form-error">
            {error}
            {step === 0 && error === 'Please enter a goal name' && (
              <button type="button" className="random-name-btn" onClick={pickRandomName}>
                🎲 Pick random name
              </button>
            )}
            {step === 1 &&
              (error === 'Goal end date must be within 100 years of your date of birth' ||
                error === 'Please enter the goal end year') && (
                <button type="button" className="random-name-btn" onClick={setEndTo100thBirthday}>
                  Set to 100th birthday
                </button>
              )}
          </div>
        )}

        <div className="wizard-nav">
          {step > 0 ? (
            <button type="button" className="wizard-btn wizard-btn--back" onClick={goBack}>
              ← Back
            </button>
          ) : (
            <button type="button" className="wizard-btn wizard-btn--back" onClick={onCancel}>
              Cancel
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" className="wizard-btn wizard-btn--next" onClick={goNext}>
              Next →
            </button>
          ) : (
            <button type="submit" className="wizard-btn wizard-btn--create">
              {editingGoalId ? 'Update Goal' : 'Create Goal'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

export default GoalForm
