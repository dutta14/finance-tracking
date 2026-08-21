/** Pure FI calculation functions extracted from FICalculator for testability */

const MONTHS_PER_YEAR = 12

export interface FICalcInput {
  annualExpense: number
  inflationRate: number // percentage, e.g. 3 for 3%
  growthRate: number // percentage, e.g. 8 for 8% (pre-boundary)
  postBoundaryGrowth: number // percentage, e.g. 6 for 6%
  boundaryYear: number // calendar year when growth switches
  yearsToRetire: number
  yearsInRetirement: number
  fiRetirementPrimary: number
  fiRetirementPartner: number
  fiNonRetirement: number
  gwLiquid: number
  includeGwLiquid: boolean
  primary401kYear: number
  primary401kMonth: number // 1-based (1=Jan, 9=Sep)
  partner401kYear: number
  partner401kMonth: number // 1-based
  retireYear: number
  lastYear: number
  thisYear: number
  primaryName?: string
  partnerName?: string
}

export interface FICalcProjectionRow {
  month: string
  phase: 'saving' | 'drawdown'
  expense: number
  netWorth: number
  nonRet: number
  primaryRet: number
  partnerRet: number
  monthlySaved: number
  growthRate: number
  injection: string | null
  nonRetGrowth: number
  primaryRetGrowth: number
  partnerRetGrowth: number
}

