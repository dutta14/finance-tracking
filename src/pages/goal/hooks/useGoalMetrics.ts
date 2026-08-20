import { useMemo, useState, useEffect } from 'react'
import { FinancialGoal, GwGoal } from '../../../types'
import { useData } from '../../../contexts/DataContext'
import { Account, BalanceEntry } from '../../data/types'
import { getFiTarget, projectFIDate, projectFIDateWithDrawdown } from '../utils/goalCalculations'
import { calcMonthlySaving, getRetirementMonth, monthsBetween } from '../utils/goalMath'
import { getBudgetSaveRate } from '../../budget/utils/budgetStorage'
import { useFileStore } from '../../../contexts/FileStoreContext'

export interface GoalMetrics {
  fiTarget: number
  fiProgress: number
  fiMonthly: number
  gwTotal: number
  gwProgress: number
  gwMonthly: number
  retirementYear: number
  retirementMonth: number
  projectedFIDate: Date | null
  projectedFILabel: string | null
  projectedState: 'reached' | 'projected' | 'not-reachable' | 'no-budget' | 'no-goal'
}

interface GrowthSettings {
  preBoundaryGrowth: number
  postBoundaryGrowth: number
  ageBoundary: number
  gwGrowth: number
  inflation: number
}

const GROWTH_DEFAULTS: GrowthSettings = {
  preBoundaryGrowth: 8,
  postBoundaryGrowth: 6,
  ageBoundary: 60,
  gwGrowth: 8,
  inflation: 3,
}

function loadGrowthSettings(): GrowthSettings {
  try {
    const raw = localStorage.getItem('goal-growth-settings')
    if (raw) return { ...GROWTH_DEFAULTS, ...JSON.parse(raw) }
  } catch {}
  return { ...GROWTH_DEFAULTS }
}

function getTotalForMonth(accounts: Account[], balances: BalanceEntry[], month: string, goalType: 'fi' | 'gw'): number {
  const balMap = new Map<number, number>()
  for (const b of balances) if (b.month === month) balMap.set(b.accountId, b.balance)
  return accounts
    .filter(a => a.goalType === goalType && a.status === 'active')
    .reduce((sum, a) => sum + (balMap.get(a.id) ?? 0), 0)
}

function getGwTargetForGoal(
  goal: FinancialGoal,
  gwGoals: GwGoal[],
  profileBirthday: string,
  inflation: number,
): number {
  const goalGws = gwGoals.filter(g => g.fiGoalId === goal.id)
  if (!goalGws.length || !profileBirthday) return 0
  const [by, bm] = profileBirthday.split('-').map(Number)
  const created = new Date(goal.goalCreatedIn)
  return goalGws.reduce((sum, gw) => {
    const disburseYear = by + gw.disburseAge
    const months = Math.max(0, (disburseYear - created.getUTCFullYear()) * 12 + (bm - (created.getUTCMonth() + 1)))
    const disbTarget = gw.disburseAmount * Math.pow(1 + inflation / 100 / 12, months)
    const mRetToDisb = Math.max(0, (gw.disburseAge - goal.retirementAge) * 12)
    const pv = mRetToDisb > 0 ? disbTarget / Math.pow(1 + gw.growthRate / 100 / 12, mRetToDisb) : disbTarget
    return sum + pv
  }, 0)
}

/**
 * Computes goal display metrics for all goals.
 * Single source of truth — used by GoalsPeek, GoalMiniCard, GoalDetail.
 * Uses the same growth settings, budget data, and projection logic as GoalDetailedCard.
 */
