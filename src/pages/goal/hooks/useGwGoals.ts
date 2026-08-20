import { useState, useEffect, useRef } from 'react'
import { GwGoal } from '../../../types'
import { GOALS_PATH, loadGoalsFile, migrateGwFields, saveGoalsPart } from '../utils/localStorageService'
import { useFileStore } from '../../../contexts/FileStoreContext'

export const useGwGoals = () => {
  const { fileStore } = useFileStore()
  const [gwGoals, setGwGoals] = useState<GwGoal[]>([])

  const loadedRef = useRef(false)
  const fromSyncRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    const refresh = () => {
      loadGoalsFile(fileStore)
        .then(file => {
          if (cancelled) return
          fromSyncRef.current = true
          setGwGoals(migrateGwFields(file.gwGoals as unknown as Record<string, unknown>[]))
          loadedRef.current = true
        })
        .catch(err => {
          console.error('Failed to initialize general wealth goals:', err)
          fromSyncRef.current = true
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
    saveGoalsPart(fileStore, { gwGoals })
  }, [gwGoals, fileStore])

  const createGwGoal = (goal: Omit<GwGoal, 'id' | 'createdAt'>): void => {
    const next: GwGoal = { ...goal, id: Date.now(), createdAt: new Date().toISOString() }
    setGwGoals(prev => [...prev, next])
  }

  const deleteGwGoal = (id: number): void => {
    setGwGoals(prev => prev.filter(p => p.id !== id))
  }

  const deleteGwGoalsForFiGoal = (fiGoalId: number): void => {
    setGwGoals(prev => prev.filter(p => p.fiGoalId !== fiGoalId))
  }

  const updateGwGoal = (id: number, updates: Partial<Omit<GwGoal, 'id' | 'createdAt' | 'fiGoalId'>>): void => {
    setGwGoals(prev => prev.map(p => (p.id === id ? { ...p, ...updates } : p)))
  }

  const importGwGoals = (incoming: GwGoal[]): void => {
    setGwGoals(incoming)
  }

  return { gwGoals, createGwGoal, updateGwGoal, deleteGwGoal, deleteGwGoalsForFiGoal, importGwGoals }
}
