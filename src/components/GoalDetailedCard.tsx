import { FC, useState, useMemo, useCallback, useEffect } from 'react'
import { FinancialGoal } from '../types'
import GoalCardActions from './GoalCardActions'
import { calculateGoalMetrics } from '../pages/goal/utils/goalCalculations'
import { parseDate as utilParseDate, getMonthsBetween } from '../pages/goal/utils/dateHelpers'
import '../styles/GoalDetailedCard.css'

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
  onEditClick?: () => void
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

const formatMonthYear = (dateString: string): string => {
  const date = parseDate(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

const formatFullDate = (dateString: string): string => {
  const date = parseDate(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatRetirementDate = (date: Date): string =>
  date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const dollars = (n: number) => '$' + Math.round(n).toLocaleString()

function runProjection(
  goal: FinancialGoal,
  profileBirthday: string,
  fiGoal: number,
): { remaining: number }[] {
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

const InfoIcon: FC<{ tooltip: React.ReactNode; align?: 'right' | 'left' }> = ({ tooltip, align = 'right' }) => (
  <span className="fi-goal-info">
    <svg className="fi-goal-info-icon" width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="7.25" y="7" width="1.5" height="5" rx="0.75" fill="currentColor"/>
      <rect x="7.25" y="4" width="1.5" height="1.5" rx="0.75" fill="currentColor"/>
    </svg>
    <span className={`fi-goal-tooltip${align === 'left' ? ' fi-goal-tooltip--left' : ''}`}>{tooltip}</span>
  </span>
)

const GoalDetailedCard: FC<GoalDetailedCardProps> = ({ goal, profileBirthday, onEdit, onCopy, onDelete, onUpdateGoal, onEditClick, showActions = true, condensed = false, showTitle = true, initialEditing = false }) => {
  const [expenseView, setExpenseView] = useState<'creation' | 'retirement'>('creation')
  const [amountView, setAmountView] = useState<'annual' | 'monthly'>('annual')
  const [suggesting, setSuggesting] = useState(false)
  const [editing, setEditing] = useState(initialEditing)
  const [editFields, setEditFields] = useState<EditFields>(toEditFields(goal))
  const [editError, setEditError] = useState('')

  useEffect(() => {
    setEditFields(toEditFields(goal))
  }, [goal.id])

  // Sync fields if goal values change externally while not editing (e.g. Suggest SWR)
  useEffect(() => {
    if (!editing) setEditFields(toEditFields(goal))
  }, [editing, goal.safeWithdrawalRate, goal.fiGoal, goal.inflationRate, goal.growth, goal.retirementAge, goal.expenseValue])

  const setEF = (k: keyof EditFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEditFields(f => ({ ...f, [k]: e.target.value }))

  const handleEditSave = () => {
    if (!editFields.goalCreatedIn) { setEditError('Goal creation date is required'); return }
    if (!editFields.retirementAge || Number(editFields.retirementAge) <= 0) { setEditError('Valid retirement age required'); return }
    if (!editFields.expenseValue || Number(editFields.expenseValue) <= 0) { setEditError('Valid annual expense required'); return }
    const annualExpense = Number(editFields.expenseValue)
    const retirementAge = Number(editFields.retirementAge)
    const metrics = calculateGoalMetrics(
      annualExpense, profileBirthday, retirementAge, editFields.goalCreatedIn,
      Number(editFields.inflationRate) || 0, Number(editFields.safeWithdrawalRate) || 0,
      getMonthsBetween, utilParseDate,
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
  const retirementDate = new Date(birthDate.getFullYear() + goal.retirementAge, birthDate.getMonth(), birthDate.getDate())
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

  const creationYear = goal.goalCreatedIn ? new Date(goal.goalCreatedIn).getFullYear() : '—'
  const retirementYear = retirementDate.getFullYear()
  const inflationYears = Math.round(retirementYear - Number(creationYear))
  const progressClamped = Math.min(100, Math.max(0, goal.progress || 0))

  return (
    <div className={`fi-card${condensed ? ' fi-card--flat' : ''}`}>
      {/* ── Warning banner ── */}
      {depletionMonth && (
        <div className="fi-card-warning">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M8 1.5L1 14.5h14L8 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
            <rect x="7.25" y="6.5" width="1.5" height="4" rx="0.75" fill="currentColor"/>
            <rect x="7.25" y="11.5" width="1.5" height="1.5" rx="0.75" fill="currentColor"/>
          </svg>
          <span style={{ flex: 1 }}>Not sustainable beyond {depletionMonth}</span>
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
          <span className="fi-card-badge">FI</span>
          {showTitle && <h3 className="fi-card-title">{goal.goalName}</h3>}
        </div>
        {showActions && onEdit && onCopy && onDelete && (
          <GoalCardActions goal={goal} onEdit={onEdit} onCopy={onCopy} onDelete={onDelete} />
        )}
      </div>
      )}

      {/* ── Edit Button (Solo Page) ── */}
      {!showActions && onUpdateGoal && !editing && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
          <button
            className="fi-card-edit-btn"
            onClick={() => setEditing(true)}
            title="Edit goal"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M1.5 14.5h2.25L12.5 5.25 10.25 3 1.5 11.75v2.75z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10.75 2.5l2.25 2.25" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
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
              <input className="fi-form-input" type="date" value={editFields.goalCreatedIn} onChange={setEF('goalCreatedIn')} />
            </div>
            <div className="fi-form-group">
              <label className="fi-form-label">Goal End Year</label>
              <input className="fi-form-input" type="date" value={editFields.goalEndYear} onChange={setEF('goalEndYear')} />
            </div>
            <div className="fi-form-group">
              <label className="fi-form-label">Retirement Age</label>
              <input className="fi-form-input" type="number" value={editFields.retirementAge} onChange={setEF('retirementAge')} min="0" step="1" />
            </div>
            <div className="fi-form-group">
              <label className="fi-form-label">Annual Expense ($)</label>
              <input className="fi-form-input" type="number" value={editFields.expenseValue} onChange={setEF('expenseValue')} min="0" />
            </div>
            <div className="fi-form-group">
              <label className="fi-form-label">Inflation Rate (%)</label>
              <input className="fi-form-input" type="number" value={editFields.inflationRate} onChange={setEF('inflationRate')} step="0.1" />
            </div>
            <div className="fi-form-group">
              <label className="fi-form-label">Safe Withdrawal Rate (%)</label>
              <input className="fi-form-input" type="number" value={editFields.safeWithdrawalRate} onChange={setEF('safeWithdrawalRate')} step="0.1" />
            </div>
            <div className="fi-form-group">
              <label className="fi-form-label">Growth Rate (%)</label>
              <input className="fi-form-input" type="number" value={editFields.growth} onChange={setEF('growth')} step="0.1" />
            </div>
          </div>
          <div className="fi-form-actions">
            <button className="fi-form-save" onClick={handleEditSave}>Save</button>
            <button className="fi-form-cancel" onClick={handleEditCancel}>Cancel</button>
          </div>
        </div>
      ) : (
        <>
          {/* ── Parameters ── */}
          {!condensed && <div className="fi-card-section">
        <div className="fi-card-section-title">Parameters</div>
        <div className="fi-card-rows">
          <div className="fi-card-row">
            <span className="fi-card-row-label">Goal Created</span>
            <span className="fi-card-row-value">{goal.goalCreatedIn ? formatMonthYear(goal.goalCreatedIn) : 'N/A'}</span>
          </div>
          <div className="fi-card-row">
            <span className="fi-card-row-label">Retirement</span>
            <span className="fi-card-row-value">
              {retirementDateLabel}
              <InfoIcon tooltip={<>Birthday ({formatFullDate(profileBirthday)}) + retirement age ({goal.retirementAge})</>} align="left" />
            </span>
          </div>
          <div className="fi-card-row">
            <span className="fi-card-row-label">Inflation</span>
            <span className="fi-card-row-value">{goal.inflationRate}%</span>
          </div>
          <div className="fi-card-row">
            <span className="fi-card-row-label">
              Safe Withdrawal Rate
              <InfoIcon tooltip="The % of your portfolio you withdraw annually in retirement." />
            </span>
            <span className="fi-card-row-value">{goal.safeWithdrawalRate}%</span>
          </div>
          <div className="fi-card-row">
            <span className="fi-card-row-label">Portfolio Growth</span>
            <span className="fi-card-row-value">{goal.growth}%</span>
          </div>
        </div>
      </div>}

      {/* ── Expense Analysis ── */}
      {!condensed && <div className="fi-card-section">
        <div className="fi-card-section-header">
          <div className="fi-card-section-title">Expenses</div>
          <div className="expense-toggle">
            <button
              className={`expense-toggle-btn${expenseView === 'creation' ? ' active' : ''}`}
              onClick={() => setExpenseView('creation')}
              title={`Values as of ${creationYear}`}
            >At Creation</button>
            <button
              className={`expense-toggle-btn${expenseView === 'retirement' ? ' active' : ''}`}
              onClick={() => setExpenseView('retirement')}
              title={`Values as of ${retirementYear}`}
            >At Retirement</button>
          </div>
        </div>
        <div className="fi-card-rows">
          {expenseView === 'creation' ? (
            <div className="fi-card-row">
              <span className="fi-card-row-label">
                <span className="expense-toggle">
                  <button className={`expense-toggle-btn${amountView === 'annual' ? ' active' : ''}`} onClick={() => setAmountView('annual')}>Annual</button>
                  <button className={`expense-toggle-btn${amountView === 'monthly' ? ' active' : ''}`} onClick={() => setAmountView('monthly')}>Monthly</button>
                </span>
              </span>
              <span className="fi-card-row-value">{dollars(amountView === 'annual' ? goal.expenseValue : goal.monthlyExpenseValue)}</span>
            </div>
          ) : (
            <div className="fi-card-row">
              <span className="fi-card-row-label">
                <span className="expense-toggle">
                  <button className={`expense-toggle-btn${amountView === 'annual' ? ' active' : ''}`} onClick={() => setAmountView('annual')}>Annual</button>
                  <button className={`expense-toggle-btn${amountView === 'monthly' ? ' active' : ''}`} onClick={() => setAmountView('monthly')}>Monthly</button>
                </span>
                <InfoIcon tooltip={<>Inflated at {goal.inflationRate}% for {inflationYears} yrs.<br />{dollars(amountView === 'annual' ? goal.expenseValue : goal.monthlyExpenseValue)} → {dollars(amountView === 'annual' ? goal.expenseValue2047 : goal.monthlyExpense2047)}</>} />
              </span>
              <span className="fi-card-row-value">{dollars(amountView === 'annual' ? goal.expenseValue2047 : goal.monthlyExpense2047)}</span>
            </div>
          )}
        </div>
      </div>}

      {/* ── FI Goal callout ── */}
      <div className="fi-card-goal">
        <div className="fi-card-goal-top">
          <span className="fi-card-goal-label">
            FI Goal
            <InfoIcon tooltip={<>Annual expense at retirement ÷ SWR.<br />{dollars(goal.expenseValue2047)} ÷ {goal.safeWithdrawalRate}% = {dollars(goal.fiGoal)}</>} />
          </span>
          <span className="fi-card-goal-amount">{dollars(goal.fiGoal)}</span>
        </div>
        <div className="fi-card-progress-row">
          <div className="fi-card-progress-bar-track">
            <div
              className="fi-card-progress-bar-fill"
              style={{ width: `${progressClamped}%` }}
            />
          </div>
          <span className="fi-card-progress-pct">{goal.progress.toFixed(1)}%</span>
        </div>
      </div>

      {!condensed && <div className="fi-card-meta">
        <small>Created {goal.createdAt}</small>
      </div>}
        </>
      )}
    </div>
  )
}

export default GoalDetailedCard
