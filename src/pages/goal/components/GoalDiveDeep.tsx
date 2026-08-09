import { FC, useEffect, useMemo, useRef, useState } from 'react'
import { FinancialGoal } from '../../../types'
import {
  ProjectionRow,
  BalanceBreakdown,
  buildPlannedProjection,
  buildProjectedLifecycle,
} from '../utils/lifecycleProjection'
import { computeRequiredCorpus, getFiTarget } from '../utils/goalCalculations'
import { calcMonthlySaving, FiBreakdown } from '../utils/goalMath'
import LifecycleChart from './LifecycleChart'
import LifecycleTable from './LifecycleTable'
import '../../../styles/GoalDiveDeep.css'

interface GoalDiveDeepProps {
  goal: FinancialGoal
  profileBirthday: string
  partnerBirthday?: string
  currentBalance?: number
  monthlyContribution?: number
  currentMonth?: string
  growthRate?: number
  postGrowthRate?: number
  ageBoundary?: number
  inflation?: number
  fiBreakdown?: FiBreakdown
  primaryRetirementAccessAge?: number
  partnerRetirementAccessAge?: number
  retirementCap: number
  nonRetirementBase: number
  showYearly?: boolean
  targetFireDate?: string | null
  onFireMonth?: (month: string | null) => void
  onRequiredSavings?: (monthlySavings: number | null) => void
  gwBalance?: number
  gwMonthlyContribution?: number
  gwProjectedMonthlyContribution?: number
  gwGrowthRate?: number
  gwTarget?: number
  gwProjectedTarget?: number
  gwTargetMonth?: string
  gwDisburseMonth?: string
  projectedFiMonth?: string | null
}

type DataMode = 'projected' | 'planned'
type ViewInterval = 'monthly' | 'yearly' | '5year' | '10year'
type ViewMode = 'chart' | 'table'

const dollars = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

const INTERVAL_LABELS: { value: ViewInterval; label: string; months: number }[] = [
  { value: 'monthly', label: 'Monthly', months: 1 },
  { value: 'yearly', label: 'Yearly', months: 12 },
  { value: '5year', label: 'Every 5 Yrs', months: 60 },
  { value: '10year', label: 'Every 10 Yrs', months: 120 },
]

