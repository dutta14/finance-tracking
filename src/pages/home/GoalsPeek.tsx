import { FC, useMemo } from 'react'
import { FinancialGoal, GwGoal } from '../../types'
import { formatCurrency, getLatestGoalTotals } from '../data/types'

interface GoalsPeekProps {
  goals: FinancialGoal[]
  gwGoals: GwGoal[]
  onNavigate: () => void
  onGoToGoal: (goalId: number) => void
}

const GoalsPeek: FC<GoalsPeekProps> = ({ goals, gwGoals, onNavigate, onGoToGoal }) => {
  const { fiTotal, gwTotal } = useMemo(() => getLatestGoalTotals(), [])

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

          let gwPct = 0
          if (goalGws.length > 0) {
            const [by, bm] = (JSON.parse(localStorage.getItem('user-profile') || '{}').birthday || '1990-01').split('-').map(Number)
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
                </div>
                {goalGws.length > 0 && (
                  <div className="goals-peek-bar-row">
                    <span className="goals-peek-bar-label">GW</span>
                    <div className="goals-peek-bar-track">
                      <div className="goals-peek-bar-fill goals-peek-bar-fill--gw" style={{ width: `${gwPct}%` }} />
                    </div>
                    <span className="goals-peek-pct goals-peek-pct--gw">{gwPct.toFixed(0)}%</span>
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
