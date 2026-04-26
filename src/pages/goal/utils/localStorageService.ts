import { FinancialGoal } from '../../../types'

const STORAGE_KEY = 'financialGoals'
const LEGACY_STORAGE_KEY = 'financialPlans'

// Migrate legacy field names (planName → goalName, etc.)
const migrateFields = (items: any[]): FinancialGoal[] =>
  items.map(item => {
    const migrated = { ...item }
    if ('planName' in migrated) {
      migrated.goalName = migrated.planName
      delete migrated.planName
    }
    if ('planCreatedIn' in migrated) {
      migrated.goalCreatedIn = migrated.planCreatedIn
      delete migrated.planCreatedIn
    }
    if ('planEndYear' in migrated) {
      migrated.goalEndYear = migrated.planEndYear
      delete migrated.planEndYear
    }
    return migrated as FinancialGoal
  })

export const loadGoalsFromStorage = (): FinancialGoal[] => {
  try {
    const savedGoals = localStorage.getItem(STORAGE_KEY)
    if (savedGoals) {
      const parsed = JSON.parse(savedGoals)
      if (parsed.length > 0) return migrateFields(parsed)
    }

    // Migrate from legacy key (also runs if new key held an empty array)
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacy) {
      const parsed = migrateFields(JSON.parse(legacy))
      if (parsed.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
        localStorage.removeItem(LEGACY_STORAGE_KEY)
        return parsed
      }
    }

    return savedGoals ? [] : []
  } catch (err) {
    console.error('Failed to load goals from localStorage:', err)
    return []
  }
}

export const saveGoalsToStorage = (goals: FinancialGoal[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goals))
  } catch (err) {
    console.error('Failed to save goals to localStorage:', err)
  }
}

export const migrateGoals = (goalsToMigrate: FinancialGoal[]): FinancialGoal[] => {
  return migrateFields(goalsToMigrate).map(goal => {
    if (goal.fiGoal === 0 && goal.expenseValue2047 > 0 && goal.safeWithdrawalRate > 0) {
      const annualExpenseAtRetirement = goal.expenseValue2047
      const safeWithdrawalRateDecimal = goal.safeWithdrawalRate / 100
      const calculatedFiGoal = annualExpenseAtRetirement / safeWithdrawalRateDecimal
      return { ...goal, fiGoal: calculatedFiGoal }
    }
    return goal
  })
}
