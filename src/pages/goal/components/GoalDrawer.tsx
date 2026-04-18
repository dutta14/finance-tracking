import { FC, useState, useRef, useEffect } from 'react'
import { FinancialGoal, GwGoal } from '../../../types'
import GoalDetailedCard from './GoalDetailedCard'
import GoalActionsMenu from './GoalActionsMenu'
import GoalDiveDeep from './GoalDiveDeep'
import GwSection from './GwSection'
import SavingsPlan from './SavingsPlan'
import '../../../styles/GoalDrawer.css'
import '../../../styles/GoalDiveDeep.css'
import '../../../styles/SavingsPlan.css'
import '../../../styles/GwSection.css'

interface GoalDrawerProps {
  goal: FinancialGoal
  goals: FinancialGoal[]
  profileBirthday: string
  gwGoals: GwGoal[]
  onClose: () => void
  onNavigate: (goalId: number) => void
  onUpdateGoal: (goalId: number, goal: FinancialGoal) => void
  onCopyGoal: (goal: FinancialGoal) => void
  onDeleteGoal: (goalId: number) => void
  onRenameGoal: (goalId: number, name: string) => void
  onCreateGwGoal: (goal: Omit<GwGoal, 'id' | 'createdAt'>) => void
  onUpdateGwGoal: (id: number, updates: Partial<Omit<GwGoal, 'id' | 'createdAt' | 'fiGoalId'>>) => void
  onDeleteGwGoal: (id: number) => void
}

const GoalDrawer: FC<GoalDrawerProps> = ({
  goal, goals, profileBirthday, gwGoals,
  onClose, onNavigate, onUpdateGoal, onCopyGoal, onDeleteGoal, onRenameGoal,
  onCreateGwGoal, onUpdateGwGoal, onDeleteGwGoal,
}) => {
  const [renameMode, setRenameMode] = useState(false)
  const [renameName, setRenameName] = useState('')
  const [diveDeepOpen, setDiveDeepOpen] = useState(false)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const currentIndex = goals.findIndex(p => p.id === goal.id)
  const total = goals.length
  const prevGoal = currentIndex > 0 ? goals[currentIndex - 1] : null
  const nextGoal = currentIndex < total - 1 ? goals[currentIndex + 1] : null

  // Reset state on goal change
  useEffect(() => {
    setRenameMode(false)
    setDiveDeepOpen(false)
    bodyRef.current?.scrollTo(0, 0)
  }, [goal.id])

  useEffect(() => {
    if (renameMode) renameInputRef.current?.focus()
  }, [renameMode])

  // Esc key handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (renameMode) setRenameMode(false)
        else onClose()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, renameMode])

  // Arrow key navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      if (e.key === 'ArrowLeft' && prevGoal) onNavigate(prevGoal.id)
      if (e.key === 'ArrowRight' && nextGoal) onNavigate(nextGoal.id)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [prevGoal, nextGoal, onNavigate])

  // Lock body scroll while drawer is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const enterRename = () => { setRenameName(goal.goalName); setRenameMode(true) }
  const commitRename = () => {
    if (renameName.trim()) onRenameGoal(goal.id, renameName.trim())
    setRenameMode(false)
  }

  const handleDelete = () => {
    onDeleteGoal(goal.id)
    if (nextGoal) onNavigate(nextGoal.id)
    else if (prevGoal) onNavigate(prevGoal.id)
    else onClose()
  }

  return (
    <>
      <div className="goal-drawer-backdrop" onClick={onClose} />
      <div className="goal-drawer" role="dialog" aria-label={goal.goalName}>
        {/* Header */}
        <div className="goal-drawer-header">
          <div className="goal-drawer-header-left">
            {renameMode ? (
              <input
                ref={renameInputRef}
                className="goal-drawer-rename-input"
                value={renameName}
                onChange={e => setRenameName(e.target.value)}
                placeholder="Goal name"
                onKeyDown={e => {
                  if (e.key === 'Enter') commitRename()
                  if (e.key === 'Escape') setRenameMode(false)
                }}
                onBlur={commitRename}
              />
            ) : (
              <h2 className="goal-drawer-title">{goal.goalName}</h2>
            )}
          </div>
          <div className="goal-drawer-header-right">
            {total > 1 && (
              <div className="goal-drawer-stepper">
                <button
                  className="goal-drawer-step-btn"
                  onClick={() => prevGoal && onNavigate(prevGoal.id)}
                  disabled={!prevGoal}
                  aria-label="Previous goal"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3L5 8l5 5"/></svg>
                </button>
                <span className="goal-drawer-step-label">{currentIndex + 1} / {total}</span>
                <button
                  className="goal-drawer-step-btn"
                  onClick={() => nextGoal && onNavigate(nextGoal.id)}
                  disabled={!nextGoal}
                  aria-label="Next goal"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3l5 5-5 5"/></svg>
                </button>
              </div>
            )}
            <GoalActionsMenu
              onRename={enterRename}
              onDuplicate={() => onCopyGoal(goal)}
              onDelete={handleDelete}
            />
            <button className="goal-drawer-close-btn" onClick={onClose} aria-label="Close drawer">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 3l10 10M13 3L3 13"/></svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="goal-drawer-body" ref={bodyRef}>
          <div className="goal-drawer-main">
            <GoalDetailedCard
              goal={goal}
              profileBirthday={profileBirthday}
              onUpdateGoal={onUpdateGoal}
              showActions={false}
              showTitle={false}
            />
            <button
              className={`btn-dive-deep${diveDeepOpen ? ' active' : ''}`}
              onClick={() => setDiveDeepOpen(v => !v)}
            >
              {diveDeepOpen ? 'Close Deep Analysis' : 'Dive Deep'}
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '0.35rem', transform: diveDeepOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><path d="M4 6l4 4 4-4"/></svg>
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
          <div className="goal-drawer-sidebar">
            <SavingsPlan goal={goal} gwGoals={gwGoals} profileBirthday={profileBirthday} />
          </div>
        </div>
      </div>
    </>
  )
}

export default GoalDrawer
