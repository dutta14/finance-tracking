import { FC, useState, useRef, useEffect, useMemo } from 'react'
import { FinancialGoal, GwGoal } from '../../../types'
import { getLatestGoalTotals } from '../../data/types'
import GoalDetailedCard from '../../../components/GoalDetailedCard'
import GoalActionsMenu from '../../../components/GoalActionsMenu'
import '../../../styles/GoalDetailPane.css'

const dollars = (n: number) => '$' + Math.round(n).toLocaleString()

const GwGoalSummary: FC<{ gw: GwGoal; goal: FinancialGoal; profileBirthday: string; gwProgressPct: number }> = ({ gw, goal, profileBirthday, gwProgressPct }) => {
  const [birthYear, birthMonth] = profileBirthday.split('-').map(Number)
  const created = new Date(goal.goalCreatedIn)
  const retirementYear = birthYear + goal.retirementAge
  const disburseYear = birthYear + gw.disburseAge
  const monthsToDisburse = Math.max(0,
    (disburseYear - created.getFullYear()) * 12 + (birthMonth - (created.getMonth() + 1))
  )
  const disbursementTarget = gw.disburseAmount * Math.pow(1 + goal.inflationRate / 100 / 12, monthsToDisburse)
  const monthsRetToDisburse = Math.max(0, (gw.disburseAge - goal.retirementAge) * 12)
  const pvAtRetirement = monthsRetToDisburse > 0
    ? disbursementTarget / Math.pow(1 + gw.growthRate / 100 / 12, monthsRetToDisburse)
    : disbursementTarget
  const progressPct = gwProgressPct

  return (
    <div className="pane-gw-goal">
      <div className="pane-gw-goal-header">
        <span className="pane-gw-badge">GW</span>
        <span className="pane-gw-goal-label">{gw.label || 'Unnamed goal'}</span>
      </div>
      <div className="pane-gw-goal-milestone">
        <div className="pane-gw-goal-milestone-top">
          <span className="pane-gw-goal-milestone-label">Goal by retirement ({retirementYear})</span>
          <span className="pane-gw-goal-milestone-amount">{dollars(pvAtRetirement)}</span>
        </div>
        <div className="pane-gw-goal-progress-row">
          <div className="pane-gw-goal-progress-track">
            <div className="pane-gw-goal-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="pane-gw-goal-progress-pct">{progressPct.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  )
}

interface GoalDetailPaneProps {
  goal: FinancialGoal
  profileBirthday: string
  gwGoals: GwGoal[]
  onClose: () => void
  onGoToGoal: (goalId: number) => void
  onGoToGoalEdit: (goalId: number) => void
  onUpdateGoal: (goalId: number, goal: FinancialGoal) => void
  onCopyGoal: (goal: FinancialGoal) => void
  onDeleteGoal: (goalId: number) => void
  onRenameGoal: (goalId: number, name: string) => void
}

const GoalDetailPane: FC<GoalDetailPaneProps> = ({
  goal, profileBirthday, gwGoals, onClose, onGoToGoal, onGoToGoalEdit, onUpdateGoal, onCopyGoal, onDeleteGoal, onRenameGoal,
}) => {
  const [renameMode, setRenameMode] = useState(false)
  const [renameName, setRenameName] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  const paneGwProgress = useMemo(() => {
    const goalsForPlan = gwGoals.filter(g => g.fiGoalId === goal.id)
    if (goalsForPlan.length === 0) return 0
    const { gwTotal } = getLatestGoalTotals()
    const [by, bm] = profileBirthday.split('-').map(Number)
    const created = new Date(goal.goalCreatedIn)
    const totalNeeded = goalsForPlan.reduce((sum, gw) => {
      const disburseYear = by + gw.disburseAge
      const months = Math.max(0, (disburseYear - created.getFullYear()) * 12 + (bm - (created.getMonth() + 1)))
      const disbTarget = gw.disburseAmount * Math.pow(1 + goal.inflationRate / 100 / 12, months)
      const mRetToDisb = Math.max(0, (gw.disburseAge - goal.retirementAge) * 12)
      const pv = mRetToDisb > 0 ? disbTarget / Math.pow(1 + gw.growthRate / 100 / 12, mRetToDisb) : disbTarget
      return sum + pv
    }, 0)
    return totalNeeded > 0 ? Math.min(100, Math.max(0, (gwTotal / totalNeeded) * 100)) : 0
  }, [gwGoals, goal, profileBirthday])

  // Reset state when a different goal is selected
  useEffect(() => {
    setRenameMode(false)
  }, [goal.id])

  useEffect(() => {
    if (renameMode) renameInputRef.current?.focus()
  }, [renameMode])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (renameMode) setRenameMode(false)
        else onClose()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, renameMode])

  const enterRename = () => { setRenameName(goal.goalName); setRenameMode(true) }
  const commitRename = () => {
    if (renameName.trim()) onRenameGoal(goal.id, renameName.trim())
    setRenameMode(false)
  }

  return (
    <div className="goal-detail-pane">
      <div className="goal-detail-pane-header">
        {renameMode ? (
          <>
            <input
              ref={renameInputRef}
              className="pane-edit-name-input"
              value={renameName}
              onChange={e => setRenameName(e.target.value)}
              placeholder="Goal name"
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') setRenameMode(false)
              }}
            />
            <div className="goal-detail-pane-controls">
              <button className="pane-save-btn" onClick={commitRename}>Save</button>
              <button className="pane-icon-btn" onClick={() => setRenameMode(false)} aria-label="Cancel rename">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2 2 L14 14 M14 2 L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="goal-detail-pane-title">{goal.goalName}</span>
            <div className="goal-detail-pane-controls">
              <GoalActionsMenu
                onRename={enterRename}
                onGoToGoal={() => onGoToGoal(goal.id)}
                onDuplicate={() => onCopyGoal(goal)}
                onDelete={() => onDeleteGoal(goal.id)}
              />
              <button className="pane-icon-btn" onClick={onClose} aria-label="Close pane">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2 2 L14 14 M14 2 L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </>
        )}
      </div>

      <div className="goal-detail-pane-body">
        <GoalDetailedCard goal={goal} profileBirthday={profileBirthday} showActions={false} condensed={true} showTitle={false} />
        {gwGoals.filter(g => g.fiGoalId === goal.id).length > 0 && (
          <div className="pane-gw-goals-section">
            {gwGoals.filter(g => g.fiGoalId === goal.id).map(g => (
              <GwGoalSummary key={g.id} gw={g} goal={goal} profileBirthday={profileBirthday} gwProgressPct={paneGwProgress} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default GoalDetailPane
