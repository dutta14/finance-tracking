import { FC, useState, useRef, useEffect } from 'react'
import { FinancialPlan } from '../../../types'
import PlanDetailedCard from '../../../components/PlanDetailedCard'
import PlanDiveDeep from './PlanDiveDeep'
import './PlanDiveDeep.css'
import '../../../styles/PlanDetailPane.css'

interface PlanDetailPaneProps {
  plan: FinancialPlan
  onClose: () => void
  onGoToPlan: (planId: number) => void
  onEditPlan: (plan: FinancialPlan) => void
  onCopyPlan: (plan: FinancialPlan) => void
  onDeletePlan: (planId: number) => void
}

const PlanDetailPane: FC<PlanDetailPaneProps> = ({
  plan, onClose, onGoToPlan, onEditPlan, onCopyPlan, onDeletePlan,
}) => {
  const [diveDeepOpen, setDiveDeepOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="plan-detail-pane">
      <div className="plan-detail-pane-header">
        <span className="plan-detail-pane-title">{plan.planName}</span>
        <div className="plan-detail-pane-controls">
          <div className="pane-overflow-wrapper" ref={menuRef}>
            <button
              className="pane-icon-btn"
              onClick={() => setMenuOpen(v => !v)}
              aria-label="Plan options"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="3" cy="8" r="1.5"/>
                <circle cx="8" cy="8" r="1.5"/>
                <circle cx="13" cy="8" r="1.5"/>
              </svg>
            </button>
            {menuOpen && (
              <div className="pane-overflow-menu">
                <button
                  className="pane-overflow-menu-item"
                  onClick={() => { setMenuOpen(false); onGoToPlan(plan.id); }}
                >
                  Go to Plan
                </button>
              </div>
            )}
          </div>
          <button className="pane-icon-btn" onClick={onClose} aria-label="Close pane">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 2 L14 14 M14 2 L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="plan-detail-pane-body">
        <PlanDetailedCard
          plan={plan}
          onEdit={onEditPlan}
          onCopy={onCopyPlan}
          onDelete={onDeletePlan}
        />
        <button
          className={`btn-dive-deep${diveDeepOpen ? ' active' : ''}`}
          onClick={() => setDiveDeepOpen(v => !v)}
        >
          {diveDeepOpen ? 'Close Deep Analysis ↑' : 'Dive Deep ↓'}
        </button>
        {diveDeepOpen && <PlanDiveDeep plan={plan} />}
      </div>
    </div>
  )
}

export default PlanDetailPane
