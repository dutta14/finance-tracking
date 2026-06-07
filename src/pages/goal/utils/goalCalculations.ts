/** Default pre-FI accumulation growth rate (%). Used for savings projections. */
export const DEFAULT_PRE_FI_GROWTH_RATE = 8

// Helper function to calculate Future Value
export const calculateFV = (monthlyRate: number, months: number, presentValue: number): number => {
  return presentValue * Math.pow(1 + monthlyRate, months)
}

// Calculate all financial metrics for a goal
export interface GoalCalculations {
  monthlyExpenseAtCreation: number
  retirementDate: Date
  retirementDateFormatted: string
  monthsBetween: number
  monthlyExpenseAtRetirement: number
  annualExpenseAtRetirement: number
  fiGoal: number
}

export const calculateGoalMetrics = (
  annualExpense: number,
  birthday: string,
  retirementAge: number,
  goalCreatedIn: string,
  inflationRate: number,
  safeWithdrawalRate: number,
  getMonthsBetween: (start: Date, end: Date) => number,
  parseDate: (dateStr: string) => Date,
): GoalCalculations => {
  const monthlyExpenseAtCreation = annualExpense / 12

  const birthDate = parseDate(birthday)
  const retirementDate = new Date(birthDate.getFullYear() + retirementAge, birthDate.getMonth(), birthDate.getDate())
  const retirementDateFormatted = retirementDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

  const [gcYear, gcMonth] = goalCreatedIn.split('-').map(Number)
  const goalCreatedDate = new Date(gcYear, gcMonth - 1, 1)
  const monthsBetween = getMonthsBetween(goalCreatedDate, retirementDate)

  const yearsToRetirement = retirementDate.getFullYear() - goalCreatedDate.getFullYear()
  const annualExpenseAtRetirement = annualExpense * Math.pow(1 + (inflationRate || 0) / 100, yearsToRetirement)
  const monthlyExpenseAtRetirement = annualExpenseAtRetirement / 12

  const safeWithdrawalRateDecimal = (safeWithdrawalRate || 0) / 100
  const fiGoal = safeWithdrawalRateDecimal > 0 ? annualExpenseAtRetirement / safeWithdrawalRateDecimal : 0

  return {
    monthlyExpenseAtCreation,
    retirementDate,
    retirementDateFormatted,
    monthsBetween,
    monthlyExpenseAtRetirement,
    annualExpenseAtRetirement,
    fiGoal,
  }
}

/**
 * Project when net worth + monthly contributions at a growth rate will reach fiGoal.
 * Returns null if not calculable.
 */
export function projectFIDate(
  currentNetWorth: number,
  fiGoal: number,
  annualSavings: number,
  growthRate: number, // annual percentage, e.g. 7
): { date: Date; months: number } | null {
  if (fiGoal <= 0) return null
  if (currentNetWorth >= fiGoal) return { date: new Date(), months: 0 }
  if (annualSavings <= 0 && currentNetWorth < fiGoal) return null

  const monthlyRate = growthRate / 100 / 12
  const monthlySavings = annualSavings / 12
  let balance = currentNetWorth
  const now = new Date()

  for (let m = 1; m <= 1200; m++) {
    // cap at 100 years
    if (monthlyRate > 0) {
      balance = balance * (1 + monthlyRate) + monthlySavings
    } else {
      balance += monthlySavings // linear if 0% growth
    }
    if (balance >= fiGoal) {
      const projected = new Date(now.getFullYear(), now.getMonth() + m, 1)
      return { date: projected, months: m }
    }
  }
  return null // unreachable in 100 years
}

/**
 * Two-phase FI projection: finds the earliest month you can retire such that
 * the portfolio sustains inflation-adjusted withdrawals through end of life.
 *
 * Computes minimum corpus at FI date that depletes to exactly $0 at end of life.
 * Backward recursion: balance[N]=0, balance[d] = (balance[d+1] + expense[d]) / (1 + g[d])
 * Growth: accumulationGrowthRate until retirementDate, then drawdownGrowthRate.
 */
