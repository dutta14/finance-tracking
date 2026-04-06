import { FC, useState, useMemo } from 'react'
import { FinancialPlan, GwPlan } from '../../../types'
import '../../../styles/PlanMixer.css'

const dollars = (n: number) => '$' + Math.round(n).toLocaleString()

function computeGwPv(gw: GwPlan, base: FinancialPlan, profileBirthday: string): number {
  const [birthYear, birthMonth] = profileBirthday.split('-').map(Number)
  const created = new Date(base.planCreatedIn)
  const disburseYear = birthYear + gw.disburseAge
  const monthsToDisburse = Math.max(0,
    (disburseYear - created.getFullYear()) * 12 + (birthMonth - (created.getMonth() + 1))
  )
  const disbursementTarget = gw.disburseAmount * Math.pow(1 + base.inflationRate / 100 / 12, monthsToDisburse)
  const monthsRetToDisburse = Math.max(0, (gw.disburseAge - base.retirementAge) * 12)
  return monthsRetToDisburse > 0
    ? disbursementTarget / Math.pow(1 + gw.growthRate / 100 / 12, monthsRetToDisburse)
    : disbursementTarget
}

interface PlanMixerProps {
  plans: FinancialPlan[]
  gwPlans: GwPlan[]
  profileBirthday: string
  onCreatePlan: (plan: FinancialPlan) => void
  onCreateGwPlan: (plan: Omit<GwPlan, 'id' | 'createdAt'>) => void
  onClose: () => void
  onGoToPlan: (planId: number) => void
}

