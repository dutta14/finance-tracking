import { FinancialGoal } from '../../../types'
import { computeRequiredCorpus } from './goalCalculations'

export interface ProjectionRow {
  month: string
  expense: number
  remaining: number
  phase: 'accumulation' | 'drawdown'
  growthRate?: number
  retirementPrimary?: number
  retirementPartner?: number
  nonRetirement?: number
  contribPrimary?: number
  contribPartner?: number
  contribNonRet?: number
  primaryLocked?: boolean
  partnerLocked?: boolean
}

export interface BalanceBreakdown {
  retirementPrimary: number
  retirementPartner: number
  nonRetirement: number
  primaryAccessDate?: Date
  partnerAccessDate?: Date
}

// Forward-simulate 3-bucket drawdown to check if expenses can be paid every month through end of life
function canSustainDrawdown(
  rp0: number,
  rpt0: number,
  nr0: number,
  baseExpense: number,
  inflationRate: number,
  monthlyPreGrowth: number,
  monthlyPostGrowth: number,
  startDate: Date,
  endDate: Date,
  ageBoundaryDate: Date | undefined,
  primaryAccessDate: Date | undefined,
  partnerAccessDate: Date | undefined,
  fiYear: number,
): boolean {
  if (startDate > endDate) return true
  let rp = rp0,
    rpt = rpt0,
    nr = nr0
  const c = new Date(startDate)
  while (c <= endDate) {
    const yearsFromFI = Math.max(0, c.getFullYear() - fiYear)
    const expense = baseExpense * Math.pow(1 + inflationRate / 100, yearsFromFI)
    const pastBoundary = ageBoundaryDate && c >= ageBoundaryDate
    const g = pastBoundary ? monthlyPostGrowth : monthlyPreGrowth
    rp *= 1 + g
    rpt *= 1 + g
    nr *= 1 + g
    const pUn = !primaryAccessDate || c >= primaryAccessDate
    const ptUn = !partnerAccessDate || c >= partnerAccessDate
    let avail = nr
    if (pUn) avail += rp
    if (ptUn) avail += rpt
    if (expense > avail + 0.01) return false
    if (avail > 0 && expense > 0) {
      const ratio = Math.min(expense / avail, 1)
      nr -= nr * ratio
      if (pUn) rp -= rp * ratio
      if (ptUn) rpt -= rpt * ratio
    }
    c.setMonth(c.getMonth() + 1)
  }
  return true
}

// Find earliest month where 3-bucket corpus can sustain base×inflation expenses to end of life
function findEarliestFIDate(
  currentBalance: number,
  monthlyContribution: number,
  preGrowth: number,
  postGrowth: number,
  inflationRate: number,
  monthlyExpenseToday: number,
  endOfLife: Date,
  ageBoundaryDate: Date | undefined,
  breakdown: BalanceBreakdown | undefined,
  retirementCap: number,
  nonRetirementBase: number,
): Date {
  const monthlyPreGrowth = preGrowth / 100 / 12
  const monthlyPostGrowth = postGrowth / 100 / 12
  const now = new Date()
  const nowYear = now.getFullYear()

  let rp = breakdown?.retirementPrimary ?? 0
  let rpt = breakdown?.retirementPartner ?? 0
  let nr = breakdown?.nonRetirement ?? currentBalance
  const primaryAccessDate = breakdown?.primaryAccessDate
  const partnerAccessDate = breakdown?.partnerAccessDate

  for (let m = 0; m < 1200; m++) {
    const candidateDate = new Date(now.getFullYear(), now.getMonth() + m, 1)
    if (candidateDate >= endOfLife) return endOfLife

    const pastBoundary = ageBoundaryDate && candidateDate >= ageBoundaryDate
    const g = pastBoundary ? monthlyPostGrowth : monthlyPreGrowth

    rp *= 1 + g
    rpt *= 1 + g
    nr *= 1 + g

    // Contribution allocation: non-ret base, then up to cap each retirement, overflow to non-ret
    const retCap = retirementCap
    const hasRP = !!(breakdown && rp > 0)
    const hasRPt = !!(breakdown && rpt > 0)
    const nonRetBase = Math.min(monthlyContribution, nonRetirementBase)
    const afterBase = monthlyContribution - nonRetBase
    const activeCount = (hasRP ? 1 : 0) + (hasRPt ? 1 : 0)
    const cPrimary = hasRP ? Math.min(afterBase / activeCount, retCap) : 0
    const cPartner = hasRPt ? Math.min(afterBase / activeCount, retCap) : 0
    nr += monthlyContribution - cPrimary - cPartner
    rp += cPrimary
    rpt += cPartner

    // Check if this corpus can sustain expenses through end of life
    const yearsFromNow = candidateDate.getFullYear() - nowYear
    const expenseAtCandidate = monthlyExpenseToday * Math.pow(1 + inflationRate / 100, yearsFromNow)
    const drawdownStart = new Date(candidateDate.getFullYear(), candidateDate.getMonth() + 1, 1)

    if (
      canSustainDrawdown(
        rp,
        rpt,
        nr,
        expenseAtCandidate,
        inflationRate,
        monthlyPreGrowth,
        monthlyPostGrowth,
        drawdownStart,
        endOfLife,
        ageBoundaryDate,
        primaryAccessDate,
        partnerAccessDate,
        candidateDate.getFullYear(),
      )
    ) {
      return candidateDate
    }
  }
  return endOfLife
}

