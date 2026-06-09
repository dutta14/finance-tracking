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
  growthRate: number,
  goalEndYear: string,
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

  const endYear = goalEndYear ? new Date(goalEndYear).getFullYear() : birthDate.getFullYear() + 90
  const endOfLife = new Date(endYear, 11, 1)
  const ageBoundaryDate = new Date(birthDate.getFullYear() + 60, birthDate.getMonth(), 1)
  const fiGoal = computeRequiredCorpus(
    retirementDate,
    endOfLife,
    ageBoundaryDate,
    monthlyExpenseAtRetirement,
    inflationRate,
    growthRate,
    6,
  )

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
 * Growth: preBoundaryGrowth until ageBoundaryDate, then postBoundaryGrowth.
 */
export function computeRequiredCorpus(
  fiDate: Date,
  endOfLife: Date,
  ageBoundaryDate: Date,
  monthlyExpenseAtFI: number,
  inflationRate: number,
  preBoundaryGrowth: number,
  postBoundaryGrowth: number,
): number {
  const monthlyPreGrowth = preBoundaryGrowth / 100 / 12
  const monthlyPostGrowth = postBoundaryGrowth / 100 / 12

  const totalMonths = (endOfLife.getFullYear() - fiDate.getFullYear()) * 12 + (endOfLife.getMonth() - fiDate.getMonth())
  if (totalMonths <= 0) return 0

  const fiYear = fiDate.getFullYear()

  let balance = 0
  for (let d = totalMonths - 1; d >= 0; d--) {
    const monthDate = new Date(fiDate.getFullYear(), fiDate.getMonth() + d + 1, 1)
    const pastBoundary = monthDate >= ageBoundaryDate
    const growth = pastBoundary ? monthlyPostGrowth : monthlyPreGrowth
    const yearsFromFI = monthDate.getFullYear() - fiYear
    const expense = monthlyExpenseAtFI * Math.pow(1 + inflationRate / 100, yearsFromFI)
    balance = (balance + expense) / (1 + growth)
  }

  return balance
}

/**
 * Convenience: compute finite-depletion FI target from a goal object.
 * Falls back to goal.fiGoal (perpetuity) if birthday or goalEndYear is missing.
 */
export function getFiTarget(
  goal: {
    fiGoal: number
    birthday?: string
    goalEndYear?: string
    retirementAge: number
    monthlyExpense2047: number
  },
  profileBirthday: string,
  preBoundaryGrowth: number,
  postBoundaryGrowth?: number,
  ageBoundary?: number,
  inflationRate = 3,
): number {
  if (goal.fiGoal <= 0) return 0
  const birthday = profileBirthday || goal.birthday
  if (!birthday || !goal.goalEndYear) return goal.fiGoal
  const postGrowth = postBoundaryGrowth ?? 6
  const boundary = ageBoundary ?? 60
  const inflation = inflationRate
  const endYear = new Date(goal.goalEndYear).getFullYear()
  const [by, bm] = birthday.split('-').map(Number)
  const retirementDate = new Date(by + goal.retirementAge, bm - 1, 1)
  const ageBoundaryDate = new Date(by + boundary, bm - 1, 1)
  const endOfLife = new Date(endYear, 11, 1)
  return computeRequiredCorpus(
    retirementDate,
    endOfLife,
    ageBoundaryDate,
    goal.monthlyExpense2047,
    inflation,
    preBoundaryGrowth,
    postGrowth,
  )
}

/**
 * Projects earliest FI date where accumulated savings >= required corpus (depletes to $0 at death).
 * Growth switches from preBoundaryGrowth to postBoundaryGrowth at ageBoundaryDate.
 */
export function projectFIDateWithDrawdown(
  currentNetWorth: number,
  annualSavings: number,
  preBoundaryGrowth: number,
  postBoundaryGrowth: number,
  monthlyExpenseToday: number,
  inflationRate: number,
  endOfLife: Date,
  ageBoundaryDate?: Date,
): { date: Date; months: number; requiredCorpus: number } | null {
  if (annualSavings <= 0 && currentNetWorth <= 0) return null

  const monthlyPreRate = preBoundaryGrowth / 100 / 12
  const monthlyPostRate = postBoundaryGrowth / 100 / 12
  const monthlySavings = annualSavings / 12
  const now = new Date()
  const nowYear = now.getFullYear()
  let balance = currentNetWorth
  const boundaryDate = ageBoundaryDate || endOfLife

  for (let m = 1; m <= 1200; m++) {
    const candidateDate = new Date(now.getFullYear(), now.getMonth() + m, 1)
    const pastBoundary = ageBoundaryDate && candidateDate >= ageBoundaryDate
    const accRate = pastBoundary ? monthlyPostRate : monthlyPreRate

    balance = balance * (1 + accRate) + monthlySavings

    if (candidateDate >= endOfLife) {
      return { date: candidateDate, months: m, requiredCorpus: 0 }
    }

    const yearsFromNow = candidateDate.getFullYear() - nowYear
    const expenseAtFI = monthlyExpenseToday * Math.pow(1 + inflationRate / 100, yearsFromNow)
    const requiredCorpus = computeRequiredCorpus(
      candidateDate,
      endOfLife,
      boundaryDate,
      expenseAtFI,
      inflationRate,
      preBoundaryGrowth,
      postBoundaryGrowth,
    )

    if (balance >= requiredCorpus) {
      return { date: candidateDate, months: m, requiredCorpus }
    }
  }
  return null
}
