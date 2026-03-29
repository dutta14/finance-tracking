// Helper function to calculate Future Value
export const calculateFV = (monthlyRate: number, months: number, presentValue: number): number => {
  return presentValue * Math.pow(1 + monthlyRate, months)
}

// Calculate all financial metrics for a plan
export interface PlanCalculations {
  monthlyExpenseAtCreation: number
  retirementDate: Date
  retirementDateFormatted: string
  monthsBetween: number
  monthlyExpenseAtRetirement: number
  annualExpenseAtRetirement: number
  fiGoal: number
}

export const calculatePlanMetrics = (
  annualExpense: number,
  birthday: string,
  retirementAge: number,
  planCreatedIn: string,
  inflationRate: number,
  safeWithdrawalRate: number,
  getMonthsBetween: (start: Date, end: Date) => number,
  parseDate: (dateStr: string) => Date
): PlanCalculations => {
  const monthlyExpenseAtCreation = annualExpense / 12

  const birthDate = parseDate(birthday)
  const retirementDate = new Date(birthDate.getFullYear() + retirementAge, birthDate.getMonth(), birthDate.getDate())
  const retirementDateFormatted = retirementDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

  const planCreatedDate = new Date(planCreatedIn)
  const monthsBetween = getMonthsBetween(planCreatedDate, retirementDate)

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
    fiGoal
  }
}