export function buildLifecycle(
  currentBalance: number,
  monthlyContribution: number,
  preBoundaryGrowth: number,
  postBoundaryGrowth: number,
  inflationRate: number,
  monthlyExpenseAtFI: number,
  endYear: number,
  fiDate: Date,
  retirementCap: number,
  nonRetirementBase: number,
  ageBoundaryDate?: Date,
  breakdown?: BalanceBreakdown,
): ProjectionRow[] {
  const monthlyPreGrowth = preBoundaryGrowth / 100 / 12
  const monthlyPostGrowth = postBoundaryGrowth / 100 / 12

  const rows: ProjectionRow[] = []
  const now = new Date()
  const cursor = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(endYear, 11, 1)
  let balance = currentBalance
  let fiReached = false
  let expense = 0
  const fiYear = fiDate.getFullYear()
  let lastExpenseYear = fiYear

  // 3-bucket tracking
  let retPrimary = breakdown?.retirementPrimary ?? 0
  let retPartner = breakdown?.retirementPartner ?? 0
  let nonRet = breakdown?.nonRetirement ?? currentBalance
  if (breakdown) {
    // use breakdown values; total may differ from currentBalance
    balance = retPrimary + retPartner + nonRet
  }
  const primaryAccessDate = breakdown?.primaryAccessDate
  const partnerAccessDate = breakdown?.partnerAccessDate

  while (cursor <= end && rows.length < 1200) {
    const label = cursor.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

    if (!fiReached) {
      const pastBoundary = ageBoundaryDate && cursor >= ageBoundaryDate
      const growth = pastBoundary ? monthlyPostGrowth : monthlyPreGrowth
      const annualRate = pastBoundary ? postBoundaryGrowth : preBoundaryGrowth

      // Contribution allocation: non-ret base, then up to cap each retirement, overflow back to non-ret
      const retCap = retirementCap
      const nonRetBase = Math.min(monthlyContribution, nonRetirementBase)
      const afterBase = monthlyContribution - nonRetBase
      const hasRetPrimary = breakdown && retPrimary > 0
      const hasRetPartner = breakdown && retPartner > 0
      const cPrimary = hasRetPrimary
        ? Math.min(afterBase / ((hasRetPrimary ? 1 : 0) + (hasRetPartner ? 1 : 0)), retCap)
        : 0
      const cPartner = hasRetPartner
        ? Math.min(afterBase / ((hasRetPrimary ? 1 : 0) + (hasRetPartner ? 1 : 0)), retCap)
        : 0
      const cNonRet = monthlyContribution - cPrimary - cPartner

      if (cursor >= fiDate) {
        fiReached = true
        retPrimary *= 1 + growth
        retPartner *= 1 + growth
        nonRet *= 1 + growth
        retPrimary += cPrimary
        retPartner += cPartner
        nonRet += cNonRet
        balance = retPrimary + retPartner + nonRet
        rows.push({
          month: label,
          expense: 0,
          remaining: balance,
          phase: 'accumulation',
          growthRate: annualRate,
          retirementPrimary: retPrimary,
          retirementPartner: retPartner,
          nonRetirement: nonRet,
          contribPrimary: cPrimary,
          contribPartner: cPartner,
          contribNonRet: cNonRet,
          primaryLocked: !!(primaryAccessDate && cursor < primaryAccessDate),
          partnerLocked: !!(partnerAccessDate && cursor < partnerAccessDate),
        })
        expense = Math.round(monthlyExpenseAtFI)
        lastExpenseYear = fiYear
      } else {
        retPrimary *= 1 + growth
        retPartner *= 1 + growth
        nonRet *= 1 + growth
        retPrimary += cPrimary
        retPartner += cPartner
        nonRet += cNonRet
        balance = retPrimary + retPartner + nonRet
        rows.push({
          month: label,
          expense: 0,
          remaining: balance,
          phase: 'accumulation',
          growthRate: annualRate,
          retirementPrimary: retPrimary,
          retirementPartner: retPartner,
          nonRetirement: nonRet,
          contribPrimary: cPrimary,
          contribPartner: cPartner,
          contribNonRet: cNonRet,
          primaryLocked: !!(primaryAccessDate && cursor < primaryAccessDate),
          partnerLocked: !!(partnerAccessDate && cursor < partnerAccessDate),
        })
      }
    } else {
      const curYear = cursor.getFullYear()
      if (curYear > lastExpenseYear) {
        const yearsFromFI = curYear - fiYear
        const inflated = monthlyExpenseAtFI * Math.pow(1 + inflationRate / 100, yearsFromFI)
        expense = Math.round(inflated)
        lastExpenseYear = curYear
      }

      const pastBoundary = ageBoundaryDate && cursor >= ageBoundaryDate
      const drawRate = pastBoundary ? monthlyPostGrowth : monthlyPreGrowth
      const annualRate = pastBoundary ? postBoundaryGrowth : preBoundaryGrowth
      const primaryLocked = !!(primaryAccessDate && cursor < primaryAccessDate)
      const partnerLocked = !!(partnerAccessDate && cursor < partnerAccessDate)
      rows.push({
        month: label,
        expense,
        remaining: balance,
        phase: 'drawdown',
        growthRate: annualRate,
        retirementPrimary: retPrimary,
        retirementPartner: retPartner,
        nonRetirement: nonRet,
        primaryLocked,
        partnerLocked,
      })

      // Grow all buckets
      retPrimary *= 1 + drawRate
      retPartner *= 1 + drawRate
      nonRet *= 1 + drawRate

      // Determine available pool for drawdown
      const primaryUnlocked = !primaryAccessDate || cursor >= primaryAccessDate
      const partnerUnlocked = !partnerAccessDate || cursor >= partnerAccessDate
      let available = nonRet
      if (primaryUnlocked) available += retPrimary
      if (partnerUnlocked) available += retPartner

      if (available > 0 && expense > 0) {
        // Deplete proportionally from available buckets
        const drawRatio = Math.min(expense / available, 1)
        nonRet -= nonRet * drawRatio
        if (primaryUnlocked) retPrimary -= retPrimary * drawRatio
        if (partnerUnlocked) retPartner -= retPartner * drawRatio
      }

      balance = retPrimary + retPartner + nonRet
    }

    cursor.setMonth(cursor.getMonth() + 1)
  }

  return rows
}

