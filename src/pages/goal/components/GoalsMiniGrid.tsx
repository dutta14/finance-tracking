import { FC, useState, useEffect, useRef } from 'react'
import { FinancialGoal, GwGoal } from '../../../types'
import GoalMiniCard from '../../../components/GoalMiniCard'

interface ContextMenuState { x: number; y: number; goalId: number }

interface GoalsMiniGridProps {
  goals: FinancialGoal[]
  selectedGoalIds: number[]
  onSelectGoal: (goalId: number, multi: boolean) => void
  viewMode?: 'grid' | 'list'
  onReorderGoals?: (orderedIds: number[]) => void
  onGoToGoal: (goalId: number) => void
  onGoToGoalEdit: (goalId: number) => void
  onGoToGoalAddGw: (goalId: number) => void
  onRenameGoal: (goalId: number, name: string) => void
  onCopyGoal: (goal: FinancialGoal) => void
  onDeleteGoal: (goalId: number) => void
  gwGoals: GwGoal[]
  profileBirthday: string
}

const GoalsMiniGrid: FC<GoalsMiniGridProps> = ({
  goals, selectedGoalIds, onSelectGoal, viewMode = 'grid', onReorderGoals,
  onGoToGoal, onGoToGoalEdit, onGoToGoalAddGw, onRenameGoal, onCopyGoal, onDeleteGoal, gwGoals, profileBirthday,
}) => {
  const [draggedId, setDraggedId] = useState<number | null>(null)
  const [dragOverId, setDragOverId] = useState<number | null>(null)
  const [dragOverSide, setDragOverSide] = useState<'before' | 'after'>('after')
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!contextMenu) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setContextMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [contextMenu])

  useEffect(() => {
    if (renamingId !== null) renameInputRef.current?.focus()
  }, [renamingId])

  const openContextMenu = (e: React.MouseEvent, goalId: number) => {
    e.preventDefault()
    e.stopPropagation()
    const menuWidth = 160
    const menuHeight = 220
    const x = e.clientX + menuWidth > window.innerWidth ? e.clientX - menuWidth : e.clientX
    const y = e.clientY + menuHeight > window.innerHeight ? e.clientY - menuHeight : e.clientY
    setContextMenu({ x, y, goalId })
  }

  const closeContextMenu = () => setContextMenu(null)

  const startRename = (goalId: number, name: string) => {
    closeContextMenu()
    setRenamingId(goalId)
    setRenameValue(name)
  }

  const commitRename = (goalId: number) => {
    if (renameValue.trim()) onRenameGoal(goalId, renameValue.trim())
    setRenamingId(null)
  }

  const handleDragStart = (e: React.DragEvent, id: number) => {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, id: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (id === draggedId) { setDragOverId(null); return }
    const rect = e.currentTarget.getBoundingClientRect()
    const side: 'before' | 'after' = viewMode === 'list'
      ? (e.clientY < rect.top + rect.height / 2 ? 'before' : 'after')
      : (e.clientX < rect.left + rect.width / 2 ? 'before' : 'after')
    setDragOverId(id)
    setDragOverSide(side)
  }

  const handleDrop = (e: React.DragEvent, targetId: number) => {
    e.preventDefault()
    if (draggedId === null || draggedId === targetId || !onReorderGoals) return
    const ids = goals.map(p => p.id)
    const withoutDragged = ids.filter(id => id !== draggedId)
    const targetIdx = withoutDragged.indexOf(targetId)
    const insertIdx = dragOverSide === 'before' ? targetIdx : targetIdx + 1
    withoutDragged.splice(insertIdx, 0, draggedId)
    onReorderGoals(withoutDragged)
    setDraggedId(null)
    setDragOverId(null)
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDragOverId(null)
  }

  return (
    <>
      <div className={viewMode === 'list' ? 'goals-mini-list' : 'goals-mini-grid'}>
        {goals.map(goal => {
          let itemClass = 'goal-drag-item'
          if (draggedId === goal.id) itemClass += ' goal-drag-item--dragging'
          else if (dragOverId === goal.id) itemClass += ` goal-drag-item--drag-${dragOverSide}`
          return (
            <div
              key={goal.id}
              className={itemClass}
              draggable={!!onReorderGoals && renamingId !== goal.id}
              onDragStart={onReorderGoals && renamingId !== goal.id ? e => handleDragStart(e, goal.id) : undefined}
              onDragOver={onReorderGoals ? e => handleDragOver(e, goal.id) : undefined}
              onDrop={onReorderGoals ? e => handleDrop(e, goal.id) : undefined}
              onDragEnd={handleDragEnd}
              onContextMenu={e => openContextMenu(e, goal.id)}
            >
              {renamingId === goal.id ? (
                <div className="goal-rename-inline">
                  <input
                    ref={renameInputRef}
                    className="goal-rename-input"
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(goal.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitRename(goal.id)
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                  />
                  <p className="goal-rename-hint">Enter to save · Esc to cancel</p>
                </div>
              ) : (
                <GoalMiniCard
                  goal={goal}
                  isSelected={selectedGoalIds.includes(goal.id)}
                  onClick={(e) => onSelectGoal(goal.id, e.metaKey || e.ctrlKey)}
                  onAddGwGoal={onGoToGoalAddGw}
                  viewMode={viewMode}
                  gwGoals={gwGoals}
                  profileBirthday={profileBirthday}
                />
              )}
            </div>
          )
        })}
      </div>
      {contextMenu && (() => {
        const goal = goals.find(p => p.id === contextMenu.goalId)
        if (!goal) return null
        return (
          <div
            ref={menuRef}
            className="card-context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button className="card-context-menu-item" onClick={() => { closeContextMenu(); onGoToGoalEdit(goal.id) }}>Edit</button>
            <button className="card-context-menu-item" onClick={() => startRename(goal.id, goal.goalName)}>Rename</button>
            <button className="card-context-menu-item" onClick={() => { closeContextMenu(); onGoToGoal(goal.id) }}>Go to Goal</button>
            <button className="card-context-menu-item" onClick={() => { closeContextMenu(); onCopyGoal(goal) }}>Duplicate</button>
            <button className="card-context-menu-item card-context-menu-item--danger" onClick={() => { closeContextMenu(); onDeleteGoal(goal.id) }}>Delete</button>
          </div>
        )
      })()}
    </>
  )
}

export default GoalsMiniGrid

