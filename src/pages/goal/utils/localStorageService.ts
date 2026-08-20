import { FinancialGoal, GwGoal } from '../../../types'
import type { FileStore } from '../../../utils/fileStoreTypes'

export const GOALS_PATH = 'goals.json'

export interface GoalsFile {
  financialGoals: FinancialGoal[]
  gwGoals: GwGoal[]
}

const EMPTY_FILE: GoalsFile = { financialGoals: [], gwGoals: [] }

// Migrate legacy field names (planName → goalName, etc.)
const migrateFields = (items: Record<string, unknown>[]): FinancialGoal[] =>
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
    if ('monthlyExpense2047' in migrated) {
      migrated.monthlyExpenseRetirement = migrated.monthlyExpense2047
      delete migrated.monthlyExpense2047
    }
    return migrated as unknown as FinancialGoal
  })

/** Migrate legacy GW field names (fiPlanId → fiGoalId) */
export const migrateGwFields = (items: Record<string, unknown>[]): GwGoal[] =>
  items.map(item => {
    const migrated = { ...item }
    if ('fiPlanId' in migrated) {
      migrated.fiGoalId = migrated.fiPlanId
      delete migrated.fiPlanId
    }
    return migrated as unknown as GwGoal
  })

/** Reads `goals.json`, normalizing both halves so callers always get arrays. */
export const loadGoalsFile = async (fileStore: FileStore): Promise<GoalsFile> => {
  try {
    const raw = await fileStore.readJSON<Partial<GoalsFile>>(GOALS_PATH, EMPTY_FILE)
    return {
      financialGoals: Array.isArray(raw?.financialGoals) ? raw.financialGoals : [],
      gwGoals: Array.isArray(raw?.gwGoals) ? raw.gwGoals : [],
    }
  } catch (err) {
    console.error('Failed to load goals:', err)
    return { financialGoals: [], gwGoals: [] }
  }
}

/** Writes both halves of `goals.json`. */
export const saveGoalsFile = async (
  fileStore: FileStore,
  financialGoals: FinancialGoal[],
  gwGoals: GwGoal[],
): Promise<void> => {
  await fileStore.writeJSON(GOALS_PATH, { financialGoals, gwGoals })
}

/*
 * `financialGoals` and `gwGoals` share one file and are owned by two separate
 * hooks. Serializing the read-modify-write cycle keeps one half from clobbering
 * the other when both change in the same tick.
 */
let writeQueue: Promise<void> = Promise.resolve()

/** Merges a partial update into `goals.json` without dropping the other half. */
export const saveGoalsPart = (fileStore: FileStore, part: Partial<GoalsFile>): Promise<void> => {
  writeQueue = writeQueue
    .then(async () => {
      const current = await loadGoalsFile(fileStore)
      await saveGoalsFile(
        fileStore,
        part.financialGoals ?? current.financialGoals,
        part.gwGoals ?? current.gwGoals,
      )
    })
    .catch(err => console.error('Failed to save goals:', err))
  return writeQueue
}

export const migrateGoals = (goalsToMigrate: FinancialGoal[]): FinancialGoal[] => {
  return migrateFields(goalsToMigrate as unknown as Record<string, unknown>[]).map(goal => {
    if (goal.fiGoal === 0 && goal.expenseValue2047 > 0 && goal.safeWithdrawalRate > 0) {
      const annualExpenseAtRetirement = goal.expenseValue2047
      const safeWithdrawalRateDecimal = goal.safeWithdrawalRate / 100
      const calculatedFiGoal = annualExpenseAtRetirement / safeWithdrawalRateDecimal
      return { ...goal, fiGoal: calculatedFiGoal }
    }
    return goal
  })
}