export function buildPlannedProjection(
  goal: FinancialGoal,
  profileBirthday: string,
  currentBalance: number,
  retirementCap: number,
  nonRetirementBase: number,
  _monthlyContribution?: number,
  accGrowthOverride?: number,
  postGrowthOverride?: number,
  ageBoundary?: number,
  breakdown?: BalanceBreakdown,
  inflationOverride?: number,
): ProjectionRow[] {
  const birthday = profileBirthday || goal.birthday
  if (!birthday || !goal.goalEndYear) return []

  const preGrowth = accGrowthOverride ?? 8
  const postGrowth = postGrowthOverride ?? 6
  const boundary = ageBoundary ?? 60
  const inflation = inflationOverride ?? 3
  const endYear = new Date(goal.goalEndYear).getFullYear()

  const [by, bm] = birthday.split('-').map(Number)
  const retirementDate = new Date(by + goal.retirementAge, bm - 1, 1)
  const ageBoundaryDate = new Date(by + boundary, bm - 1, 1)

  const endOfLife = new Date(endYear, 11, 1)
  const monthlyExpenseAtFI = goal.monthlyExpense2047

  const corpusCap = computeRequiredCorpus(
    retirementDate,
    endOfLife,
    ageBoundaryDate,
    monthlyExpenseAtFI,
    inflation,
    preGrowth,
    postGrowth,
  )

  let plannedContribution: number
  if (_monthlyContribution !== undefined && _monthlyContribution > 0) {
    plannedContribution = _monthlyContribution
  } else {
    const now = new Date()
    const monthsToRetirement =
      (retirementDate.getFullYear() - now.getFullYear()) * 12 + (retirementDate.getMonth() - now.getMonth())
    const r = preGrowth / 100 / 12
    const fvOfCurrent = currentBalance * Math.pow(1 + r, monthsToRetirement)
    const needed = corpusCap - fvOfCurrent
    plannedContribution = needed > 0 ? (needed * r) / (Math.pow(1 + r, monthsToRetirement) - 1) : 0
  }

  return buildLifecycle(
    currentBalance,
    plannedContribution,
    preGrowth,
    postGrowth,
    inflation,
    monthlyExpenseAtFI,
    endYear,
    retirementDate,
    retirementCap,
    nonRetirementBase,
    ageBoundaryDate,
    breakdown,
  )
}

