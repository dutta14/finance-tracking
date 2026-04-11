import { FC, useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FinancialGoal, GwGoal } from '../../types'
import GoalDetailedCard from '../../components/GoalDetailedCard'
import GoalActionsMenu from '../../components/GoalActionsMenu'
import GoalDiveDeep from './components/GoalDiveDeep'
import GwSection from './components/GwSection'
import './components/GoalDiveDeep.css'
import '../../styles/GoalDetailPane.css'
import '../../styles/GoalSoloPage.css'

interface GoalSoloPageProps {
  goal: FinancialGoal
  goals: FinancialGoal[]
  profileBirthday: string
  onBack: () => void
  onNavigate: (goalId: number) => void
  onUpdateGoal: (goalId: number, goal: FinancialGoal) => void
  onDeleteGoal: (goalId: number) => void
  gwGoals: GwGoal[]
  onCreateGwGoal: (goal: Omit<GwGoal, 'id' | 'createdAt'>) => void
  onUpdateGwGoal: (id: number, updates: Partial<Omit<GwGoal, 'id' | 'createdAt' | 'fiGoalId'>>) => void
  onDeleteGwGoal: (id: number) => void
}

const GoalSoloPage: FC<GoalSoloPageProps> = ({ goal, goals, profileBirthday, onBack, onNavigate, onUpdateGoal, onDeleteGoal, gwGoals, onCreateGwGoal, onUpdateGwGoal, onDeleteGwGoal }) => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [startEditing] = useState(() => searchParams.get('edit') === '1')
  const [startGwForm] = useState(() => searchParams.get('gw') === '1')
  const [diveDeepOpen, setDiveDeepOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(goal.goalName)
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setRenaming(false)
    setRenameValue(goal.goalName)
    // Clear edit param after first render
    if (searchParams.has('edit')) {
      searchParams.delete('edit')
      setSearchParams(searchParams, { replace: true })
    }
    if (searchParams.has('gw')) {
      searchParams.delete('gw')
      setSearchParams(searchParams, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal.id])

  useEffect(() => {
    if (renaming) renameInputRef.current?.select()
  }, [renaming])

  const currentIndex = goals.findIndex(p => p.id === goal.id)
  const total = goals.length
  const prevGoal = currentIndex > 0 ? goals[currentIndex - 1] : null
  const nextGoal = currentIndex < total - 1 ? goals[currentIndex + 1] : null

  const commitRename = () => {
    const name = renameValue.trim()
    if (name && name !== goal.goalName) onUpdateGoal(goal.id, { ...goal, goalName: name })
    setRenaming(false)
  }

  const handleDelete = () => {
    onDeleteGoal(goal.id)
    if (nextGoal) onNavigate(nextGoal.id)
    else if (prevGoal) onNavigate(prevGoal.id)
    else onBack()
  }

  return (
    <section className="goal-solo">
      <div className="goal-solo-nav">
        <button className="goal-solo-back" onClick={onBack}>
          ← All Goals
        </button>
        {total > 1 && (
          <div className="goal-solo-stepper">
            <button
              className="goal-solo-step-btn"
              onClick={() => prevGoal && onNavigate(prevGoal.id)}
              disabled={!prevGoal}
              aria-label="Previous goal"
            >
              ‹
            </button>
            <span className="goal-solo-step-label">{currentIndex + 1} of {total}</span>
            <button
              className="goal-solo-step-btn"
              onClick={() => nextGoal && onNavigate(nextGoal.id)}
              disabled={!nextGoal}
              aria-label="Next goal"
            >
              ›
            </button>
          </div>
        )}
        <div className="goal-solo-actions">
          <GoalActionsMenu
            onRename={() => { setRenaming(true) }}
            onDelete={handleDelete}
          />
        </div>
      </div>

      <div className="goal-solo-header">
        {renaming ? (
          <input
            ref={renameInputRef}
            className="goal-solo-rename-input"
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setRenaming(false); setRenameValue(goal.goalName) } }}
          />
        ) : (
          <h1>{goal.goalName}</h1>
        )}
      </div>

      <div className="goal-solo-content">
        <GoalDetailedCard 
          goal={goal} 
          profileBirthday={profileBirthday} 
          onUpdateGoal={onUpdateGoal} 
          showActions={false} 
          showTitle={false} 
          initialEditing={startEditing}
        />
        <button
          className={`btn-dive-deep${diveDeepOpen ? ' active' : ''}`}
          onClick={() => setDiveDeepOpen(v => !v)}
        >
          {diveDeepOpen ? 'Close Deep Analysis ↑' : 'Dive Deep ↓'}
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
            initialFormOpen={startGwForm}
          />
        )}
      </div>
    </section>
  )
}

export default GoalSoloPage