export interface FICalcResult {
  corpusNeededFromNonRetirement: number
  primary401kAtAccess: number
  partner401kAtAccess: number
  fiNonRetAtRetire: number
  gwLiquidAtRetire: number
  existingAtRetire: number
  gap: number
  monthlySaving: number
  monthsToSave: number
  monthlyExpenseAtRetirement: number
  yearsToRetire: number
  monthByMonth: FICalcProjectionRow[]
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function normalizeNetWorth(value: number): number {
  return Math.abs(value) < 1 ? 0 : value
}

function monthsUntilJanuary(targetYear: number, now = new Date()): number {
  return Math.max(0, (targetYear - now.getFullYear()) * MONTHS_PER_YEAR - now.getMonth())
}

/** Adjust a value for inflation using monthly compounding over N years */
export function adjustForInflation(value: number, inflationRate: number, years: number): number {
  const monthlyInflation = inflationRate / 100 / MONTHS_PER_YEAR
  return value * Math.pow(1 + monthlyInflation, years * MONTHS_PER_YEAR)
}

/** Calculate monthly savings needed to fill a gap via future value of a monthly annuity */
export function monthlySavingsNeeded(gap: number, growthRate: number, months: number): number {
  if (months <= 0 || gap <= 0) return 0

  const monthlyGrowth = growthRate / 100 / MONTHS_PER_YEAR

  if (monthlyGrowth === 0) return gap / months

  const fvFactor = (Math.pow(1 + monthlyGrowth, months) - 1) / monthlyGrowth
  return gap / fvFactor
}

/** Core FI calculation */
export function calculateFI(input: FICalcInput): FICalcResult | null {
  const preMonthlyGrowth = input.growthRate / 100 / MONTHS_PER_YEAR
  const postMonthlyGrowth = input.postBoundaryGrowth / 100 / MONTHS_PER_YEAR
  const monthlyInflation = input.inflationRate / 100 / MONTHS_PER_YEAR
  const { yearsToRetire, yearsInRetirement, boundaryYear } = input
  const monthsToRetire = yearsToRetire * MONTHS_PER_YEAR

  // Returns the monthly growth rate for a given calendar year
  const growthForYear = (year: number) => year >= boundaryYear ? postMonthlyGrowth : preMonthlyGrowth

  if (yearsInRetirement <= 0) return null

  const monthlyExpenseAtRetirement =
    (input.annualExpense / MONTHS_PER_YEAR) * Math.pow(1 + monthlyInflation, monthsToRetire)

  // Compound growth from now to a target year/month, respecting the boundary
  function compoundFromNow(principal: number, targetYear: number, targetMonth: number): number {
    const now = new Date()
    let value = principal
    let year = now.getFullYear()
    let month = now.getMonth() // 0-based
    while (year < targetYear || (year === targetYear && month < targetMonth - 1)) {
      value *= 1 + growthForYear(year)
      month++
      if (month >= 12) { month = 0; year++ }
    }
    return value
  }

  const primary401kAtAccess = compoundFromNow(input.fiRetirementPrimary, input.primary401kYear, input.primary401kMonth)
  const partner401kAtAccess = compoundFromNow(input.fiRetirementPartner, input.partner401kYear, input.partner401kMonth)

  let corpus = 0
  for (let year = input.lastYear; year >= input.retireYear; year--) {
    for (let monthIndex = MONTHS_PER_YEAR - 1; monthIndex >= 0; monthIndex--) {
      const monthsFromRetirementStart = (year - input.retireYear) * MONTHS_PER_YEAR + monthIndex
      const expenseThisMonth = monthlyExpenseAtRetirement * Math.pow(1 + monthlyInflation, monthsFromRetirementStart)

      corpus = corpus / (1 + growthForYear(year)) + expenseThisMonth

      if (monthIndex === input.primary401kMonth - 1 && year === input.primary401kYear) corpus -= primary401kAtAccess
      if (monthIndex === input.partner401kMonth - 1 && year === input.partner401kYear) corpus -= partner401kAtAccess

      corpus = Math.max(0, corpus)
    }
  }

  const corpusNeededFromNonRetirement = Math.max(0, corpus)
  const fiNonRetAtRetire = compoundFromNow(input.fiNonRetirement, input.retireYear, 1)
  const gwLiquidAtRetire = input.includeGwLiquid ? compoundFromNow(input.gwLiquid, input.retireYear, 1) : 0
  const existingAtRetire = fiNonRetAtRetire + gwLiquidAtRetire
  const gap = Math.max(0, corpusNeededFromNonRetirement - existingAtRetire)

  const monthsToSave = monthsUntilJanuary(input.retireYear)
  const monthlySaving = monthlySavingsNeeded(gap, input.growthRate, monthsToSave)

  const monthByMonth: FICalcResult['monthByMonth'] = []
  const activeGrowthRateForYear = (year: number) => (year >= boundaryYear ? input.postBoundaryGrowth : input.growthRate)
  const appendMilestones = (injections: string[], year: number, monthIndex: number) => {
    if (monthIndex === input.primary401kMonth - 1 && year === input.primary401kYear) {
      injections.push(`${input.primaryName || 'Primary'} 401(k)`)
    }
    if (monthIndex === input.partner401kMonth - 1 && year === input.partner401kYear) {
      injections.push(`${input.partnerName || 'Partner'} 401(k)`)
    }
    if (monthIndex === 0 && year === boundaryYear) {
      injections.push(`Growth → ${input.postBoundaryGrowth}%`)
    }
  }

  // Saving phase is display-only and shows the effect of saving the calculated monthly amount.
  const now = new Date()
  let savingYear = now.getFullYear()
  let savingMonthIndex = now.getMonth()
  let savingNonRet = input.fiNonRetirement
  let savingPrimaryRet = input.fiRetirementPrimary
  let savingPartnerRet = input.fiRetirementPartner

  while (savingYear < input.retireYear) {
    const mg = growthForYear(savingYear)
    const injections: string[] = []
    const nonRetGrowth = savingNonRet * mg
    const primaryRetGrowth = savingPrimaryRet * mg
    const partnerRetGrowth = savingPartnerRet * mg

    appendMilestones(injections, savingYear, savingMonthIndex)

    savingNonRet = savingNonRet + nonRetGrowth + monthlySaving
    savingPrimaryRet += primaryRetGrowth
    savingPartnerRet += partnerRetGrowth

    monthByMonth.push({
      month: formatMonthLabel(new Date(savingYear, savingMonthIndex, 1)),
      phase: 'saving',
      expense: 0,
      netWorth: normalizeNetWorth(savingNonRet + savingPrimaryRet + savingPartnerRet),
      nonRet: normalizeNetWorth(savingNonRet),
      primaryRet: normalizeNetWorth(savingPrimaryRet),
      partnerRet: normalizeNetWorth(savingPartnerRet),
      monthlySaved: monthlySaving,
      growthRate: activeGrowthRateForYear(savingYear),
      injection: injections.length > 0 ? injections.join(' + ') : null,
      nonRetGrowth: normalizeNetWorth(nonRetGrowth),
      primaryRetGrowth: normalizeNetWorth(primaryRetGrowth),
      partnerRetGrowth: normalizeNetWorth(partnerRetGrowth),
    })

    savingMonthIndex++
    if (savingMonthIndex >= MONTHS_PER_YEAR) {
      savingMonthIndex = 0
      savingYear++
    }
  }

  // Drawdown stays aligned to the required retirement corpus while still reflecting the saving path.
  let nonRet = Math.max(corpusNeededFromNonRetirement, savingNonRet)
  let primaryRet = savingPrimaryRet
  let partnerRet = savingPartnerRet

  if (input.primary401kYear < input.retireYear) {
    nonRet += primaryRet
    primaryRet = 0
  }
  if (input.partner401kYear < input.retireYear) {
    nonRet += partnerRet
    partnerRet = 0
  }

  for (let year = input.retireYear; year <= input.lastYear; year++) {
    const mg = growthForYear(year)
    for (let monthIndex = 0; monthIndex < MONTHS_PER_YEAR; monthIndex++) {
      const monthsFromRetirementStart = (year - input.retireYear) * MONTHS_PER_YEAR + monthIndex
      const expense = monthlyExpenseAtRetirement * Math.pow(1 + monthlyInflation, monthsFromRetirementStart)
      const injections: string[] = []

      nonRet -= expense

      if (monthIndex === input.primary401kMonth - 1 && year === input.primary401kYear) {
        nonRet += primaryRet
        primaryRet = 0
      }
      if (monthIndex === input.partner401kMonth - 1 && year === input.partner401kYear) {
        nonRet += partnerRet
        partnerRet = 0
      }

      appendMilestones(injections, year, monthIndex)

      const nonRetGrowth = nonRet * mg
      const primaryRetGrowth = primaryRet * mg
      const partnerRetGrowth = partnerRet * mg

      nonRet += nonRetGrowth
      primaryRet += primaryRetGrowth
      partnerRet += partnerRetGrowth

      monthByMonth.push({
        month: formatMonthLabel(new Date(year, monthIndex, 1)),
        phase: 'drawdown',
        expense,
        netWorth: normalizeNetWorth(nonRet + primaryRet + partnerRet),
        nonRet: normalizeNetWorth(nonRet),
        primaryRet: normalizeNetWorth(primaryRet),
        partnerRet: normalizeNetWorth(partnerRet),
        monthlySaved: 0,
        growthRate: activeGrowthRateForYear(year),
        injection: injections.length > 0 ? injections.join(' + ') : null,
        nonRetGrowth: normalizeNetWorth(nonRetGrowth),
        primaryRetGrowth: normalizeNetWorth(primaryRetGrowth),
        partnerRetGrowth: normalizeNetWorth(partnerRetGrowth),
      })
    }
  }

  return {
    corpusNeededFromNonRetirement,
    primary401kAtAccess,
    partner401kAtAccess,
    fiNonRetAtRetire,
    gwLiquidAtRetire,
    existingAtRetire,
    gap,
    monthlySaving,
    monthsToSave,
    monthlyExpenseAtRetirement,
    yearsToRetire,
    monthByMonth,
  }
}
