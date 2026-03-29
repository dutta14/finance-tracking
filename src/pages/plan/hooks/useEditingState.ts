import { useState } from 'react'

export const useEditingState = () => {
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null)
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null)

  const togglePlanSelection = (planId: number): void => {
    setSelectedPlanId(selectedPlanId === planId ? null : planId)
  }

  const startEditing = (planId: number): void => {
    setEditingPlanId(planId)
  }

  const stopEditing = (): void => {
    setEditingPlanId(null)
  }

  const resetState = (): void => {
    setSelectedPlanId(null)
    setEditingPlanId(null)
  }

  return {
    selectedPlanId,
    setSelectedPlanId,
    editingPlanId,
    setEditingPlanId,
    togglePlanSelection,
    startEditing,
    stopEditing,
    resetState
  }
}
