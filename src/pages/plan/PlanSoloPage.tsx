import { FC, useState, useEffect, useRef } from 'react'
import { FinancialPlan } from '../../types'
import PlanDetailedCard from '../../components/PlanDetailedCard'
import PlanDiveDeep from './components/PlanDiveDeep'
import { calculatePlanMetrics } from './utils/planCalculations'
import { parseDate, getMonthsBetween } from './utils/dateHelpers'
import './components/PlanDiveDeep.css'
import '../../styles/PlanSoloPage.css'

interface PlanSoloPageProps {
  plan: FinancialPlan
  plans: FinancialPlan[]
  profileBirthday: string
  onBack: () => void
  onNavigate: (planId: number) => void
  onUpdatePlan: (planId: number, plan: FinancialPlan) => void
  onDeletePlan: (planId: number) => void
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

const toEditFields = (p: FinancialPlan): EditFields => ({
  planName: p.planName,
  planCreatedIn: p.planCreatedIn,
  planEndYear: p.planEndYear,
  retirementAge: String(p.retirementAge),
  expenseValue: String(p.expenseValue),
  inflationRate: String(p.inflationRate),
  safeWithdrawalRate: String(p.safeWithdrawalRate),
  growth: String(p.growth),
})

const PlanSoloPage: FC<PlanSoloPageProps> = ({ plan, plans, profileBirthday, onBack, onNavigate, onUpdatePlan, onDeletePlan }) => {
  const [diveDeepOpen, setDiveDeepOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [fields, setFields] = useState<EditFields>(toEditFields(plan))
  const [saveError, setSaveError] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  const set = (k: keyof EditFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields(f => ({ ...f, [k]: e.target.value }))

  useEffect(() => {
    setFields(toEditFields(plan))
    setEditMode(false)
    setRenaming(false)
    setSaveError('')
  }, [plan.id])

  useEffect(() => {
    if (renaming) renameInputRef.current?.select()
  }, [renaming])

  const currentIndex = plans.findIndex(p => p.id === plan.id)
  const total = plans.length
  const prevPlan = currentIndex > 0 ? plans[currentIndex - 1] : null
  const nextPlan = currentIndex < total - 1 ? plans[currentIndex + 1] : null

  const commitRename = () => {
    const name = fields.planName.trim()
    if (name && name !== plan.planName) onUpdatePlan(plan.id, { ...plan, planName: name })
    setRenaming(false)
  }

  const handleSave = () => {
    if (!fields.planName.trim()) { setSaveError('Plan name is required'); return }
    if (!fields.planCreatedIn) { setSaveError('Plan creation date is required'); return }
    if (!fields.retirementAge || Number(fields.retirementAge) <= 0) { setSaveError('Valid retirement age required'); return }
    if (!fields.expenseValue || Number(fields.expenseValue) <= 0) { setSaveError('Valid annual expense required'); return }
    const annualExpense = Number(fields.expenseValue)
    const retirementAge = Number(fields.retirementAge)
    const metrics = calculatePlanMetrics(
      annualExpense, profileBirthday, retirementAge, fields.planCreatedIn,
      Number(fields.inflationRate) || 0, Number(fields.safeWithdrawalRate) || 0,
      getMonthsBetween, parseDate,
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

  const handleDelete = () => {
    onDeletePlan(plan.id)
    if (nextPlan) onNavigate(nextPlan.id)
    else if (prevPlan) onNavigate(prevPlan.id)
    else onBack()
  }

  return (
    <section className="plan-solo">
      <div className="plan-solo-nav">
        <button className="plan-solo-back" onClick={onBack}>
          ← All Plans
        </button>
        {total > 1 && (
          <div className="plan-solo-stepper">
            <button
              className="plan-solo-step-btn"
              onClick={() => prevPlan && onNavigate(prevPlan.id)}
              disabled={!prevPlan}
              aria-label="Previous plan"
            >
              ‹
            </button>
            <span className="plan-solo-step-label">{currentIndex + 1} of {total}</span>
            <button
              className="plan-solo-step-btn"
              onClick={() => nextPlan && onNavigate(nextPlan.id)}
              disabled={!nextPlan}
              aria-label="Next plan"
            >
              ›
            </button>
          </div>
        )}
        <div className="plan-solo-actions">
          {!editMode && (
            <>
              <button className="plan-solo-action-btn" onClick={() => { setEditMode(true); setRenaming(false) }}>Edit</button>
              <button className="plan-solo-action-btn" onClick={() => { setRenaming(true); setEditMode(false) }}>Rename</button>
              <button className="plan-solo-action-btn plan-solo-action-btn--danger" onClick={handleDelete}>Delete</button>
            </>
          )}
          {editMode && (
            <>
              <button className="plan-solo-action-btn plan-solo-action-btn--primary" onClick={handleSave}>Save</button>
              <button className="plan-solo-action-btn" onClick={() => { setEditMode(false); setFields(toEditFields(plan)); setSaveError('') }}>Cancel</button>
            </>
          )}
        </div>
      </div>

      <div className="plan-solo-header">
        {renaming ? (
          <input
            ref={renameInputRef}
            className="plan-solo-rename-input"
            value={fields.planName}
            onChange={set('planName')}
            onBlur={commitRename}
            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setRenaming(false); setFields(f => ({ ...f, planName: plan.planName })) } }}
          />
        ) : (
          <h1>{plan.planName}</h1>
        )}
      </div>

      <div className="plan-solo-content">
        {editMode && (
          <div className="plan-solo-edit-form">
            {saveError && <p className="plan-solo-edit-error">{saveError}</p>}
            <div className="plan-solo-edit-grid">
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
          </div>
        )}
        <PlanDetailedCard plan={plan} profileBirthday={profileBirthday} showActions={false} />
        <button
          className={`btn-dive-deep${diveDeepOpen ? ' active' : ''}`}
          onClick={() => setDiveDeepOpen(v => !v)}
        >
          {diveDeepOpen ? 'Close Deep Analysis ↑' : 'Dive Deep ↓'}
        </button>
        {diveDeepOpen && <PlanDiveDeep plan={plan} />}
      </div>
    </section>
  )
}

export default PlanSoloPage
