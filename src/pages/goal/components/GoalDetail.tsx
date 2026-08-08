import { FC, useState, useRef, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { FinancialGoal, GwGoal } from '../../../types'
import { useData } from '../../../contexts/DataContext'
import { formatCurrency } from '../../data/types'
import { appStorage } from '../../../utils/appStorage'
import GoalDetailedCard from './GoalDetailedCard'
import GoalActionsMenu from './GoalActionsMenu'
import GoalDiveDeep from './GoalDiveDeep'
import GwSection from './GwSection'
import { FiSavingsPlan, GwSavingsPlan } from './SavingsPlan'
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
import { useYearMonthlySaving } from '../hooks/useYearMonthlySaving'
import { useGrowthSettings } from '../hooks/useGrowthSettings'
import '../../../styles/GoalDetail.css'
import '../../../styles/GoalDiveDeep.css'
import '../../../styles/SavingsPlan.css'
import '../../../styles/GwSection.css'
import '../../../styles/GrowthSettings.css'

/** Inline value that shows formatted text, becomes an input on click */
const InlineEditableValue: FC<{
  value: string
  onChange: (v: string) => void
  displayValue: string
  placeholder: string
  ariaLabel: string
  narrow?: boolean
}> = ({ value, onChange, displayValue, placeholder, ariaLabel, narrow }) => {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  if (!editing) {
    return (
      <strong
        className="goal-summary-toggleable"
        onClick={() => {
          setEditing(true)
          setTimeout(() => inputRef.current?.focus(), 0)
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setEditing(true)
            setTimeout(() => inputRef.current?.focus(), 0)
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
      >
        {value ? displayValue : placeholder}
      </strong>
    )
  }

  return (
    <input
      ref={inputRef}
      className={`goal-summary-inline-input${narrow ? ' goal-summary-inline-input--narrow' : ''}`}
      type="text"
      inputMode="numeric"
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={() => setEditing(false)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      autoFocus
    />
  )
}

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
  const [annualSpending, setAnnualSpending] = useState(() => (goal?.annualSpending ? String(goal.annualSpending) : ''))
  const [incomeTaxRate, setIncomeTaxRate] = useState(() => (goal?.incomeTaxRate ? String(goal.incomeTaxRate) : ''))
  const renameInputRef = useRef<HTMLInputElement>(null)
  const savingsOverride = goal?.savingsOverride ?? null

  const setSavingsOverride = (v: number | null) => {
    if (!goal) return
    onUpdateGoal(goalId, { ...goal, savingsOverride: v })
  }

  // Sync state when navigating between goals
  useEffect(() => {
    setAnnualSpending(goal?.annualSpending ? String(goal.annualSpending) : '')
    setIncomeTaxRate(goal?.incomeTaxRate ? String(goal.incomeTaxRate) : '')
  }, [goal?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleSpendingChange = (v: string) => {
    setAnnualSpending(v)
    const parsed = Number(v.replace(/[^0-9.]/g, '')) || 0
    if (goal) onUpdateGoal(goalId, { ...goal, annualSpending: parsed || null })
  }

  const handleTaxRateChange = (v: string) => {
    setIncomeTaxRate(v)
    const parsed = Number(v) || 0
    if (goal) onUpdateGoal(goalId, { ...goal, incomeTaxRate: parsed || null })
  }

  const parsedSpending = Number(annualSpending.replace(/[^0-9.]/g, '')) || 0
  const parsedTaxRate = Number(incomeTaxRate) || 0
  const annualSavingsNeeded = (summaryData?.totalNeeded ?? 0) * 12
  const grossIncome = parsedTaxRate < 100 ? (annualSavingsNeeded + parsedSpending) / (1 - parsedTaxRate / 100) : 0

  const lastYearGross = useMemo(() => {
    const lastYear = new Date().getFullYear() - 1
    try {
      const overrides = appStorage.getJSON<Record<number, { grossIncome?: number; taxes?: number }>>(
        'sgt-overrides',
        {},
      )
      const entry = overrides[lastYear]
      if (!entry?.grossIncome) return null
      const taxRate =
        entry.taxes != null && entry.grossIncome ? ((entry.taxes / entry.grossIncome) * 100).toFixed(1) : null
      return { grossIncome: entry.grossIncome, taxRate }
    } catch {
      return null
    }
  }, [])

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

      {summaryData && (
        <div className="goal-summary-card">
          <p className="goal-summary-prose">
            {!summaryData.hasGoals ? (
              <>Set an FI target or add GW goals to see your savings plan.</>
            ) : summaryData.totalNeeded > 0 ? (
              <>
                To achieve your goals, you need to save{' '}
                <strong
                  className="goal-summary-toggleable"
                  onClick={() => setShowYearly(v => !v)}
                  title={showYearly ? 'Click to show monthly' : 'Click to show yearly'}
                >
                  {showYearly
                    ? `${formatCurrency(summaryData.totalNeeded * 12)}/yr`
                    : `${formatCurrency(summaryData.totalNeeded)}/mo`}
                </strong>
                .
              </>
            ) : (
              <>🎉 You&apos;ve already achieved all your goals at the current growth rate.</>
            )}
          </p>
          {summaryData.totalNeeded > 0 && yearMonthlySaving !== null && (
            <p className="goal-summary-prose">
              {summaryYear < new Date().getFullYear() ? 'You saved' : 'You\u0027re saving'}{' '}
              <strong
                className="goal-summary-toggleable"
                onClick={() => setShowYearly(v => !v)}
                title={showYearly ? 'Click to show monthly' : 'Click to show yearly'}
              >
                {showYearly
                  ? `${formatCurrency(yearMonthlySaving * 12)}/yr`
                  : `${formatCurrency(yearMonthlySaving)}/mo`}
              </strong>{' '}
              in{' '}
              <select
                className="goal-summary-year-select"
                value={summaryYear}
                onChange={e => setSummaryYear(Number(e.target.value))}
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              {yearMonthlySaving >= summaryData.totalNeeded ? (
                summaryYear < new Date().getFullYear() ? (
                  ' \u2014 you were on track.'
                ) : (
                  ' \u2014 you\u2019re on track.'
                )
              ) : (
                <>
                  {summaryYear < new Date().getFullYear() ? ' \u2014 you needed ' : ' \u2014 you need '}
                  <strong
                    className="goal-summary-toggleable"
                    onClick={() => setShowYearly(v => !v)}
                    title={showYearly ? 'Click to show monthly' : 'Click to show yearly'}
                  >
                    {showYearly
                      ? `${formatCurrency((summaryData.totalNeeded - yearMonthlySaving) * 12)}/yr`
                      : `${formatCurrency(summaryData.totalNeeded - yearMonthlySaving)}/mo`}
                  </strong>
                  {' more.'}
                </>
              )}
            </p>
          )}
          {summaryData.totalNeeded > 0 && (
            <p className="goal-summary-prose">
              If you want to spend{' '}
              <InlineEditableValue
                value={annualSpending}
                onChange={handleSpendingChange}
                displayValue={parsedSpending ? `${formatCurrency(parsedSpending)}` : '$0'}
                placeholder="$0"
                ariaLabel="Annual spending"
              />
              /yr, and your tax rate is{' '}
              <InlineEditableValue
                value={incomeTaxRate}
                onChange={handleTaxRateChange}
                displayValue={parsedTaxRate ? `${parsedTaxRate}` : '0'}
                placeholder="0"
                ariaLabel="Income tax rate"
                narrow
              />
              %, then your gross income should at least be <strong>{formatCurrency(grossIncome)}/yr</strong>.
            </p>
          )}
          {lastYearGross !== null && (
            <p className="goal-summary-prose">
              Your gross income last year was <strong>{formatCurrency(lastYearGross.grossIncome)}</strong>
              {lastYearGross.taxRate !== null && (
                <>
                  , and your tax rate was <strong>{lastYearGross.taxRate}%</strong>
                </>
              )}
              .
            </p>
          )}
        </div>
      )}

      <div className="goal-detail-body goal-detail-body--columns">
        <div className="goal-detail-column">
          <h2 className="goal-detail-column-title">
            <span className="goal-detail-column-badge goal-detail-column-badge--fi">FI</span>
            Financial Independence
          </h2>
          <FiSavingsPlan
            goal={goal}
            gwGoals={gwGoals}
            profileBirthday={profileBirthday}
            growthRate={fiGrowth}
            postGrowthRate={growthCtx.settings.postBoundaryGrowth}
            ageBoundary={growthCtx.settings.ageBoundary}
            showYearly={showYearly}
            onTogglePeriod={() => setShowYearly(v => !v)}
            inflation={growthCtx.settings.inflation}
          />
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
            savingsOverride={savingsOverride}
            onSavingsOverrideChange={setSavingsOverride}
            gwMonthlySavings={summaryData?.gwMonthly ?? 0}
          />
        </div>

        <div className="goal-detail-column">
          <h2 className="goal-detail-column-title">
            <span className="goal-detail-column-badge goal-detail-column-badge--gw">GW</span>
            Generational Wealth
          </h2>
          <GwSavingsPlan
            goal={goal}
            gwGoals={gwGoals}
            profileBirthday={profileBirthday}
            growthRate={gwGrowth}
            showYearly={showYearly}
            onTogglePeriod={() => setShowYearly(v => !v)}
            inflation={growthCtx.settings.inflation}
          />
          <div className="goal-detail-column-card">
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
      />
    </div>
  )
}

export default GoalDetail
