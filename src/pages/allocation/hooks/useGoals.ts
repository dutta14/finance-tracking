import { useMemo } from 'react'
import { Profile } from '../../../hooks/useProfile'
import { GoalOwner, RatioGoal } from '../types'

export function useGoals() {
  const profile: Profile = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user-profile') || '{}')
    } catch {
      return {} as Profile
    }
  }, [])

  const getAge = (owner: GoalOwner): number | null => {
    const bday = owner === 'partner' ? profile.partner?.birthday : profile.birthday
    if (!bday) return null
    const bd = new Date(bday)
    if (isNaN(bd.getTime())) return null
    const now = new Date()
    let age = now.getFullYear() - bd.getFullYear()
    if (now.getMonth() < bd.getMonth() || (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())) age--
    return age
  }

  const computeGoalPcts = (goal: RatioGoal, numGroups: number): number[] | null => {
    if (goal.type === 'constant') {
      return goal.pcts.length === numGroups ? goal.pcts : null
    }
    const age = getAge(goal.owner)
    if (age === null) return null
    if (goal.startPcts.length !== numGroups || goal.endPcts.length !== numGroups) return null
    if (age <= goal.startAge) return goal.startPcts
    if (age >= goal.endAge) return goal.endPcts
    const progress = (age - goal.startAge) / (goal.endAge - goal.startAge)
    return goal.startPcts.map((sp, i) => {
      const ep = goal.endPcts[i]
      return Math.round(sp + (ep - sp) * progress)
    })
  }

  return { profile, getAge, computeGoalPcts }
}
