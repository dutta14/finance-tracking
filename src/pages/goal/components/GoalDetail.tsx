import { FC, useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { FinancialGoal, GwGoal } from '../../../types'
import { useData } from '../../../contexts/DataContext'
import { Account, BalanceEntry, formatCurrency } from '../../data/types'
import { loadBudgetStore, getGlobalCategoryGroups } from '../../budget/utils/budgetStorage'
import { parseCSV, buildMonthKey } from '../../budget/utils/csvParser'
import GoalDetailedCard from './GoalDetailedCard'
import GoalActionsMenu from './GoalActionsMenu'
import GoalDiveDeep from './GoalDiveDeep'
import GwSection from './GwSection'
import { FiSavingsPlan, GwSavingsPlan } from './SavingsPlan'
import '../../../styles/GoalDetail.css'
import '../../../styles/GoalDiveDeep.css'
import '../../../styles/SavingsPlan.css'
import '../../../styles/GwSection.css'

const getTotalForMonth = (
  accounts: Account[],
  balances: BalanceEntry[],
  month: string,
  goalType: 'fi' | 'gw',
): number => {
  const balMap = new Map<number, number>()
  for (const b of balances) if (b.month === month) balMap.set(b.accountId, b.balance)
  return accounts.filter(a => a.goalType === goalType).reduce((sum, a) => sum + (balMap.get(a.id) ?? 0), 0)
}

const getRetirementMonth = (birthday: string, retirementAge: number): string => {
  const [by, bm] = birthday.split('-').map(Number)
  const retYear = by + retirementAge
  const mm = String(bm).padStart(2, '0')
  return `${retYear}-${mm}`
}

const monthsBetween = (from: string, to: string): number => {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  return (ty - fy) * 12 + (tm - fm)
}

const calcMonthlySaving = (pv: number, fv: number, annualRate: number, nMonths: number): number => {
  if (nMonths <= 0) return 0
  const r = annualRate / 100 / 12
  if (r === 0) return Math.max(0, (fv - pv) / nMonths)
  // Simple growth model: PV grows by r per month (linear), contributions grow similarly
  const pvFuture = pv * (1 + r * nMonths)
  const needed = fv - pvFuture
  if (needed <= 0) return 0
  // FV of annuity with simple monthly growth: PMT × (n + r × n × (n-1) / 2)
  const annuityFactor = nMonths + r * nMonths * (nMonths - 1) / 2
  return needed / annuityFactor
}

const getGwTarget = (goal: FinancialGoal, gwGoals: GwGoal[], profileBirthday: string): number => {
  const goalGws = gwGoals.filter(g => g.fiGoalId === goal.id)
  if (goalGws.length === 0) return 0
  const [by, bm] = profileBirthday.split('-').map(Number)
  const created = new Date(goal.goalCreatedIn)
  return goalGws.reduce((sum, gw) => {
    const disburseYear = by + gw.disburseAge
    const months = Math.max(0, (disburseYear - created.getUTCFullYear()) * 12 + (bm - (created.getUTCMonth() + 1)))
    const disbTarget = gw.disburseAmount * Math.pow(1 + goal.inflationRate / 100 / 12, months)
    const mRetToDisb = Math.max(0, (gw.disburseAge - goal.retirementAge) * 12)
    const pv = mRetToDisb > 0 ? disbTarget / Math.pow(1 + gw.growthRate / 100 / 12, mRetToDisb) : disbTarget
    return sum + pv
  }, 0)
}

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

  const currentYear = new Date().getFullYear()
  const [summaryYear, setSummaryYear] = useState(currentYear)

  const availableYears = useMemo(() => {
    const store = loadBudgetStore()
    return store.years.filter(y => y >= 2024).sort((a, b) => b - a)
  }, [])

  const yearMonthlySaving = useMemo(() => {
    const store = loadBudgetStore()
    const groups = getGlobalCategoryGroups(store)
    const removedCats = new Set(groups.find(g => g.id === 'removed')?.categories || [])

    const categorySums: Record<string, number> = {}
    let monthsWithData = 0
    for (let m = 0; m < 12; m++) {
      const key = buildMonthKey(summaryYear, m)
      const csv = store.csvs[key]
      if (!csv) continue
      monthsWithData++
      try {
        const txs = parseCSV(csv.csv)
        txs.forEach(t => {
          if (removedCats.has(t.category)) return
          categorySums[t.category] = (categorySums[t.category] || 0) + t.amount
        })
      } catch {
        /* skip bad csv */
      }
    }

    if (monthsWithData === 0) return null

    const expenseCats = new Set<string>()
    const incomeCats = new Set<string>()
    Object.entries(categorySums).forEach(([cat, total]) => {
      if (total < 0) expenseCats.add(cat)
      else if (total > 0) incomeCats.add(cat)
    })

    let totalIncome = 0
    let totalExpense = 0
    Object.entries(categorySums).forEach(([cat, total]) => {
      if (incomeCats.has(cat)) totalIncome += total
      else if (expenseCats.has(cat)) totalExpense += Math.abs(total)
    })

    const annualSavings = (totalIncome - totalExpense) * (12 / monthsWithData)
    return annualSavings / 12
  }, [summaryYear])

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
                    .
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
        />
      )}
    </div>
  )
}

export default GoalDetail
