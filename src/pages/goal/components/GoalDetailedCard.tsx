import { FC, useState, useMemo, useEffect, useRef } from 'react'
import { FinancialGoal } from '../../../types'
import GoalCardActions from './GoalCardActions'
import {
  calculateGoalMetrics,
  computeRequiredCorpus,
  projectFIDate,
  projectFIDateWithDrawdown,
} from '../utils/goalCalculations'
import {
  formatTimeUntilYearMonth,
  formatYearMonthLong,
  parseDate as utilParseDate,
  getMonthsBetween,
} from '../utils/dateHelpers'
import { calcMonthlySaving, getRetirementMonth, monthsBetween as goalMonthsBetween } from '../utils/goalMath'
import { useData } from '../../../contexts/DataContext'
import { getBudgetSaveRate, loadBudgetStore, getGlobalCategoryGroups } from '../../budget/utils/budgetStorage'
import { parseCSV, buildMonthKey } from '../../budget/utils/csvParser'
import TermAbbr from '../../../components/TermAbbr'
import MonthPicker from '../../../components/MonthPicker'

import '../../../styles/GoalDetailedCard.css'

interface EditFields {
  goalCreatedIn: string
  goalEndYear: string
  retirementAge: string
  expenseValue: string
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
  preBoundaryGrowth?: number
  postBoundaryGrowth?: number
  ageBoundary?: number
  inflation?: number
  showYearly?: boolean
  onTogglePeriod?: () => void
  summaryYear?: number
  availableYears?: number[]
  onSummaryYearChange?: (year: number) => void
  savingsOverride?: number | null
  onSavingsOverrideChange?: (value: number | null) => void
  gwMonthlySavings?: number
  fiProjectedMonth?: string | null
  fiYearOverride?: string | null
  onFiYearOverrideChange?: (value: string | null) => void
  chartRequiredSavings?: number | null
}

const toEditFields = (p: FinancialGoal): EditFields => ({
  goalCreatedIn: p.goalCreatedIn,
  goalEndYear: p.goalEndYear,
  retirementAge: String(p.retirementAge),
  expenseValue: String(p.expenseValue),
})

// Helper functions
const parseDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-')
  return new Date(Number(year), Number(month) - 1, Number(day))
}

const formatRetirementDate = (date: Date): string =>
  date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const dollars = (n: number) => '$' + Math.round(n).toLocaleString()

const getProjectedDiffText = (projectedMonth: string, targetDate: Date): string => {
  const [year, month] = projectedMonth.split('-').map(Number)
  if (!year || !month) return ''

  const diffMonthsRaw = (targetDate.getFullYear() - year) * 12 + (targetDate.getMonth() - (month - 1))
  const absDiffMonths = Math.abs(diffMonthsRaw)
  if (absDiffMonths === 0) return 'on track'

  const diffYears = Math.floor(absDiffMonths / 12)
  const diffMonths = absDiffMonths % 12
  const diffParts =
    diffYears > 0 && diffMonths > 0
      ? `${diffYears} year${diffYears !== 1 ? 's' : ''} ${diffMonths} month${diffMonths !== 1 ? 's' : ''}`
      : diffYears > 0
        ? `${diffYears} year${diffYears !== 1 ? 's' : ''}`
        : `${diffMonths} month${diffMonths !== 1 ? 's' : ''}`

  return `${diffParts} ${diffMonthsRaw >= 0 ? 'early' : 'behind'}`
}

