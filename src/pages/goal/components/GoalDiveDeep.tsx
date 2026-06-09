import { FC, useMemo, useState } from 'react'
import { FinancialGoal } from '../../../types'
import {
  ProjectionRow,
  BalanceBreakdown,
  buildPlannedProjection,
  buildProjectedLifecycle,
} from '../utils/lifecycleProjection'
import { getFiTarget } from '../utils/goalCalculations'
import { FiBreakdown } from '../utils/goalMath'
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
}) => {
  const [interval, setInterval] = useState<ViewInterval>('yearly')
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [scenario, setScenario] = useState<DataMode>('projected')

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
    () => getFiTarget(goal, profileBirthday, growthRate, postGrowthRate, ageBoundary),
    [goal, profileBirthday, growthRate, postGrowthRate, ageBoundary],
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

  const projection = useMemo(
    () =>
      scenario === 'planned'
        ? buildPlannedProjection(
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
          )
        : buildProjectedLifecycle(
            goal,
            profileBirthday,
            currentBalance,
            monthlyContribution,
            retirementCap,
            nonRetirementBase,
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
      monthlyContribution,
      plannedMonthly,
      scenario,
      growthRate,
      postGrowthRate,
      ageBoundary,
      inflation,
      breakdown,
      retirementCap,
      nonRetirementBase,
    ],
  )

  const intervalMonths = INTERVAL_LABELS.find(i => i.value === interval)!.months
  const filteredRows = useMemo(() => {
    if (projection.length === 0) return []
    if (intervalMonths === 1) return projection
    const result: ProjectionRow[] = []
    for (let i = 0; i < projection.length; i += intervalMonths) {
      const bucketEnd = Math.min(i + intervalMonths, projection.length)
      const endRow = projection[bucketEnd - 1]
      let bucketExpense = 0
      for (let j = i; j < bucketEnd; j++) {
        bucketExpense += projection[j].expense
      }
      result.push({ ...endRow, expense: bucketExpense })
    }
    return result
  }, [projection, intervalMonths])

  return (
    <div className="dive-deep-container">
      <h3 className="dive-deep-title">Analysis — {goal.goalName}</h3>

      <div className="dive-deep-section">
        <h4>Full Lifecycle — {scenario === 'projected' ? 'Projected' : 'Planned'}</h4>
        {projection.length === 0 ? (
          <p className="dive-deep-placeholder">No projection available — check retirement date and goal end year.</p>
        ) : (
          <>
            <div className="projection-controls" role="toolbar" aria-label="Projection controls">
              <div className="projection-scenario-toggle" role="group" aria-label="Scenario selection">
                <button
                  className={`projection-interval-btn${scenario === 'projected' ? ' active' : ''}`}
                  onClick={() => setScenario('projected')}
                  aria-pressed={scenario === 'projected'}
                >
                  Projected ({dollars(monthlyContribution)}/mo)
                </button>
                <button
                  className={`projection-interval-btn${scenario === 'planned' ? ' active' : ''}`}
                  onClick={() => setScenario('planned')}
                  aria-pressed={scenario === 'planned'}
                >
                  Planned ({dollars(plannedMonthly)}/mo)
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
              <button
                className="projection-view-toggle"
                onClick={() => setViewMode(v => (v === 'chart' ? 'table' : 'chart'))}
                aria-label={viewMode === 'chart' ? 'Switch to table view' : 'Switch to chart view'}
              >
                {viewMode === 'chart' ? 'View Table' : 'View Chart'}
              </button>
            </div>

            {viewMode === 'chart' ? (
              <LifecycleChart rows={filteredRows} />
            ) : (
              <LifecycleTable
                rows={filteredRows}
                interval={interval}
                primaryAccessDate={primaryAccessDate}
                partnerAccessDate={partnerAccessDate}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default GoalDiveDeep
