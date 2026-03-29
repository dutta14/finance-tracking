import { useState, useEffect } from 'react'
import { FinancialPlan } from '../../../types'
import { loadPlansFromStorage, savePlansToStorage, migratePlans } from '../utils/localStorageService'

export const useFinancialPlans = () => {
  const [plans, setPlans] = useState<FinancialPlan[]>(() => {
    try {
      const loadedPlans = loadPlansFromStorage()
      return migratePlans(loadedPlans)
    } catch (err) {
      console.error('Failed to initialize plans:', err)
      return []
    }
  })

  // Save plans to localStorage whenever they change
  useEffect(() => {
    savePlansToStorage(plans)
  }, [plans])

  const createPlan = (plan: FinancialPlan): void => {
    setPlans(prev => [plan, ...prev])
  }

  const updatePlan = (planId: number, updatedPlan: FinancialPlan): void => {
    setPlans(prev => prev.map(plan => plan.id === planId ? updatedPlan : plan))
  }

  const deletePlan = (planId: number): void => {
    setPlans(prev => prev.filter(plan => plan.id !== planId))
  }

  return {
    plans,
    createPlan,
    updatePlan,
    deletePlan
  }
}