export function buildProjectedLifecycle(
  goal: FinancialGoal,
  profileBirthday: string,
  currentBalance: number,
  monthlyContribution: number,
  retirementCap: number,
  nonRetirementBase: number,
  accGrowthOverride?: number,
  postGrowthOverride?: number,
  ageBoundary?: number,
  breakdown?: BalanceBreakdown,
  inflationOverride?: number,
): ProjectionRow[] {
  const birthday = profileBirthday || goal.birthday
  if (!birthday || !goal.goalEndYear) return []

  const preGrowth = accGrowthOverride ?? 8
  const postGrowth = postGrowthOverride ?? 6
  const boundary = ageBoundary ?? 60
  const inflation = inflationOverride ?? 3
  const endYear = new Date(goal.goalEndYear).getFullYear()

  const now = new Date()
  const [by, bm] = birthday.split('-').map(Number)
  const retirementDate = new Date(by + goal.retirementAge, bm - 1, 1)
  const ageBoundaryDate = new Date(by + boundary, bm - 1, 1)
  const retirementYear = retirementDate.getFullYear()
  const nowYear = now.getFullYear()
  const monthlyExpenseToday = goal.monthlyExpense2047 / Math.pow(1 + inflation / 100, retirementYear - nowYear)

  const endOfLife = new Date(endYear, 11, 1)

  // Find earliest FI date where 3-bucket corpus sustains base×inflation expenses to end of life
  const fiDate = findEarliestFIDate(
    currentBalance,
    monthlyContribution,
    preGrowth,
    postGrowth,
    inflation,
    monthlyExpenseToday,
    endOfLife,
    ageBoundaryDate,
    breakdown,
    retirementCap,
    nonRetirementBase,
  )

  const fiYear = fiDate.getFullYear()
  const monthlyExpenseAtFI = monthlyExpenseToday * Math.pow(1 + inflation / 100, fiYear - nowYear)

  return buildLifecycle(
    currentBalance,
    monthlyContribution,
    preGrowth,
    postGrowth,
    inflation,
    monthlyExpenseAtFI,
    endYear,
    fiDate,
    retirementCap,
    nonRetirementBase,
    ageBoundaryDate,
    breakdown,
  )
}
