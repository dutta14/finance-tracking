import { FC, useState, useRef, useEffect } from 'react'
import { FinancialPlan } from '../../../types'
import PlanDetailedCard from '../../../components/PlanDetailedCard'
import PlanDiveDeep from './PlanDiveDeep'
import { calculatePlanMetrics } from '../utils/planCalculations'
import { parseDate, getMonthsBetween } from '../utils/dateHelpers'
import './PlanDiveDeep.css'
import '../../../styles/PlanDetailPane.css'

interface PlanDetailPaneProps {
  plan: FinancialPlan
  profileBirthday: string
  onClose: () => void
  onGoToPlan: (planId: number) => void
  onUpdatePlan: (planId: number, plan: FinancialPlan) => void
  onCopyPlan: (plan: FinancialPlan) => void
  onDeletePlan: (planId: number) => void
  onRenamePlan: (planId: number, name: string) => void
}

interface EditFields {
  planName: string
  planCreatedIn: string
  planEndYear: string
  retirementAge: string
  expenseValue: string
  inflationRate: string
  safeWithdrawalRate: string
  growth: string
}

const toEditFields = (plan: FinancialPlan): EditFields => ({
  planName: plan.planName,
  planCreatedIn: plan.planCreatedIn,
  planEndYear: plan.planEndYear,
  retirementAge: String(plan.retirementAge),
  expenseValue: String(plan.expenseValue),
  inflationRate: String(plan.inflationRate),
  safeWithdrawalRate: String(plan.safeWithdrawalRate),
  growth: String(plan.growth),
})

