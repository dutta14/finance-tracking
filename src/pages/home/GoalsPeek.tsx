import { FC } from 'react'
import { useNavigate } from 'react-router-dom'
import { FinancialGoal, GwGoal } from '../../types'
import { formatCurrency } from '../data/types'
import { useGoalMetrics } from '../goal/hooks/useGoalMetrics'
import TermAbbr from '../../components/TermAbbr'
import { useProfile } from '../../hooks/useProfile'

interface GoalsPeekProps {
  goals: FinancialGoal[]
  gwGoals: GwGoal[]
  onNavigate: () => void
}

const GoalsPeek: FC<GoalsPeekProps> = ({ goals, gwGoals, onNavigate }) => {
  const navigate = useNavigate()
  const { profile } = useProfile()
  const profileBirthday = profile.birthday || '1990-01'
  const metricsMap = useGoalMetrics(goals, gwGoals, profileBirthday)

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
        {goals.slice(0, 3).map(goal => {
          const goalGws = gwGoals.filter(g => g.fiGoalId === goal.id)
          const m = metricsMap.get(goal.id)
          if (!m) return null

          return (
            <button key={goal.id} className="goals-peek-item" onClick={() => navigate(`/goal/${goal.id}`)}>
              <div className="goals-peek-item-top">
                <span className="goals-peek-name">{goal.goalName}</span>
                {m.projectedFILabel &&
                  (m.projectedState === 'no-budget' ? (
                    <span
                      role="link"
                      tabIndex={0}
                      className="goals-peek-projected goals-peek-projected--link goals-peek-projected--action"
                      onClick={e => {
                        e.stopPropagation()
                        navigate('/budget')
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          e.stopPropagation()
                          navigate('/budget')
                        }
                      }}
                    >
                      {m.projectedFILabel}
                    </span>
                  ) : (
                    <span
                      className={`goals-peek-projected${
                        m.projectedState === 'reached'
                          ? ' goals-peek-projected--reached'
                          : m.projectedState === 'not-reachable'
                            ? ' goals-peek-projected--warn'
                            : ''
                      }`}
                    >
                      {m.projectedState === 'projected' ? (
                        (() => {
                          const plannedDate = new Date(m.retirementYear, m.retirementMonth - 1, 1)
                          const isEarlier = m.projectedFIDate! < plannedDate
                          const plannedLabel = plannedDate.toLocaleDateString('en-US', {
                            month: 'short',
                            year: 'numeric',
                          })
                          return (
                            <>
                              FI by <span className="goals-peek-projected-planned">{plannedLabel}</span>
                              {' → '}
                              <span
                                className={isEarlier ? 'goals-peek-projected--early' : 'goals-peek-projected--late'}
                              >
                                {m.projectedFILabel}
                              </span>
                            </>
                          )
                        })()
                      ) : m.projectedState === 'reached' ? (
                        <>
                          <span role="img" aria-label="celebration">
                            🎉
                          </span>{' '}
                          Goal reached!
                        </>
                      ) : (
                        m.projectedFILabel
                      )}
                    </span>
                  ))}
              </div>
              <div className="goals-peek-bars">
                <div className="goals-peek-bar-row">
                  <span className="goals-peek-bar-label">
                    <TermAbbr term="FI" />
                  </span>
                  <div
                    className="goals-peek-bar-track"
                    role="progressbar"
                    aria-valuenow={Math.round(m.fiProgress)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`FI progress: ${m.fiProgress.toFixed(0)}%`}
                  >
                    <div
                      className="goals-peek-bar-fill goals-peek-bar-fill--fi"
                      style={{ width: `${m.fiProgress}%` }}
                    />
                  </div>
                  <span className="goals-peek-pct goals-peek-pct--fi">{m.fiProgress.toFixed(0)}%</span>
                  <span className="goals-peek-target">{m.fiTarget > 0 ? formatCurrency(m.fiTarget) : '—'}</span>
                  <span className="goals-peek-monthly">
                    {m.fiMonthly > 0 ? `${formatCurrency(m.fiMonthly)}/mo` : ''}
                  </span>
                </div>
                {goalGws.length > 0 && (
                  <div className="goals-peek-bar-row">
                    <span className="goals-peek-bar-label">
                      <TermAbbr term="GW" />
                    </span>
                    <div
                      className="goals-peek-bar-track"
                      role="progressbar"
                      aria-valuenow={Math.round(m.gwProgress)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`General wealth progress: ${m.gwProgress.toFixed(0)}%`}
                    >
                      <div
                        className="goals-peek-bar-fill goals-peek-bar-fill--gw"
                        style={{ width: `${m.gwProgress}%` }}
                      />
                    </div>
                    <span className="goals-peek-pct goals-peek-pct--gw">{m.gwProgress.toFixed(0)}%</span>
                    <span className="goals-peek-target">{m.gwTotal > 0 ? formatCurrency(m.gwTotal) : '—'}</span>
                    <span className="goals-peek-monthly">
                      {m.gwMonthly > 0 ? `${formatCurrency(m.gwMonthly)}/mo` : 'Completed'}
                    </span>
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
      {goals.length > 3 && (
        <div className="goals-peek-more">
          +{goals.length - 3} more goal{goals.length - 3 > 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}

export default GoalsPeek
