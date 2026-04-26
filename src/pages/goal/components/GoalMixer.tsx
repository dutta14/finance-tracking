import { FC, useState, useMemo, useRef, useEffect } from 'react'
import { FinancialGoal, GwGoal } from '../../../types'
import { useFocusTrap } from '../../../hooks/useFocusTrap'
import '../../../styles/GoalMixer.css'

const dollars = (n: number) => '$' + Math.round(n).toLocaleString()

function computeGwPv(gw: GwGoal, base: FinancialGoal, profileBirthday: string): number {
  const [birthYear, birthMonth] = profileBirthday.split('-').map(Number)
  const created = new Date(base.goalCreatedIn)
  const disburseYear = birthYear + gw.disburseAge
  const monthsToDisburse = Math.max(
    0,
    (disburseYear - created.getFullYear()) * 12 + (birthMonth - (created.getMonth() + 1)),
  )
  const disbursementTarget = gw.disburseAmount * Math.pow(1 + base.inflationRate / 100 / 12, monthsToDisburse)
  const monthsRetToDisburse = Math.max(0, (gw.disburseAge - base.retirementAge) * 12)
  return monthsRetToDisburse > 0
    ? disbursementTarget / Math.pow(1 + gw.growthRate / 100 / 12, monthsRetToDisburse)
    : disbursementTarget
}

interface GoalMixerProps {
  goals: FinancialGoal[]
  gwGoals: GwGoal[]
  profileBirthday: string
  onCreateGoal: (goal: FinancialGoal) => void
  onCreateGwGoal: (goal: Omit<GwGoal, 'id' | 'createdAt'>) => void
  onClose: () => void
  onGoToGoal: (goalId: number) => void
}

const GoalMixer: FC<GoalMixerProps> = ({
  goals,
  gwGoals,
  profileBirthday,
  onCreateGoal,
  onCreateGwGoal,
  onClose,
  onGoToGoal,
}) => {
  const [selectedGoalId, setSelectedPlanId] = useState<number | null>(goals[0]?.id ?? null)
  const [selectedGwIds, setSelectedGwIds] = useState<Set<number>>(new Set())
  const modalRef = useRef<HTMLDivElement>(null)
  useFocusTrap(modalRef, true)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const selectedGoal = goals.find(p => p.id === selectedGoalId) ?? null

  const toggleGw = (id: number) => {
    setSelectedGwIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedGwGoals = gwGoals.filter(g => selectedGwIds.has(g.id))

  const gwByGoal = useMemo(() => {
    const map = new Map<number, { goal: FinancialGoal; goals: GwGoal[] }>()
    for (const gw of gwGoals) {
      const goal = goals.find(p => p.id === gw.fiGoalId)
      if (!goal) continue
      if (!map.has(goal.id)) map.set(goal.id, { goal, goals: [] })
      map.get(goal.id)!.goals.push(gw)
    }
    return [...map.values()]
  }, [gwGoals, goals])

  const gwTotal = useMemo(() => {
    if (!selectedGoal) return 0
    return selectedGwGoals.reduce((sum, gw) => sum + computeGwPv(gw, selectedGoal, profileBirthday), 0)
  }, [selectedGwGoals, selectedGoal, profileBirthday])

  const totalAtRetirement = (selectedGoal?.fiGoal ?? 0) + gwTotal

  const handleCreate = () => {
    if (!selectedGoal) return
    const newId = Date.now()
    const newGoal: FinancialGoal = {
      ...selectedGoal,
      id: newId,
      goalName: `${selectedGoal.goalName} – Mixed`,
      createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    }
    onCreateGoal(newGoal)
    selectedGwGoals.forEach(gw => {
      const { id: _id, createdAt: _createdAt, ...rest } = gw
      onCreateGwGoal({ ...rest, fiGoalId: newId })
    })
    onClose()
    onGoToGoal(newId)
  }

  const retirementYear = selectedGoal ? new Date(profileBirthday).getFullYear() + selectedGoal.retirementAge : null

  return (
    <div className="mixer-backdrop" onClick={onClose}>
      <div ref={modalRef} className="mixer-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="mixer-header">
          <div>
            <h2 className="mixer-title">Mix &amp; Match</h2>
            <p className="mixer-subtitle">Pick an FI base and any GW goals to preview a combined goal</p>
          </div>
          <button className="mixer-close-btn" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 2 L14 14 M14 2 L2 14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="mixer-body">
          {/* ── FI Base ── */}
          <div className="mixer-col">
            <div className="mixer-col-title">
              <span className="mixer-badge mixer-badge--fi">FI</span>
              Base Goal
            </div>
            <div className="mixer-goal-list">
              {goals.map(goal => (
                <button
                  key={goal.id}
                  className={`mixer-goal-item${selectedGoalId === goal.id ? ' selected' : ''}`}
                  onClick={() => setSelectedPlanId(goal.id)}
                >
                  <span className="mixer-goal-name">{goal.goalName}</span>
                  <span className="mixer-goal-stat">
                    FI Goal <strong>{dollars(goal.fiGoal)}</strong>
                  </span>
                  <span className="mixer-goal-stat">
                    Retire {new Date(profileBirthday).getFullYear() + goal.retirementAge}
                    &nbsp;·&nbsp;{goal.inflationRate}% infl
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
              {!selectedGoal && <span className="mixer-col-hint">(select FI base first)</span>}
            </div>
            {gwByGoal.length === 0 ? (
              <p className="mixer-empty">No GW goals found across any goals.</p>
            ) : (
              <div className="mixer-gw-list">
                {gwByGoal.map(({ goal, goals }) => (
                  <div key={goal.id} className="mixer-gw-group">
                    <div className="mixer-gw-group-label">from "{goal.goalName}"</div>
                    {goals.map(gw => {
                      const pv = selectedGoal ? computeGwPv(gw, selectedGoal, profileBirthday) : 0
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
                          <span className="mixer-gw-meta">
                            age {gw.disburseAge} · {gw.growthRate}%
                          </span>
                          {selectedGoal && <span className="mixer-gw-pv">{dollars(pv)}</span>}
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
          {selectedGoal ? (
            <div className="mixer-preview-rows">
              <div className="mixer-preview-row">
                <span className="mixer-preview-label">
                  <span className="mixer-badge mixer-badge--fi mixer-badge--sm">FI</span>
                  {selectedGoal.goalName}
                </span>
                <span className="mixer-preview-amount">{dollars(selectedGoal.fiGoal)}</span>
              </div>
              {selectedGwGoals.map(gw => (
                <div key={gw.id} className="mixer-preview-row mixer-preview-row--gw">
                  <span className="mixer-preview-label">
                    <span className="mixer-badge mixer-badge--gw mixer-badge--sm">GW</span>
                    {gw.label || 'Unnamed goal'}
                  </span>
                  <span className="mixer-preview-amount mixer-preview-amount--gw">
                    {dollars(computeGwPv(gw, selectedGoal, profileBirthday))}
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
          <button className="mixer-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="mixer-btn-create" disabled={!selectedGoal} onClick={handleCreate}>
            Create as New Goal →
          </button>
        </div>
      </div>
    </div>
  )
}

export default GoalMixer
