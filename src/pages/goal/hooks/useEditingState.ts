import { useState } from 'react'

export const useEditingState = () => {
  const [selectedGoalIds, setSelectedGoalIds] = useState<number[]>([])
  const [editingGoalId, setEditingGoalId] = useState<number | null>(null)

  const toggleGoalSelection = (goalId: number, multi = false): void => {
    if (multi) {
      setSelectedGoalIds(prev => (prev.includes(goalId) ? prev.filter(id => id !== goalId) : [...prev, goalId]))
    } else {
      setSelectedGoalIds(prev => (prev.length === 1 && prev[0] === goalId ? [] : [goalId]))
    }
  }

  const startEditing = (goalId: number): void => {
    setEditingGoalId(goalId)
  }

  const stopEditing = (): void => {
    setEditingGoalId(null)
  }

  const resetState = (): void => {
    setSelectedGoalIds([])
    setEditingGoalId(null)
  }

  return {
    selectedGoalIds,
    setSelectedGoalIds,
    editingGoalId,
    setEditingGoalId,
    toggleGoalSelection,
    startEditing,
    stopEditing,
    resetState,
  }
}