const PlanMixer: FC<PlanMixerProps> = ({
  plans, gwPlans, profileBirthday, onCreatePlan, onCreateGwPlan, onClose, onGoToPlan,
}) => {
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(plans[0]?.id ?? null)
  const [selectedGwIds, setSelectedGwIds] = useState<Set<number>>(new Set())

  const selectedPlan = plans.find(p => p.id === selectedPlanId) ?? null

  const toggleGw = (id: number) => {
    setSelectedGwIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedGwGoals = gwPlans.filter(g => selectedGwIds.has(g.id))

  const gwByPlan = useMemo(() => {
    const map = new Map<number, { plan: FinancialPlan; goals: GwPlan[] }>()
    for (const gw of gwPlans) {
      const plan = plans.find(p => p.id === gw.fiPlanId)
      if (!plan) continue
      if (!map.has(plan.id)) map.set(plan.id, { plan, goals: [] })
      map.get(plan.id)!.goals.push(gw)
    }
    return [...map.values()]
  }, [gwPlans, plans])

  const gwTotal = useMemo(() => {
    if (!selectedPlan) return 0
    return selectedGwGoals.reduce(
      (sum, gw) => sum + computeGwPv(gw, selectedPlan, profileBirthday), 0
    )
  }, [selectedGwGoals, selectedPlan, profileBirthday])

  const totalAtRetirement = (selectedPlan?.fiGoal ?? 0) + gwTotal

  const handleCreate = () => {
    if (!selectedPlan) return
    const newId = Date.now()
    const newPlan: FinancialPlan = {
      ...selectedPlan,
      id: newId,
      planName: `${selectedPlan.planName} – Mixed`,
      createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    }
    onCreatePlan(newPlan)
    selectedGwGoals.forEach(gw => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, createdAt: _createdAt, ...rest } = gw
      onCreateGwPlan({ ...rest, fiPlanId: newId })
    })
    onClose()
    onGoToPlan(newId)
  }

  const retirementYear = selectedPlan
    ? new Date(profileBirthday).getFullYear() + selectedPlan.retirementAge
    : null

  return (
    <div className="mixer-backdrop" onClick={onClose}>
      <div className="mixer-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">

        <div className="mixer-header">
          <div>
            <h2 className="mixer-title">Mix &amp; Match</h2>
            <p className="mixer-subtitle">Pick an FI base and any GW goals to preview a combined plan</p>
          </div>
          <button className="mixer-close-btn" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 2 L14 14 M14 2 L2 14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="mixer-body">

          {/* ── FI Base ── */}
          <div className="mixer-col">
            <div className="mixer-col-title">
              <span className="mixer-badge mixer-badge--fi">FI</span>
              Base Plan
            </div>
            <div className="mixer-plan-list">
              {plans.map(plan => (
                <button
                  key={plan.id}
                  className={`mixer-plan-item${selectedPlanId === plan.id ? ' selected' : ''}`}
                  onClick={() => setSelectedPlanId(plan.id)}
                >
                  <span className="mixer-plan-name">{plan.planName}</span>
                  <span className="mixer-plan-stat">
                    FI Goal <strong>{dollars(plan.fiGoal)}</strong>
                  </span>
                  <span className="mixer-plan-stat">
                    Retire {new Date(profileBirthday).getFullYear() + plan.retirementAge}
                    &nbsp;·&nbsp;{plan.inflationRate}% infl
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ── GW Goals ── */}
          <div className="mixer-col">
            <div className="mixer-col-title">
              <span className="mixer-badge mixer-badge--gw">GW</span>
              Goals
              {!selectedPlan && <span className="mixer-col-hint">(select FI base first)</span>}
            </div>
            {gwByPlan.length === 0 ? (
              <p className="mixer-empty">No GW goals found across any plans.</p>
            ) : (
              <div className="mixer-gw-list">
                {gwByPlan.map(({ plan, goals }) => (
                  <div key={plan.id} className="mixer-gw-group">
                    <div className="mixer-gw-group-label">from "{plan.planName}"</div>
                    {goals.map(gw => {
                      const pv = selectedPlan ? computeGwPv(gw, selectedPlan, profileBirthday) : 0
                      const isChecked = selectedGwIds.has(gw.id)
                      return (
                        <label key={gw.id} className={`mixer-gw-item${isChecked ? ' checked' : ''}`}>
                          <input
                            type="checkbox"
                            className="mixer-gw-checkbox"
                            checked={isChecked}
                            onChange={() => toggleGw(gw.id)}
                          />
                          <span className="mixer-gw-label">{gw.label || 'Unnamed goal'}</span>
                          <span className="mixer-gw-meta">age {gw.disburseAge} · {gw.growthRate}%</span>
                          {selectedPlan && (
                            <span className="mixer-gw-pv">{dollars(pv)}</span>
                          )}
                        </label>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* ── Preview ── */}
        <div className="mixer-preview">
          <div className="mixer-preview-heading">
            Preview at retirement{retirementYear ? ` (${retirementYear})` : ''}
          </div>
          {selectedPlan ? (
            <div className="mixer-preview-rows">
              <div className="mixer-preview-row">
                <span className="mixer-preview-label">
                  <span className="mixer-badge mixer-badge--fi mixer-badge--sm">FI</span>
                  {selectedPlan.planName}
                </span>
                <span className="mixer-preview-amount">{dollars(selectedPlan.fiGoal)}</span>
              </div>
              {selectedGwGoals.map(gw => (
                <div key={gw.id} className="mixer-preview-row mixer-preview-row--gw">
                  <span className="mixer-preview-label">
                    <span className="mixer-badge mixer-badge--gw mixer-badge--sm">GW</span>
                    {gw.label || 'Unnamed goal'}
                  </span>
                  <span className="mixer-preview-amount mixer-preview-amount--gw">
                    {dollars(computeGwPv(gw, selectedPlan, profileBirthday))}
                  </span>
                </div>
              ))}
              {selectedGwGoals.length > 0 && (
                <div className="mixer-preview-row mixer-preview-row--total">
                  <span className="mixer-preview-label">Total</span>
                  <span className="mixer-preview-amount mixer-preview-amount--total">{dollars(totalAtRetirement)}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="mixer-empty">Select an FI base to see a preview.</p>
          )}
        </div>

        <div className="mixer-footer">
          <button className="mixer-btn-cancel" onClick={onClose}>Cancel</button>
          <button
            className="mixer-btn-create"
            disabled={!selectedPlan}
            onClick={handleCreate}
          >
            Create as New Plan →
          </button>
        </div>

      </div>
    </div>
  )
}

export default PlanMixer
