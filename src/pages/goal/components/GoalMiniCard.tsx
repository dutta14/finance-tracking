import { FC } from 'react'
import '../../../styles/GoalMiniCard.css'

const dollars = (n: number) => '$' + Math.round(n).toLocaleString()

interface GoalMiniCardProps {
  goalName: string
  retirementYear: number
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
  retirementYear,
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
        <h4>{goalName}</h4>
        <span className="mini-retire-year">{retirementYear}</span>
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
