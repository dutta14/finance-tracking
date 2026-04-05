import { FC, useState, useRef, useEffect } from 'react'
import { FinancialPlan } from '../../../types'
import PlanDetailedCard from '../../../components/PlanDetailedCard'
import PlanDiveDeep from './PlanDiveDeep'
import PlanActionsMenu from '../../../components/PlanActionsMenu'
import './PlanDiveDeep.css'
import '../../../styles/PlanDetailPane.css'

interface PlanDetailPaneProps {
  plan: FinancialPlan
  profileBirthday: string
  onClose: () => void
  onGoToPlan: (planId: number) => void
  onGoToPlanEdit: (planId: number) => void
  onUpdatePlan: (planId: number, plan: FinancialPlan) => void
  onCopyPlan: (plan: FinancialPlan) => void
  onDeletePlan: (planId: number) => void
  onRenamePlan: (planId: number, name: string) => void
}

const PlanDetailPane: FC<PlanDetailPaneProps> = ({
  plan, profileBirthday, onClose, onGoToPlan, onGoToPlanEdit, onUpdatePlan, onCopyPlan, onDeletePlan, onRenamePlan,
}) => {
  const [diveDeepOpen, setDiveDeepOpen] = useState(false)
  const [renameMode, setRenameMode] = useState(false)
  const [renameName, setRenameName] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Reset state when a different plan is selected
  useEffect(() => {
    setDiveDeepOpen(false)
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
        <PlanDetailedCard plan={plan} profileBirthday={profileBirthday} onUpdatePlan={onUpdatePlan} showActions={false} />
        <button
          className={`btn-dive-deep${diveDeepOpen ? ' active' : ''}`}
          onClick={() => setDiveDeepOpen(v => !v)}
        >
          {diveDeepOpen ? 'Close Deep Analysis ↑' : 'Dive Deep ↓'}
        </button>
        {diveDeepOpen && <PlanDiveDeep plan={plan} profileBirthday={profileBirthday} />}
      </div>
    </div>
  )
}

export default PlanDetailPane
