import { FC, useState, useRef, useEffect } from 'react'
import { FinancialPlan, GwPlan } from '../../../types'
import PlanDetailedCard from '../../../components/PlanDetailedCard'
import PlanActionsMenu from '../../../components/PlanActionsMenu'
import '../../../styles/PlanDetailPane.css'

const dollars = (n: number) => '$' + Math.round(n).toLocaleString()

const GwGoalSummary: FC<{ gw: GwPlan; plan: FinancialPlan; profileBirthday: string }> = ({ gw, plan, profileBirthday }) => {
  const [birthYear, birthMonth] = profileBirthday.split('-').map(Number)
  const created = new Date(plan.planCreatedIn)
  const disburseYear = birthYear + gw.disburseAge
  const retirementYear = birthYear + plan.retirementAge
  const monthsToDisburse = Math.max(0,
    (disburseYear - created.getFullYear()) * 12 + (birthMonth - (created.getMonth() + 1))
  )
  const disbursementTarget = gw.disburseAmount * Math.pow(1 + plan.inflationRate / 100 / 12, monthsToDisburse)
  const monthsRetToDisburse = Math.max(0, (gw.disburseAge - plan.retirementAge) * 12)
  const pvAtRetirement = monthsRetToDisburse > 0
    ? disbursementTarget / Math.pow(1 + gw.growthRate / 100 / 12, monthsRetToDisburse)
    : disbursementTarget
  const progressPct = pvAtRetirement > 0
    ? Math.min(100, Math.max(0, ((gw.currentSavings ?? 0) / pvAtRetirement) * 100))
    : 0

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

interface PlanDetailPaneProps {
  plan: FinancialPlan
  profileBirthday: string
  gwPlans: GwPlan[]
  onClose: () => void
  onGoToPlan: (planId: number) => void
  onGoToPlanEdit: (planId: number) => void
  onUpdatePlan: (planId: number, plan: FinancialPlan) => void
  onCopyPlan: (plan: FinancialPlan) => void
  onDeletePlan: (planId: number) => void
  onRenamePlan: (planId: number, name: string) => void
}

const PlanDetailPane: FC<PlanDetailPaneProps> = ({
  plan, profileBirthday, gwPlans, onClose, onGoToPlan, onGoToPlanEdit, onUpdatePlan, onCopyPlan, onDeletePlan, onRenamePlan,
}) => {
  const [renameMode, setRenameMode] = useState(false)
  const [renameName, setRenameName] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Reset state when a different plan is selected
  useEffect(() => {
    setRenameMode(false)
  }, [plan.id])

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

  const enterRename = () => { setRenameName(plan.planName); setRenameMode(true) }
  const commitRename = () => {
    if (renameName.trim()) onRenamePlan(plan.id, renameName.trim())
    setRenameMode(false)
  }

  return (
    <div className="plan-detail-pane">
      <div className="plan-detail-pane-header">
        {renameMode ? (
          <>
            <input
              ref={renameInputRef}
              className="pane-edit-name-input"
              value={renameName}
              onChange={e => setRenameName(e.target.value)}
              placeholder="Plan name"
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') setRenameMode(false)
              }}
            />
            <div className="plan-detail-pane-controls">
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
            <span className="plan-detail-pane-title">{plan.planName}</span>
            <div className="plan-detail-pane-controls">
              <PlanActionsMenu
                onEdit={() => onGoToPlanEdit(plan.id)}
                onRename={enterRename}
                onGoToPlan={() => onGoToPlan(plan.id)}
                onDuplicate={() => onCopyPlan(plan)}
                onDelete={() => onDeletePlan(plan.id)}
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

      <div className="plan-detail-pane-body">
        <PlanDetailedCard plan={plan} profileBirthday={profileBirthday} onUpdatePlan={onUpdatePlan} showActions={false} condensed={true} showTitle={false} />
        {gwPlans.filter(g => g.fiPlanId === plan.id).length > 0 && (
          <div className="pane-gw-goals-section">
            {gwPlans.filter(g => g.fiPlanId === plan.id).map(g => (
              <GwGoalSummary key={g.id} gw={g} plan={plan} profileBirthday={profileBirthday} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default PlanDetailPane
