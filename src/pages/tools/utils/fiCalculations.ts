/** Pure FI calculation functions extracted from FICalculator for testability */

export interface FICalcInput {
  annualExpense: number
  inflationRate: number // percentage, e.g. 3 for 3%
  growthRate: number // percentage, e.g. 8 for 8%
  yearsToRetire: number
  yearsInRetirement: number
  fiRetirementPrimary: number
  fiRetirementPartner: number
  fiNonRetirement: number
  gwLiquid: number
  includeGwLiquid: boolean
  primary401kYear: number
  partner401kYear: number
  retireYear: number
  lastYear: number
  thisYear: number
}

export interface FICalcResult {
  corpusNeededFromNonRetirement: number
  primary401kAtAccess: number
  partner401kAtAccess: number
  fiNonRetAtRetire: number
  gwLiquidAtRetire: number
  existingAtRetire: number
  gap: number
  annualSaving: number
  expenseAtRetirement: number
  yearsToRetire: number
  yearByYear: { year: number; expense: number; netWorth: number; injection: string | null }[]
}

/** Adjust a value for inflation over N years */
export function adjustForInflation(value: number, inflationRate: number, years: number): number {
  return value * Math.pow(1 + inflationRate / 100, years)
}

/** Calculate annual savings needed to fill a gap via future value of annuity */
export function annualSavingsNeeded(gap: number, growthRate: number, years: number): number {
  if (years <= 0 || gap <= 0) return 0
  const g = growthRate / 100
  if (g === 0) return gap / years
  const fvFactor = (Math.pow(1 + g, years) - 1) / g
  return gap / fvFactor
}

/** Core FI calculation */
export function calculateFI(input: FICalcInput): FICalcResult | null {
  const g = input.growthRate / 100
  const inf = input.inflationRate / 100
  const { yearsToRetire, yearsInRetirement } = input

  if (yearsInRetirement <= 0) return null

  const expenseAtRetirement = input.annualExpense * Math.pow(1 + inf, yearsToRetire)

  const primary401kAtAccess = input.fiRetirementPrimary * Math.pow(1 + g, input.primary401kYear - input.thisYear)
  const partner401kAtAccess = input.fiRetirementPartner * Math.pow(1 + g, input.partner401kYear - input.thisYear)

  let corpus = 0
  for (let y = input.lastYear; y >= input.retireYear; y--) {
    corpus = corpus / (1 + g)
    const yearIdx = y - input.retireYear
    const expenseThisYear = expenseAtRetirement * Math.pow(1 + inf, yearIdx)
    corpus += expenseThisYear

    if (y === input.primary401kYear) corpus -= primary401kAtAccess
    if (y === input.partner401kYear) corpus -= partner401kAtAccess
    corpus = Math.max(0, corpus)
  }

  const corpusNeededFromNonRetirement = Math.max(0, corpus)
  const fiNonRetAtRetire = input.fiNonRetirement * Math.pow(1 + g, yearsToRetire)
  const gwLiquidAtRetire = input.includeGwLiquid ? input.gwLiquid * Math.pow(1 + g, yearsToRetire) : 0
  const existingAtRetire = fiNonRetAtRetire + gwLiquidAtRetire
  const gap = Math.max(0, corpusNeededFromNonRetirement - existingAtRetire)

  const annualSaving = annualSavingsNeeded(gap, input.growthRate, yearsToRetire)

  const startingCorpus = corpusNeededFromNonRetirement
  const yearByYear: { year: number; expense: number; netWorth: number; injection: string | null }[] = []
  let nw = startingCorpus
  for (let y = input.retireYear; y <= input.lastYear; y++) {
    const yearIdx = y - input.retireYear
    let injection: string | null = null

    if (y === input.primary401kYear) {
      nw += primary401kAtAccess
      injection = 'Primary 401(k)'
    }
    if (y === input.partner401kYear) {
      nw += partner401kAtAccess
      injection = injection ? injection + ' + Partner 401(k)' : 'Partner 401(k)'
    }

    const expense = expenseAtRetirement * Math.pow(1 + inf, yearIdx)
    nw -= expense

    yearByYear.push({ year: y, expense, netWorth: Math.abs(nw) < 1 ? 0 : nw, injection })
    nw *= 1 + g
  }

  return {
    corpusNeededFromNonRetirement,
    primary401kAtAccess,
    partner401kAtAccess,
    fiNonRetAtRetire,
    gwLiquidAtRetire,
    existingAtRetire,
    gap,
    annualSaving,
    expenseAtRetirement,
    yearsToRetire,
    yearByYear,
  }
}
