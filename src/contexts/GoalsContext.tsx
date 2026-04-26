import { createContext, useContext, useState, useMemo, FC, ReactNode } from 'react'
import { FinancialGoal, GwGoal } from '../types'
import { useFinancialGoals } from '../pages/goal/hooks/useFinancialGoals'
import { useGwGoals } from '../pages/goal/hooks/useGwGoals'
import { useProfile } from '../hooks/useProfile'
import type { Profile } from '../hooks/useProfile'

export type { Profile } from '../hooks/useProfile'

export interface GoalsContextValue {
  goals: FinancialGoal[]
  gwGoals: GwGoal[]
  profile: Profile
  createGoal: (goal: FinancialGoal) => void
  updateGoal: (goalId: number, g: FinancialGoal) => void
  deleteGoal: (goalId: number) => void
  importGoals: (incoming: FinancialGoal[]) => void
  reorderGoals: (orderedIds: number[]) => void
  createGwGoal: (data: Omit<GwGoal, 'id' | 'createdAt'>) => void
  updateGwGoal: (id: number, u: Partial<Omit<GwGoal, 'id' | 'createdAt' | 'fiGoalId'>>) => void
  deleteGwGoal: (id: number) => void
  importGwGoals: (incoming: GwGoal[]) => void
  updateProfile: (updates: Partial<Profile>) => void
  visibleGoals: FinancialGoal[]
  pendingDelete: {
    ids: number[]
    savedGoals: FinancialGoal[]
    message: string
    timerId: ReturnType<typeof setTimeout>
  } | null
  handleDeleteWithUndo: (ids: number[]) => void
  handleUndoDelete: () => void
  handleDeleteGoal: (goalId: number) => void
  handleCopyGwGoals: (sourcePlanId: number, newPlanId: number) => void
  dismissPendingDelete: () => void
}

const GoalsContext = createContext<GoalsContextValue | null>(null)

export const useGoals = (): GoalsContextValue => {
  const ctx = useContext(GoalsContext)
  if (!ctx) {
    throw new Error(
      'useGoals must be used within a <GoalsProvider>. Wrap a parent component in <GoalsProvider> before calling useGoals().',
    )
  }
  return ctx
}

export const GoalsProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { goals, createGoal, updateGoal, deleteGoal, importGoals, reorderGoals } = useFinancialGoals()
  const { gwGoals, createGwGoal, updateGwGoal, deleteGwGoal, importGwGoals } = useGwGoals()
  const { profile, updateProfile } = useProfile()

  const [pendingDelete, setPendingDelete] = useState<GoalsContextValue['pendingDelete']>(null)

  const visibleGoals = pendingDelete ? goals.filter(p => !pendingDelete.ids.includes(p.id)) : goals

  const handleDeleteWithUndo = (ids: number[]): void => {
    if (pendingDelete) {
      clearTimeout(pendingDelete.timerId)
      pendingDelete.ids.forEach(id => deleteGoal(id))
      setPendingDelete(null)
    }
    const affectedGoals = goals.filter(p => ids.includes(p.id))
    const name = affectedGoals[0]?.goalName ?? 'Goal'
    const message = ids.length === 1 ? `"${name}" deleted` : `${ids.length} goals deleted`
    const timerId = setTimeout(() => {
      ids.forEach(id => deleteGoal(id))
      setPendingDelete(null)
    }, 10_000)
    setPendingDelete({ ids, savedGoals: affectedGoals, message, timerId })
  }

  const handleUndoDelete = (): void => {
    if (!pendingDelete) return
    clearTimeout(pendingDelete.timerId)
    setPendingDelete(null)
  }

  const handleDeleteGoal = (goalId: number): void => handleDeleteWithUndo([goalId])

  const handleCopyGwGoals = (sourcePlanId: number, newPlanId: number): void => {
    gwGoals
      .filter(g => g.fiGoalId === sourcePlanId)
      .forEach(g =>
        createGwGoal({
          fiGoalId: newPlanId,
          label: g.label,
          disburseAge: g.disburseAge,
          disburseAmount: g.disburseAmount,
          growthRate: g.growthRate,
          currentSavings: 0,
        }),
      )
  }

  const dismissPendingDelete = (): void => {
    if (!pendingDelete) return
    clearTimeout(pendingDelete.timerId)
    pendingDelete.ids.forEach(id => deleteGoal(id))
    setPendingDelete(null)
  }

  const value = useMemo<GoalsContextValue>(
    () => ({
      goals,
      gwGoals,
      profile,
      createGoal,
      updateGoal,
      deleteGoal,
      importGoals,
      reorderGoals,
      createGwGoal,
      updateGwGoal,
      deleteGwGoal,
      importGwGoals,
      updateProfile,
      visibleGoals,
      pendingDelete,
      handleDeleteWithUndo,
      handleUndoDelete,
      handleDeleteGoal,
      handleCopyGwGoals,
      dismissPendingDelete,
    }),
    [goals, gwGoals, profile, visibleGoals, pendingDelete],
  ) // eslint-disable-line react-hooks/exhaustive-deps

  return <GoalsContext.Provider value={value}>{children}</GoalsContext.Provider>
}

export default GoalsContext