const PlanDetailPane: FC<PlanDetailPaneProps> = ({
  plan, profileBirthday, onClose, onGoToPlan, onUpdatePlan, onCopyPlan, onDeletePlan, onRenamePlan,
}) => {
  const [diveDeepOpen, setDiveDeepOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [renameMode, setRenameMode] = useState(false)
  const [renameName, setRenameName] = useState('')
  const [fields, setFields] = useState<EditFields>(toEditFields(plan))
  const [saveError, setSaveError] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  const set = (k: keyof EditFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields(f => ({ ...f, [k]: e.target.value }))

  // Reset edit state when a different plan is selected
  useEffect(() => {
    setFields(toEditFields(plan))
    setEditMode(false)
    setRenameMode(false)
    setSaveError('')
  }, [plan.id])

  useEffect(() => {
    if (renameMode) renameInputRef.current?.focus()
  }, [renameMode])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (renameMode) { setRenameMode(false) }
        else if (editMode) { setEditMode(false); setFields(toEditFields(plan)); setSaveError('') }
        else onClose()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, editMode, plan])

  const enterEdit = () => { setFields(toEditFields(plan)); setEditMode(true); setMenuOpen(false) }
  const cancelEdit = () => { setEditMode(false); setFields(toEditFields(plan)); setSaveError('') }

  const enterRename = () => { setRenameName(plan.planName); setRenameMode(true); setMenuOpen(false) }
  const commitRename = () => {
    if (renameName.trim()) onRenamePlan(plan.id, renameName.trim())
    setRenameMode(false)
  }

  const handleSave = () => {
    if (!fields.planName.trim()) { setSaveError('Plan name is required'); return }
    if (!fields.planCreatedIn) { setSaveError('Plan creation date is required'); return }
    if (!fields.retirementAge || Number(fields.retirementAge) <= 0) { setSaveError('Valid retirement age required'); return }
    if (!fields.expenseValue || Number(fields.expenseValue) <= 0) { setSaveError('Valid annual expense required'); return }

    const annualExpense = Number(fields.expenseValue)
    const retirementAge = Number(fields.retirementAge)
    const metrics = calculatePlanMetrics(
      annualExpense,
      profileBirthday,
      retirementAge,
      fields.planCreatedIn,
      Number(fields.inflationRate) || 0,
      Number(fields.safeWithdrawalRate) || 0,
      getMonthsBetween,
      parseDate,
    )
    onUpdatePlan(plan.id, {
      ...plan,
      planName: fields.planName.trim(),
      birthday: profileBirthday,
      planCreatedIn: fields.planCreatedIn,
      planEndYear: fields.planEndYear,
      retirementAge,
      expenseValue: annualExpense,
      monthlyExpenseValue: metrics.monthlyExpenseAtCreation,
      expenseValue2047: metrics.annualExpenseAtRetirement,
      monthlyExpense2047: metrics.monthlyExpenseAtRetirement,
      inflationRate: Number(fields.inflationRate) || 0,
      safeWithdrawalRate: Number(fields.safeWithdrawalRate) || 0,
      growth: Number(fields.growth) || 0,
      retirement: metrics.retirementDateFormatted,
      fiGoal: metrics.fiGoal,
    })
    setSaveError('')
    setEditMode(false)
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
        ) : editMode ? (
          <>
            <input
              className="pane-edit-name-input"
              value={fields.planName}
              onChange={set('planName')}
              placeholder="Plan name"
              autoFocus
            />
            <div className="plan-detail-pane-controls">
              <button className="pane-save-btn" onClick={handleSave}>Save</button>
              <button className="pane-icon-btn" onClick={cancelEdit} aria-label="Cancel edit">
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
              <div className="pane-overflow-wrapper" ref={menuRef}>
                <button className="pane-icon-btn" onClick={() => setMenuOpen(v => !v)} aria-label="Plan options">
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                    <circle cx="3" cy="8" r="1.5"/>
                    <circle cx="8" cy="8" r="1.5"/>
                    <circle cx="13" cy="8" r="1.5"/>
                  </svg>
                </button>
                {menuOpen && (
                  <div className="pane-overflow-menu">
                    <button className="pane-overflow-menu-item" onClick={enterEdit}>Edit</button>
                    <button className="pane-overflow-menu-item" onClick={enterRename}>Rename</button>
                    <button className="pane-overflow-menu-item" onClick={() => { setMenuOpen(false); onGoToPlan(plan.id) }}>Go to Plan</button>
                    <button className="pane-overflow-menu-item" onClick={() => { setMenuOpen(false); onCopyPlan(plan) }}>Duplicate</button>
                    <button className="pane-overflow-menu-item pane-overflow-menu-item--danger" onClick={() => { setMenuOpen(false); onDeletePlan(plan.id) }}>Delete</button>
                  </div>
                )}
              </div>
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
        {editMode ? (
          <div className="pane-edit-form">
            {saveError && <p className="pane-edit-error">{saveError}</p>}
            <div className="pane-edit-section">
              <h4 className="pane-edit-section-title">Personal &amp; Timeline</h4>
              <div className="pane-edit-group">
                <label className="pane-edit-label">Plan Created On</label>
                <input className="pane-edit-input" type="date" value={fields.planCreatedIn} onChange={set('planCreatedIn')} />
              </div>
              <div className="pane-edit-group">
                <label className="pane-edit-label">Plan End Year</label>
                <input className="pane-edit-input" type="date" value={fields.planEndYear} onChange={set('planEndYear')} />
              </div>
              <div className="pane-edit-group">
                <label className="pane-edit-label">Retirement Age</label>
                <input className="pane-edit-input" type="number" value={fields.retirementAge} onChange={set('retirementAge')} min="0" step="1" />
              </div>
            </div>
            <div className="pane-edit-section">
              <h4 className="pane-edit-section-title">Financials</h4>
              <div className="pane-edit-group">
                <label className="pane-edit-label">Annual Expense ($)</label>
                <input className="pane-edit-input" type="number" value={fields.expenseValue} onChange={set('expenseValue')} min="0" />
              </div>
              <div className="pane-edit-group">
                <label className="pane-edit-label">Inflation Rate (%)</label>
                <input className="pane-edit-input" type="number" value={fields.inflationRate} onChange={set('inflationRate')} step="0.1" />
              </div>
              <div className="pane-edit-group">
                <label className="pane-edit-label">Safe Withdrawal Rate (%)</label>
                <input className="pane-edit-input" type="number" value={fields.safeWithdrawalRate} onChange={set('safeWithdrawalRate')} step="0.1" />
              </div>
              <div className="pane-edit-group">
                <label className="pane-edit-label">Growth Rate (%)</label>
                <input className="pane-edit-input" type="number" value={fields.growth} onChange={set('growth')} step="0.1" />
              </div>
            </div>
            <div className="pane-edit-actions">
              <button className="pane-edit-save-btn" onClick={handleSave}>Save Changes</button>
              <button className="pane-edit-cancel-btn" onClick={cancelEdit}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <PlanDetailedCard plan={plan} profileBirthday={profileBirthday} showActions={false} />
            <button
              className={`btn-dive-deep${diveDeepOpen ? ' active' : ''}`}
              onClick={() => setDiveDeepOpen(v => !v)}
            >
              {diveDeepOpen ? 'Close Deep Analysis ↑' : 'Dive Deep ↓'}
            </button>
            {diveDeepOpen && <PlanDiveDeep plan={plan} profileBirthday={profileBirthday} />}
          </>
        )}
      </div>
    </div>
  )
}

export default PlanDetailPane
