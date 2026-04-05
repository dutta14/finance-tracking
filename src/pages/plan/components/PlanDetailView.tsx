import { FC, useState } from 'react'
import { FinancialPlan } from '../../../types'
import PlanDetailedCard from '../../../components/PlanDetailedCard'
import PlanDiveDeep from './PlanDiveDeep'
import './PlanDiveDeep.css'

interface PlanDetailViewProps {
  plans: FinancialPlan[]
  selectedPlanIds: number[]
  profileBirthday: string
  onEditPlan: (plan: FinancialPlan) => void
  onCopyPlan: (plan: FinancialPlan) => void
  onDeletePlan: (planId: number) => void
  onUpdatePlan: (planId: number, plan: FinancialPlan) => void
}

const PlanDetailView: FC<PlanDetailViewProps> = ({
  plans,
  selectedPlanIds,
  profileBirthday,
  onEditPlan,
  onCopyPlan,
  onDeletePlan,
  onUpdatePlan,
}) => {
  const [diveDeepOpen, setDiveDeepOpen] = useState(false)

  const selectedPlanId = selectedPlanIds[0] ?? null
  if (!selectedPlanId) return null

  const plan = plans.find(p => p.id === selectedPlanId)
  if (!plan) return null

  return (
    <div className="plan-detail-container">
      <PlanDetailedCard
        plan={plan}
        profileBirthday={profileBirthday}
        onEdit={onEditPlan}
        onCopy={onCopyPlan}
        onDelete={onDeletePlan}
        onUpdatePlan={onUpdatePlan}
      />
      <button
        className={`btn-dive-deep${diveDeepOpen ? ' active' : ''}`}
        onClick={() => setDiveDeepOpen(v => !v)}
      >
        {diveDeepOpen ? 'Close Deep Analysis ↑' : 'Dive Deep ↓'}
      </button>
      {diveDeepOpen && <PlanDiveDeep plan={plan} profileBirthday={profileBirthday} />}
    </div>
  )
}

export default PlanDetailView
