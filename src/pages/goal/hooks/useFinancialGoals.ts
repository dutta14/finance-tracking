import { useState, useEffect, useRef } from 'react'
import { FinancialGoal } from '../../../types'
import { GOALS_PATH, loadGoalsFile, migrateGoals, saveGoalsPart } from '../utils/localStorageService'
import { useFileStore } from '../../../contexts/FileStoreContext'

export const useFinancialGoals = () => {
  const { fileStore } = useFileStore()
  const [goals, setGoals] = useState<FinancialGoal[]>([])

  const loadedRef = useRef(false)
  const fromSyncRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    const refresh = () => {
      loadGoalsFile(fileStore)
        .then(file => {
          if (cancelled) return
          fromSyncRef.current = true
          setGoals(migrateGoals(file.financialGoals))
          loadedRef.current = true
        })
        .catch(err => {
          console.error('Failed to initialize goals:', err)
          loadedRef.current = true
        })
    }

    refresh()
    const unsubscribe = fileStore.subscribe(GOALS_PATH, refresh)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [fileStore])

  useEffect(() => {
    if (!loadedRef.current) return
    if (fromSyncRef.current) {
      fromSyncRef.current = false
      return
    }
    saveGoalsPart(fileStore, { financialGoals: goals })
  }, [goals, fileStore])

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
