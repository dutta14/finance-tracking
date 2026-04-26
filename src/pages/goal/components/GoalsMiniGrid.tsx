import { FC, useState, useEffect, useRef, useCallback } from 'react'
import { FinancialGoal, GwGoal } from '../../../types'
import { useTouchDrag } from '../../../hooks/useTouchDrag'
import GoalMiniCard from './GoalMiniCard'

interface ContextMenuState {
  x: number
  y: number
  goalId: number
}

interface GoalsMiniGridProps {
  goals: FinancialGoal[]
  selectedGoalIds: number[]
  onSelectGoal: (goalId: number, multi: boolean) => void
  viewMode?: 'grid' | 'list'
  compareMode?: boolean
  onReorderGoals?: (orderedIds: number[]) => void
  onRenameGoal: (goalId: number, name: string) => void
  onCopyGoal: (goal: FinancialGoal) => void
  onDeleteGoal: (goalId: number) => void
  gwGoals: GwGoal[]
  profileBirthday: string
}

const GoalsMiniGrid: FC<GoalsMiniGridProps> = ({
  goals,
  selectedGoalIds,
  onSelectGoal,
  viewMode = 'grid',
  compareMode = false,
  onReorderGoals,
  onRenameGoal,
  onCopyGoal,
  onDeleteGoal,
  gwGoals,
  profileBirthday,
}) => {
  const [draggedId, setDraggedId] = useState<number | null>(null)
  const [dragOverId, setDragOverId] = useState<number | null>(null)
  const [dragOverSide, setDragOverSide] = useState<'before' | 'after'>('after')
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const touchMovedFlag = useRef(false)

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
    if (touchMovedFlag.current) {
      touchMovedFlag.current = false
      return
    }
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

  /* ── Desktop HTML5 drag ── */
  const handleDragStart = (e: React.DragEvent, id: number) => {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, id: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (id === draggedId) {
      setDragOverId(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const side: 'before' | 'after' =
      viewMode === 'list'
        ? e.clientY < rect.top + rect.height / 2
          ? 'before'
          : 'after'
        : e.clientX < rect.left + rect.width / 2
          ? 'before'
          : 'after'
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
    const draggedGoal = goals.find(g => g.id === draggedId)
    const targetGoal = goals.find(g => g.id === targetId)
    if (draggedGoal && targetGoal) {
      setAnnouncement(`${draggedGoal.goalName} moved ${dragOverSide} ${targetGoal.goalName}`)
    }
    setDraggedId(null)
    setDragOverId(null)
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDragOverId(null)
  }

  /* ── Touch drag via hook ── */
  const touchDraggedId = useRef<number | null>(null)
  const touchTargetId = useRef<number | null>(null)
  const touchTargetSide = useRef<'before' | 'after'>('after')

  const getGoalIdFromPoint = useCallback(
    (x: number, y: number): number | null => {
      const el = document.elementFromPoint(x, y)
      if (!el || !gridRef.current) return null
      const item = (el as HTMLElement).closest?.('.goal-drag-item') as HTMLElement | null
      if (!item) return null
      const items = Array.from(gridRef.current.querySelectorAll('.goal-drag-item'))
      const idx = items.indexOf(item)
      return idx >= 0 && idx < goals.length ? goals[idx].id : null
    },
    [goals],
  )

  const touchDrag = useTouchDrag({
    longPressMs: 300,
    onDragStart: idx => {
      if (idx >= 0 && idx < goals.length) {
        const id = goals[idx].id
        touchDraggedId.current = id
        setDraggedId(id)
      }
    },
    onDragMove: (cx, cy) => {
      const targetGoalId = getGoalIdFromPoint(cx, cy)
      if (targetGoalId === null || targetGoalId === touchDraggedId.current) {
        setDragOverId(null)
        return
      }
      // Determine before/after using bounding rect
      const items = gridRef.current?.querySelectorAll('.goal-drag-item')
      if (!items) return
      const goalIdx = goals.findIndex(g => g.id === targetGoalId)
      if (goalIdx < 0 || goalIdx >= items.length) return
      const rect = items[goalIdx].getBoundingClientRect()
      const side: 'before' | 'after' =
        viewMode === 'list'
          ? cy < rect.top + rect.height / 2
            ? 'before'
            : 'after'
          : cx < rect.left + rect.width / 2
            ? 'before'
            : 'after'
      setDragOverId(targetGoalId)
      setDragOverSide(side)
      touchTargetId.current = targetGoalId
      touchTargetSide.current = side
    },
    onDragEnd: () => {
      touchMovedFlag.current = true
      const dId = touchDraggedId.current
      const tId = touchTargetId.current
      if (dId !== null && tId !== null && dId !== tId && onReorderGoals) {
        const ids = goals.map(p => p.id)
        const withoutDragged = ids.filter(id => id !== dId)
        const targetIdx = withoutDragged.indexOf(tId)
        const insertIdx = touchTargetSide.current === 'before' ? targetIdx : targetIdx + 1
        withoutDragged.splice(insertIdx, 0, dId)
        onReorderGoals(withoutDragged)
        const draggedGoal = goals.find(g => g.id === dId)
        const targetGoal = goals.find(g => g.id === tId)
        if (draggedGoal && targetGoal) {
          setAnnouncement(`${draggedGoal.goalName} moved ${touchTargetSide.current} ${targetGoal.goalName}`)
        }
      }
      touchDraggedId.current = null
      touchTargetId.current = null
      setDraggedId(null)
      setDragOverId(null)
    },
    getSlotFromPoint: (x, y) => {
      const id = getGoalIdFromPoint(x, y)
      if (id === null) return null
      return goals.findIndex(g => g.id === id)
    },
  })

  /* ── Mobile move buttons ── */
  const moveGoal = useCallback(
    (goalIdx: number, direction: -1 | 1) => {
      if (!onReorderGoals) return
      const target = goalIdx + direction
      if (target < 0 || target >= goals.length) return
      const ids = goals.map(g => g.id)
      const [removed] = ids.splice(goalIdx, 1)
      ids.splice(target, 0, removed)
      onReorderGoals(ids)
      const movedGoal = goals[goalIdx]
      const neighborGoal = goals[target]
      if (movedGoal && neighborGoal) {
        const relation =
          direction < 0 ? (viewMode === 'list' ? 'before' : 'before') : viewMode === 'list' ? 'after' : 'after'
        setAnnouncement(`${movedGoal.goalName} moved ${relation} ${neighborGoal.goalName}`)
      }
    },
    [goals, onReorderGoals, viewMode],
  )

  const isHorizontal = viewMode === 'grid'
  const prevLabel = isHorizontal ? '←' : '↑'
  const nextLabel = isHorizontal ? '→' : '↓'
  const prevDir = isHorizontal ? 'left' : 'up'
  const nextDir = isHorizontal ? 'right' : 'down'

  return (
    <>
      <div
        ref={gridRef}
        className={viewMode === 'list' ? 'goals-mini-list' : 'goals-mini-grid'}
        role={compareMode ? 'group' : undefined}
        aria-label={compareMode ? 'Select goals for comparison' : undefined}
      >
        {goals.map((goal, goalIdx) => {
          let itemClass = 'goal-drag-item'
          if (draggedId === goal.id) itemClass += ' goal-drag-item--dragging'
          else if (dragOverId === goal.id) itemClass += ` goal-drag-item--drag-${dragOverSide}`
          if (touchDrag.isDragging && touchDraggedId.current === goal.id) itemClass += ' goal-drag-item--touch-dragging'
          if (touchDrag.isLongPressing && touchDrag.dragIdx === goalIdx) itemClass += ' goal-drag-item--long-press'
          const canDrag = !!onReorderGoals && renamingId !== goal.id
          const touchHandlers = canDrag ? touchDrag.getTouchHandlers(goalIdx) : undefined
          return (
            <div
              key={goal.id}
              className={itemClass}
              draggable={canDrag}
              onDragStart={canDrag ? e => handleDragStart(e, goal.id) : undefined}
              onDragOver={onReorderGoals ? e => handleDragOver(e, goal.id) : undefined}
              onDrop={onReorderGoals ? e => handleDrop(e, goal.id) : undefined}
              onDragEnd={handleDragEnd}
              onContextMenu={e => openContextMenu(e, goal.id)}
              onTouchStart={touchHandlers?.onTouchStart}
              onTouchMove={touchHandlers?.onTouchMove}
              onTouchEnd={touchHandlers?.onTouchEnd}
            >
              {onReorderGoals && renamingId !== goal.id && (
                <div className="reorder-touch-controls goal-reorder-touch-controls">
                  <button
                    className="reorder-move-btn"
                    disabled={goalIdx === 0}
                    onClick={() => moveGoal(goalIdx, -1)}
                    aria-label={`Move ${goal.goalName} ${prevDir}`}
                  >
                    {prevLabel}
                  </button>
                  <button
                    className="reorder-move-btn"
                    disabled={goalIdx === goals.length - 1}
                    onClick={() => moveGoal(goalIdx, 1)}
                    aria-label={`Move ${goal.goalName} ${nextDir}`}
                  >
                    {nextLabel}
                  </button>
                </div>
              )}
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
                  onClick={e => onSelectGoal(goal.id, e.metaKey || e.ctrlKey)}
                  viewMode={viewMode}
                  compareMode={compareMode}
                  gwGoals={gwGoals}
                  profileBirthday={profileBirthday}
                />
              )}
            </div>
          )
        })}
      </div>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      {contextMenu &&
        (() => {
          const goal = goals.find(p => p.id === contextMenu.goalId)
          if (!goal) return null
          return (
            <div ref={menuRef} className="card-context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
              <button
                className="card-context-menu-item"
                onClick={() => {
                  closeContextMenu()
                  onSelectGoal(goal.id, false)
                }}
              >
                Open
              </button>
              <button className="card-context-menu-item" onClick={() => startRename(goal.id, goal.goalName)}>
                Rename
              </button>
              <button
                className="card-context-menu-item"
                onClick={() => {
                  closeContextMenu()
                  onCopyGoal(goal)
                }}
              >
                Duplicate
              </button>
              <button
                className="card-context-menu-item card-context-menu-item--danger"
                onClick={() => {
                  closeContextMenu()
                  onDeleteGoal(goal.id)
                }}
              >
                Delete
              </button>
            </div>
          )
        })()}
    </>
  )
}

export default GoalsMiniGrid