export function computeRequiredCorpus(
  fiDate: Date,
  endOfLife: Date,
  retirementDate: Date,
  monthlyExpenseAtFI: number,
  inflationRate: number,
  accumulationGrowthRate: number,
  drawdownGrowthRate: number,
): number {
  const monthlyAccGrowth = accumulationGrowthRate / 100 / 12
  const monthlyDrawGrowth = drawdownGrowthRate / 100 / 12

  const totalMonths = (endOfLife.getFullYear() - fiDate.getFullYear()) * 12 + (endOfLife.getMonth() - fiDate.getMonth())
  if (totalMonths <= 0) return 0

  const fiYear = fiDate.getFullYear()

  // Work backwards from death ($0) to FI date
  // Use d+1 offset so growth rate aligns with forward display loop (which starts at fiDate+1)
  let balance = 0
  for (let d = totalMonths - 1; d >= 0; d--) {
    const monthDate = new Date(fiDate.getFullYear(), fiDate.getMonth() + d + 1, 1)
    const pastRetirement = monthDate >= retirementDate
    const growth = pastRetirement ? monthlyDrawGrowth : monthlyAccGrowth
    // Annual inflation: expense is flat within a year, steps at year boundary
    const yearsFromFI = monthDate.getFullYear() - fiYear
    const expense = monthlyExpenseAtFI * Math.pow(1 + inflationRate / 100, yearsFromFI)
    balance = (balance + expense) / (1 + growth)
  }

  return balance
}

/**
 * Projects earliest FI date where accumulated savings >= required corpus (depletes to $0 at death).
 * Returns FI date, required corpus, and effective SWR.
 */
export function projectFIDateWithDrawdown(
  currentNetWorth: number,
  annualSavings: number,
  accumulationGrowthRate: number,
  drawdownGrowthRate: number,
  monthlyExpenseToday: number,
  inflationRate: number,
  endOfLife: Date,
  retirementDate?: Date,
): { date: Date; months: number; requiredCorpus: number; effectiveSWR: number } | null {
  if (annualSavings <= 0 && currentNetWorth <= 0) return null

  const monthlyAccRate = accumulationGrowthRate / 100 / 12
  const monthlyDrawRate = drawdownGrowthRate / 100 / 12
  const monthlySavings = annualSavings / 12
  const now = new Date()
  const nowYear = now.getFullYear()
  let balance = currentNetWorth
  const retDate = retirementDate || endOfLife

  for (let m = 1; m <= 1200; m++) {
    const candidateDate = new Date(now.getFullYear(), now.getMonth() + m, 1)
    const pastRetirement = retirementDate && candidateDate >= retirementDate
    const accRate = pastRetirement ? monthlyDrawRate : monthlyAccRate

    balance = balance * (1 + accRate) + monthlySavings

    if (candidateDate >= endOfLife) {
      return { date: candidateDate, months: m, requiredCorpus: 0, effectiveSWR: 100 }
    }

    // Annual inflation: expense for year Y = monthlyExpenseToday * (1+rate)^(Y - nowYear)
    const yearsFromNow = candidateDate.getFullYear() - nowYear
    const expenseAtFI = monthlyExpenseToday * Math.pow(1 + inflationRate / 100, yearsFromNow)
    const requiredCorpus = computeRequiredCorpus(
      candidateDate,
      endOfLife,
      retDate,
      expenseAtFI,
      inflationRate,
      accumulationGrowthRate,
      drawdownGrowthRate,
    )

    if (balance >= requiredCorpus) {
      const annualExpenseAtFI = expenseAtFI * 12
      const effectiveSWR = requiredCorpus > 0 ? (annualExpenseAtFI / requiredCorpus) * 100 : 0
      return { date: candidateDate, months: m, requiredCorpus, effectiveSWR }
    }
  }
  return null
}
