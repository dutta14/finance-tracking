import { FC, useState } from 'react'
import { FinancialPlan, GwPlan } from '../../../types'
import '../../../styles/GwSection.css'

interface GwSectionProps {
  plan: FinancialPlan
  profileBirthday: string
  gwPlans: GwPlan[]
  onCreateGwPlan: (plan: Omit<GwPlan, 'id' | 'createdAt'>) => void
  onUpdateGwPlan: (id: number, updates: Partial<Omit<GwPlan, 'id' | 'createdAt' | 'fiPlanId'>>) => void
  onDeleteGwPlan: (id: number) => void
}

const dollars = (n: number) => '$' + Math.round(n).toLocaleString()

/** Age of the user at the FI plan's creation date */
const ageAtCreation = (birthday: string, planCreatedIn: string): number => {
  if (!birthday || !planCreatedIn) return 0
  const [by, bm, bd] = birthday.split('-').map(Number)
  const created = new Date(planCreatedIn)
  let age = created.getFullYear() - by
  if (
    created.getMonth() + 1 < bm ||
    (created.getMonth() + 1 === bm && created.getDate() < bd)
  ) age -= 1
  return Math.max(age, 0)
}

interface GwFormFields {
  label: string
  disburseAge: string
  disburseAmount: string
  growthRate: string
}

const EMPTY_FORM: GwFormFields = { label: '', disburseAge: '', disburseAmount: '', growthRate: '7' }