const GoalDiveDeep: FC<GoalDiveDeepProps> = ({
  goal,
  profileBirthday,
  partnerBirthday,
  currentBalance = 0,
  monthlyContribution = 0,
  currentMonth,
  growthRate = 8,
  postGrowthRate = 6,
  ageBoundary = 60,
  inflation = 3,
  fiBreakdown,
  primaryRetirementAccessAge = 59.5,
  partnerRetirementAccessAge = 59.5,
  retirementCap,
  nonRetirementBase,
  showYearly = false,
  targetFireDate,
  onFireMonth,
  onRequiredSavings,
  gwBalance = 0,
  gwMonthlyContribution = 0,
  gwProjectedMonthlyContribution = 0,
  gwGrowthRate = 8,
  gwTarget = 0,
  gwProjectedTarget = 0,
  gwTargetMonth,
  gwDisburseMonth,
  projectedFiMonth,
}) => {
  const [interval, setInterval] = useState<ViewInterval>('yearly')
  const [viewMode, setViewMode] = useState<ViewMode>('chart')
  const [scenario, setScenario] = useState<DataMode>('projected')
  const [analysisType, setAnalysisType] = useState<'fi' | 'gw'>('fi')

  const accessDates = useMemo(() => {
    const birthday = profileBirthday || goal.birthday
    if (!birthday) return { primaryAccessDate: undefined, partnerAccessDate: undefined }
    const [by, bm] = birthday.split('-').map(Number)
    const primaryYears = Math.floor(primaryRetirementAccessAge)
    const primaryMonths = Math.round((primaryRetirementAccessAge - primaryYears) * 12)
    const primaryAccessDate = new Date(by + primaryYears, bm - 1 + primaryMonths, 1)

    const pBday = partnerBirthday || birthday
    const [pby, pbm] = pBday.split('-').map(Number)
    const partnerYears = Math.floor(partnerRetirementAccessAge)
    const partnerMonths = Math.round((partnerRetirementAccessAge - partnerYears) * 12)
    const partnerAccessDate = new Date(pby + partnerYears, pbm - 1 + partnerMonths, 1)

    return { primaryAccessDate, partnerAccessDate }
  }, [profileBirthday, partnerBirthday, goal.birthday, primaryRetirementAccessAge, partnerRetirementAccessAge])

  const { primaryAccessDate, partnerAccessDate } = accessDates

  const breakdown = useMemo<BalanceBreakdown | undefined>(() => {
    if (!fiBreakdown) return undefined
    if (!primaryAccessDate) return undefined
    return {
      retirementPrimary: fiBreakdown.retirementPrimary,
      retirementPartner: fiBreakdown.retirementPartner,
      nonRetirement: fiBreakdown.nonRetirement,
      primaryAccessDate,
      partnerAccessDate,
    }
  }, [fiBreakdown, primaryAccessDate, partnerAccessDate])

  const fiTarget = useMemo(
    () => getFiTarget(goal, profileBirthday, growthRate, postGrowthRate, ageBoundary, inflation),
    [goal, profileBirthday, growthRate, postGrowthRate, ageBoundary, inflation],
  )

  const plannedMonthly = useMemo(() => {
    const birthday = profileBirthday || goal.birthday
    if (!birthday || fiTarget <= 0) return 0
    const [by, bm] = birthday.split('-').map(Number)
    const retYear = by + goal.retirementAge
    const retMonth = `${retYear}-${String(bm).padStart(2, '0')}`
    let months: number
    if (currentMonth) {
      const [fy, fm] = currentMonth.split('-').map(Number)
      const [ty, tm] = retMonth.split('-').map(Number)
      months = (ty - fy) * 12 + (tm - fm)
    } else {
      const now = new Date()
      const retDate = new Date(retYear, bm - 1, 1)
      months = (retDate.getFullYear() - now.getFullYear()) * 12 + (retDate.getMonth() - now.getMonth())
    }
    if (months <= 0) return 0
    const r = growthRate / 100 / 12
    const factor = Math.pow(1 + r, months)
    const needed = fiTarget - currentBalance * factor
    if (needed <= 0) return 0
    return (needed * r) / (factor - 1)
  }, [goal, profileBirthday, currentBalance, currentMonth, growthRate, fiTarget])

  // Convert targetFireDate "YYYY-MM" to a Date for forced FIRE
  // Offset by -1 month because buildLifecycle's transition row uses accumulation phase,
  // and the first drawdown row appears the month after cursor >= fiDate
  const forcedFireDate = useMemo(() => {
    if (!targetFireDate) return null
    const [yr, mo] = targetFireDate.split('-').map(Number)
    return new Date(yr, mo - 2, 1)
  }, [targetFireDate])

  // Compute required monthly savings for the target FIRE date (direct formula, no search)
  const requiredMonthlySavings = useMemo(() => {
    if (!forcedFireDate) return null

    const birthday = profileBirthday || goal.birthday
    if (!birthday || !goal.goalEndYear) return null

    const preGrowth = growthRate
    const postGrowth = postGrowthRate
    const boundary = ageBoundary
    const inflationRate = inflation
    const endYear = new Date(goal.goalEndYear).getFullYear()
    const now = new Date()
    const [by, bm] = birthday.split('-').map(Number)
    const ageBoundaryDate = new Date(by + boundary, bm - 1, 1)
    const retirementYear = new Date(by + goal.retirementAge, bm - 1, 1).getFullYear()
    const monthlyExpenseToday = goal.monthlyExpense2047 / Math.pow(1 + inflationRate / 100, retirementYear - now.getFullYear())

    // What expense will be at target FIRE date
    const fiYear = forcedFireDate.getFullYear()
    const monthlyExpenseAtFI = monthlyExpenseToday * Math.pow(1 + inflationRate / 100, fiYear - now.getFullYear())
    const endOfLife = new Date(endYear, 11, 1)

    // Required corpus at the target date to sustain expenses until end of life
    const requiredCorpus = computeRequiredCorpus(
      forcedFireDate, endOfLife, ageBoundaryDate,
      monthlyExpenseAtFI, inflationRate, preGrowth, postGrowth,
    )

    // How many months from now to target FIRE date
    const monthsToFI = (fiYear - now.getFullYear()) * 12 + (forcedFireDate.getMonth() - now.getMonth())
    if (monthsToFI <= 0) return monthlyContribution

    // Direct formula: what monthly saving gets us from currentBalance to requiredCorpus in monthsToFI months
    return Math.max(0, calcMonthlySaving(currentBalance, requiredCorpus, preGrowth, monthsToFI))
  }, [forcedFireDate, goal, profileBirthday, currentBalance, monthlyContribution,
      growthRate, postGrowthRate, ageBoundary, inflation])

  const projectedProjection = useMemo(
    () =>
      buildProjectedLifecycle(
        goal,
        profileBirthday,
        currentBalance,
        requiredMonthlySavings ?? monthlyContribution,
        retirementCap,
        nonRetirementBase,
        growthRate,
        postGrowthRate,
        ageBoundary,
        breakdown,
        inflation,
        forcedFireDate,
      ),
    [
      goal,
      profileBirthday,
      currentBalance,
      requiredMonthlySavings,
      monthlyContribution,
      growthRate,
      postGrowthRate,
      ageBoundary,
      inflation,
      breakdown,
      retirementCap,
      nonRetirementBase,
      forcedFireDate,
    ],
  )

  const plannedProjection = useMemo(
    () =>
      buildPlannedProjection(
        goal,
        profileBirthday,
        currentBalance,
        retirementCap,
        nonRetirementBase,
        plannedMonthly,
        growthRate,
        postGrowthRate,
        ageBoundary,
        breakdown,
        inflation,
      ),
    [
      goal,
      profileBirthday,
      currentBalance,
      plannedMonthly,
      growthRate,
      postGrowthRate,
      ageBoundary,
      inflation,
      breakdown,
      retirementCap,
      nonRetirementBase,
    ],
  )

  const projection = scenario === 'planned' ? plannedProjection : projectedProjection

  // For Projected view, use the balance at FIRE transition as the effective goal
  // (since FIRE triggers earlier, the required corpus is different from planned)
  const effectiveFiGoal = useMemo(() => {
    if (scenario === 'planned') return fiTarget
    const fireRow = projection.find(r => r.phase === 'drawdown')
    return fireRow ? fireRow.remaining : fiTarget
  }, [scenario, projection, fiTarget])

  const projectedFireMonth = useMemo(
    () => projectedProjection.find(r => r.phase === 'drawdown')?.month ?? null,
    [projectedProjection],
  )

  const lastReportedFireMonthRef = useRef<string | null | undefined>(undefined)

  // Report the chart's FIRE month to the parent
  useEffect(() => {
    if (!onFireMonth) return
    if (lastReportedFireMonthRef.current === projectedFireMonth) return
    lastReportedFireMonthRef.current = projectedFireMonth
    onFireMonth(projectedFireMonth)
  }, [projectedFireMonth, onFireMonth])

  // Report the effective required monthly savings when target date overrides contribution
  const lastReportedSavingsRef = useRef<number | null | undefined>(undefined)
  useEffect(() => {
    if (!onRequiredSavings) return
    const val = requiredMonthlySavings
    if (lastReportedSavingsRef.current === val) return
    lastReportedSavingsRef.current = val
    onRequiredSavings(val)
  }, [requiredMonthlySavings, onRequiredSavings])

  const intervalMonths = INTERVAL_LABELS.find(i => i.value === interval)!.months
  const filteredRows = useMemo(() => {
    if (projection.length === 0) return []
    if (intervalMonths === 1) return projection

    // Find the actual FIRE transition row (first drawdown month)
    const fireIdx = projection.findIndex(r => r.phase === 'drawdown')

    // Always include the first point (current month), then bucket from there
    const result: ProjectionRow[] = [{ ...projection[0], expense: projection[0].expense }]
    for (let i = intervalMonths; i < projection.length; i += intervalMonths) {
      const bucketStart = i - intervalMonths + 1
      const bucketEnd = Math.min(i + 1, projection.length)
      const endRow = projection[Math.min(i, projection.length - 1)]

      // If the FIRE transition falls inside this bucket, insert it before the bucket end
      if (fireIdx > 0 && fireIdx >= bucketStart && fireIdx < i) {
        const fireRow = projection[fireIdx]
        let preFireExpense = 0
        for (let j = bucketStart; j < fireIdx; j++) preFireExpense += projection[j].expense
        result.push({ ...projection[fireIdx - 1], expense: preFireExpense })
        let postFireExpense = 0
        for (let j = fireIdx; j < bucketEnd; j++) postFireExpense += projection[j].expense
        result.push({ ...fireRow, expense: postFireExpense })
      } else {
        let bucketExpense = 0
        for (let j = bucketStart; j < bucketEnd; j++) {
          bucketExpense += projection[j].expense
        }
        result.push({ ...endRow, expense: bucketExpense })
      }
    }
    // Include last point if not already included
    const lastIdx = projection.length - 1
    if (result[result.length - 1].month !== projection[lastIdx].month) {
      const prevEnd = Math.floor((lastIdx - 1) / intervalMonths) * intervalMonths + 1
      let bucketExpense = 0
      for (let j = prevEnd; j <= lastIdx; j++) {
        bucketExpense += projection[j].expense
      }
      result.push({ ...projection[lastIdx], expense: bucketExpense })
    }
    return result
  }, [projection, intervalMonths])

  // ── GW Projection builder ──
  const buildGwProjection = (monthlyContrib: number, fireMonth?: string | null): ProjectionRow[] => {
    const accumulationEnd = fireMonth || gwTargetMonth
    if (!accumulationEnd || gwTarget <= 0) return []
    const startMonth = currentMonth || (() => {
      const now = new Date()
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    })()
    const [sy, sm] = startMonth.split('-').map(Number)
    const [ty, tm] = accumulationEnd.split('-').map(Number)
    const monthsToFire = (ty - sy) * 12 + (tm - sm)
    if (monthsToFire <= 0) return []

    const endMonth = gwDisburseMonth || gwTargetMonth
    if (!endMonth) return []
    const [ey, em] = endMonth.split('-').map(Number)
    const totalMonths = (ey - sy) * 12 + (em - sm)

    const r = gwGrowthRate / 100 / 12
    const rows: ProjectionRow[] = []
    let balance = gwBalance

    for (let i = 0; i <= totalMonths; i++) {
      const year = sy + Math.floor((sm - 1 + i) / 12)
      const month = ((sm - 1 + i) % 12) + 1
      const monthStr = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      const isGrowthPhase = i >= monthsToFire

      rows.push({
        month: monthStr,
        remaining: balance,
        expense: 0,
        phase: isGrowthPhase ? 'drawdown' : 'accumulation',
        monthlySaved: i === 0 ? 0 : (isGrowthPhase ? 0 : monthlyContrib),
      })

      if (i < totalMonths) {
        const contribution = i < monthsToFire ? monthlyContrib : 0
        balance = balance * (1 + r) + contribution
      }
    }
    return rows
  }

  const gwPlannedRows = useMemo(
    () => buildGwProjection(gwMonthlyContribution, gwTargetMonth),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gwBalance, gwMonthlyContribution, gwGrowthRate, gwTarget, gwTargetMonth, gwDisburseMonth, currentMonth],
  )

  const gwProjectedRows = useMemo(
    () => buildGwProjection(gwProjectedMonthlyContribution, projectedFiMonth),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gwBalance, gwProjectedMonthlyContribution, gwGrowthRate, gwTarget, gwTargetMonth, gwDisburseMonth, currentMonth, projectedFiMonth],
  )


  const gwFilteredRows = useMemo(() => {
    const rows = scenario === 'planned' ? gwPlannedRows : gwProjectedRows
    if (rows.length === 0) return []
    if (intervalMonths === 1) return rows

    const result: ProjectionRow[] = [rows[0]]
    for (let i = intervalMonths; i < rows.length; i += intervalMonths) {
      result.push(rows[Math.min(i, rows.length - 1)])
    }
    const lastIdx = rows.length - 1
    if (result[result.length - 1].month !== rows[lastIdx].month) {
      result.push(rows[lastIdx])
    }
    return result
  }, [gwPlannedRows, gwProjectedRows, scenario, intervalMonths])

  return (
    <div className="dive-deep-container">
      <div className="dive-deep-header">
        <h3 className="dive-deep-title">
          {analysisType === 'fi'
            ? `FI Analysis — ${scenario === 'projected' ? 'Projected' : 'Planned'}`
            : `GW Analysis — ${scenario === 'projected' ? 'Projected' : 'Planned'}`}
        </h3>
        <div className="projection-interval-toggle" role="group" aria-label="Analysis type">
          <button
            className={`projection-interval-btn${analysisType === 'fi' ? ' active' : ''}`}
            onClick={() => setAnalysisType('fi')}
            aria-pressed={analysisType === 'fi'}
          >
            FI
          </button>
          <button
            className={`projection-interval-btn${analysisType === 'gw' ? ' active' : ''}`}
            onClick={() => setAnalysisType('gw')}
            aria-pressed={analysisType === 'gw'}
          >
            GW
          </button>
        </div>
      </div>

      <div className="dive-deep-section">
        {analysisType === 'fi' ? (
          projection.length === 0 ? (
            <p className="dive-deep-placeholder">No projection available — check retirement date and goal end year.</p>
          ) : (
            <>
              <div className="projection-controls" role="toolbar" aria-label="Projection controls">
                <div className="projection-scenario-toggle" role="group" aria-label="Scenario selection">
                  <button
                    className={`projection-interval-btn${scenario === 'planned' ? ' active' : ''}`}
                    onClick={() => setScenario('planned')}
                    aria-pressed={scenario === 'planned'}
                  >
                    Planned ({dollars(showYearly ? plannedMonthly * 12 : plannedMonthly)}/{showYearly ? 'yr' : 'mo'})
                  </button>
                  <button
                    className={`projection-interval-btn${scenario === 'projected' ? ' active' : ''}`}
                    onClick={() => setScenario('projected')}
                    aria-pressed={scenario === 'projected'}
                  >
                    Projected ({dollars(showYearly ? (requiredMonthlySavings ?? monthlyContribution) * 12 : (requiredMonthlySavings ?? monthlyContribution))}/{showYearly ? 'yr' : 'mo'})
                  </button>
                </div>
                <div className="projection-interval-toggle" role="group" aria-label="Time interval">
                  {INTERVAL_LABELS.map(opt => (
                    <button
                      key={opt.value}
                      className={`projection-interval-btn${interval === opt.value ? ' active' : ''}`}
                      onClick={() => setInterval(opt.value)}
                      aria-pressed={interval === opt.value}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="projection-interval-toggle" role="group" aria-label="View mode">
                  <button
                    className={`projection-interval-btn${viewMode === 'chart' ? ' active' : ''}`}
                    onClick={() => setViewMode('chart')}
                    aria-pressed={viewMode === 'chart'}
                  >
                    Chart
                  </button>
                  <button
                    className={`projection-interval-btn${viewMode === 'table' ? ' active' : ''}`}
                    onClick={() => setViewMode('table')}
                    aria-pressed={viewMode === 'table'}
                  >
                    Table
                  </button>
                </div>
              </div>

              {viewMode === 'chart' ? (
                <LifecycleChart key="fi" rows={filteredRows} fiGoal={effectiveFiGoal} />
              ) : (
                <LifecycleTable
                  key="fi"
                  rows={filteredRows}
                  interval={interval}
                  primaryAccessDate={primaryAccessDate}
                  partnerAccessDate={partnerAccessDate}
                />
              )}
            </>
          )
        ) : (
          gwPlannedRows.length === 0 ? (
            <p className="dive-deep-placeholder">No GW projection available — add GW goals first.</p>
          ) : (
            <>
              <div className="projection-controls" role="toolbar" aria-label="GW Projection controls">
                <div className="projection-scenario-toggle" role="group" aria-label="Scenario selection">
                  <button
                    className={`projection-interval-btn${scenario === 'planned' ? ' active' : ''}`}
                    onClick={() => setScenario('planned')}
                    aria-pressed={scenario === 'planned'}
                  >
                    Planned ({dollars(showYearly ? gwMonthlyContribution * 12 : gwMonthlyContribution)}/{showYearly ? 'yr' : 'mo'})
                  </button>
                  <button
                    className={`projection-interval-btn${scenario === 'projected' ? ' active' : ''}`}
                    onClick={() => setScenario('projected')}
                    aria-pressed={scenario === 'projected'}
                  >
                    Projected ({dollars(showYearly ? gwProjectedMonthlyContribution * 12 : gwProjectedMonthlyContribution)}/{showYearly ? 'yr' : 'mo'})
                  </button>
                </div>
                <div className="projection-interval-toggle" role="group" aria-label="Time interval">
                  {INTERVAL_LABELS.map(opt => (
                    <button
                      key={opt.value}
                      className={`projection-interval-btn${interval === opt.value ? ' active' : ''}`}
                      onClick={() => setInterval(opt.value)}
                      aria-pressed={interval === opt.value}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="projection-interval-toggle" role="group" aria-label="View mode">
                  <button
                    className={`projection-interval-btn${viewMode === 'chart' ? ' active' : ''}`}
                    onClick={() => setViewMode('chart')}
                    aria-pressed={viewMode === 'chart'}
                  >
                    Chart
                  </button>
                  <button
                    className={`projection-interval-btn${viewMode === 'table' ? ' active' : ''}`}
                    onClick={() => setViewMode('table')}
                    aria-pressed={viewMode === 'table'}
                  >
                    Table
                  </button>
                </div>
              </div>

              {viewMode === 'chart' ? (
                <LifecycleChart key="gw" rows={gwFilteredRows} fiGoal={scenario === 'projected' ? gwProjectedTarget : gwTarget} goalLabel="GW goal" />
              ) : (
                <LifecycleTable
                  key="gw"
                  rows={gwFilteredRows}
                  interval={interval}
                  hideExpense
                />
              )}
            </>
          )
        )}
      </div>
    </div>
  )
}

export default GoalDiveDeep
