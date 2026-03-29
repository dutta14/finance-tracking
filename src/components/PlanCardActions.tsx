import { FC } from 'react'
import { FinancialPlan } from '../types'
import { EditIcon, CopyIcon, DeleteIcon } from './Icons'
import '../styles/components.css'

interface PlanCardActionsProps {
  plan: FinancialPlan
  onEdit: (plan: FinancialPlan) => void
  onCopy: (plan: FinancialPlan) => void
  onDelete: (planId: number) => void
}

const PlanCardActions: FC<PlanCardActionsProps> = ({ plan, onEdit, onCopy, onDelete }) => {
  return (
    <div className="plan-card-actions">
      <button
        className="btn-edit"
        onClick={() => onEdit(plan)}
        title="Edit plan"
      >
        <EditIcon size={18} />
      </button>
      <button
        className="btn-copy"
        onClick={() => onCopy(plan)}
        title="Copy plan to form"
      >
        <CopyIcon size={18} />
      </button>
      <button
        className="btn-delete"
        onClick={() => onDelete(plan.id)}
        title="Delete plan"
      >
        <DeleteIcon size={18} />
      </button>
    </div>
  )
}

export default PlanCardActions
