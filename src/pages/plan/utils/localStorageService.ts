import { FinancialPlan } from '../../../types'

const STORAGE_KEY = 'financialPlans'

export const loadPlansFromStorage = (): FinancialPlan[] => {
  try {
    const savedPlans = localStorage.getItem(STORAGE_KEY)
    return savedPlans ? JSON.parse(savedPlans) : []
  } catch (err) {
    console.error('Failed to load plans from localStorage:', err)
    return []
  }
}

export const savePlansToStorage = (plans: FinancialPlan[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans))
  } catch (err) {
    console.error('Failed to save plans to localStorage:', err)
  }
}

export const migratePlans = (plansToMigrate: FinancialPlan[]): FinancialPlan[] => {
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