const GwGoalCard: FC<{
  gw: GwPlan
  currentAge: number
  creationYear: number
  onEdit: (fields: GwFormFields) => void
  onDelete: () => void
}> = ({ gw, currentAge, creationYear, onEdit, onDelete }) => {
  const [editing, setEditing] = useState(false)
  const [editFields, setEditFields] = useState<GwFormFields>({
    label: gw.label,
    disburseAge: String(gw.disburseAge),
    disburseAmount: String(gw.disburseAmount),
    growthRate: String(gw.growthRate),
  })
  const [editError, setEditError] = useState('')

  const setEF = (k: keyof GwFormFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEditFields(f => ({ ...f, [k]: e.target.value }))

  const handleSave = () => {
    const disburseAge = Number(editFields.disburseAge)
    const disburseAmount = Number(editFields.disburseAmount)
    const growthRate = Number(editFields.growthRate)
    if (!editFields.label.trim()) { setEditError('Label is required.'); return }
    if (!disburseAge || disburseAge <= currentAge) {
      setEditError(`Disbursement age must be greater than ${currentAge}.`); return
    }
    if (!disburseAmount || disburseAmount <= 0) { setEditError('Enter a valid target amount.'); return }
    if (growthRate <= 0 || growthRate > 50) { setEditError('Growth rate must be 0.1–50%.'); return }
    onEdit(editFields)
    setEditing(false)
    setEditError('')
  }

  const handleCancelEdit = () => {
    setEditFields({
      label: gw.label,
      disburseAge: String(gw.disburseAge),
      disburseAmount: String(gw.disburseAmount),
      growthRate: String(gw.growthRate),
    })
    setEditError('')
    setEditing(false)
  }

  const years = gw.disburseAge - currentAge
  const setAsideToday =
    years > 0 ? gw.disburseAmount / Math.pow(1 + gw.growthRate / 100, years) : gw.disburseAmount

  return (
    <div className={`gw-goal-card${editing ? ' gw-goal-card--editing' : ''}`}>
      <div className="gw-goal-card-header">
        {editing ? (
          <span className="gw-goal-label gw-goal-label--editing">Editing goal</span>
        ) : (
          <span className="gw-goal-label">{gw.label || 'Unnamed goal'}</span>
        )}
        <div className="gw-goal-card-actions">
          {!editing && (
            <button
              className="gw-goal-edit"
              onClick={() => setEditing(true)}
              aria-label="Edit GW goal"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M11.5 2.5 L13.5 4.5 L5 13 H3 V11 L11.5 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
                <path d="M10 4 L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}
          <button className="gw-goal-delete" onClick={onDelete} aria-label="Delete GW goal">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 2 L14 14 M14 2 L2 14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {editing ? (
        <div className="gw-card-edit-form">
          {editError && <p className="gw-form-error">{editError}</p>}
          <div className="gw-form-grid">
            <div className="gw-form-group gw-form-group--full">
              <label className="gw-form-label">Goal label</label>
              <input className="gw-form-input" type="text" value={editFields.label} onChange={setEF('label')} autoFocus />
            </div>
            <div className="gw-form-group">
              <label className="gw-form-label">Age at disbursement</label>
              <input className="gw-form-input" type="number" value={editFields.disburseAge} onChange={setEF('disburseAge')} min={currentAge + 1} step="1" />
            </div>
            <div className="gw-form-group">
              <label className="gw-form-label">Target amount ({creationYear} $)</label>
              <input className="gw-form-input" type="number" value={editFields.disburseAmount} onChange={setEF('disburseAmount')} min="1" />
            </div>
            <div className="gw-form-group">
              <label className="gw-form-label">Growth rate (% / yr)</label>
              <input className="gw-form-input" type="number" value={editFields.growthRate} onChange={setEF('growthRate')} min="0.1" max="50" step="0.1" />
            </div>
          </div>
          <div className="gw-form-actions">
            <button className="gw-form-save" onClick={handleSave}>Save</button>
            <button className="gw-form-cancel" onClick={handleCancelEdit}>Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <div className="gw-goal-rows">
            <div className="gw-goal-row">
              <span className="gw-goal-row-label">Disbursement age</span>
              <span className="gw-goal-row-value">{gw.disburseAge} yrs</span>
            </div>
            <div className="gw-goal-row">
              <span className="gw-goal-row-label">Horizon</span>
              <span className="gw-goal-row-value">{years > 0 ? `${years} yrs` : '—'}</span>
            </div>
            <div className="gw-goal-row">
              <span className="gw-goal-row-label">Target ({creationYear} dollars)</span>
              <span className="gw-goal-row-value gw-goal-row-value--highlight">{dollars(gw.disburseAmount)}</span>
            </div>
            <div className="gw-goal-row">
              <span className="gw-goal-row-label">Growth rate</span>
              <span className="gw-goal-row-value">{gw.growthRate}% / yr</span>
            </div>
          </div>

          <div className="gw-goal-pv">
            <div className="gw-goal-pv-label">Set aside today</div>
            <div className="gw-goal-pv-amount">{dollars(setAsideToday)}</div>
            <div className="gw-goal-pv-note">
              grows to {dollars(gw.disburseAmount)} ({creationYear} $) in {years > 0 ? `${years} yrs` : '—'} at {gw.growthRate}%
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const GwSection: FC<GwSectionProps> = ({ plan, profileBirthday, gwPlans, onCreateGwPlan, onUpdateGwPlan, onDeleteGwPlan }) => {
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<GwFormFields>(EMPTY_FORM)
  const [formError, setFormError] = useState('')

  const planGoals = gwPlans.filter(g => g.fiPlanId === plan.id)
  const currentAge = ageAtCreation(profileBirthday, plan.planCreatedIn)

  const setField = (k: keyof GwFormFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleAdd = () => {
    const disburseAge = Number(form.disburseAge)
    const disburseAmount = Number(form.disburseAmount)
    const growthRate = Number(form.growthRate)

    if (!form.label.trim()) { setFormError('Please enter a label for this goal.'); return }
    if (!disburseAge || disburseAge <= currentAge) {
      setFormError(`Disbursement age must be greater than your current age (${currentAge}).`); return
    }
    if (!disburseAmount || disburseAmount <= 0) { setFormError('Enter a valid target amount.'); return }
    if (growthRate <= 0 || growthRate > 50) { setFormError('Growth rate must be between 0 and 50%.'); return }

    onCreateGwPlan({
      fiPlanId: plan.id,
      label: form.label.trim(),
      disburseAge,
      disburseAmount,
      growthRate,
    })
    setForm(EMPTY_FORM)
    setFormError('')
    setFormOpen(false)
  }

  const handleCancel = () => {
    setForm(EMPTY_FORM)
    setFormError('')
    setFormOpen(false)
  }

  return (
    <section className="gw-section">
      <div className="gw-section-header">
        <div className="gw-section-title-row">
          <span className="gw-section-badge">GW</span>
          <h2 className="gw-section-title">Generational Wealth</h2>
        </div>
        <p className="gw-section-subtitle">
          Beyond FI — define endowments for the people who come after you.
          Each goal shows exactly what to set aside today at your chosen growth rate.
        </p>
      </div>

      {planGoals.length === 0 && !formOpen && (
        <div className="gw-empty-state">
          <div className="gw-empty-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="21" y="30" width="6" height="12" rx="2" fill="currentColor" opacity="0.5" />
              <ellipse cx="24" cy="27" rx="14" ry="9" fill="currentColor" opacity="0.2" />
              <ellipse cx="24" cy="21" rx="11" ry="7.5" fill="currentColor" opacity="0.35" />
              <ellipse cx="24" cy="15" rx="8" ry="6" fill="currentColor" opacity="0.6" />
            </svg>
          </div>
          <p className="gw-empty-text">No generational wealth goals yet.</p>
          <button className="gw-add-btn" onClick={() => setFormOpen(true)}>
            + Add your first GW goal
          </button>
        </div>
      )}

      {planGoals.length > 0 && (
        <div className="gw-goals-list">
          {planGoals.map(gw => (
            <GwGoalCard
              key={gw.id}
              gw={gw}
              currentAge={currentAge}
              creationYear={new Date(plan.planCreatedIn).getFullYear()}
              onEdit={fields => onUpdateGwPlan(gw.id, {
                label: fields.label.trim(),
                disburseAge: Number(fields.disburseAge),
                disburseAmount: Number(fields.disburseAmount),
                growthRate: Number(fields.growthRate),
              })}
              onDelete={() => onDeleteGwPlan(gw.id)}
            />
          ))}
          {!formOpen && (
            <button className="gw-add-btn gw-add-btn--inline" onClick={() => setFormOpen(true)}>
              + Add another GW goal
            </button>
          )}
        </div>
      )}

      {formOpen && (
        <div className="gw-form">
          <h3 className="gw-form-title">New GW goal</h3>
          {formError && <p className="gw-form-error">{formError}</p>}

          <div className="gw-form-grid">
            <div className="gw-form-group gw-form-group--full">
              <label className="gw-form-label">Goal label</label>
              <input
                className="gw-form-input"
                type="text"
                placeholder="e.g. Kids' inheritance, Family trust…"
                value={form.label}
                onChange={setField('label')}
                autoFocus
              />
            </div>

            <div className="gw-form-group">
              <label className="gw-form-label">Age at disbursement</label>
              <input
                className="gw-form-input"
                type="number"
                placeholder={`> ${currentAge}`}
                value={form.disburseAge}
                onChange={setField('disburseAge')}
                min={currentAge + 1}
                step="1"
              />
              {currentAge > 0 && (
                <span className="gw-form-hint">You are currently {currentAge} (at plan creation)</span>
              )}
            </div>

            <div className="gw-form-group">
              <label className="gw-form-label">Target amount ({new Date(plan.planCreatedIn).getFullYear()} $)</label>
              <input
                className="gw-form-input"
                type="number"
                placeholder="e.g. 500000"
                value={form.disburseAmount}
                onChange={setField('disburseAmount')}
                min="1"
              />
            </div>

            <div className="gw-form-group">
              <label className="gw-form-label">Growth rate (% / yr)</label>
              <input
                className="gw-form-input"
                type="number"
                value={form.growthRate}
                onChange={setField('growthRate')}
                min="0.1"
                max="50"
                step="0.1"
              />
              <span className="gw-form-hint">Separate from your FI portfolio growth</span>
            </div>
          </div>

          <div className="gw-form-actions">
            <button className="gw-form-save" onClick={handleAdd}>Add goal</button>
            <button className="gw-form-cancel" onClick={handleCancel}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  )
}

export default GwSection
