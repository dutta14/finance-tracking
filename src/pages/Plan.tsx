import { FC, useState, ChangeEvent, FormEvent, useEffect } from 'react'
import { FinancialPlan } from '../types'
import './Plan.css'

interface FormData {
  planName: string
  birthday: string
  planCreatedIn: string
  planEndYear: string
  resetExpenseMonth: boolean
  retirementAge: string
  expenseMonth: string
  expenseValue: string
  monthlyExpenseValue: string
  inflationRate: string
  safeWithdrawalRate: string
  growth: string
}

const Plan: FC = () => {
  // Helper function to calculate Future Value
  const calculateFV = (monthlyRate: number, months: number, presentValue: number): number => {
    return presentValue * Math.pow(1 + monthlyRate, months)
  }

  // Helper function to get months between two dates (matches Excel DATEDIF behavior)
  const getMonthsBetween = (startDate: Date, endDate: Date): number => {
    const yearsDiff = endDate.getFullYear() - startDate.getFullYear()
    const monthsDiff = endDate.getMonth() - startDate.getMonth()
    let totalMonths = yearsDiff * 12 + monthsDiff
    
    // DATEDIF counts complete months - if start day > end day, subtract 1
    if (startDate.getDate() > endDate.getDate()) {
      totalMonths--
    }
    
    return totalMonths
  }

  // Helper function to parse date string "YYYY-MM-DD" safely
  const parseDate = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-')
    return new Date(Number(year), Number(month) - 1, Number(day))
  }

  // Helper function to format date as "Mmm YYYY"
  const formatMonthYear = (dateString: string): string => {
    const date = parseDate(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  // Helper function to recalculate FI Goal for existing plans (backward compatibility)
  const migratePlans = (plansToMigrate: FinancialPlan[]): FinancialPlan[] => {
    return plansToMigrate.map(plan => {
      if (plan.fiGoal === 0 && plan.expenseValue2047 > 0 && plan.safeWithdrawalRate > 0) {
        const annualExpenseAtRetirement = plan.expenseValue2047
        const safeWithdrawalRateDecimal = plan.safeWithdrawalRate / 100
        const calculatedFiGoal = annualExpenseAtRetirement / safeWithdrawalRateDecimal
        return { ...plan, fiGoal: calculatedFiGoal }
      }
      return plan
    })
  }

  const [formData, setFormData] = useState<FormData>({
    planName: '',
    birthday: '',
    planCreatedIn: new Date().toISOString().split('T')[0],
    planEndYear: new Date().getFullYear().toString(),
    resetExpenseMonth: false,
    retirementAge: '',
    expenseMonth: '',
    expenseValue: '',
    monthlyExpenseValue: '',
    inflationRate: '',
    safeWithdrawalRate: '',
    growth: ''
  })

  // Initialize plans from localStorage
  const [plans, setPlans] = useState<FinancialPlan[]>(() => {
    try {
      const savedPlans = localStorage.getItem('financialPlans')
      const loadedPlans = savedPlans ? JSON.parse(savedPlans) : []
      // Apply migration to recalculate FI Goal for old plans
      return migratePlans(loadedPlans)
    } catch (err) {
      console.error('Failed to load plans from localStorage:', err)
      return []
    }
  })
  const [error, setError] = useState<string>('')

  // Save plans to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('financialPlans', JSON.stringify(plans))
    } catch (err) {
      console.error('Failed to save plans to localStorage:', err)
    }
  }, [plans])

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const { name, type } = e.currentTarget
    
    if (type === 'checkbox') {
      const checkbox = e.currentTarget as HTMLInputElement
      setFormData(prev => ({
        ...prev,
        [name]: checkbox.checked
      }))
    } else {
      const { value } = e.currentTarget
      setFormData(prev => ({
        ...prev,
        [name]: value
      }))
    }
  }

  const handleCreatePlan = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault()
    setError('')
    
    // Validate all required fields
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

    // Calculate expense month (Mmm YYYY format)
    const expenseMonthDisplay = formatMonthYear(formData.planCreatedIn)

    // Calculate annual expense value
    const annualExpense = Number(formData.expenseValue) || 0

    // Calculate monthly expense at creation (annual / 12)
    const monthlyExpenseAtCreation = annualExpense / 12

    // Calculate retirement date
    const birthDate = parseDate(formData.birthday)
    const retirementAge = Number(formData.retirementAge)
    const retirementDate = new Date(birthDate.getFullYear() + retirementAge, birthDate.getMonth(), birthDate.getDate())
    const retirementDateFormatted = retirementDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

    // Calculate months between plan creation and retirement
    const planCreatedDate = new Date(formData.planCreatedIn)
    const monthsBetween = getMonthsBetween(planCreatedDate, retirementDate)

    // Calculate monthly expense at retirement using FV formula
    // FV = PV * (1 + r)^n
    const inflationRateMonthly = (Number(formData.inflationRate) || 0) / 100 / 12
    const monthlyExpenseAtRetirement = calculateFV(inflationRateMonthly, monthsBetween, monthlyExpenseAtCreation)
    const annualExpenseAtRetirement = monthlyExpenseAtRetirement * 12

    // Calculate FI Goal: (Monthly Expense at Retirement * 12) / (Safe Withdrawal Rate / 100)
    const safeWithdrawalRateDecimal = (Number(formData.safeWithdrawalRate) || 0) / 100
    const fiGoal = safeWithdrawalRateDecimal > 0 ? annualExpenseAtRetirement / safeWithdrawalRateDecimal : 0

    const newPlan: FinancialPlan = {
      id: Date.now(),
      planName: formData.planName,
      createdAt: new Date().toLocaleString(),
      birthday: formData.birthday,
      planCreatedIn: formData.planCreatedIn,
      planEndYear: formData.planEndYear,
      resetExpenseMonth: formData.resetExpenseMonth,
      retirementAge: retirementAge,
      expenseMonth: 0, // This is now a display field (expenseMonthDisplay)
      expenseValue: annualExpense,
      monthlyExpenseValue: monthlyExpenseAtCreation,
      expenseValueMar2026: 0, // calculated
      expenseValue2047: annualExpenseAtRetirement,
      monthlyExpense2047: monthlyExpenseAtRetirement,
      inflationRate: Number(formData.inflationRate) || 0,
      safeWithdrawalRate: Number(formData.safeWithdrawalRate) || 0,
      growth: Number(formData.growth) || 0,
      retirement: retirementDateFormatted,
      fiGoal: fiGoal,
      progress: 0 // calculated
    }

    setPlans(prev => [newPlan, ...prev])
    setFormData({
      planName: '',
      birthday: '',
      planCreatedIn: new Date().toISOString().split('T')[0],
      planEndYear: new Date().getFullYear().toString(),
      resetExpenseMonth: false,
      retirementAge: '',
      expenseMonth: '',
      expenseValue: '',
      monthlyExpenseValue: '',
      inflationRate: '',
      safeWithdrawalRate: '',
      growth: ''
    })
    setError('')
  }

  const handleDeletePlan = (id: number): void => {
    setPlans(prev => prev.filter(plan => plan.id !== id))
  }

  const handleCopyPlan = (plan: FinancialPlan): void => {
    setFormData({
      planName: plan.planName,
      birthday: plan.birthday,
      planCreatedIn: plan.planCreatedIn,
      planEndYear: plan.planEndYear,
      resetExpenseMonth: plan.resetExpenseMonth,
      retirementAge: plan.retirementAge.toString(),
      expenseMonth: '',
      expenseValue: plan.expenseValue.toString(),
      monthlyExpenseValue: '',
      inflationRate: plan.inflationRate.toString(),
      safeWithdrawalRate: plan.safeWithdrawalRate.toString(),
      growth: plan.growth.toString()
    })
    // Scroll to form for better UX
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const planCreatedYear = formData.planCreatedIn ? new Date(formData.planCreatedIn).getFullYear() : new Date().getFullYear()
  const planCreatedMonthYear = formatMonthYear(formData.planCreatedIn)

  return (
    <div className="plan-page">
      <section className="plan-header">
        <h1>Financial Planning</h1>
        <p>Create and model different financial plans for your future</p>
      </section>

      <section className="plan-content">
        <div className="plan-container">
          <div className="plan-layout">
            {/* Form Section */}
            <div className="plan-form-section">
              <h2>Create New Plan</h2>
              <form className="plan-form" onSubmit={handleCreatePlan}>
                
                {/* Plan Name */}
                <div className="form-group">
                  <label htmlFor="planName">Plan Name</label>
                  <input
                    type="text"
                    id="planName"
                    name="planName"
                    placeholder="e.g., Retirement Plan 2026"
                    value={formData.planName}
                    onChange={handleInputChange}
                  />
                </div>

                {/* Personal & Timeline Section */}
                <div className="form-section">
                  <h3>Personal & Timeline</h3>
                  
                  <div className="form-group">
                    <label htmlFor="birthday">Birthday</label>
                    <input
                      type="date"
                      id="birthday"
                      name="birthday"
                      value={formData.birthday}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="planCreatedIn">Plan Created In</label>
                    <input
                      type="date"
                      id="planCreatedIn"
                      name="planCreatedIn"
                      value={formData.planCreatedIn}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="planEndYear">Plan End Year</label>
                    <input
                      type="date"
                      id="planEndYear"
                      name="planEndYear"
                      value={formData.planEndYear}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group checkbox-group">
                    <label htmlFor="resetExpenseMonth">
                      <input
                        type="checkbox"
                        id="resetExpenseMonth"
                        name="resetExpenseMonth"
                        checked={formData.resetExpenseMonth}
                        onChange={handleInputChange}
                      />
                      <span>Reset Expense Month</span>
                    </label>
                  </div>

                  <div className="form-group">
                    <label htmlFor="retirementAge">Retirement Age</label>
                    <input
                      type="number"
                      id="retirementAge"
                      name="retirementAge"
                      placeholder="e.g., 65"
                      value={formData.retirementAge}
                      onChange={handleInputChange}
                      min="0"
                      max="150"
                    />
                  </div>
                </div>

                {/* Expense Details Section */}
                <div className="form-section">
                  <h3>Expense Details</h3>
                  
                  <div className="form-group">
                    <label htmlFor="expenseValue">Expense ({planCreatedYear})</label>
                    <input
                      type="number"
                      id="expenseValue"
                      name="expenseValue"
                      placeholder="Annual expense"
                      value={formData.expenseValue}
                      onChange={handleInputChange}
                      min="0"
                    />
                  </div>

                  <div className="form-group display-field">
                    <label>Expense Month</label>
                    <div className="display-value">{planCreatedMonthYear}</div>
                  </div>

                  <div className="form-group display-field">
                    <label>Monthly Expense ({planCreatedYear})</label>
                    <div className="display-value">${(Number(formData.expenseValue) / 12 || 0).toFixed(2)}</div>
                  </div>

                  {formData.birthday && formData.retirementAge && (
                    <>
                      <div className="form-group display-field">
                        <label>Retirement Year</label>
                        <div className="display-value">
                          {(() => {
                            const birthDate = parseDate(formData.birthday)
                            const retirementAge = Number(formData.retirementAge)
                            const retirementDate = new Date(birthDate.getFullYear() + retirementAge, birthDate.getMonth(), birthDate.getDate())
                            return retirementDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                          })()}
                        </div>
                      </div>

                      <div className="form-group display-field">
                        <label>Monthly Expense (Retirement)</label>
                        <div className="display-value">
                          ${(() => {
                            const birthDate = parseDate(formData.birthday)
                            const retirementDate = new Date(birthDate.getFullYear() + Number(formData.retirementAge), birthDate.getMonth(), birthDate.getDate())
                            const planCreatedDate = parseDate(formData.planCreatedIn)
                            const monthsBetween = (retirementDate.getFullYear() - planCreatedDate.getFullYear()) * 12 + (retirementDate.getMonth() - planCreatedDate.getMonth())
                            const monthlyExpenseNow = Number(formData.expenseValue) / 12
                            const inflationRateMonthly = (Number(formData.inflationRate) || 0) / 100 / 12
                            const futureMonthlyExpense = monthlyExpenseNow * Math.pow(1 + inflationRateMonthly, monthsBetween)
                            return futureMonthlyExpense.toFixed(2)
                          })()}
                        </div>
                      </div>

                      <div className="form-group display-field">
                        <label>Expense (Retirement Year)</label>
                        <div className="display-value">
                          ${(() => {
                            const birthDate = parseDate(formData.birthday)
                            const retirementDate = new Date(birthDate.getFullYear() + Number(formData.retirementAge), birthDate.getMonth(), birthDate.getDate())
                            const planCreatedDate = parseDate(formData.planCreatedIn)
                            const monthsBetween = (retirementDate.getFullYear() - planCreatedDate.getFullYear()) * 12 + (retirementDate.getMonth() - planCreatedDate.getMonth())
                            const monthlyExpenseNow = Number(formData.expenseValue) / 12
                            const inflationRateMonthly = (Number(formData.inflationRate) || 0) / 100 / 12
                            const futureMonthlyExpense = monthlyExpenseNow * Math.pow(1 + inflationRateMonthly, monthsBetween)
                            return (futureMonthlyExpense * 12).toFixed(2)
                          })()}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Financial Parameters Section */}
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
                      onChange={handleInputChange}
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
                      onChange={handleInputChange}
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
                      onChange={handleInputChange}
                      min="0"
                      step="0.1"
                    />
                  </div>
                </div>

                {error && <div className="form-error">{error}</div>}
                <button type="submit" className="btn-create">Create Plan</button>
              </form>
            </div>

            {/* Saved Plans Section */}
            <div className="plan-results-section">
              <h2>Saved Plans ({plans.length})</h2>
              {plans.length === 0 ? (
                <div className="empty-state">
                  <p>No plans created yet. Fill in the form and click "Create Plan" to get started.</p>
                </div>
              ) : (
                <div className="plans-grid">
                  {plans.map(plan => (
                    <div key={plan.id} className="plan-card">
                      <div className="plan-card-header">
                        <h3>{plan.planName}</h3>
                        <div className="plan-card-actions">
                          <button
                            className="btn-copy"
                            onClick={() => handleCopyPlan(plan)}
                            title="Copy plan to form"
                          >
                            📋
                          </button>
                          <button
                            className="btn-delete"
                            onClick={() => handleDeletePlan(plan.id)}
                            title="Delete plan"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                      
                      <div className="plan-card-details">
                        <div className="detail-row">
                          <span className="label">Birthday:</span>
                          <span className="value">{plan.birthday ? parseDate(plan.birthday).toLocaleDateString() : 'N/A'}</span>
                        </div>
                        <div className="detail-row">
                          <span className="label">Plan Creation Date:</span>
                          <span className="value">{plan.planCreatedIn ? formatMonthYear(plan.planCreatedIn) : 'N/A'}</span>
                        </div>
                        <div className="detail-row">
                          <span className="label">Retirement Age:</span>
                          <span className="value">{plan.retirementAge}</span>
                        </div>
                        <div className="detail-row">
                          <span className="label">Retirement Date:</span>
                          <span className="value">{plan.retirement}</span>
                        </div>
                        <div className="detail-row">
                          <span className="label">Inflation Rate:</span>
                          <span className="value">{plan.inflationRate}%</span>
                        </div>
                        <div className="detail-row">
                          <span className="label">Safe Withdrawal Rate:</span>
                          <span className="value">{plan.safeWithdrawalRate}%</span>
                        </div>
                        <div className="detail-row">
                          <span className="label">Growth:</span>
                          <span className="value">{plan.growth}%</span>
                        </div>
                      </div>

                      <div className="plan-card-calculations">
                        <h4>Expense Analysis</h4>
                        {(() => {
                          const createdMonthYear = formatMonthYear(plan.planCreatedIn)
                          const birthDate = parseDate(plan.birthday)
                          const retirementDate = new Date(birthDate.getFullYear() + plan.retirementAge, birthDate.getMonth(), birthDate.getDate())
                          const retirementMonthYear = retirementDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                          
                          return (
                            <>
                              <div className="detail-row">
                                <span className="label">Expense ({createdMonthYear}):</span>
                                <span className="value">${plan.expenseValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                              </div>
                              <div className="detail-row">
                                <span className="label">Monthly Expense ({createdMonthYear}):</span>
                                <span className="value">${plan.monthlyExpenseValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                              </div>
                              <div className="detail-row">
                                <span className="label">Monthly Expense ({retirementMonthYear}):</span>
                                <span className="value">${plan.monthlyExpense2047.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                              </div>
                              <div className="detail-row">
                                <span className="label">Expense ({retirementMonthYear}):</span>
                                <span className="value">${plan.expenseValue2047.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                              </div>
                            </>
                          )
                        })()}
                      </div>

                      <div className="plan-card-calculations">
                        <h4>Financial Goals</h4>
                        <div className="detail-row">
                          <span className="label">FI Goal:</span>
                          <span className="value">${plan.fiGoal.toLocaleString()}</span>
                        </div>
                        <div className="detail-row">
                          <span className="label">Progress:</span>
                          <span className="value">{plan.progress.toFixed(1)}%</span>
                        </div>
                      </div>

                      <div className="plan-meta">
                        <small>Created: {plan.createdAt}</small>
                      </div>
                    </div>
                  ))}
                </div>
              )},
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Plan
