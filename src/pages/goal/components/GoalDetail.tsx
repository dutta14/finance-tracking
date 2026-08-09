import { FC, useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { FinancialGoal, GwGoal } from '../../../types'
import { useData } from '../../../contexts/DataContext'
import GoalDetailedCard from './GoalDetailedCard'
import GoalActionsMenu from './GoalActionsMenu'
import GoalDiveDeep from './GoalDiveDeep'
import GwSection from './GwSection'
import { GwSavingsPlan } from './SavingsPlan'
import GrowthSettingsPanel from './GrowthSettingsPanel'
import {
  getTotalForMonth,
  getFiBreakdown,
  getRetirementMonth,
  monthsBetween,
  calcMonthlySaving,
  getGwTarget,
} from '../utils/goalMath'
import { getFiTarget } from '../utils/goalCalculations'
import { formatTimeUntilYearMonth, formatYearMonthLong, parseShortMonthYear } from '../utils/dateHelpers'
import { useYearMonthlySaving } from '../hooks/useYearMonthlySaving'
import { useGrowthSettings } from '../hooks/useGrowthSettings'
import '../../../styles/GoalDetail.css'
import '../../../styles/GoalDiveDeep.css'
import '../../../styles/SavingsPlan.css'
import '../../../styles/GwSection.css'
import '../../../styles/GrowthSettings.css'

interface GoalDetailProps {
  goals: FinancialGoal[]
  profileBirthday: string
  partnerBirthday?: string
  gwGoals: GwGoal[]
  growthSettings: ReturnType<typeof useGrowthSettings>
  onUpdateGoal: (goalId: number, goal: FinancialGoal) => void
  onCopyGoal: (goal: FinancialGoal) => void
  onDeleteGoal: (goalId: number) => void
  onRenameGoal: (goalId: number, name: string) => void
  onCreateGwGoal: (goal: Omit<GwGoal, 'id' | 'createdAt'>) => void
  onUpdateGwGoal: (id: number, updates: Partial<Omit<GwGoal, 'id' | 'createdAt' | 'fiGoalId'>>) => void
  onDeleteGwGoal: (id: number) => void
}

const GoalDetail: FC<GoalDetailProps> = ({
  goals,
  profileBirthday,
  partnerBirthday,
  gwGoals,
  growthSettings: growthCtx,
  onUpdateGoal,
  onCopyGoal,
  onDeleteGoal,
  onRenameGoal,
  onCreateGwGoal,
  onUpdateGwGoal,
  onDeleteGwGoal,
}) => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const goalId = Number(id)
  const goal = goals.find(g => g.id === goalId)

  const [renameMode, setRenameMode] = useState(false)
  const [renameName, setRenameName] = useState('')
  const [showYearly, setShowYearly] = useState(false)
  const [fiProjectedMonth, setFiProjectedMonth] = useState<string | null>(null)
  const [fiYearOverride, setFiYearOverride] = useState<string | null>(null)
  const [chartRequiredSavings, setChartRequiredSavings] = useState<number | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const [localSavingsOverride, setLocalSavingsOverride] = useState<number | null>(null)
  const savingsOverride = localSavingsOverride

  const handleFireMonth = useCallback((month: string | null) => {
    const nextMonth = month ? parseShortMonthYear(month) : null
    setFiProjectedMonth(prev => (prev === nextMonth ? prev : nextMonth))
  }, [])

  const handleSavingsOverrideChange = useCallback((v: number | null) => {
    setLocalSavingsOverride(prev => (prev === v ? prev : v))
  }, [])

  const handleFiYearOverrideChange = useCallback((v: string | null) => {
    setFiYearOverride(prev => (prev === v ? prev : v))
  }, [])

  const handleRequiredSavings = useCallback((v: number | null) => {
    setChartRequiredSavings(prev => (prev === v ? prev : v))
  }, [])

  // Sync state when navigating between goals
  useEffect(() => {
    setRenameMode(false)
    setFiYearOverride(null)
    setChartRequiredSavings(null)
    setLocalSavingsOverride(null)
  }, [goal?.id])

  const { pre: fiGrowth, post: _fiPostGrowth, hasOverride: _fiHasOverride } = growthCtx.getEffectiveFiRates(goalId)
  const gwGrowth = growthCtx.settings.gwGrowth

  const currentIndex = goals.findIndex(g => g.id === goalId)
  const total = goals.length
  const prevGoal = currentIndex > 0 ? goals[currentIndex - 1] : null
  const nextGoal = currentIndex < total - 1 ? goals[currentIndex + 1] : null

  useEffect(() => {
    setRenameMode(false)
  }, [goalId])

  useEffect(() => {
    if (renameMode) renameInputRef.current?.focus()
  }, [renameMode])

  // Arrow key navigation between goals
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return
      if (e.key === 'ArrowLeft' && prevGoal) navigate(`/goal/${prevGoal.id}`)
      if (e.key === 'ArrowRight' && nextGoal) navigate(`/goal/${nextGoal.id}`)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [prevGoal, nextGoal, navigate])

  const { accounts, balances, allMonths } = useData()
  const { summaryYear, setSummaryYear, availableYears, yearMonthlySaving } = useYearMonthlySaving()

  const summaryData = useMemo(() => {
    if (!goal || allMonths.length === 0) return null
    const currentMonth = allMonths[allMonths.length - 1]
    const retMonth = getRetirementMonth(goal.birthday || profileBirthday, goal.retirementAge)
    const n = monthsBetween(currentMonth, retMonth)

    const fiBal = getTotalForMonth(accounts, balances, currentMonth, 'fi')
    const fiTarget = getFiTarget(
      goal,
      profileBirthday,
      fiGrowth,
      growthCtx.settings.postBoundaryGrowth,
      growthCtx.settings.ageBoundary,
    )
    const fiMonthly = fiTarget > 0 ? calcMonthlySaving(fiBal, fiTarget, fiGrowth, n) : 0

    const gwTarget = getGwTarget(goal, gwGoals, profileBirthday, growthCtx.settings.inflation)
    const gwBal = getTotalForMonth(accounts, balances, currentMonth, 'gw')
    const gwMonthly = gwTarget > 0 ? calcMonthlySaving(gwBal, gwTarget, gwGrowth, n) : 0

    const totalNeeded = fiMonthly + gwMonthly
    const hasGoals = fiTarget > 0 || gwTarget > 0

    const fiBreakdown = getFiBreakdown(accounts, balances, currentMonth)
    return { totalNeeded, fiBal, currentMonth, hasGoals, fiBreakdown, gwMonthly }
  }, [goal, allMonths, accounts, balances, profileBirthday, gwGoals, fiGrowth, gwGrowth, growthCtx.settings])

  // GW Projection: how much to save for GW if FIRE happens at projected FI date
  const gwProjection = useMemo(() => {
    if (!goal || !fiProjectedMonth || allMonths.length === 0) return null
    const gwTargetAtRetirement = getGwTarget(goal, gwGoals, profileBirthday, growthCtx.settings.inflation)
    if (gwTargetAtRetirement <= 0) return null
    const currentMonth = allMonths[allMonths.length - 1]
    const gwBal = getTotalForMonth(accounts, balances, currentMonth, 'gw')

    const monthsToFI = monthsBetween(currentMonth, fiProjectedMonth)
    if (monthsToFI <= 0) return null

    // Discount GW target back from retirement date to FI date
    // gwTarget is needed at retirement (retirementAge). If FIRE is earlier, 
    // money grows from FIRE date to retirement date, so we need less at FIRE.
    const retMonth = getRetirementMonth(goal.birthday || profileBirthday, goal.retirementAge)
    const monthsFItoRetirement = monthsBetween(fiProjectedMonth, retMonth)
    const gwTargetAtFI = monthsFItoRetirement > 0
      ? gwTargetAtRetirement / Math.pow(1 + gwGrowth / 100 / 12, monthsFItoRetirement)
      : gwTargetAtRetirement

    if (gwBal >= gwTargetAtFI) return { state: 'reached' as const }

    const requiredMonthly = calcMonthlySaving(gwBal, gwTargetAtFI, gwGrowth, monthsToFI)
    const [yr, mo] = fiProjectedMonth.split('-').map(Number)
    const fiDate = new Date(yr, mo - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    const fiYears = Math.floor(monthsToFI / 12)
    const fiRemMonths = monthsToFI % 12
    const timeUntilFI = fiYears > 0 && fiRemMonths > 0
      ? `${fiYears} year${fiYears > 1 ? 's' : ''} ${fiRemMonths} month${fiRemMonths > 1 ? 's' : ''}`
      : fiYears > 0
        ? `${fiYears} year${fiYears > 1 ? 's' : ''}`
        : `${fiRemMonths} month${fiRemMonths > 1 ? 's' : ''}`
    return {
      state: 'projected' as const,
      fiDate,
      timeUntilFI,
      monthlySaving: requiredMonthly,
      annualSaving: requiredMonthly * 12,
      gwTarget: gwTargetAtFI,
      gwTargetAtRetirement,
    }
  }, [goal, fiProjectedMonth, allMonths, accounts, balances, profileBirthday, gwGoals, gwGrowth, growthCtx.settings])

  if (!goal) {
    return (
      <div className="goal-detail-not-found">
        <svg
          width="48"
          height="48"
          viewBox="0 0 48 48"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="goal-detail-not-found-icon"
        >
          <circle cx="24" cy="24" r="20" />
          <path d="M18 18l12 12M30 18L18 30" />
        </svg>
        <p>This goal may have been deleted or the link is no longer valid.</p>
        <Link className="goal-detail-not-found-btn" to="/goal">
          ← Back to Goals
        </Link>
      </div>
    )
  }

  const enterRename = () => {
    setRenameName(goal.goalName)
    setRenameMode(true)
  }
  const commitRename = () => {
    if (renameName.trim()) onRenameGoal(goal.id, renameName.trim())
    setRenameMode(false)
  }

  const handleDelete = () => {
    onDeleteGoal(goal.id)
    if (nextGoal) navigate(`/goal/${nextGoal.id}`)
    else if (prevGoal) navigate(`/goal/${prevGoal.id}`)
    else navigate('/goal')
  }

  return (
    <div className="goal-detail">
      <div className="goal-detail-header">
        <div className="goal-detail-header-left">
          <Link className="goal-detail-back-link" to="/goal" aria-label="Back to Goals">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M10 3L5 8l5 5" />
            </svg>
          </Link>
          {renameMode ? (
            <input
              ref={renameInputRef}
              className="goal-detail-rename-input"
              value={renameName}
              onChange={e => setRenameName(e.target.value)}
              placeholder="Goal name"
              aria-label="Rename goal"
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') setRenameMode(false)
              }}
              onBlur={commitRename}
            />
          ) : (
            <h1 className="goal-detail-title">{goal.goalName}</h1>
          )}
        </div>
        <div className="goal-detail-header-right">
          {total > 1 && (
            <div className="goal-detail-stepper" role="group" aria-label="Goal navigation">
              <button
                className="goal-detail-step-btn"
                onClick={() => prevGoal && navigate(`/goal/${prevGoal.id}`)}
                disabled={!prevGoal}
                aria-label="Previous goal"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M10 3L5 8l5 5" />
                </svg>
              </button>
              <span className="goal-detail-step-label" aria-current="step">
                Goal {currentIndex + 1} of {total}
              </span>
              <button
                className="goal-detail-step-btn"
                onClick={() => nextGoal && navigate(`/goal/${nextGoal.id}`)}
                disabled={!nextGoal}
                aria-label="Next goal"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 3l5 5-5 5" />
                </svg>
              </button>
            </div>
          )}
          <GrowthSettingsPanel settings={growthCtx.settings} onUpdate={growthCtx.updateSettings} />
          <GoalActionsMenu onRename={enterRename} onDuplicate={() => onCopyGoal(goal)} onDelete={handleDelete} />
        </div>
      </div>


      {/* FI Row */}
      <div className="goal-detail-section">
        <h2 className="goal-detail-column-title">
          <span className="goal-detail-column-badge goal-detail-column-badge--fi">FI</span>
          Financial Independence
        </h2>
        <div className="goal-detail-section-cards">
          <GoalDetailedCard
            goal={goal}
            profileBirthday={profileBirthday}
            onUpdateGoal={onUpdateGoal}
            showActions={false}
            showTitle={false}
            preBoundaryGrowth={growthCtx.settings.preBoundaryGrowth}
            postBoundaryGrowth={growthCtx.settings.postBoundaryGrowth}
            ageBoundary={growthCtx.settings.ageBoundary}
            inflation={growthCtx.settings.inflation}
            showYearly={showYearly}
            onTogglePeriod={() => setShowYearly(v => !v)}
            summaryYear={summaryYear}
            availableYears={availableYears}
            onSummaryYearChange={setSummaryYear}
            savingsOverride={savingsOverride}
            onSavingsOverrideChange={handleSavingsOverrideChange}
            gwMonthlySavings={summaryData?.gwMonthly ?? 0}
            fiProjectedMonth={fiProjectedMonth}
            fiYearOverride={fiYearOverride}
            onFiYearOverrideChange={handleFiYearOverrideChange}
            chartRequiredSavings={chartRequiredSavings}
          />
        </div>
      </div>

      {/* GW Row */}
      <div className="goal-detail-section">
        <h2 className="goal-detail-column-title">
          <span className="goal-detail-column-badge goal-detail-column-badge--gw">GW</span>
          Generational Wealth
        </h2>
        <div className="goal-detail-section-cards">
          <div className="fi-card">
            <h3 className="fi-card-section-title">Planned Goal</h3>
            <GwSavingsPlan
              goal={goal}
              gwGoals={gwGoals}
              profileBirthday={profileBirthday}
              growthRate={gwGrowth}
              showYearly={showYearly}
              onTogglePeriod={() => setShowYearly(v => !v)}
              inflation={growthCtx.settings.inflation}
            />
            {goal.fiGoal > 0 && (
              <GwSection
                goal={goal}
                goals={goals}
                profileBirthday={profileBirthday}
                gwGoals={gwGoals}
                gwGrowthRate={gwGrowth}
                inflationRate={growthCtx.settings.inflation}
                onCreateGwGoal={onCreateGwGoal}
                onUpdateGwGoal={onUpdateGwGoal}
                onDeleteGwGoal={onDeleteGwGoal}
              />
            )}
          </div>

          {gwProjection && gwProjection.state === 'projected' && fiProjectedMonth && (
            <div className="fi-card">
              <h3 className="fi-card-section-title">Projections</h3>
              <div className="fi-projection-block">
                <div className="fi-projection-rows">
                  <div className="fi-projection-row">
                    <span className="fi-projection-key">GW target</span>
                    <span className="fi-projection-val">{'$' + Math.round(gwProjection.gwTarget).toLocaleString()}</span>
                  </div>
                  <div className="fi-projection-row">
                    <span className="fi-projection-key">Saving</span>
                    <span className="fi-projection-val">
                      {gwProjection.monthlySaving <= 0
                        ? "You've achieved this goal 🎉"
                        : `$${Math.round(showYearly ? gwProjection.annualSaving : gwProjection.monthlySaving).toLocaleString()}/${showYearly ? 'yr' : 'mo'}`
                      }
                    </span>
                  </div>
                </div>
              </div>
              <div className="fi-projection-result-row">
                <span className="fi-goal-prose fi-projection-result-label">→ FI in</span>
                <p className="fi-goal-prose fi-projection-result">
                  <strong>
                    {formatYearMonthLong(fiYearOverride ?? fiProjectedMonth)}
                  </strong> ({formatTimeUntilYearMonth(fiYearOverride ?? fiProjectedMonth)})
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <GoalDiveDeep
        goal={goal}
        profileBirthday={profileBirthday}
        partnerBirthday={partnerBirthday}
        currentBalance={summaryData?.fiBal || 0}
        monthlyContribution={savingsOverride ?? Math.max(0, (yearMonthlySaving ?? 0) - (summaryData?.gwMonthly ?? 0))}
        currentMonth={summaryData?.currentMonth}
        growthRate={fiGrowth}
        postGrowthRate={growthCtx.settings.postBoundaryGrowth}
        ageBoundary={growthCtx.settings.ageBoundary}
        inflation={growthCtx.settings.inflation}
        fiBreakdown={summaryData?.fiBreakdown}
        primaryRetirementAccessAge={growthCtx.settings.primaryRetirementAccessAge}
        partnerRetirementAccessAge={growthCtx.settings.partnerRetirementAccessAge}
        retirementCap={growthCtx.settings.retirementCap}
        nonRetirementBase={growthCtx.settings.nonRetirementBase}
        showYearly={showYearly}
        targetFireDate={fiYearOverride}
        onFireMonth={handleFireMonth}
        onRequiredSavings={handleRequiredSavings}
      />
    </div>
  )
}

export default GoalDetail
