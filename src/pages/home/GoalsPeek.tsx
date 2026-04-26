import { FC, useMemo } from 'react'
import { FinancialGoal, GwGoal } from '../../types'
import { useData } from '../../contexts/DataContext'
import { Account, BalanceEntry, formatCurrency } from '../data/types'
import { projectFIDate, DEFAULT_PRE_FI_GROWTH_RATE } from '../goal/utils/goalCalculations'
import { getBudgetSaveRate } from '../budget/utils/budgetStorage'
import TermAbbr from '../../components/TermAbbr'

interface GoalsPeekProps {
  goals: FinancialGoal[]
  gwGoals: GwGoal[]
  onNavigate: () => void
}

const GROWTH_RATE = DEFAULT_PRE_FI_GROWTH_RATE

const calcMonthlySaving = (pv: number, fv: number, annualRate: number, nMonths: number): number => {
  if (nMonths <= 0) return 0
  const r = annualRate / 100 / 12
  if (r === 0) return Math.max(0, (fv - pv) / nMonths)
  const factor = Math.pow(1 + r, nMonths)
  const needed = fv - pv * factor
  if (needed <= 0) return 0
  return (needed * r) / (factor - 1)
}

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

const GoalsPeek: FC<GoalsPeekProps> = ({ goals, gwGoals, onNavigate }) => {
  const { accounts, balances, allMonths } = useData()

  const { fiTotal, gwTotal, latestMonth, profileBirthday } = useMemo(() => {
    const latest = allMonths[allMonths.length - 1] || ''
    const fiT = latest ? getTotalForMonth(accounts, balances, latest, 'fi') : 0
    const gwT = latest ? getTotalForMonth(accounts, balances, latest, 'gw') : 0
    const pb = JSON.parse(localStorage.getItem('user-profile') || '{}').birthday || '1990-01'
    return { fiTotal: fiT, gwTotal: gwT, latestMonth: latest, profileBirthday: pb }
  }, [accounts, balances, allMonths])

  // Lightweight budget read — called each render (cheap localStorage parse)
  const budgetSaveRate = getBudgetSaveRate()

  if (goals.length === 0) {
    return (
      <div className="home-card home-card--goals">
        <div className="home-card-header">
          <h3>Goals</h3>
          <button className="home-card-link" onClick={onNavigate}>
            View Goals →
          </button>
        </div>
        <div className="home-card-cta">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="5" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
          </svg>
          <p>Set an FI target or general wealth goal to start tracking your progress.</p>
          <button className="home-card-cta-btn" onClick={onNavigate}>
            Create a goal →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="home-card home-card--goals">
      <div className="home-card-header">
        <h3>Goals</h3>
        <button className="home-card-link" onClick={onNavigate}>
          View Goals →
        </button>
      </div>
      <div className="goals-peek-list">
        {goals.slice(0, 5).map(goal => {
          const goalGws = gwGoals.filter(g => g.fiGoalId === goal.id)
          const fiPct = goal.fiGoal > 0 ? Math.min(Math.max((fiTotal / goal.fiGoal) * 100, 0), 100) : 0

          // Retirement month
          const [by, bm] = profileBirthday.split('-').map(Number)
          const retMonth = `${by + goal.retirementAge}-${String(bm).padStart(2, '0')}`

          // FI monthly saving
          let fiMonthly = 0
          if (latestMonth && goal.fiGoal > 0) {
            const [fy, fm] = latestMonth.split('-').map(Number)
            const [ty, tm] = retMonth.split('-').map(Number)
            const nMonths = (ty - fy) * 12 + (tm - fm)
            fiMonthly = calcMonthlySaving(fiTotal, goal.fiGoal, GROWTH_RATE, nMonths)
          }

          let gwPct = 0
          let gwMonthly = 0
          if (goalGws.length > 0) {
            const created = new Date(goal.goalCreatedIn)
            const totalNeeded = goalGws.reduce((sum, gw) => {
              const disburseYear = by + gw.disburseAge
              const months = Math.max(0, (disburseYear - created.getFullYear()) * 12 + (bm - (created.getMonth() + 1)))
              const disbTarget = gw.disburseAmount * Math.pow(1 + goal.inflationRate / 100 / 12, months)
              const mRetToDisb = Math.max(0, (gw.disburseAge - goal.retirementAge) * 12)
              const pv = mRetToDisb > 0 ? disbTarget / Math.pow(1 + gw.growthRate / 100 / 12, mRetToDisb) : disbTarget
              return sum + pv
            }, 0)
            gwPct = totalNeeded > 0 ? Math.min(100, Math.max(0, (gwTotal / totalNeeded) * 100)) : 0

            if (latestMonth && totalNeeded > 0) {
              const [fy, fm] = latestMonth.split('-').map(Number)
              const [ty, tm] = retMonth.split('-').map(Number)
              const nMonths = (ty - fy) * 12 + (tm - fm)
              gwMonthly = calcMonthlySaving(gwTotal, totalNeeded, GROWTH_RATE, nMonths)
            }
          }

          // Project FI date from budget savings data
          let fiProjectedLabel: string | null = null
          let fiProjectedType: 'date' | 'reached' | 'no-budget' | 'not-reachable' | null = null

          if (goal.fiGoal > 0) {
            if (fiTotal >= goal.fiGoal) {
              fiProjectedLabel = '🎉 Goal reached!'
              fiProjectedType = 'reached'
            } else if (!budgetSaveRate) {
              fiProjectedLabel = 'Add budget data →'
              fiProjectedType = 'no-budget'
            } else if (budgetSaveRate.annualSavings <= 0) {
              fiProjectedLabel = 'Not reachable at current rate'
              fiProjectedType = 'not-reachable'
            } else {
              const proj = projectFIDate(fiTotal, goal.fiGoal, budgetSaveRate.annualSavings, GROWTH_RATE)
              if (proj && proj.months === 0) {
                fiProjectedLabel = '🎉 Goal reached!'
                fiProjectedType = 'reached'
              } else if (proj) {
                fiProjectedLabel = proj.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                fiProjectedType = 'date'
              } else {
                fiProjectedLabel = 'Not reachable at current rate'
                fiProjectedType = 'not-reachable'
              }
            }
          }

          return (
            <button key={goal.id} className="goals-peek-item" onClick={onNavigate}>
              <div className="goals-peek-item-top">
                <span className="goals-peek-name">{goal.goalName}</span>
              </div>
              <div className="goals-peek-bars">
                <div className="goals-peek-bar-row">
                  <span className="goals-peek-bar-label">
                    <TermAbbr term="FI" />
                  </span>
                  <div
                    className="goals-peek-bar-track"
                    role="progressbar"
                    aria-valuenow={Math.round(fiPct)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`FI progress: ${fiPct.toFixed(0)}%`}
                  >
                    <div className="goals-peek-bar-fill goals-peek-bar-fill--fi" style={{ width: `${fiPct}%` }} />
                  </div>
                  <span className="goals-peek-pct goals-peek-pct--fi">{fiPct.toFixed(0)}%</span>
                  <span className="goals-peek-monthly">{fiMonthly > 0 ? `${formatCurrency(fiMonthly)}/mo` : ''}</span>
                </div>
                {goalGws.length > 0 && (
                  <div className="goals-peek-bar-row">
                    <span className="goals-peek-bar-label">
                      <TermAbbr term="GW" />
                    </span>
                    <div
                      className="goals-peek-bar-track"
                      role="progressbar"
                      aria-valuenow={Math.round(gwPct)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`General wealth progress: ${gwPct.toFixed(0)}%`}
                    >
                      <div className="goals-peek-bar-fill goals-peek-bar-fill--gw" style={{ width: `${gwPct}%` }} />
                    </div>
                    <span className="goals-peek-pct goals-peek-pct--gw">{gwPct.toFixed(0)}%</span>
                    <span className="goals-peek-monthly">{gwMonthly > 0 ? `${formatCurrency(gwMonthly)}/mo` : ''}</span>
                  </div>
                )}
              </div>
              <div className="goals-peek-item-meta">
                <span>FI: {goal.fiGoal != null ? formatCurrency(goal.fiGoal) : '—'}</span>
                {goalGws.length > 0 && (
                  <span>
                    {goalGws.length} GW goal{goalGws.length > 1 ? 's' : ''}
                  </span>
                )}
                <span>Retire: {goal.retirement}</span>
                {fiProjectedLabel && (
                  <span
                    className={`goals-peek-projected${
                      fiProjectedType === 'reached'
                        ? ' goals-peek-projected--reached'
                        : fiProjectedType === 'no-budget'
                          ? ' goals-peek-projected--link'
                          : fiProjectedType === 'not-reachable'
                            ? ' goals-peek-projected--warn'
                            : ''
                    }`}
                  >
                    {fiProjectedType === 'date' ? (
                      <>
                        FI by <span className="goals-peek-projected-date">{fiProjectedLabel}</span>
                      </>
                    ) : fiProjectedType === 'reached' ? (
                      <>
                        <span role="img" aria-label="celebration">
                          🎉
                        </span>{' '}
                        Goal reached!
                      </>
                    ) : (
                      fiProjectedLabel
                    )}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
      {goals.length > 5 && (
        <div className="goals-peek-more">
          +{goals.length - 5} more goal{goals.length - 5 > 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}

export default GoalsPeek
