import { useState, useEffect, useRef } from 'react'
import { GwGoal } from '../../../types'
import { appStorage } from '../../../utils/appStorage'

const STORAGE_KEY = 'gw-goals'
const LEGACY_STORAGE_KEY = 'gw-plans'

// Migrate legacy field names (fiPlanId → fiGoalId)
const migrateGwFields = (items: Record<string, unknown>[]): GwGoal[] =>
  items.map(item => {
    const migrated = { ...item }
    if ('fiPlanId' in migrated) {
      migrated.fiGoalId = migrated.fiPlanId
      delete migrated.fiPlanId
    }
    return migrated as unknown as GwGoal
  })

const load = (): GwGoal[] => {
  try {
    const raw = appStorage.getString(STORAGE_KEY)
    if (raw) {
      const parsed = migrateGwFields(JSON.parse(raw))
      if (parsed.length > 0) return parsed
    }

    // Migrate from legacy key (also runs if new key held an empty array)
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacy) {
      const parsed = migrateGwFields(JSON.parse(legacy))
      if (parsed.length > 0) {
        appStorage.setJSON(STORAGE_KEY, parsed)
        localStorage.removeItem(LEGACY_STORAGE_KEY)
        return parsed
      }
    }

    return []
  } catch {
    return []
  }
}

export const useGwGoals = () => {
  const [gwGoals, setGwGoals] = useState<GwGoal[]>(load)

  const fromSyncRef = useRef(false)

  // Cross-tab sync: reload when another tab writes to storage
  useEffect(() => {
    const unsub = appStorage.subscribe(STORAGE_KEY, () => {
      try {
        const loaded = load()
        fromSyncRef.current = true
        setGwGoals(loaded)
      } catch {
        /* load failed — don't set fromSyncRef so next local save proceeds normally */
      }
    })
    return unsub
  }, [])

  useEffect(() => {
    if (fromSyncRef.current) {
      fromSyncRef.current = false
      return
    }
    appStorage.setJSON(STORAGE_KEY, gwGoals)
  }, [gwGoals])

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