export function useGoalMetrics(
  goals: FinancialGoal[],
  gwGoals: GwGoal[],
  profileBirthday: string,
): Map<number, GoalMetrics> {
  const { accounts, balances, allMonths } = useData()
  const { fileStore } = useFileStore()
  const [budgetSaveRate, setBudgetSaveRate] = useState<Awaited<ReturnType<typeof getBudgetSaveRate>>>(null)

  useEffect(() => {
    let cancelled = false
    getBudgetSaveRate(fileStore)
      .then(r => { if (!cancelled) setBudgetSaveRate(r) })
      .catch(console.error)
    return () => { cancelled = true }
  }, [fileStore])

  return useMemo(() => {
    const settings = loadGrowthSettings()
    const latestMonth = allMonths[allMonths.length - 1] || ''
    const fiTotal = latestMonth ? getTotalForMonth(accounts, balances, latestMonth, 'fi') : 0
    const gwBal = latestMonth ? getTotalForMonth(accounts, balances, latestMonth, 'gw') : 0
    const annualSavings = budgetSaveRate?.annualSavings ?? null

    const map = new Map<number, GoalMetrics>()

    for (const goal of goals) {
      const { preBoundaryGrowth, postBoundaryGrowth, ageBoundary, gwGrowth, inflation } = settings
      const fiTarget = getFiTarget(goal, profileBirthday, preBoundaryGrowth, postBoundaryGrowth, ageBoundary, inflation)
      const fiProgress = fiTarget > 0 ? Math.min(100, Math.max(0, (fiTotal / fiTarget) * 100)) : 0

      // Retirement timing
      const [by, bm] = profileBirthday.split('-').map(Number)
      const retirementYear = by + goal.retirementAge
      const retMonth = getRetirementMonth(profileBirthday, goal.retirementAge)
      const n = latestMonth ? monthsBetween(latestMonth, retMonth) : 0

      // Monthly savings needed
      const fiMonthly = fiTarget > 0 && n > 0 ? calcMonthlySaving(fiTotal, fiTarget, preBoundaryGrowth, n) : 0

      // GW metrics
      const gwTarget = getGwTargetForGoal(goal, gwGoals, profileBirthday, inflation)
      const gwProgress = gwTarget > 0 ? Math.min(100, Math.max(0, (gwBal / gwTarget) * 100)) : 0
      const gwMonthly = gwTarget > 0 && n > 0 ? calcMonthlySaving(gwBal, gwTarget, gwGrowth, n) : 0

      // Projected FI date — same logic as GoalDetailedCard
      let projectedFILabel: string | null = null
      let projectedFIDate: Date | null = null
      let projectedState: GoalMetrics['projectedState'] = 'no-goal'

      if (fiTarget > 0) {
        if (fiTotal >= fiTarget) {
          projectedState = 'reached'
          projectedFILabel = '🎉 Goal reached!'
        } else if (!annualSavings || annualSavings <= 0) {
          projectedState = annualSavings === null ? 'no-budget' : 'not-reachable'
          projectedFILabel = annualSavings === null ? 'Add budget data →' : 'Not reachable at current rate'
        } else {
          const fiAnnualSavings = Math.max(0, annualSavings - gwMonthly * 12)
          if (fiAnnualSavings <= 0) {
            projectedState = 'not-reachable'
            projectedFILabel = 'Not reachable at current rate'
          } else {
            const endOfLife = goal.goalEndYear ? new Date(goal.goalEndYear) : null
            // Monthly expense in today's dollars (same deflation as GoalDetailedCard)
            let monthlyExpenseNow: number
            if (goal.monthlyExpenseRetirement && goal.monthlyExpenseRetirement > 0) {
              const retYear = by + goal.retirementAge
              const yearsToRetirement = retYear - new Date().getFullYear()
              monthlyExpenseNow = goal.monthlyExpenseRetirement / Math.pow(1 + inflation / 100, yearsToRetirement)
            } else {
              monthlyExpenseNow = (goal.expenseValue || 0) / 12
            }
            const ageBoundaryDate = new Date(by + ageBoundary, bm - 1, 1)

            const result =
              endOfLife && monthlyExpenseNow > 0
                ? projectFIDateWithDrawdown(
                    fiTotal,
                    fiAnnualSavings,
                    preBoundaryGrowth,
                    postBoundaryGrowth,
                    monthlyExpenseNow,
                    inflation,
                    endOfLife,
                    ageBoundaryDate,
                  )
                : projectFIDate(fiTotal, fiTarget, fiAnnualSavings, preBoundaryGrowth)

            if (result && result.months === 0) {
              projectedState = 'reached'
              projectedFILabel = '🎉 Goal reached!'
            } else if (result) {
              projectedState = 'projected'
              projectedFIDate = result.date
              projectedFILabel = result.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
            } else {
              projectedState = 'not-reachable'
              projectedFILabel = 'Not reachable at current rate'
            }
          }
        }
      }

      map.set(goal.id, {
        fiTarget,
        fiProgress,
        fiMonthly,
        gwTotal: gwTarget,
        gwProgress,
        gwMonthly,
        retirementYear,
        retirementMonth: bm,
        projectedFIDate,
        projectedFILabel,
        projectedState,
      })
    }

    return map
  }, [goals, gwGoals, profileBirthday, accounts, balances, allMonths, budgetSaveRate])
}