const findDepletionMonth = (
  goal: FinancialGoal,
  profileBirthday: string,
  inflationRate: number,
  preBoundaryGrowth: number,
  postBoundaryGrowth: number,
  ageBoundary: number,
  fiGoalOverride?: number,
): string | null => {
  const fiGoalVal = fiGoalOverride ?? goal.fiGoal
  if (!profileBirthday || !goal.goalEndYear || !fiGoalVal) return null
  const [by, bm, bd] = profileBirthday.split('-').map(Number)
  const retirementDate = new Date(by + goal.retirementAge, bm - 1, bd)
  const endDate = new Date(goal.goalEndYear)
  if (retirementDate >= endDate) return null
  const annualInflation = inflationRate / 100
  const boundaryDate = new Date(by + ageBoundary, bm - 1, 1)
  const baseExpense = goal.monthlyExpense2047
  const fiYear = retirementDate.getFullYear()
  let expense = baseExpense
  let lastExpenseYear = fiYear
  let remaining = fiGoalVal
  const cursor = new Date(fiYear, retirementDate.getMonth(), 1)
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1)
  while (cursor <= end) {
    const curYear = cursor.getFullYear()
    if (curYear > lastExpenseYear) {
      expense = baseExpense * Math.pow(1 + annualInflation, curYear - fiYear)
      lastExpenseYear = curYear
    }
    if (remaining < 0) {
      return cursor.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    }
    const growthRate = cursor < boundaryDate ? preBoundaryGrowth : postBoundaryGrowth
    remaining = remaining * (1 + growthRate / 100 / 12) - expense
    cursor.setMonth(cursor.getMonth() + 1)
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
  preBoundaryGrowth = 8,
  postBoundaryGrowth = 6,
  ageBoundary = 60,
  inflation = 3,
  showYearly,
  onTogglePeriod,
  summaryYear,
  availableYears,
  onSummaryYearChange,
  savingsOverride: _savingsOverrideProp,
  onSavingsOverrideChange,
  gwMonthlySavings = 0,
  fiProjectedMonth,
  fiYearOverride,
  onFiYearOverrideChange,
  chartRequiredSavings,
}) => {
  const [editing, setEditing] = useState(initialEditing)
  const [editFields, setEditFields] = useState<EditFields>(toEditFields(goal))
  const [editError, setEditError] = useState('')
  const [expenseDollarMode, setExpenseDollarMode] = useState<'creation' | 'current' | 'retirement'>('creation')
  const [fiResultDetail, setFiResultDetail] = useState<'time' | 'diff'>('time')
  const [expenseOverride, setExpenseOverride] = useState<number | null>(null)
  const [editingExpense, setEditingExpense] = useState(false)
  const [expenseInputValue, setExpenseInputValue] = useState('')
  const lastSavingsOverrideRef = useRef<number | null | undefined>(undefined)

  const { accounts, balances, allMonths } = useData()

  useEffect(() => {
    setEditFields(toEditFields(goal))
  }, [goal])

  useEffect(() => {
    if (!editing) setEditFields(toEditFields(goal))
  }, [editing, goal])

  useEffect(() => {
    setExpenseOverride(null)
    setEditingExpense(false)
    setExpenseInputValue('')
    onFiYearOverrideChange?.(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal.id])

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
      inflation,
      preBoundaryGrowth,
      editFields.goalEndYear,
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
      safeWithdrawalRate: 0,
      growth: preBoundaryGrowth,
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

  // Dynamically recompute fiGoal from current settings (inflation, growth rates)
  const fiGoal = useMemo(() => {
    if (!goal.goalEndYear || !goal.expenseValue || goal.expenseValue <= 0) return goal.fiGoal
    const bd = parseDate(profileBirthday)
    const rd = new Date(bd.getFullYear() + goal.retirementAge, bd.getMonth(), bd.getDate())
    const endYear = new Date(goal.goalEndYear).getFullYear()
    const endOfLife = new Date(endYear, 11, 1)
    const ageBoundaryDate = new Date(bd.getFullYear() + ageBoundary, bd.getMonth(), 1)
    const [gcYear] = (goal.goalCreatedIn || '').split('-').map(Number)
    const yearsToRetirement = rd.getFullYear() - (gcYear || new Date().getFullYear())
    const annualExpenseAtRetirement = goal.expenseValue * Math.pow(1 + inflation / 100, yearsToRetirement)
    const monthlyExpenseAtRetirement = annualExpenseAtRetirement / 12
    return computeRequiredCorpus(
      rd,
      endOfLife,
      ageBoundaryDate,
      monthlyExpenseAtRetirement,
      inflation,
      preBoundaryGrowth,
      postBoundaryGrowth,
    )
  }, [
    goal.goalEndYear,
    goal.expenseValue,
    goal.goalCreatedIn,
    goal.retirementAge,
    goal.fiGoal,
    profileBirthday,
    inflation,
    preBoundaryGrowth,
    postBoundaryGrowth,
    ageBoundary,
  ])

  const depletionMonth = useMemo(
    () =>
      findDepletionMonth(goal, profileBirthday, inflation, preBoundaryGrowth, postBoundaryGrowth, ageBoundary, fiGoal),
    [goal, profileBirthday, inflation, preBoundaryGrowth, postBoundaryGrowth, ageBoundary, fiGoal],
  )

  const creationYear = goal.goalCreatedIn ? new Date(goal.goalCreatedIn).getUTCFullYear() : '—'
  const currentYear = new Date().getFullYear()
  const retirementYear = retirementDate.getFullYear()
  const gcYearNum = typeof creationYear === 'number' ? creationYear : currentYear

  const expenseDisplay = useMemo(() => {
    const base = goal.expenseValue || 0
    const rate = inflation / 100
    const toCurrentYear = base * Math.pow(1 + rate, currentYear - gcYearNum)
    const toRetirementYear = base * Math.pow(1 + rate, retirementYear - gcYearNum)
    return { creation: base, current: toCurrentYear, retirement: toRetirementYear }
  }, [goal.expenseValue, inflation, currentYear, retirementYear, gcYearNum])

  const cycleExpenseDollarMode = () =>
    setExpenseDollarMode(m => (m === 'creation' ? 'current' : m === 'current' ? 'retirement' : 'creation'))

  const expenseLabel =
    expenseDollarMode === 'creation'
      ? `${dollars(expenseDisplay.creation)}/yr (${creationYear} dollars)`
      : expenseDollarMode === 'current'
        ? `${dollars(expenseDisplay.current)}/yr (${currentYear} dollars)`
        : `${dollars(expenseDisplay.retirement)}/yr (${retirementYear} dollars)`

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

  // Compute selected-year monthly savings from CSV data (not the stored budget-summary which may be stale)
  const selectedYear = summaryYear ?? new Date().getFullYear()
  const budgetBreakdown = useMemo(() => {
    const store = loadBudgetStore()
    const groups = getGlobalCategoryGroups(store)
    const removedCats = new Set(groups.find(g => g.id === 'removed')?.categories || [])
    const year = selectedYear

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
    const annualIncome = (totalIncome / monthsWithData) * 12
    const annualExpense = (totalExpense / monthsWithData) * 12
    const annualSavings = annualIncome - annualExpense
    return { annualIncome, annualExpense, annualSavings }
  }, [selectedYear])

  const budgetAnnualIncome = budgetBreakdown?.annualIncome ?? 0
  const budgetAnnualExpenseBase = budgetBreakdown?.annualExpense ?? 0
  const budgetAnnualExpense = expenseOverride ?? budgetAnnualExpenseBase
  const budgetAnnualSavings = expenseOverride !== null
    ? Math.max(0, budgetAnnualIncome - expenseOverride)
    : budgetBreakdown?.annualSavings && budgetBreakdown.annualSavings > 0
      ? budgetBreakdown.annualSavings
      : budgetData?.annualSavings && budgetData.annualSavings > 0
        ? budgetData.annualSavings
        : 0

  const fiProgress = useMemo(() => {
    if (fiGoal <= 0) return 0
    return Math.min(100, Math.max(0, (fiTotal / fiGoal) * 100))
  }, [fiGoal, fiTotal])
  const progressClamped = fiProgress

  // Required monthly saving (simple FV-based, for Planned Goal section)
  const requiredMonthlySaving = useMemo(() => {
    if (fiGoal <= 0) return null
    const retMonth = getRetirementMonth(goal.birthday || profileBirthday, goal.retirementAge)
    const currentMonth = allMonths[allMonths.length - 1]
    if (!currentMonth) return null
    const n = goalMonthsBetween(currentMonth, retMonth)
    return calcMonthlySaving(fiTotal, fiGoal, preBoundaryGrowth, n)
  }, [fiGoal, fiTotal, goal.birthday, goal.retirementAge, profileBirthday, allMonths, preBoundaryGrowth])

  // ── Savings → goal timeline projection (two-phase: accumulation + drawdown) ──
  const projection = useMemo(() => {
    if (fiGoal <= 0) return { state: 'no-goal' as const }
    if (fiTotal >= fiGoal) return { state: 'reached' as const }
    if (!hasBudgetData) return { state: 'no-budget' as const }
    if (budgetAnnualSavings <= 0) return { state: 'not-reachable' as const }

    const fiAnnualSavings = Math.max(0, budgetAnnualSavings - gwMonthlySavings * 12)
    if (fiAnnualSavings <= 0) return { state: 'not-reachable' as const }

    // End of life from goalEndYear
    const endOfLife = goal.goalEndYear ? new Date(goal.goalEndYear) : null
    // Monthly expense today (from goal creation expenses, inflated to now)
    const monthlyExpenseNow = goal.monthlyExpense2047
      ? goal.monthlyExpense2047 /
        Math.pow(
          1 + inflation / 100,
          (() => {
            const [by, bm] = profileBirthday.split('-').map(Number)
            const retDate = new Date(by + goal.retirementAge, bm - 1, 1)
            const now = new Date()
            return retDate.getFullYear() - now.getFullYear()
          })(),
        )
      : (goal.expenseValue || 0) / 12

    const [by, bm] = profileBirthday.split('-').map(Number)
    const ageBoundaryDate = new Date(by + ageBoundary, bm - 1, 1)

    const result: { date: Date; months: number } | null =
      endOfLife && monthlyExpenseNow > 0
        ? projectFIDateWithDrawdown(
            fiTotal,
            fiAnnualSavings,
            preBoundaryGrowth,
            postBoundaryGrowth,
            monthlyExpenseNow,
            inflation,
            endOfLife,
            ageBoundaryDate,
          )
        : projectFIDate(fiTotal, fiGoal, fiAnnualSavings, preBoundaryGrowth)

    if (!result) return { state: 'not-reachable' as const }

    // Compare projected FI date with target retirement date
    const bd = profileBirthday.split('-').map(Number)[2]
    const targetRetirement = new Date(by + goal.retirementAge, bm - 1, bd)
    const diffMs = targetRetirement.getTime() - result.date.getTime()
    const diffMonthsRaw = Math.round(diffMs / (30.44 * 24 * 60 * 60 * 1000))
    const absDiffMonths = Math.abs(diffMonthsRaw)
    const ahead = diffMonthsRaw >= 0

    const now = new Date()
    const totalMonthsAway =
      (result.date.getFullYear() - now.getFullYear()) * 12 + (result.date.getMonth() - now.getMonth())
    const fiYears = Math.floor(Math.abs(totalMonthsAway) / 12)
    const fiRemainingMonths = Math.abs(totalMonthsAway) % 12
    let timeUntilFI: string
    if (fiYears > 0 && fiRemainingMonths > 0) {
      timeUntilFI = `${fiYears} year${fiYears !== 1 ? 's' : ''} ${fiRemainingMonths} month${fiRemainingMonths !== 1 ? 's' : ''}`
    } else if (fiYears > 0) {
      timeUntilFI = `${fiYears} year${fiYears !== 1 ? 's' : ''}`
    } else {
      timeUntilFI = `${fiRemainingMonths} month${fiRemainingMonths !== 1 ? 's' : ''}`
    }

    let diffText: string
    if (absDiffMonths === 0) {
      diffText = 'on track'
    } else {
      const diffYears = Math.floor(absDiffMonths / 12)
      const diffRemMonths = absDiffMonths % 12
      let diffParts: string
      if (diffYears > 0 && diffRemMonths > 0) {
        diffParts = `${diffYears} year${diffYears !== 1 ? 's' : ''} ${diffRemMonths} month${diffRemMonths !== 1 ? 's' : ''}`
      } else if (diffYears > 0) {
        diffParts = `${diffYears} year${diffYears !== 1 ? 's' : ''}`
      } else {
        diffParts = `${diffRemMonths} month${diffRemMonths !== 1 ? 's' : ''}`
      }
      diffText = `${diffParts} ${ahead ? 'early' : 'behind'}`
    }

    const shortDate = `${result.date.toLocaleDateString('en-US', { month: 'short' })} '${String(result.date.getFullYear()).slice(2)}`
    const actualDate = result.date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    const monthlySavings = Math.max(0, budgetAnnualSavings / 12 - gwMonthlySavings)
    return {
      state: 'projected' as const,
      date: result.date,
      months: result.months,
      dateLabel: result.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      shortDateLabel: shortDate,
      actualDate,
      timeUntilFI,
      monthlySavings,
      currentNetWorth: fiTotal,
      fiGoal,
      saveRate: budgetSaveRateValue,
      ahead,
      absDiffMonths,
      diffText,
    }
  }, [
    fiGoal,
    goal.retirementAge,
    goal.goalEndYear,
    goal.monthlyExpense2047,
    goal.expenseValue,
    inflation,
    preBoundaryGrowth,
    postBoundaryGrowth,
    ageBoundary,
    profileBirthday,
    fiTotal,
    hasBudgetData,
    budgetAnnualSavings,
    budgetSaveRateValue,
    gwMonthlySavings,
  ])

  const nextSavingsOverride = useMemo(() => {
    if (expenseOverride === null) return null

    const monthlySavings = Math.max(0, (budgetAnnualIncome - expenseOverride) / 12)
    return Math.max(0, monthlySavings - gwMonthlySavings)
  }, [expenseOverride, budgetAnnualIncome, gwMonthlySavings])

  useEffect(() => {
    if (!onSavingsOverrideChange) return
    if (lastSavingsOverrideRef.current === nextSavingsOverride) return
    lastSavingsOverrideRef.current = nextSavingsOverride
    onSavingsOverrideChange(nextSavingsOverride)
  }, [nextSavingsOverride, onSavingsOverrideChange])

  const projectedDiffText = useMemo(
    () => (fiProjectedMonth ? getProjectedDiffText(fiProjectedMonth, retirementDate) : projection.diffText),
    [fiProjectedMonth, projection.diffText, retirementDate],
  )

  // Generate future months for FI date picker (next 50 years)
  const futureMonths = useMemo(() => {
    const months: string[] = []
    const now = new Date()
    const startYear = now.getFullYear()
    const startMonth = now.getMonth() + 1
    for (let y = startYear; y <= startYear + 50; y++) {
      for (let m = (y === startYear ? startMonth : 1); m <= 12; m++) {
        months.push(`${y}-${String(m).padStart(2, '0')}`)
      }
    }
    months.reverse()
    return months
  }, [])

  // ── Projections using savings override ──
  return (
    <>
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
          <button className="fi-card-action-btn" onClick={() => setEditing(true)}>Edit</button>
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
          {/* ── Planned Goal ── */}
          {!condensed && <h3 className="fi-card-section-title">Planned Goal</h3>}
          {!condensed && (
            <p className="fi-goal-prose">
              To spend{' '}
              <strong className="goal-summary-toggleable" onClick={cycleExpenseDollarMode}>
                {expenseLabel}
              </strong>
              {' '}<strong>in retirement</strong>, you need <strong>{dollars(fiGoal)}</strong> to retire by <strong>{retirementDateLabel}</strong>,
              assuming <strong>{preBoundaryGrowth}%</strong> growth (pre-{ageBoundary}) and{' '}
              <strong>{postBoundaryGrowth}%</strong> growth (post-{ageBoundary}), with <strong>{inflation}%</strong>{' '}
              inflation (depletes to $0 at end of life)
            </p>
          )}
          {condensed && (
            <p className="fi-goal-prose">
              You need <strong>{dollars(fiGoal)}</strong> to retire by <strong>{retirementDateLabel}</strong>.
            </p>
          )}
          {!condensed && requiredMonthlySaving !== null && (
            <p className="fi-goal-prose">
              {requiredMonthlySaving <= 0 ? (
                <span>You&apos;ve achieved this goal 🎉</span>
              ) : (
                <>
                  You need to save{' '}
                  <strong className="goal-summary-toggleable" onClick={onTogglePeriod}>
                    {dollars(showYearly ? requiredMonthlySaving * 12 : requiredMonthlySaving)}/{showYearly ? 'yr' : 'mo'}
                  </strong>
                </>
              )}
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

          {!condensed && (
            <div className="fi-card-meta">
              <small>Created {goal.createdAt}</small>
            </div>
          )}
        </>
      )}
    </div>

    {/* ── Projections Card ── */}
    {!condensed && (projection.state === 'projected' || projection.state === 'reached' || projection.state === 'no-budget' || projection.state === 'not-reachable') && (
      <div className="fi-card">
        <div className="fi-card-section-header">
          <h3 className="fi-card-section-title">Projections</h3>
          <div className="fi-projection-controls">
            <div className="fi-projection-period-toggle">
              <button
                className={`fi-projection-period-btn${!showYearly ? ' fi-projection-period-btn--active' : ''}`}
                onClick={() => showYearly && onTogglePeriod?.()}
              >
                /mo
              </button>
              <button
                className={`fi-projection-period-btn${showYearly ? ' fi-projection-period-btn--active' : ''}`}
                onClick={() => !showYearly && onTogglePeriod?.()}
              >
                /yr
              </button>
            </div>
            {availableYears && availableYears.length > 1 && onSummaryYearChange ? (
              <div className="fi-projection-year-toggle">
                <button
                  className="fi-projection-year-chevron"
                  type="button"
                  aria-label="Previous year"
                  disabled={summaryYear === availableYears[availableYears.length - 1]}
                  onClick={() => {
                    const idx = availableYears.indexOf(summaryYear ?? new Date().getFullYear())
                    if (idx < availableYears.length - 1) onSummaryYearChange(availableYears[idx + 1])
                  }}
                >
                  ‹
                </button>
                <span className="fi-projection-year-value">{summaryYear ?? new Date().getFullYear()}</span>
                <button
                  className="fi-projection-year-chevron"
                  type="button"
                  aria-label="Next year"
                  disabled={summaryYear === availableYears[0]}
                  onClick={() => {
                    const idx = availableYears.indexOf(summaryYear ?? new Date().getFullYear())
                    if (idx > 0) onSummaryYearChange(availableYears[idx - 1])
                  }}
                >
                  ›
                </button>
              </div>
            ) : (
              <span className="fi-projection-year-label">{summaryYear ?? new Date().getFullYear()}</span>
            )}
          </div>
        </div>

        {(projection.state === 'projected' || projection.state === 'not-reachable') && (
          <div className="fi-projection-block">
            <div className="fi-projection-rows">
              <div className="fi-projection-row">
                <span className="fi-projection-key">Income</span>
                <span className="fi-projection-val">
                  {(() => {
                    const annualSaving = chartRequiredSavings != null
                      ? (chartRequiredSavings + gwMonthlySavings) * 12
                      : budgetAnnualSavings
                    const income = chartRequiredSavings != null
                      ? annualSaving + budgetAnnualExpense
                      : budgetAnnualIncome
                    return `${dollars(showYearly ? income : income / 12)}/${showYearly ? 'yr' : 'mo'}`
                  })()}
                </span>
              </div>
              <div className="fi-projection-row">
                <span className="fi-projection-key">Expense</span>
                <span className="fi-projection-val">
                  {editingExpense ? (
                    <span className="fi-savings-edit-inline">
                      $<input
                        type="text"
                        className="fi-savings-inline-input"
                        value={expenseInputValue}
                        size={Math.max(4, expenseInputValue.length)}
                        autoFocus
                        onChange={e => {
                          const raw = e.target.value.replace(/[^0-9]/g, '')
                          setExpenseInputValue(raw ? Number(raw).toLocaleString() : '')
                          const num = Number(raw)
                          if (num > 0) setExpenseOverride(showYearly ? num : num * 12)
                        }}
                        onBlur={() => setEditingExpense(false)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === 'Escape') setEditingExpense(false)
                        }}
                      />/{showYearly ? 'yr' : 'mo'}
                    </span>
                  ) : (
                    <strong
                      className="goal-summary-toggleable fi-savings-editable"
                      onClick={() => {
                        const display = showYearly ? budgetAnnualExpense : budgetAnnualExpense / 12
                        setExpenseInputValue(Math.round(display).toLocaleString())
                        setEditingExpense(true)
                      }}
                    >
                      {dollars(showYearly ? budgetAnnualExpense : budgetAnnualExpense / 12)}/{showYearly ? 'yr' : 'mo'}
                    </strong>
                  )}
                  {expenseOverride !== null && !editingExpense && (
                    <button
                      className="fi-savings-reset-btn"
                      onClick={() => setExpenseOverride(null)}
                    >
                      Reset
                    </button>
                  )}
                </span>
              </div>
              <div className="fi-projection-row">
                <span className="fi-projection-key">Saving</span>
                <span className="fi-projection-val">
                  {(() => {
                    const saving = chartRequiredSavings != null
                      ? chartRequiredSavings * 12
                      : Math.max(0, budgetAnnualSavings - gwMonthlySavings * 12)
                    return `${dollars(showYearly ? saving : saving / 12)}/${showYearly ? 'yr' : 'mo'}`
                  })()}
                </span>
              </div>
            </div>
            {projection.state === 'projected' || fiYearOverride != null ? (
              <div className="fi-projection-result-row">
                <span className="fi-goal-prose fi-projection-result-label">→ FI in</span>
                {fiYearOverride != null ? (
                  <div className="fi-projection-fi-picker">
                    <MonthPicker
                      allMonths={futureMonths}
                      selectedMonth={fiYearOverride}
                      onMonthChange={m => onFiYearOverrideChange?.(m)}
                    />
                    <button
                      className="fi-savings-reset-btn"
                      onClick={() => onFiYearOverrideChange?.(null)}
                    >
                      Reset
                    </button>
                  </div>
                ) : projection.state === 'projected' ? (
                  <p className="fi-goal-prose fi-projection-result">
                    <strong
                      className="goal-summary-toggleable fi-savings-editable"
                      onClick={() => fiProjectedMonth && onFiYearOverrideChange?.(fiProjectedMonth)}
                    >
                      {fiProjectedMonth
                        ? formatYearMonthLong(fiProjectedMonth)
                        : 'Calculating…'}
                    </strong>
                    {' '}(<strong
                      className="goal-summary-toggleable"
                      onClick={() => setFiResultDetail(d => d === 'time' ? 'diff' : 'time')}
                    >
                      {fiResultDetail === 'time'
                        ? (fiProjectedMonth
                            ? formatTimeUntilYearMonth(fiProjectedMonth)
                            : 'Calculating…')
                        : projectedDiffText}
                    </strong>)
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="fi-goal-prose fi-projection-result">
                → FI <strong>not reachable</strong> at this savings rate. Try reducing expenses.
              </p>
            )}
          </div>
        )}

        {projection.state === 'reached' && (
          <p className="fi-goal-prose fi-goal-pace">
            <span role="img" aria-label="celebration">🎉</span>{' '}
            Goal reached!
          </p>
        )}

        {projection.state === 'no-budget' && (
          <p className="fi-goal-prose fi-goal-pace">
            <a href="#/budget">Add budget data</a> to see your savings pace.
          </p>
        )}
      </div>
    )}
    </>
  )
}

export default GoalDetailedCard
