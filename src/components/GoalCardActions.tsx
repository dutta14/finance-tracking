import { FC } from 'react'
import { FinancialGoal } from '../types'
import { EditIcon, CopyIcon, DeleteIcon } from './Icons'
import '../styles/GoalCardActions.css'

interface GoalCardActionsProps {
  goal: FinancialGoal
  onEdit: (goal: FinancialGoal) => void
  onCopy: (goal: FinancialGoal) => void
  onDelete: (goalId: number) => void
}

const GoalCardActions: FC<GoalCardActionsProps> = ({ goal, onEdit, onCopy, onDelete }) => {
  return (
    <div className="goal-card-actions">
      <button
        className="btn-edit"
        onClick={() => onEdit(goal)}
        title="Edit goal"
      >
        <EditIcon size={18} />
      </button>
      <button
        className="btn-copy"
        onClick={() => onCopy(goal)}
        title="Copy goal to form"
      >
        <CopyIcon size={18} />
      </button>
      <button
        className="btn-delete"
        onClick={() => onDelete(goal.id)}
        title="Delete goal"
      >
        <DeleteIcon size={18} />
      </button>
    </div>
  )
}

export default GoalCardActions
