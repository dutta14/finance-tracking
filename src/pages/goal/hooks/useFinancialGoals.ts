import { useState, useEffect } from 'react'
import { FinancialGoal } from '../../../types'
import { loadGoalsFromStorage, saveGoalsToStorage, migrateGoals } from '../utils/localStorageService'

export const useFinancialGoals = () => {
  const [goals, setGoals] = useState<FinancialGoal[]>(() => {
    try {
      const loadedGoals = loadGoalsFromStorage()
      return migrateGoals(loadedGoals)
    } catch (err) {
      console.error('Failed to initialize goals:', err)
      return []
    }
  })

  // Save goals to localStorage whenever they change
  useEffect(() => {
    saveGoalsToStorage(goals)
  }, [goals])

  const createGoal = (goal: FinancialGoal): void => {
    setGoals(prev => [goal, ...prev])
  }

  const updateGoal = (goalId: number, updatedGoal: FinancialGoal): void => {
    setGoals(prev => prev.map(goal => (goal.id === goalId ? updatedGoal : goal)))
  }

  const deleteGoal = (goalId: number): void => {
    setGoals(prev => prev.filter(goal => goal.id !== goalId))
  }

  const importGoals = (incoming: FinancialGoal[]): void => {
    setGoals(migrateGoals(incoming))
  }

  const reorderGoals = (orderedIds: number[]): void => {
    setGoals(prev => {
      const map = new Map(prev.map(p => [p.id, p]))
      return orderedIds.map(id => map.get(id)).filter((p): p is FinancialGoal => p !== undefined)
    })
  }

  return {
    goals,
    createGoal,
    updateGoal,
    deleteGoal,
    importGoals,
    reorderGoals,
  }
}
