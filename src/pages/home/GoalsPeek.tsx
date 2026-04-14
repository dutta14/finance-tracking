import { FC, useMemo } from 'react'
import { FinancialGoal, GwGoal } from '../../types'
import { Account, BalanceEntry, formatCurrency } from '../data/types'

interface GoalsPeekProps {
  goals: FinancialGoal[]
  gwGoals: GwGoal[]
  onNavigate: () => void
  onGoToGoal: (goalId: number) => void
}

const GROWTH_RATE = 8

const calcMonthlySaving = (pv: number, fv: number, annualRate: number, nMonths: number): number => {
  if (nMonths <= 0) return 0
  const r = annualRate / 100 / 12
  if (r === 0) return Math.max(0, (fv - pv) / nMonths)
  const factor = Math.pow(1 + r, nMonths)
  const needed = fv - pv * factor
  if (needed <= 0) return 0
  return needed * r / (factor - 1)
}

const getBalanceData = () => {
  try {
    const accounts: Account[] = JSON.parse(localStorage.getItem('data-accounts') || '[]')
    const balances: BalanceEntry[] = JSON.parse(localStorage.getItem('data-balances') || '[]')
    const months = [...new Set(balances.map(b => b.month))].sort()
    return { accounts, balances, months }
  } catch {
    return { accounts: [] as Account[], balances: [] as BalanceEntry[], months: [] as string[] }
  }
}

const getTotalForMonth = (accounts: Account[], balances: BalanceEntry[], month: string, goalType: 'fi' | 'gw'): number => {
  const balMap = new Map<number, number>()
  for (const b of balances) if (b.month === month) balMap.set(b.accountId, b.balance)
  return accounts.filter(a => a.goalType === goalType).reduce((sum, a) => sum + (balMap.get(a.id) ?? 0), 0)
}

const GoalsPeek: FC<GoalsPeekProps> = ({ goals, gwGoals, onNavigate, onGoToGoal }) => {
  const { fiTotal, gwTotal, accounts, balances, latestMonth, profileBirthday } = useMemo(() => {
    const { accounts, balances, months } = getBalanceData()
    const latest = months[months.length - 1] || ''
    const fiT = latest ? getTotalForMonth(accounts, balances, latest, 'fi') : 0
    const gwT = latest ? getTotalForMonth(accounts, balances, latest, 'gw') : 0
    const pb = JSON.parse(localStorage.getItem('user-profile') || '{}').birthday || '1990-01'
    return { fiTotal: fiT, gwTotal: gwT, accounts, balances, latestMonth: latest, profileBirthday: pb }
  }, [])

  if (goals.length === 0) {
    return (
      <div className="home-card home-card--goals">
        <div className="home-card-header">
          <h3>Goals</h3>
          <button className="home-card-link" onClick={onNavigate}>View Goals →</button>
        </div>
        <div className="home-card-empty">No goals yet</div>
      </div>
    )
  }

  return (
    <div className="home-card home-card--goals">
      <div className="home-card-header">
        <h3>Goals</h3>
        <button className="home-card-link" onClick={onNavigate}>View Goals →</button>
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

          return (
            <button
              key={goal.id}
              className="goals-peek-item"
              onClick={() => onGoToGoal(goal.id)}
            >
              <div className="goals-peek-item-top">
                <span className="goals-peek-name">{goal.goalName}</span>
              </div>
              <div className="goals-peek-bars">
                <div className="goals-peek-bar-row">
                  <span className="goals-peek-bar-label">FI</span>
                  <div className="goals-peek-bar-track">
                    <div className="goals-peek-bar-fill goals-peek-bar-fill--fi" style={{ width: `${fiPct}%` }} />
                  </div>
                  <span className="goals-peek-pct goals-peek-pct--fi">{fiPct.toFixed(0)}%</span>
                  <span className="goals-peek-monthly">{fiMonthly > 0 ? `${formatCurrency(fiMonthly)}/mo` : ''}</span>
                </div>
                {goalGws.length > 0 && (
                  <div className="goals-peek-bar-row">
                    <span className="goals-peek-bar-label">GW</span>
                    <div className="goals-peek-bar-track">
                      <div className="goals-peek-bar-fill goals-peek-bar-fill--gw" style={{ width: `${gwPct}%` }} />
                    </div>
                    <span className="goals-peek-pct goals-peek-pct--gw">{gwPct.toFixed(0)}%</span>
                    <span className="goals-peek-monthly">{gwMonthly > 0 ? `${formatCurrency(gwMonthly)}/mo` : ''}</span>
                  </div>
                )}
              </div>
              <div className="goals-peek-item-meta">
                <span>FI: {formatCurrency(goal.fiGoal)}</span>
                {goalGws.length > 0 && <span>{goalGws.length} GW goal{goalGws.length > 1 ? 's' : ''}</span>}
                <span>Retire: {goal.retirement}</span>
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
