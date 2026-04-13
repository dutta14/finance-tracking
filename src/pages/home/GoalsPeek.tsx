import { FC } from 'react'
import { FinancialGoal, GwGoal } from '../../types'
import { formatCurrency } from '../data/types'

interface GoalsPeekProps {
  goals: FinancialGoal[]
  gwGoals: GwGoal[]
  onNavigate: () => void
  onGoToGoal: (goalId: number) => void
}

const GoalsPeek: FC<GoalsPeekProps> = ({ goals, gwGoals, onNavigate, onGoToGoal }) => {
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
          const gwCount = gwGoals.filter(g => g.fiGoalId === goal.id).length
          const progressPct = Math.min(Math.max(goal.progress, 0), 100)
          return (
            <button
              key={goal.id}
              className="goals-peek-item"
              onClick={() => onGoToGoal(goal.id)}
            >
              <div className="goals-peek-item-top">
                <span className="goals-peek-name">{goal.goalName}</span>
                <span className="goals-peek-pct">{progressPct.toFixed(0)}%</span>
              </div>
              <div className="goals-peek-bar-track">
                <div
                  className="goals-peek-bar-fill"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="goals-peek-item-meta">
                <span>FI Goal: {formatCurrency(goal.fiGoal)}</span>
                {gwCount > 0 && <span>{gwCount} GW goal{gwCount > 1 ? 's' : ''}</span>}
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
