import { FC, useState } from 'react'
import { FinancialPlan } from '../../../types'
import PlanDetailedCard from '../../../components/PlanDetailedCard'
import PlanDiveDeep from './PlanDiveDeep'
import './PlanDiveDeep.css'

interface PlanDetailViewProps {
  plans: FinancialPlan[]
  selectedPlanId: number | null
  onEditPlan: (plan: FinancialPlan) => void
  onCopyPlan: (plan: FinancialPlan) => void
  onDeletePlan: (planId: number) => void
}

const PlanDetailView: FC<PlanDetailViewProps> = ({
  plans,
  selectedPlanId,
  onEditPlan,
  onCopyPlan,
  onDeletePlan
}) => {
  const [diveDeepOpen, setDiveDeepOpen] = useState(false)

  if (!selectedPlanId) return null

  const plan = plans.find(p => p.id === selectedPlanId)
  if (!plan) return null

  return (
    <div className="plan-detail-container">
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
  )
}

export default PlanDetailView
