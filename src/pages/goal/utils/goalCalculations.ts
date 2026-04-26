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

  const goalCreatedDate = new Date(goalCreatedIn)
  const monthsBetween = getMonthsBetween(goalCreatedDate, retirementDate)

  const inflationRateMonthly = (inflationRate || 0) / 100 / 12
  const monthlyExpenseAtRetirement = calculateFV(inflationRateMonthly, monthsBetween, monthlyExpenseAtCreation)
  const annualExpenseAtRetirement = monthlyExpenseAtRetirement * 12

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
