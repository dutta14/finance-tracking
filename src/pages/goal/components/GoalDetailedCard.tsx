import { FC, useState, useMemo, useCallback, useEffect } from 'react'
import { FinancialGoal } from '../../../types'
import GoalCardActions from './GoalCardActions'
import {
  calculateGoalMetrics,
  projectFIDate,
  projectFIDateWithDrawdown,
  DEFAULT_PRE_FI_GROWTH_RATE,
} from '../utils/goalCalculations'
import { parseDate as utilParseDate, getMonthsBetween } from '../utils/dateHelpers'
import { useData } from '../../../contexts/DataContext'
import { getBudgetSaveRate, loadBudgetStore, getGlobalCategoryGroups } from '../../budget/utils/budgetStorage'
import { parseCSV, buildMonthKey } from '../../budget/utils/csvParser'
import TermAbbr from '../../../components/TermAbbr'

import '../../../styles/GoalDetailedCard.css'

interface EditFields {
  goalCreatedIn: string
  goalEndYear: string
  retirementAge: string
  expenseValue: string
  inflationRate: string
  safeWithdrawalRate: string
  growth: string
}

interface GoalDetailedCardProps {
  goal: FinancialGoal
  profileBirthday: string
  onEdit?: (goal: FinancialGoal) => void
  onCopy?: (goal: FinancialGoal) => void
  onDelete?: (goalId: number) => void
  onUpdateGoal?: (goalId: number, goal: FinancialGoal) => void
  showActions?: boolean
  condensed?: boolean
  showTitle?: boolean
  initialEditing?: boolean
}

const toEditFields = (p: FinancialGoal): EditFields => ({
  goalCreatedIn: p.goalCreatedIn,
  goalEndYear: p.goalEndYear,
  retirementAge: String(p.retirementAge),
  expenseValue: String(p.expenseValue),
  inflationRate: String(p.inflationRate),
  safeWithdrawalRate: String(p.safeWithdrawalRate),
  growth: String(p.growth),
})

// Helper functions
const parseDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-')
  return new Date(Number(year), Number(month) - 1, Number(day))
}

const formatRetirementDate = (date: Date): string =>
  date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const dollars = (n: number) => '$' + Math.round(n).toLocaleString()

function runProjection(goal: FinancialGoal, profileBirthday: string, fiGoal: number): { remaining: number }[] {
  if (!profileBirthday || !goal.goalEndYear || !fiGoal) return []
  const [by, bm, bd] = profileBirthday.split('-').map(Number)
  const retirementDate = new Date(by + goal.retirementAge, bm - 1, bd)
  const endDate = new Date(goal.goalEndYear)
  if (retirementDate >= endDate) return []
  const monthlyInflation = (goal.inflationRate || 0) / 100 / 12
  const monthlyGrowth = (goal.growth || 0) / 100 / 12
  let expense = goal.monthlyExpense2047
  let remaining = fiGoal
  const rows: { remaining: number }[] = []
  const cursor = new Date(retirementDate.getFullYear(), retirementDate.getMonth(), 1)
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1)
  while (cursor <= end) {
    rows.push({ remaining })
    remaining = remaining * (1 + monthlyGrowth) - expense
    expense = expense * (1 + monthlyInflation)
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return rows
}

const findDepletionMonth = (goal: FinancialGoal, profileBirthday: string): string | null => {
  if (!profileBirthday || !goal.goalEndYear || !goal.fiGoal) return null
  const [by, bm, bd] = profileBirthday.split('-').map(Number)
  const retirementDate = new Date(by + goal.retirementAge, bm - 1, bd)
  const endDate = new Date(goal.goalEndYear)
  if (retirementDate >= endDate) return null
  const monthlyInflation = (goal.inflationRate || 0) / 100 / 12
  const monthlyGrowth = (goal.growth || 0) / 100 / 12
  let expense = goal.monthlyExpense2047
  let remaining = goal.fiGoal
  const cursor = new Date(retirementDate.getFullYear(), retirementDate.getMonth(), 1)
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1)
  while (cursor <= end) {
    if (remaining < 0) {
      return cursor.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    }
    remaining = remaining * (1 + monthlyGrowth) - expense
    expense = expense * (1 + monthlyInflation)
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return null
}

