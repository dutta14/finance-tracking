import { FC, useState, useEffect, useRef, useMemo } from 'react'
import { FinancialGoal, GwGoal } from '../../../types'
import { getLatestGoalTotals } from '../../data/types'
import '../../../styles/GwSection.css'

interface GwSectionProps {
  goal: FinancialGoal
  goals: FinancialGoal[]
  profileBirthday: string
  gwGoals: GwGoal[]
  onCreateGwGoal: (goal: Omit<GwGoal, 'id' | 'createdAt'>) => void
  onUpdateGwGoal: (id: number, updates: Partial<Omit<GwGoal, 'id' | 'createdAt' | 'fiGoalId'>>) => void
  onDeleteGwGoal: (id: number) => void
  initialFormOpen?: boolean
}

const dollars = (n: number) => '$' + Math.round(n).toLocaleString()

/** Age of the user at the FI goal's creation date */
const ageAtCreation = (birthday: string, goalCreatedIn: string): number => {
  if (!birthday || !goalCreatedIn) return 0
  const [by, bm, bd] = birthday.split('-').map(Number)
  const created = new Date(goalCreatedIn)
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

type GwDollarView = 'creation' | 'disbursement'

const GwGoalCard: FC<{
  gw: GwGoal
  currentAge: number
  creationYear: number
  inflationRate: number
  retirementAge: number
  goalCreatedIn: string
  profileBirthday: string
  dollarView: GwDollarView
  onSetDollarView: (v: GwDollarView) => void
  onEdit: (fields: GwFormFields) => void
  onDelete: () => void
  gwProgressPct: number
}> = ({ gw, currentAge, creationYear, inflationRate, retirementAge, goalCreatedIn, profileBirthday, dollarView, onSetDollarView, onEdit, onDelete, gwProgressPct }) => {
  const [editing, setEditing] = useState(false)
  const [editFields, setEditFields] = useState<GwFormFields>({
    label: gw.label,
    disburseAge: String(gw.disburseAge),
    disburseAmount: String(gw.disburseAmount),
    growthRate: String(gw.growthRate),
  })
  const [editError, setEditError] = useState('')
  const [pendingDelete, setPendingDelete] = useState(false)
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current) }, [])

  const handleDeleteClick = () => {
    setPendingDelete(true)
    deleteTimerRef.current = setTimeout(() => {
      onDelete()
    }, 10_000)
  }

  const handleUndoDelete = () => {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
    setPendingDelete(false)
  }

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

  // Exact month count: creation month → birthday month of disbursement year
  const [birthYear, birthMonth] = profileBirthday.split('-').map(Number)
  const created = new Date(goalCreatedIn)
  const disburseYear = birthYear + gw.disburseAge
  const retirementYear = birthYear + retirementAge
  const monthsToDisburse = Math.max(
    0,
    (disburseYear - created.getFullYear()) * 12 + (birthMonth - (created.getMonth() + 1))
  )
  const displayTarget =
    dollarView === 'creation'
      ? gw.disburseAmount
      : gw.disburseAmount * Math.pow(1 + inflationRate / 100 / 12, monthsToDisburse)
  const displayYear = dollarView === 'creation' ? creationYear : disburseYear

  // PV at retirement: inflation-adjust target to disbursement year, then discount back to retirement
  // This gives the nominal $ needed at retirement — constant regardless of creation/disbursement toggle
  const disbursementTarget = gw.disburseAmount * Math.pow(1 + inflationRate / 100 / 12, monthsToDisburse)
  const monthsRetToDisburse = Math.max(0, (gw.disburseAge - retirementAge) * 12)
  const pvAtRetirement =
    monthsRetToDisburse > 0
      ? disbursementTarget / Math.pow(1 + gw.growthRate / 100 / 12, monthsRetToDisburse)
      : disbursementTarget
  const progressPct = gwProgressPct

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
          <button className="gw-goal-delete" onClick={handleDeleteClick} aria-label="Delete GW goal">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M2.5 3.5h11M6.5 6.5v5M9.5 6.5v5M3.5 3.5l0.5 10c0 0.3 0.2 0.5 0.5 0.5h7c0.3 0 0.5-0.2 0.5-0.5l0.5-10M5.5 3.5V2.5c0-0.3 0.2-0.5 0.5-0.5h4c0.3 0 0.5 0.2 0.5 0.5v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {pendingDelete ? (
        <div className="gw-goal-undo-bar">
          <span className="gw-goal-undo-msg">Goal will be deleted in 10s</span>
          <button className="gw-goal-undo-btn" onClick={handleUndoDelete}>Undo</button>
          <div className="gw-goal-undo-progress"><div className="gw-goal-undo-progress-fill" /></div>
        </div>
      ) : editing ? (
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
              <span className="gw-goal-row-label">Growth rate</span>
              <span className="gw-goal-row-value">{gw.growthRate}% / yr</span>
            </div>
            <div className="gw-goal-row">
              <span className="gw-goal-row-label">
                <span className="gw-dollar-toggle">
                  <button className={`gw-dollar-toggle-btn${dollarView === 'creation' ? ' active' : ''}`} onClick={() => onSetDollarView('creation')} title={`${creationYear} dollars (as entered)`}>Creation</button>
                  <button className={`gw-dollar-toggle-btn${dollarView === 'disbursement' ? ' active' : ''}`} onClick={() => onSetDollarView('disbursement')} title={`Inflated to disbursement year`}>Disbursement</button>
                </span>
              </span>
              <span className="gw-goal-row-value gw-goal-row-value--highlight">{dollars(displayTarget)}</span>
            </div>
          </div>

          <div className="gw-goal-milestone">
            <div className="gw-goal-milestone-top">
              <span className="gw-goal-milestone-label">GW Goal by retirement ({retirementYear})</span>
              <span className="gw-goal-milestone-amount">{dollars(pvAtRetirement)}</span>
            </div>
            <div className="gw-goal-progress-row">
              <div className="gw-goal-progress-track">
                <div className="gw-goal-progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <span className="gw-goal-progress-pct">{progressPct.toFixed(1)}%</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const GwSection: FC<GwSectionProps> = ({ goal, goals, profileBirthday, gwGoals, onCreateGwGoal, onUpdateGwGoal, onDeleteGwGoal, initialFormOpen }) => {
  const [formOpen, setFormOpen] = useState(initialFormOpen ?? false)
  const [importPickerOpen, setImportPickerOpen] = useState(false)
  const [form, setForm] = useState<GwFormFields>(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [dollarView, setDollarView] = useState<GwDollarView>('creation')

  const goalGoals = gwGoals.filter(g => g.fiGoalId === goal.id)
  const otherGoals = gwGoals.filter(g => g.fiGoalId !== goal.id)
  const currentAge = ageAtCreation(profileBirthday, goal.goalCreatedIn)

  const gwProgressPct = useMemo(() => {
    const { gwTotal } = getLatestGoalTotals()
    if (goalGoals.length === 0) return 0
    const [by, bm] = profileBirthday.split('-').map(Number)
    const created = new Date(goal.goalCreatedIn)
    const totalNeeded = goalGoals.reduce((sum, gw) => {
      const disburseYear = by + gw.disburseAge
      const months = Math.max(0, (disburseYear - created.getFullYear()) * 12 + (bm - (created.getMonth() + 1)))
      const disbTarget = gw.disburseAmount * Math.pow(1 + goal.inflationRate / 100 / 12, months)
      const mRetToDisb = Math.max(0, (gw.disburseAge - goal.retirementAge) * 12)
      const pv = mRetToDisb > 0 ? disbTarget / Math.pow(1 + gw.growthRate / 100 / 12, mRetToDisb) : disbTarget
      return sum + pv
    }, 0)
    return totalNeeded > 0 ? Math.min(100, Math.max(0, (gwTotal / totalNeeded) * 100)) : 0
  }, [goalGoals, profileBirthday, goal])

  const handleImport = (gw: GwGoal) => {
    onCreateGwGoal({
      fiGoalId: goal.id,
      label: gw.label,
      disburseAge: gw.disburseAge,
      disburseAmount: gw.disburseAmount,
      growthRate: gw.growthRate,
      currentSavings: 0,
    })
    setImportPickerOpen(false)
  }

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

    onCreateGwGoal({
      fiGoalId: goal.id,
      label: form.label.trim(),
      disburseAge,
      disburseAmount,
      growthRate,
      currentSavings: 0,
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

      {goalGoals.length === 0 && !formOpen && (
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
          <div className="gw-empty-actions">
            <button className="gw-add-btn" onClick={() => { setFormOpen(true); setImportPickerOpen(false) }}>
              + New GW goal
            </button>
            {otherGoals.length > 0 && (
              <button className="gw-add-btn gw-add-btn--copy" onClick={() => setImportPickerOpen(v => !v)}>
                Copy from existing
              </button>
            )}
          </div>
          {importPickerOpen && (
            <div className="gw-import-picker">
              <div className="gw-import-picker-header">
                <span className="gw-import-picker-title">Copy from existing</span>
                <button className="gw-import-picker-cancel" onClick={() => setImportPickerOpen(false)}>Cancel</button>
              </div>
              {goals.filter(p => otherGoals.some(g => g.fiGoalId === p.id)).map(srcGoal => (
                <div key={srcGoal.id} className="gw-import-group">
                  <div className="gw-import-group-label">{srcGoal.goalName}</div>
                  {otherGoals.filter(g => g.fiGoalId === srcGoal.id).map(gw => (
                    <button key={gw.id} className="gw-import-item" onClick={() => handleImport(gw)}>
                      <span className="gw-import-item-label">{gw.label}</span>
                      <span className="gw-import-item-meta">Age {gw.disburseAge} · ${Math.round(gw.disburseAmount).toLocaleString()}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {goalGoals.length > 0 && (
        <div className="gw-goals-list">
          {goalGoals.map(gw => (
            <GwGoalCard
              key={gw.id}
              gw={gw}
              currentAge={currentAge}
              creationYear={new Date(goal.goalCreatedIn).getFullYear()}
              inflationRate={goal.inflationRate}
              retirementAge={goal.retirementAge}
              goalCreatedIn={goal.goalCreatedIn}
              profileBirthday={profileBirthday}
              dollarView={dollarView}
              onSetDollarView={setDollarView}
              gwProgressPct={gwProgressPct}
              onEdit={fields => onUpdateGwGoal(gw.id, {
                label: fields.label.trim(),
                disburseAge: Number(fields.disburseAge),
                disburseAmount: Number(fields.disburseAmount),
                growthRate: Number(fields.growthRate),
              })}
              onDelete={() => onDeleteGwGoal(gw.id)}
            />
          ))}
          {!formOpen && (
            <div className="gw-inline-footer">
              <button className="gw-add-btn gw-add-btn--inline" onClick={() => { setFormOpen(true); setImportPickerOpen(false) }}>
                + Add another GW goal
              </button>
              {otherGoals.length > 0 && (
                <button className="gw-add-btn gw-add-btn--copy gw-add-btn--inline" onClick={() => setImportPickerOpen(v => !v)}>
                  Copy from existing
                </button>
              )}
              {importPickerOpen && (
                <div className="gw-import-picker">
                  <div className="gw-import-picker-header">
                    <span className="gw-import-picker-title">Copy from existing</span>
                    <button className="gw-import-picker-cancel" onClick={() => setImportPickerOpen(false)}>Cancel</button>
                  </div>
                  {goals.filter(p => otherGoals.some(g => g.fiGoalId === p.id)).map(srcGoal => (
                    <div key={srcGoal.id} className="gw-import-group">
                      <div className="gw-import-group-label">{srcGoal.goalName}</div>
                      {otherGoals.filter(g => g.fiGoalId === srcGoal.id).map(gw => (
                        <button key={gw.id} className="gw-import-item" onClick={() => handleImport(gw)}>
                          <span className="gw-import-item-label">{gw.label}</span>
                          <span className="gw-import-item-meta">Age {gw.disburseAge} · ${Math.round(gw.disburseAmount).toLocaleString()}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
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
                <span className="gw-form-hint">You are currently {currentAge} (at goal creation)</span>
              )}
            </div>

            <div className="gw-form-group">
              <label className="gw-form-label">Target amount ({new Date(goal.goalCreatedIn).getFullYear()} $)</label>
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
          {otherGoals.length > 0 && (
            <p className="gw-form-copy-hint">
              or <button type="button" className="gw-form-copy-link" onClick={() => { setFormOpen(false); setImportPickerOpen(true) }}>copy from an existing goal</button>
            </p>
          )}
        </div>
      )}
    </section>
  )
}

export default GwSection
