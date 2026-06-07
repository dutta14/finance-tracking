import { FinancialGoal } from '../../../types'
import { projectFIDateWithDrawdown, computeRequiredCorpus } from './goalCalculations'

export interface ProjectionRow {
  month: string
  expense: number
  remaining: number
  phase: 'accumulation' | 'drawdown'
  growthRate?: number
}

export function buildLifecycle(
  currentBalance: number,
  monthlyContribution: number,
  accumulationGrowthRate: number,
  drawdownGrowthRate: number,
  inflationRate: number,
  monthlyExpenseAtFI: number,
  endYear: number,
  fiDate: Date,
  retirementDate?: Date,
  corpusCapAtFI?: number,
  initialWithdrawal?: number,
): ProjectionRow[] {
  const monthlyAccGrowth = accumulationGrowthRate / 100 / 12
  const monthlyDrawGrowth = drawdownGrowthRate / 100 / 12

  const rows: ProjectionRow[] = []
  const now = new Date()
  const cursor = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(endYear, 11, 1)
  let balance = currentBalance
  let fiReached = false
  let expense = 0
  const fiYear = fiDate.getFullYear()
  let lastExpenseYear = fiYear

  while (cursor <= end && rows.length < 1200) {
    const label = cursor.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

    if (!fiReached) {
      const pastRetirement = retirementDate && cursor >= retirementDate
      const growth = pastRetirement ? monthlyDrawGrowth : monthlyAccGrowth
      const annualRate = pastRetirement ? drawdownGrowthRate : accumulationGrowthRate

      if (cursor >= fiDate) {
        fiReached = true
        balance = balance * (1 + growth) + monthlyContribution
        if (corpusCapAtFI && balance > corpusCapAtFI) balance = corpusCapAtFI
        rows.push({ month: label, expense: 0, remaining: balance, phase: 'accumulation', growthRate: annualRate })
        expense = initialWithdrawal || monthlyExpenseAtFI
        lastExpenseYear = fiYear
      } else {
        rows.push({ month: label, expense: 0, remaining: balance, phase: 'accumulation', growthRate: annualRate })
        balance = balance * (1 + growth) + monthlyContribution
        if (corpusCapAtFI && balance > corpusCapAtFI) balance = corpusCapAtFI
      }
    } else {
      const curYear = cursor.getFullYear()
      if (curYear > lastExpenseYear) {
        const yearsFromFI = curYear - fiYear
        expense = (initialWithdrawal || monthlyExpenseAtFI) * Math.pow(1 + inflationRate / 100, yearsFromFI)
        lastExpenseYear = curYear
      }

      const pastRetirement = retirementDate && cursor >= retirementDate
      const drawRate = pastRetirement ? monthlyDrawGrowth : monthlyAccGrowth
      const annualRate = pastRetirement ? drawdownGrowthRate : accumulationGrowthRate
      rows.push({ month: label, expense, remaining: balance, phase: 'drawdown', growthRate: annualRate })
      balance = balance * (1 + drawRate) - expense
    }

    cursor.setMonth(cursor.getMonth() + 1)
  }

  return rows
}

export function buildPlannedProjection(
  goal: FinancialGoal,
  profileBirthday: string,
  currentBalance: number,
  _monthlyContribution?: number,
  accGrowthOverride?: number,
): ProjectionRow[] {
  const birthday = profileBirthday || goal.birthday
  if (!birthday || !goal.goalEndYear) return []

  const accGrowth = accGrowthOverride ?? 8
  const drawGrowth = goal.growth || 6
  const inflation = goal.inflationRate || 3
  const endYear = new Date(goal.goalEndYear).getFullYear()

  const [by, bm] = birthday.split('-').map(Number)
  const retirementDate = new Date(by + goal.retirementAge, bm - 1, 1)

  const endOfLife = new Date(endYear, 11, 1)
  const monthlyExpenseAtFI = goal.monthlyExpense2047

  const corpusCap = computeRequiredCorpus(
    retirementDate,
    endOfLife,
    retirementDate,
    monthlyExpenseAtFI,
    inflation,
    accGrowth,
    drawGrowth,
  )

  const now = new Date()
  const monthsToRetirement =
    (retirementDate.getFullYear() - now.getFullYear()) * 12 + (retirementDate.getMonth() - now.getMonth())
  const r = accGrowth / 100 / 12
  const fvOfCurrent = currentBalance * Math.pow(1 + r, monthsToRetirement)
  const needed = corpusCap - fvOfCurrent
  const plannedContribution = needed > 0 ? (needed * r) / (Math.pow(1 + r, monthsToRetirement) - 1) : 0

  return buildLifecycle(
    currentBalance,
    plannedContribution,
    accGrowth,
    drawGrowth,
    inflation,
    monthlyExpenseAtFI,
    endYear,
    retirementDate,
    retirementDate,
    corpusCap,
  )
}

export function buildProjectedLifecycle(
  goal: FinancialGoal,
  profileBirthday: string,
  currentBalance: number,
  monthlyContribution: number,
  accGrowthOverride?: number,
): ProjectionRow[] {
  const birthday = profileBirthday || goal.birthday
  if (!birthday || !goal.goalEndYear) return []

  const accGrowth = accGrowthOverride ?? 8
  const drawGrowth = goal.growth || 6
  const inflation = goal.inflationRate || 3
  const endYear = new Date(goal.goalEndYear).getFullYear()

  const now = new Date()
  const [by, bm] = birthday.split('-').map(Number)
  const retirementDate = new Date(by + goal.retirementAge, bm - 1, 1)
  const retirementYear = retirementDate.getFullYear()
  const nowYear = now.getFullYear()
  const monthlyExpenseThisYear = goal.monthlyExpense2047 / Math.pow(1 + inflation / 100, retirementYear - nowYear)

  const endOfLife = new Date(endYear, 11, 1)
  const fiResult = projectFIDateWithDrawdown(
    currentBalance,
    monthlyContribution * 12,
    accGrowth,
    drawGrowth,
    monthlyExpenseThisYear,
    inflation,
    endOfLife,
    retirementDate,
  )
  const fiDate = fiResult ? fiResult.date : endOfLife
  const corpusCap = fiResult?.requiredCorpus

  const fiYear = fiDate.getFullYear()
  const monthlyExpenseAtFI = monthlyExpenseThisYear * Math.pow(1 + inflation / 100, fiYear - nowYear)

  return buildLifecycle(
    currentBalance,
    monthlyContribution,
    accGrowth,
    drawGrowth,
    inflation,
    monthlyExpenseAtFI,
    endYear,
    fiDate,
    retirementDate,
    corpusCap,
  )
}
