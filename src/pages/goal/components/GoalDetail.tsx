import { FC, useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { FinancialGoal, GwGoal } from '../../../types'
import { useData } from '../../../contexts/DataContext'
import { formatCurrency } from '../../data/types'
import GoalDetailedCard from './GoalDetailedCard'
import GoalActionsMenu from './GoalActionsMenu'
import GoalDiveDeep from './GoalDiveDeep'
import GwSection from './GwSection'
import { FiSavingsPlan, GwSavingsPlan } from './SavingsPlan'
import { getTotalForMonth, getRetirementMonth, monthsBetween, calcMonthlySaving, getGwTarget } from '../utils/goalMath'
import { useYearMonthlySaving } from '../hooks/useYearMonthlySaving'
import '../../../styles/GoalDetail.css'
import '../../../styles/GoalDiveDeep.css'
import '../../../styles/SavingsPlan.css'
import '../../../styles/GwSection.css'

interface GoalDetailProps {
  goals: FinancialGoal[]
  profileBirthday: string
  gwGoals: GwGoal[]
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
  gwGoals,
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
  const [diveDeepOpen, setDiveDeepOpen] = useState(false)
  const renameInputRef = useRef<HTMLInputElement>(null)

  const growthKey = `goal-growth-${goalId}`
  const savedGrowth = useMemo(() => {
    try {
      const raw = localStorage.getItem(growthKey)
      if (raw) return JSON.parse(raw) as { fi: number; gw: number }
    } catch {}
    return null
  }, [growthKey])
  const [growthRates, setGrowthRates] = useState({ fi: savedGrowth?.fi ?? 8, gw: savedGrowth?.gw ?? 8 })
  const fiGrowth = growthRates.fi
  const gwGrowth = growthRates.gw

  const setFiGrowth = useCallback(
    (v: number) => {
      setGrowthRates(prev => {
        const next = { ...prev, fi: v }
        localStorage.setItem(growthKey, JSON.stringify(next))
        return next
      })
    },
    [growthKey],
  )

  const setGwGrowth = useCallback(
    (v: number) => {
      setGrowthRates(prev => {
        const next = { ...prev, gw: v }
        localStorage.setItem(growthKey, JSON.stringify(next))
        return next
      })
    },
    [growthKey],
  )

  const currentIndex = goals.findIndex(g => g.id === goalId)
  const total = goals.length
  const prevGoal = currentIndex > 0 ? goals[currentIndex - 1] : null
  const nextGoal = currentIndex < total - 1 ? goals[currentIndex + 1] : null

  useEffect(() => {
    setRenameMode(false)
    setDiveDeepOpen(false)
    const key = `goal-growth-${goalId}`
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw)
        setGrowthRates({ fi: parsed.fi ?? 8, gw: parsed.gw ?? 8 })
      } else {
        setGrowthRates({ fi: 8, gw: 8 })
      }
    } catch {
      setGrowthRates({ fi: 8, gw: 8 })
    }
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
    const fiMonthly = goal.fiGoal > 0 ? calcMonthlySaving(fiBal, goal.fiGoal, fiGrowth, n) : 0

    const gwTarget = getGwTarget(goal, gwGoals, profileBirthday)
    const gwBal = getTotalForMonth(accounts, balances, currentMonth, 'gw')
    const gwMonthly = gwTarget > 0 ? calcMonthlySaving(gwBal, gwTarget, gwGrowth, n) : 0

    const totalNeeded = fiMonthly + gwMonthly
    const hasGoals = goal.fiGoal > 0 || gwTarget > 0

    return { totalNeeded, fiBal, currentMonth, hasGoals }
  }, [goal, allMonths, accounts, balances, profileBirthday, gwGoals, fiGrowth, gwGrowth])

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
          <Link className="goal-detail-back-link" to="/goal">
            <svg
              width="14"
              height="14"
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
            Goals
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
                To achieve all your goals, you need to save{' '}
                <strong>{formatCurrency(summaryData.totalNeeded)}/mo</strong> total.
                {yearMonthlySaving !== null && (
                  <>
                    {' '}
                    You&apos;re saving <strong>{formatCurrency(yearMonthlySaving)}/mo</strong> in{' '}
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
                      ' \u2014 you\u2019re on track.'
                    ) : (
                      <>
                        {' \u2014 you need '}
                        <strong>{formatCurrency(summaryData.totalNeeded - yearMonthlySaving)}/mo</strong>
                        {' more.'}
                      </>
                    )}
                  </>
                )}
              </>
            ) : (
              <>🎉 You&apos;ve already achieved all your goals at the current growth rate.</>
            )}
          </p>
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
            onGrowthChange={setFiGrowth}
          />
          <GoalDetailedCard
            goal={goal}
            profileBirthday={profileBirthday}
            onUpdateGoal={onUpdateGoal}
            showActions={false}
            showTitle={false}
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
            onGrowthChange={setGwGrowth}
          />
          <div className="goal-detail-column-card">
            {goal.fiGoal > 0 && (
              <GwSection
                goal={goal}
                goals={goals}
                profileBirthday={profileBirthday}
                gwGoals={gwGoals}
                onCreateGwGoal={onCreateGwGoal}
                onUpdateGwGoal={onUpdateGwGoal}
                onDeleteGwGoal={onDeleteGwGoal}
              />
            )}
          </div>
        </div>
      </div>

      <button className={`btn-dive-deep${diveDeepOpen ? ' active' : ''}`} onClick={() => setDiveDeepOpen(v => !v)}>
        {diveDeepOpen ? 'Close Analysis' : 'Analysis'}
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`goal-detail-chevron${diveDeepOpen ? ' goal-detail-chevron--open' : ''}`}
          aria-hidden="true"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {diveDeepOpen && (
        <GoalDiveDeep
          goal={goal}
          profileBirthday={profileBirthday}
          currentBalance={summaryData?.fiBal || 0}
          monthlyContribution={yearMonthlySaving ?? 0}
          currentMonth={summaryData?.currentMonth}
          growthRate={fiGrowth}
        />
      )}
    </div>
  )
}

export default GoalDetail
