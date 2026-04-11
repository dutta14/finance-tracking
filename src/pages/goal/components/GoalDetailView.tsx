import { FC, useState } from 'react'
import { FinancialGoal } from '../../../types'
import GoalDetailedCard from '../../../components/GoalDetailedCard'
import GoalDiveDeep from './GoalDiveDeep'
import './GoalDiveDeep.css'

interface GoalDetailViewProps {
  goals: FinancialGoal[]
  selectedGoalIds: number[]
  profileBirthday: string
  onEditGoal: (goal: FinancialGoal) => void
  onCopyGoal: (goal: FinancialGoal) => void
  onDeleteGoal: (goalId: number) => void
  onUpdateGoal: (goalId: number, goal: FinancialGoal) => void
}

const GoalDetailView: FC<GoalDetailViewProps> = ({
  goals,
  selectedGoalIds,
  profileBirthday,
  onEditGoal,
  onCopyGoal,
  onDeleteGoal,
  onUpdateGoal,
}) => {
  const [diveDeepOpen, setDiveDeepOpen] = useState(false)

  const selectedGoalId = selectedGoalIds[0] ?? null
  if (!selectedGoalId) return null

  const goal = goals.find(p => p.id === selectedGoalId)
  if (!goal) return null

  return (
    <div className="goal-detail-container">
      <GoalDetailedCard
        goal={goal}
        profileBirthday={profileBirthday}
        onEdit={onEditGoal}
        onCopy={onCopyGoal}
        onDelete={onDeleteGoal}
        onUpdateGoal={onUpdateGoal}
      />
      <button
        className={`btn-dive-deep${diveDeepOpen ? ' active' : ''}`}
        onClick={() => setDiveDeepOpen(v => !v)}
      >
        {diveDeepOpen ? 'Close Deep Analysis ↑' : 'Dive Deep ↓'}
      </button>
      {diveDeepOpen && <GoalDiveDeep goal={goal} profileBirthday={profileBirthday} />}
    </div>
  )
}

export default GoalDetailView
