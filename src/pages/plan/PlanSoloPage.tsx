import { FC, useState, useEffect, useRef } from 'react'
import { FinancialPlan, GwPlan } from '../../types'
import PlanDetailedCard from '../../components/PlanDetailedCard'
import PlanActionsMenu from '../../components/PlanActionsMenu'
import PlanDiveDeep from './components/PlanDiveDeep'
import GwSection from './components/GwSection'
import './components/PlanDiveDeep.css'
import '../../styles/PlanDetailPane.css'
import '../../styles/PlanSoloPage.css'

interface PlanSoloPageProps {
  plan: FinancialPlan
  plans: FinancialPlan[]
  profileBirthday: string
  onBack: () => void
  onNavigate: (planId: number) => void
  onUpdatePlan: (planId: number, plan: FinancialPlan) => void
  onDeletePlan: (planId: number) => void
  gwPlans: GwPlan[]
  onCreateGwPlan: (plan: Omit<GwPlan, 'id' | 'createdAt'>) => void
  onUpdateGwPlan: (id: number, updates: Partial<Omit<GwPlan, 'id' | 'createdAt' | 'fiPlanId'>>) => void
  onDeleteGwPlan: (id: number) => void
}

const PlanSoloPage: FC<PlanSoloPageProps> = ({ plan, plans, profileBirthday, onBack, onNavigate, onUpdatePlan, onDeletePlan, gwPlans, onCreateGwPlan, onUpdateGwPlan, onDeleteGwPlan }) => {
  const [diveDeepOpen, setDiveDeepOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(plan.planName)
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setRenaming(false)
    setRenameValue(plan.planName)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id])

  useEffect(() => {
    if (renaming) renameInputRef.current?.select()
  }, [renaming])

  const currentIndex = plans.findIndex(p => p.id === plan.id)
  const total = plans.length
  const prevPlan = currentIndex > 0 ? plans[currentIndex - 1] : null
  const nextPlan = currentIndex < total - 1 ? plans[currentIndex + 1] : null

  const commitRename = () => {
    const name = renameValue.trim()
    if (name && name !== plan.planName) onUpdatePlan(plan.id, { ...plan, planName: name })
    setRenaming(false)
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
          <PlanActionsMenu
            onRename={() => { setRenaming(true) }}
            onDelete={handleDelete}
          />
        </div>
      </div>

      <div className="plan-solo-header">
        {renaming ? (
          <input
            ref={renameInputRef}
            className="plan-solo-rename-input"
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setRenaming(false); setRenameValue(plan.planName) } }}
          />
        ) : (
          <h1>{plan.planName}</h1>
        )}
      </div>

      <div className="plan-solo-content">
        <PlanDetailedCard 
          plan={plan} 
          profileBirthday={profileBirthday} 
          onUpdatePlan={onUpdatePlan} 
          showActions={false} 
          showTitle={false} 
        />
        <button
          className={`btn-dive-deep${diveDeepOpen ? ' active' : ''}`}
          onClick={() => setDiveDeepOpen(v => !v)}
        >
          {diveDeepOpen ? 'Close Deep Analysis ↑' : 'Dive Deep ↓'}
        </button>
        {diveDeepOpen && <PlanDiveDeep plan={plan} profileBirthday={profileBirthday} />}
        {plan.fiGoal > 0 && (
          <GwSection
            plan={plan}
            plans={plans}
            profileBirthday={profileBirthday}
            gwPlans={gwPlans}
            onCreateGwPlan={onCreateGwPlan}
            onUpdateGwPlan={onUpdateGwPlan}
            onDeleteGwPlan={onDeleteGwPlan}
          />
        )}
      </div>
    </section>
  )
}

export default PlanSoloPage
