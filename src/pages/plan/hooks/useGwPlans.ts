import { useState, useEffect } from 'react'
import { GwPlan } from '../../../types'

const STORAGE_KEY = 'gw-plans'

const load = (): GwPlan[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as GwPlan[]) : []
  } catch {
    return []
  }
}

export const useGwPlans = () => {
  const [gwPlans, setGwPlans] = useState<GwPlan[]>(load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gwPlans))
  }, [gwPlans])

  const createGwPlan = (plan: Omit<GwPlan, 'id' | 'createdAt'>): void => {
    const next: GwPlan = { ...plan, id: Date.now(), createdAt: new Date().toISOString() }
    setGwPlans(prev => [...prev, next])
  }

  const deleteGwPlan = (id: number): void => {
    setGwPlans(prev => prev.filter(p => p.id !== id))
  }

  const deleteGwPlansForFiPlan = (fiPlanId: number): void => {
    setGwPlans(prev => prev.filter(p => p.fiPlanId !== fiPlanId))
  }

  const updateGwPlan = (id: number, updates: Partial<Omit<GwPlan, 'id' | 'createdAt' | 'fiPlanId'>>): void => {
    setGwPlans(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
  }

  return { gwPlans, createGwPlan, updateGwPlan, deleteGwPlan, deleteGwPlansForFiPlan }
}
