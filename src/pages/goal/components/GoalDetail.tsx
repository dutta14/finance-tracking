import { FC, useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { FinancialGoal, GwGoal } from '../../../types'
import GoalDetailedCard from './GoalDetailedCard'
import GoalActionsMenu from './GoalActionsMenu'
import GoalDiveDeep from './GoalDiveDeep'
import GwSection from './GwSection'
import SavingsPlan from './SavingsPlan'
import '../../../styles/GoalDetail.css'
import '../../../styles/GoalDiveDeep.css'
import '../../../styles/SavingsPlan.css'
import '../../../styles/GwSection.css'

interface GoalDetailProps {
  goals: FinancialGoal[]
  profileBirthday: string
  gwGoals: GwGoal[]
  onUpdateGoal: (goalId: number, goal: FinancialGoal) => void
  onCopyGoal: (goal: FinancialGoal) => void
  onDeleteGoal: (goalId: number) => void
  onRenameGoal: (goalId: number, name: string) => void
  onCreateGwGoal: (goal: Omit<GwGoal, 'id' | 'createdAt'>) => void
  onUpdateGwGoal: (id: number, updates: Partial<Omit<GwGoal, 'id' | 'createdAt' | 'fiGoalId'>>) => void
  onDeleteGwGoal: (id: number) => void
}

const GoalDetail: FC<GoalDetailProps> = ({
  goals,
  profileBirthday,
  gwGoals,
  onUpdateGoal,
  onCopyGoal,
  onDeleteGoal,
  onRenameGoal,
  onCreateGwGoal,
  onUpdateGwGoal,
  onDeleteGwGoal,
}) => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const goalId = Number(id)
  const goal = goals.find(g => g.id === goalId)

  const [renameMode, setRenameMode] = useState(false)
  const [renameName, setRenameName] = useState('')
  const [diveDeepOpen, setDiveDeepOpen] = useState(false)
  const renameInputRef = useRef<HTMLInputElement>(null)

  const currentIndex = goals.findIndex(g => g.id === goalId)
  const total = goals.length
  const prevGoal = currentIndex > 0 ? goals[currentIndex - 1] : null
  const nextGoal = currentIndex < total - 1 ? goals[currentIndex + 1] : null

  useEffect(() => {
    setRenameMode(false)
    setDiveDeepOpen(false)
  }, [goalId])

  useEffect(() => {
    if (renameMode) renameInputRef.current?.focus()
  }, [renameMode])

  // Arrow key navigation between goals
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return
      if (e.key === 'ArrowLeft' && prevGoal) navigate(`/goal/${prevGoal.id}`)
      if (e.key === 'ArrowRight' && nextGoal) navigate(`/goal/${nextGoal.id}`)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [prevGoal, nextGoal, navigate])

  if (!goal) {
    return (
      <div className="goal-detail-not-found">
        <svg
          width="48"
          height="48"
          viewBox="0 0 48 48"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ opacity: 0.4 }}
        >
          <circle cx="24" cy="24" r="20" />
          <path d="M18 18l12 12M30 18L18 30" />
        </svg>
        <p>This goal may have been deleted or the link is no longer valid.</p>
        <Link className="goal-detail-not-found-btn" to="/goal">
          ← Back to Goals
        </Link>
      </div>
    )
  }

  const enterRename = () => {
    setRenameName(goal.goalName)
    setRenameMode(true)
  }
  const commitRename = () => {
    if (renameName.trim()) onRenameGoal(goal.id, renameName.trim())
    setRenameMode(false)
  }

  const handleDelete = () => {
    onDeleteGoal(goal.id)
    if (nextGoal) navigate(`/goal/${nextGoal.id}`)
    else if (prevGoal) navigate(`/goal/${prevGoal.id}`)
    else navigate('/goal')
  }

  return (
    <div className="goal-detail">
      <div className="goal-detail-header">
        <div className="goal-detail-header-left">
          <Link className="goal-detail-back-link" to="/goal">
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M10 3L5 8l5 5" />
            </svg>
            Goals
          </Link>
          {renameMode ? (
            <input
              ref={renameInputRef}
              className="goal-detail-rename-input"
              value={renameName}
              onChange={e => setRenameName(e.target.value)}
              placeholder="Goal name"
              aria-label="Rename goal"
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') setRenameMode(false)
              }}
              onBlur={commitRename}
            />
          ) : (
            <h1 className="goal-detail-title">{goal.goalName}</h1>
          )}
        </div>
        <div className="goal-detail-header-right">
          {total > 1 && (
            <div className="goal-detail-stepper" role="group" aria-label="Goal navigation">
              <button
                className="goal-detail-step-btn"
                onClick={() => prevGoal && navigate(`/goal/${prevGoal.id}`)}
                disabled={!prevGoal}
                aria-label="Previous goal"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M10 3L5 8l5 5" />
                </svg>
              </button>
              <span className="goal-detail-step-label" aria-current="step">
                Goal {currentIndex + 1} of {total}
              </span>
              <button
                className="goal-detail-step-btn"
                onClick={() => nextGoal && navigate(`/goal/${nextGoal.id}`)}
                disabled={!nextGoal}
                aria-label="Next goal"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 3l5 5-5 5" />
                </svg>
              </button>
            </div>
          )}
          <GoalActionsMenu onRename={enterRename} onDuplicate={() => onCopyGoal(goal)} onDelete={handleDelete} />
        </div>
      </div>

      <div className="goal-detail-body">
        <div className="goal-detail-main">
          <GoalDetailedCard
            goal={goal}
            profileBirthday={profileBirthday}
            onUpdateGoal={onUpdateGoal}
            showActions={false}
            showTitle={false}
          />
          <button className={`btn-dive-deep${diveDeepOpen ? ' active' : ''}`} onClick={() => setDiveDeepOpen(v => !v)}>
            {diveDeepOpen ? 'Close Analysis' : 'Deep Analysis'}
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                marginLeft: '0.35rem',
                transform: diveDeepOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s',
              }}
              aria-hidden="true"
            >
              <path d="M4 6l4 4 4-4" />
            </svg>
          </button>
          {diveDeepOpen && <GoalDiveDeep goal={goal} profileBirthday={profileBirthday} />}
          {goal.fiGoal > 0 && (
            <GwSection
              goal={goal}
              goals={goals}
              profileBirthday={profileBirthday}
              gwGoals={gwGoals}
              onCreateGwGoal={onCreateGwGoal}
              onUpdateGwGoal={onUpdateGwGoal}
              onDeleteGwGoal={onDeleteGwGoal}
            />
          )}
        </div>
        <div className="goal-detail-aside">
          <SavingsPlan goal={goal} gwGoals={gwGoals} profileBirthday={profileBirthday} />
        </div>
      </div>
    </div>
  )
}

export default GoalDetail
