import { FC } from 'react'
import '../../../styles/GoalMiniCard.css'

const dollars = (n: number) => '$' + Math.round(n).toLocaleString()

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface GoalMiniCardProps {
  goalName: string
  goalCreatedIn: string
  retirementYear: number
  retirementMonth: number
  projectedFILabel: string | null
  projectedFIDate: Date | null
  fiTarget: number
  fiProgress: number
  gwTotal: number
  isSelected: boolean
  onClick: (e: React.MouseEvent) => void
  viewMode?: 'grid' | 'list'
  compareMode?: boolean
}

const GoalMiniCard: FC<GoalMiniCardProps> = ({
  goalName,
  goalCreatedIn,
  retirementYear,
  retirementMonth,
  projectedFILabel,
  projectedFIDate,
  fiTarget = 0,
  fiProgress = 0,
  gwTotal = 0,
  isSelected,
  onClick,
  viewMode = 'grid',
  compareMode = false,
}) => {
  const hasGw = gwTotal > 0
  const totalGoals = fiTarget + gwTotal

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick(e as unknown as React.MouseEvent)
    }
  }

  return (
    <div
      className={`goal-mini-card${isSelected ? ' selected' : ''}${viewMode === 'list' ? ' list' : ''}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-pressed={compareMode ? isSelected : undefined}
      aria-label={
        compareMode
          ? `${goalName}, ${fiProgress.toFixed(0)}% progress${isSelected ? ', selected for comparison' : ''}`
          : `${goalName}, ${fiProgress.toFixed(0)}% progress`
      }
    >
      <div className="mini-card-top">
        <div className="mini-card-top-left">
          <h4>{goalName}</h4>
          {viewMode !== 'list' && (
            <span className="mini-created-in">
              {(() => {
                const d = new Date(goalCreatedIn)
                return isNaN(d.getTime()) ? '' : `Created in ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`
              })()}
            </span>
          )}
        </div>
        {viewMode === 'list' && (
          <span className="mini-created-cell">
            {(() => {
              const d = new Date(goalCreatedIn)
              return isNaN(d.getTime()) ? '' : `${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`
            })()}
          </span>
        )}
        <span className="mini-retire-year">
          {projectedFIDate ? (
            <>
              {viewMode !== 'list' && (
                <>
                  <s className="mini-retire-original">
                    {MONTH_SHORT[retirementMonth - 1]} {retirementYear}
                  </s>
                  <span className="mini-retire-arrow"> → </span>
                </>
              )}
              <span className="mini-retire-projected">{projectedFILabel}</span>
            </>
          ) : (
            <>
              {MONTH_SHORT[retirementMonth - 1]} {retirementYear}
            </>
          )}
        </span>
      </div>
      <div className="mini-progress">
        <div className="mini-progress-track">
          <div className="mini-progress-fill" style={{ width: `${fiProgress}%` }} />
        </div>
        <span className="mini-progress-pct">{fiProgress.toFixed(0)}%</span>
      </div>
      <div className="mini-value">
        <span className="label">FI Goal</span>
        <span className="amount">{fiTarget > 0 ? dollars(fiTarget) : '—'}</span>
      </div>
      {hasGw && (
        <div className="mini-value">
          <span className="label">GW Goals</span>
          <span className="amount mini-amount--gw">{dollars(gwTotal)}</span>
        </div>
      )}
      {hasGw && (
        <div className="mini-value mini-value--total">
          <span className="label">Total</span>
          <span className="amount">{dollars(totalGoals)}</span>
        </div>
      )}
      {!hasGw && <span className="mini-no-gw">FI only</span>}
    </div>
  )
}

export default GoalMiniCard
