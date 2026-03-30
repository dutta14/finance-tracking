import { useState } from 'react'

export const useEditingState = () => {
  const [selectedPlanIds, setSelectedPlanIds] = useState<number[]>([])
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null)

  const togglePlanSelection = (planId: number, multi = false): void => {
    if (multi) {
      setSelectedPlanIds(prev =>
        prev.includes(planId) ? prev.filter(id => id !== planId) : [...prev, planId]
      )
    } else {
      setSelectedPlanIds(prev =>
        prev.length === 1 && prev[0] === planId ? [] : [planId]
      )
    }
  }

  const startEditing = (planId: number): void => {
    setEditingPlanId(planId)
  }

  const stopEditing = (): void => {
    setEditingPlanId(null)
  }

  const resetState = (): void => {
    setSelectedPlanIds([])
    setEditingPlanId(null)
  }

  return {
    selectedPlanIds,
    setSelectedPlanIds,
    editingPlanId,
    setEditingPlanId,
    togglePlanSelection,
    startEditing,
    stopEditing,
    resetState,
  }
}
