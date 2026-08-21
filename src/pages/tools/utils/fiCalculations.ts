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
  bonus: number
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
  const growthForYear = (year: number) => (year >= boundaryYear ? postMonthlyGrowth : preMonthlyGrowth)

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
      if (month >= 12) {
        month = 0
        year++
      }
    }
    return value
  }

  const primary401kAtAccess = compoundFromNow(input.fiRetirementPrimary, input.primary401kYear, input.primary401kMonth)
  const partner401kAtAccess = compoundFromNow(input.fiRetirementPartner, input.partner401kYear, input.partner401kMonth)

  // If 401(k) access is before retirement, compound it forward to retirement start
  const primary401kEffectiveYear = Math.max(input.primary401kYear, input.retireYear)
  const primary401kEffectiveMonth = input.primary401kYear >= input.retireYear ? input.primary401kMonth : 1
  const primary401kEffective =
    input.primary401kYear < input.retireYear
      ? compoundFromNow(input.fiRetirementPrimary, input.retireYear, 1)
      : primary401kAtAccess

  const partner401kEffectiveYear = Math.max(input.partner401kYear, input.retireYear)
  const partner401kEffectiveMonth = input.partner401kYear >= input.retireYear ? input.partner401kMonth : 1
  const partner401kEffective =
    input.partner401kYear < input.retireYear
      ? compoundFromNow(input.fiRetirementPartner, input.retireYear, 1)
      : partner401kAtAccess

  let corpus = 0
  for (let year = input.lastYear; year >= input.retireYear; year--) {
    for (let monthIndex = MONTHS_PER_YEAR - 1; monthIndex >= 0; monthIndex--) {
      const monthsFromRetirementStart = (year - input.retireYear) * MONTHS_PER_YEAR + monthIndex
      const expenseThisMonth = monthlyExpenseAtRetirement * Math.pow(1 + monthlyInflation, monthsFromRetirementStart)

      corpus = corpus / (1 + growthForYear(year)) + expenseThisMonth

      if (monthIndex === primary401kEffectiveMonth - 1 && year === primary401kEffectiveYear)
        corpus -= primary401kEffective
      if (monthIndex === partner401kEffectiveMonth - 1 && year === partner401kEffectiveYear)
        corpus -= partner401kEffective

      corpus = Math.max(0, corpus)
    }
  }

  const corpusNeededFromNonRetirement = Math.max(0, corpus)
  const fiNonRetAtRetire = compoundFromNow(input.fiNonRetirement, input.retireYear, 1)
  const gwLiquidAtRetire = input.includeGwLiquid ? compoundFromNow(input.gwLiquid, input.retireYear, 1) : 0
  const existingAtRetire = fiNonRetAtRetire + gwLiquidAtRetire
  const gap = Math.max(0, corpusNeededFromNonRetirement - existingAtRetire)

  const monthsToSave = monthsUntilJanuary(input.retireYear)

  // Compute monthly saving with boundary-aware growth (variable-rate FV annuity)
  let monthlySaving = 0
  if (gap > 0 && monthsToSave > 0) {
    // Walk backward from retirement to compute FV factor for each saving month
    let fvFactor = 0
    let cumGrowth = 1
    let y = input.retireYear - 1
    let m = 11 // Dec of year before retirement
    for (let i = 0; i < monthsToSave; i++) {
      fvFactor += cumGrowth
      cumGrowth *= 1 + growthForYear(y)
      m--
      if (m < 0) {
        m = 11
        y--
      }
    }
    monthlySaving = gap / fvFactor
  }

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
  let savingNonRet = input.fiNonRetirement + (input.includeGwLiquid ? input.gwLiquid : 0)
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
      bonus: 0,
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

  // Drawdown starts from the actual accumulated saving values
  let initNonRet = savingNonRet
  let initPrimaryRet = savingPrimaryRet
  let initPartnerRet = savingPartnerRet

  if (input.primary401kYear < input.retireYear) {
    initNonRet += initPrimaryRet
    initPrimaryRet = 0
  }
  if (input.partner401kYear < input.retireYear) {
    initNonRet += initPartnerRet
    initPartnerRet = 0
  }

  // Simulate drawdown with an optional monthly bonus (at retirement start, grows with inflation)
  // Bonus only applies after all 401(k) injections have occurred
  const lastInjectionYear = Math.max(
    input.primary401kYear <= input.lastYear ? input.primary401kYear : input.retireYear,
    input.partner401kYear <= input.lastYear ? input.partner401kYear : input.retireYear,
  )
  const lastInjectionMonth = Math.max(
    input.primary401kYear === lastInjectionYear ? input.primary401kMonth - 1 : -1,
    input.partner401kYear === lastInjectionYear ? input.partner401kMonth - 1 : -1,
  )

  function simulateDrawdown(bonusAtRetirement: number): { rows: FICalcProjectionRow[]; finalNetWorth: number } {
    let nonRet = initNonRet
    let primaryRet = initPrimaryRet
    let partnerRet = initPartnerRet
    const rows: FICalcProjectionRow[] = []

    for (let year = input.retireYear; year <= input.lastYear; year++) {
      const mg = growthForYear(year)
      for (let monthIndex = 0; monthIndex < MONTHS_PER_YEAR; monthIndex++) {
        const monthsFromRetirementStart = (year - input.retireYear) * MONTHS_PER_YEAR + monthIndex
        const inflationFactor = Math.pow(1 + monthlyInflation, monthsFromRetirementStart)
        const expense = monthlyExpenseAtRetirement * inflationFactor
        const pastLastInjection =
          year > lastInjectionYear || (year === lastInjectionYear && monthIndex > lastInjectionMonth)
        const bonus = pastLastInjection ? bonusAtRetirement * inflationFactor : 0
        const injections: string[] = []

        nonRet -= expense + bonus

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

        rows.push({
          month: formatMonthLabel(new Date(year, monthIndex, 1)),
          phase: 'drawdown',
          expense,
          bonus,
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
    return { rows, finalNetWorth: nonRet + primaryRet + partnerRet }
  }

  // Lightweight simulation that only returns final net worth (no row allocation)
  function simulateFinalNetWorth(bonusAtRetirement: number): number {
    let nonRet = initNonRet
    let primaryRet = initPrimaryRet
    let partnerRet = initPartnerRet

    for (let year = input.retireYear; year <= input.lastYear; year++) {
      const mg = growthForYear(year)
      for (let monthIndex = 0; monthIndex < MONTHS_PER_YEAR; monthIndex++) {
        const monthsFromRetirementStart = (year - input.retireYear) * MONTHS_PER_YEAR + monthIndex
        const inflationFactor = Math.pow(1 + monthlyInflation, monthsFromRetirementStart)
        const expense = monthlyExpenseAtRetirement * inflationFactor
        const pastLastInjection =
          year > lastInjectionYear || (year === lastInjectionYear && monthIndex > lastInjectionMonth)
        const bonus = pastLastInjection ? bonusAtRetirement * inflationFactor : 0

        nonRet -= expense + bonus

        if (monthIndex === input.primary401kMonth - 1 && year === input.primary401kYear) {
          nonRet += primaryRet
          primaryRet = 0
        }
        if (monthIndex === input.partner401kMonth - 1 && year === input.partner401kYear) {
          nonRet += partnerRet
          partnerRet = 0
        }

        nonRet *= 1 + mg
        primaryRet *= 1 + mg
        partnerRet *= 1 + mg
      }
    }
    return nonRet + primaryRet + partnerRet
  }

  // Binary search for the bonus that depletes net worth to ~$0
  let bonusAtRetirement = 0
  const baseFinalNW = simulateFinalNetWorth(0)
  if (baseFinalNW > 100) {
    let lo = 0
    let hi = baseFinalNW / ((input.lastYear - input.retireYear + 1) * MONTHS_PER_YEAR)
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2
      if (simulateFinalNetWorth(mid) > 100) lo = mid
      else hi = mid
    }
    bonusAtRetirement = (lo + hi) / 2
  }

  const drawdownResult = simulateDrawdown(bonusAtRetirement)
  monthByMonth.push(...drawdownResult.rows)

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