function suggestSWR(goal: FinancialGoal, profileBirthday: string): number | null {
  if (!goal.expenseValue2047) return null
  for (
    let swr = Math.round((goal.safeWithdrawalRate - 0.1) * 10) / 10;
    swr >= 0.1;
    swr = Math.round((swr - 0.1) * 10) / 10
  ) {
    const newFiGoal = goal.expenseValue2047 / (swr / 100)
    const rows = runProjection(goal, profileBirthday, newFiGoal)
    if (rows.length > 0 && rows[rows.length - 1].remaining >= 0) return swr
  }
  return null
}

const GoalDetailedCard: FC<GoalDetailedCardProps> = ({
  goal,
  profileBirthday,
  onEdit,
  onCopy,
  onDelete,
  onUpdateGoal,
  showActions = true,
  condensed = false,
  showTitle = true,
  initialEditing = false,
}) => {
  const [suggesting, setSuggesting] = useState(false)
  const [editing, setEditing] = useState(initialEditing)
  const [editFields, setEditFields] = useState<EditFields>(toEditFields(goal))
  const [editError, setEditError] = useState('')

  const { accounts, balances, allMonths } = useData()

  useEffect(() => {
    setEditFields(toEditFields(goal))
  }, [goal])

  // Sync fields if goal values change externally while not editing (e.g. Suggest SWR)
  useEffect(() => {
    if (!editing) setEditFields(toEditFields(goal))
  }, [editing, goal])

  const setEF = (k: keyof EditFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEditFields(f => ({ ...f, [k]: e.target.value }))

  const handleEditSave = () => {
    if (!editFields.goalCreatedIn) {
      setEditError('Goal creation date is required')
      return
    }
    if (!editFields.retirementAge || Number(editFields.retirementAge) <= 0) {
      setEditError('Valid retirement age required')
      return
    }
    if (!editFields.expenseValue || Number(editFields.expenseValue) <= 0) {
      setEditError('Valid annual expense required')
      return
    }
    const annualExpense = Number(editFields.expenseValue)
    const retirementAge = Number(editFields.retirementAge)
    const metrics = calculateGoalMetrics(
      annualExpense,
      profileBirthday,
      retirementAge,
      editFields.goalCreatedIn,
      Number(editFields.inflationRate) || 0,
      Number(editFields.safeWithdrawalRate) || 0,
      getMonthsBetween,
      utilParseDate,
    )
    onUpdateGoal?.(goal.id, {
      ...goal,
      goalCreatedIn: editFields.goalCreatedIn,
      goalEndYear: editFields.goalEndYear,
      retirementAge,
      expenseValue: annualExpense,
      monthlyExpenseValue: metrics.monthlyExpenseAtCreation,
      expenseValue2047: metrics.annualExpenseAtRetirement,
      monthlyExpense2047: metrics.monthlyExpenseAtRetirement,
      inflationRate: Number(editFields.inflationRate) || 0,
      safeWithdrawalRate: Number(editFields.safeWithdrawalRate) || 0,
      growth: Number(editFields.growth) || 0,
      retirement: metrics.retirementDateFormatted,
      fiGoal: metrics.fiGoal,
    })
    setEditError('')
    setEditing(false)
  }

  const handleEditCancel = () => {
    setEditFields(toEditFields(goal))
    setEditError('')
    setEditing(false)
  }

  const birthDate = parseDate(profileBirthday)
  const retirementDate = new Date(
    birthDate.getFullYear() + goal.retirementAge,
    birthDate.getMonth(),
    birthDate.getDate(),
  )
  const retirementDateLabel = formatRetirementDate(retirementDate)
  const depletionMonth = useMemo(() => findDepletionMonth(goal, profileBirthday), [goal, profileBirthday])

  const handleSuggest = useCallback(() => {
    if (!onUpdateGoal) return
    setSuggesting(true)
    // run in macrotask so the 'Searching…' label renders first
    setTimeout(() => {
      const swr = suggestSWR(goal, profileBirthday)
      if (swr !== null) {
        const newFiGoal = goal.expenseValue2047 / (swr / 100)
        onUpdateGoal(goal.id, { ...goal, safeWithdrawalRate: swr, fiGoal: newFiGoal })
      }
      setSuggesting(false)
    }, 0)
  }, [onUpdateGoal, goal, profileBirthday])

  const creationYear = goal.goalCreatedIn ? new Date(goal.goalCreatedIn).getUTCFullYear() : '—'

  const fiTotal = useMemo(() => {
    const latest = allMonths[allMonths.length - 1]
    if (!latest) return 0
    const balMap = new Map<number, number>()
    for (const b of balances) if (b.month === latest) balMap.set(b.accountId, b.balance)
    return accounts
      .filter(a => a.status === 'active' && a.goalType === 'fi')
      .reduce((sum, a) => sum + (balMap.get(a.id) ?? 0), 0)
  }, [accounts, balances, allMonths])

  const budgetData = getBudgetSaveRate()
  const budgetSaveRateValue = budgetData?.saveRate ?? 0
  const hasBudgetData = budgetData !== null

  // Compute current-year monthly savings from CSV data (not the stored budget-summary which may be stale)
  const currentYearSavings = useMemo(() => {
    const store = loadBudgetStore()
    const groups = getGlobalCategoryGroups(store)
    const removedCats = new Set(groups.find(g => g.id === 'removed')?.categories || [])
    const year = new Date().getFullYear()

    const categorySums: Record<string, number> = {}
    let monthsWithData = 0
    for (let m = 0; m < 12; m++) {
      const key = buildMonthKey(year, m)
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

    const incomeCats = new Set<string>()
    const expenseCats = new Set<string>()
    Object.entries(categorySums).forEach(([cat, total]) => {
      if (total > 0) incomeCats.add(cat)
      else if (total < 0) expenseCats.add(cat)
    })

    let totalIncome = 0
    let totalExpense = 0
    Object.entries(categorySums).forEach(([cat, total]) => {
      if (incomeCats.has(cat)) totalIncome += total
      else if (expenseCats.has(cat)) totalExpense += Math.abs(total)
    })
    return (totalIncome - totalExpense) / monthsWithData
  }, [])

  const budgetAnnualSavings =
    currentYearSavings !== null && currentYearSavings > 0
      ? currentYearSavings * 12
      : budgetData?.annualSavings && budgetData.annualSavings > 0
        ? budgetData.annualSavings
        : 0

  const fiProgress = useMemo(() => {
    if (goal.fiGoal <= 0) return 0
    return Math.min(100, Math.max(0, (fiTotal / goal.fiGoal) * 100))
  }, [goal.fiGoal, fiTotal])
  const progressClamped = fiProgress

  // ── Savings → goal timeline projection (two-phase: accumulation + drawdown) ──
  const projection = useMemo(() => {
    if (goal.fiGoal <= 0) return { state: 'no-goal' as const }
    if (fiTotal >= goal.fiGoal) return { state: 'reached' as const }
    if (!hasBudgetData) return { state: 'no-budget' as const }
    if (budgetAnnualSavings <= 0) return { state: 'not-reachable' as const }

    // End of life from goalEndYear
    const endOfLife = goal.goalEndYear ? new Date(goal.goalEndYear) : null
    // Monthly expense today (from goal creation expenses, inflated to now)
    const monthlyExpenseNow = goal.monthlyExpense2047
      ? goal.monthlyExpense2047 /
        Math.pow(
          1 + (goal.inflationRate || 0) / 100 / 12,
          (() => {
            const [by, bm] = profileBirthday.split('-').map(Number)
            const retDate = new Date(by + goal.retirementAge, bm - 1, 1)
            const now = new Date()
            return (retDate.getFullYear() - now.getFullYear()) * 12 + (retDate.getMonth() - now.getMonth())
          })(),
        )
      : (goal.expenseValue || 0) / 12

    let result: { date: Date; months: number } | null = null
    const [by, bm] = profileBirthday.split('-').map(Number)
    const retirementDate = new Date(by + goal.retirementAge, bm - 1, 1)

    if (endOfLife && monthlyExpenseNow > 0) {
      // Two-phase: find earliest retirement date that sustains drawdown
      result = projectFIDateWithDrawdown(
        fiTotal,
        budgetAnnualSavings,
        DEFAULT_PRE_FI_GROWTH_RATE,
        goal.growth || 6,
        monthlyExpenseNow,
        goal.inflationRate || 3,
        endOfLife,
        retirementDate,
      )
    } else {
      // Fallback: simple accumulation-only projection (legacy behavior)
      result = projectFIDate(fiTotal, goal.fiGoal, budgetAnnualSavings, DEFAULT_PRE_FI_GROWTH_RATE)
    }

    if (!result) return { state: 'not-reachable' as const }

    // Compare projected FI date with target retirement date
    const bd = profileBirthday.split('-').map(Number)[2]
    const targetRetirement = new Date(by + goal.retirementAge, bm - 1, bd)
    const diffMs = targetRetirement.getTime() - result.date.getTime()
    const diffMonthsRaw = Math.round(diffMs / (30.44 * 24 * 60 * 60 * 1000))
    const absDiffMonths = Math.abs(diffMonthsRaw)
    const ahead = diffMonthsRaw >= 0

    let diffText: string
    if (absDiffMonths === 0) {
      diffText = 'On track'
    } else if (absDiffMonths < 12) {
      diffText = `${absDiffMonths} month${absDiffMonths !== 1 ? 's' : ''} ${ahead ? 'early' : 'behind'}`
    } else {
      const years = Math.round(absDiffMonths / 12)
      diffText = `${years} year${years !== 1 ? 's' : ''} ${ahead ? 'early' : 'behind'}`
    }

    const shortDate = `${result.date.toLocaleDateString('en-US', { month: 'short' })} '${String(result.date.getFullYear()).slice(2)}`
    const monthlySavings = budgetAnnualSavings / 12
    return {
      state: 'projected' as const,
      date: result.date,
      months: result.months,
      dateLabel: result.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      shortDateLabel: shortDate,
      monthlySavings,
      currentNetWorth: fiTotal,
      fiGoal: goal.fiGoal,
      saveRate: budgetSaveRateValue,
      ahead,
      absDiffMonths,
      diffText,
    }
  }, [
    goal.fiGoal,
    goal.retirementAge,
    goal.goalEndYear,
    goal.monthlyExpense2047,
    goal.expenseValue,
    goal.inflationRate,
    goal.growth,
    profileBirthday,
    fiTotal,
    hasBudgetData,
    budgetAnnualSavings,
    budgetSaveRateValue,
  ])

  return (
    <div className={`fi-card${condensed ? ' fi-card--flat' : ''}`}>
      {/* ── Warning banner ── */}
      {depletionMonth && (
        <div className="fi-card-warning">
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className="fi-card-warning-icon"
          >
            <path
              d="M8 1.5L1 14.5h14L8 1.5z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
              fill="none"
            />
            <rect x="7.25" y="6.5" width="1.5" height="4" rx="0.75" fill="currentColor" />
            <rect x="7.25" y="11.5" width="1.5" height="1.5" rx="0.75" fill="currentColor" />
          </svg>
          <span className="fi-card-warning-text">Not sustainable beyond {depletionMonth}</span>
          {onUpdateGoal && (
            <button className="fi-card-warning-suggest" onClick={handleSuggest} disabled={suggesting}>
              {suggesting ? 'Searching…' : 'Suggest SWR'}
            </button>
          )}
        </div>
      )}

      {/* ── Header ── */}
      {(showTitle || (showActions && onEdit && onCopy && onDelete)) && (
        <div className="fi-card-header">
          <div className="fi-card-title-row">
            <span className="fi-card-badge">
              <TermAbbr term="FI" />
            </span>
            {showTitle && <h3 className="fi-card-title">{goal.goalName}</h3>}
          </div>
          {showActions && onEdit && onCopy && onDelete && (
            <GoalCardActions goal={goal} onEdit={onEdit} onCopy={onCopy} onDelete={onDelete} />
          )}
        </div>
      )}

      {/* ── Edit Button (Solo Page) ── */}
      {!showActions && onUpdateGoal && !editing && (
        <div className="fi-card-edit-row">
          <button className="fi-card-edit-btn" onClick={() => setEditing(true)} title="Edit goal">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M1.5 14.5h2.25L12.5 5.25 10.25 3 1.5 11.75v2.75z"
                stroke="currentColor"
                strokeWidth="1.2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M10.75 2.5l2.25 2.25"
                stroke="currentColor"
                strokeWidth="1.2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Edit
          </button>
        </div>
      )}

      {editing && onUpdateGoal ? (
        <div className="fi-card-edit-form">
          {editError && <p className="fi-form-error">{editError}</p>}
          <div className="fi-form-grid">
            <div className="fi-form-group">
              <label className="fi-form-label">Goal Creation Date</label>
              <input
                className="fi-form-input"
                type="date"
                value={editFields.goalCreatedIn}
                onChange={setEF('goalCreatedIn')}
              />
            </div>
            <div className="fi-form-group">
              <label className="fi-form-label">Goal End Year</label>
              <input
                className="fi-form-input"
                type="date"
                value={editFields.goalEndYear}
                onChange={setEF('goalEndYear')}
              />
            </div>
            <div className="fi-form-group">
              <label className="fi-form-label">Retirement Age</label>
              <input
                className="fi-form-input"
                type="number"
                value={editFields.retirementAge}
                onChange={setEF('retirementAge')}
                min="0"
                step="1"
              />
            </div>
            <div className="fi-form-group">
              <label className="fi-form-label">Annual Expense ($)</label>
              <input
                className="fi-form-input"
                type="number"
                value={editFields.expenseValue}
                onChange={setEF('expenseValue')}
                min="0"
              />
            </div>
            <div className="fi-form-group">
              <label className="fi-form-label">Inflation Rate (%)</label>
              <input
                className="fi-form-input"
                type="number"
                value={editFields.inflationRate}
                onChange={setEF('inflationRate')}
                step="0.1"
              />
            </div>
            <div className="fi-form-group">
              <label className="fi-form-label">Safe Withdrawal Rate (%)</label>
              <input
                className="fi-form-input"
                type="number"
                value={editFields.safeWithdrawalRate}
                onChange={setEF('safeWithdrawalRate')}
                step="0.1"
              />
            </div>
            <div className="fi-form-group">
              <label className="fi-form-label">Growth Rate (%)</label>
              <input
                className="fi-form-input"
                type="number"
                value={editFields.growth}
                onChange={setEF('growth')}
                step="0.1"
              />
            </div>
          </div>
          <div className="fi-form-actions">
            <button className="fi-form-save" onClick={handleEditSave}>
              Save
            </button>
            <button className="fi-form-cancel" onClick={handleEditCancel}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ── FI Goal prose ── */}
          {!condensed && (
            <p className="fi-goal-prose">
              Based on spending <strong>{dollars(goal.expenseValue)}/year</strong> ({creationYear} dollars) and a{' '}
              <strong>{goal.safeWithdrawalRate}%</strong> safe withdrawal rate, you need{' '}
              <strong>{dollars(goal.fiGoal)}</strong> to retire by <strong>{retirementDateLabel}</strong>, assuming{' '}
              <strong>{goal.growth}%</strong> growth and <strong>{goal.inflationRate}%</strong> inflation.
            </p>
          )}
          {condensed && (
            <p className="fi-goal-prose">
              You need <strong>{dollars(goal.fiGoal)}</strong> to retire by <strong>{retirementDateLabel}</strong>.
            </p>
          )}
          <div className="fi-card-progress-row">
            <div
              className="fi-card-progress-bar-track"
              role="progressbar"
              aria-valuenow={Math.round(fiProgress)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`FI goal progress: ${fiProgress.toFixed(1)}%`}
            >
              <div className="fi-card-progress-bar-fill" style={{ width: `${progressClamped}%` }} />
            </div>
            <span className="fi-card-progress-pct">
              <strong>{fiProgress.toFixed(1)}%</strong> saved toward that target
            </span>
          </div>

          {/* ── Savings Pace Prose ── */}
          {!condensed && projection.state === 'projected' && (
            <p className="fi-goal-prose fi-goal-pace">
              You&apos;re saving <strong>{dollars(projection.monthlySavings)}/mo</strong> in{' '}
              <strong>{new Date().getFullYear()}</strong>. At this pace, you&apos;ll hit FI by{' '}
              <strong>{projection.dateLabel}</strong>, <strong>{projection.diffText}</strong>.
            </p>
          )}
          {!condensed && projection.state === 'reached' && (
            <p className="fi-goal-prose fi-goal-pace">
              <span role="img" aria-label="celebration">
                🎉
              </span>{' '}
              Goal reached!
            </p>
          )}
          {!condensed && projection.state === 'no-budget' && (
            <p className="fi-goal-prose fi-goal-pace">
              <a href="#/budget">Add budget data</a> to see your savings pace.
            </p>
          )}

          {!condensed && (
            <div className="fi-card-meta">
              <small>Created {goal.createdAt}</small>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default GoalDetailedCard
