import { FC, useState, useEffect, useRef } from 'react'
import { FinancialPlan } from '../../../types'
import PlanMiniCard from '../../../components/PlanMiniCard'

interface ContextMenuState { x: number; y: number; planId: number }

interface PlansMiniGridProps {
  plans: FinancialPlan[]
  selectedPlanIds: number[]
  onSelectPlan: (planId: number, multi: boolean) => void
  viewMode?: 'grid' | 'list'
  onReorderPlans?: (orderedIds: number[]) => void
  onGoToPlan: (planId: number) => void
  onRenamePlan: (planId: number, name: string) => void
  onCopyPlan: (plan: FinancialPlan) => void
  onDeletePlan: (planId: number) => void
}

const PlansMiniGrid: FC<PlansMiniGridProps> = ({
  plans, selectedPlanIds, onSelectPlan, viewMode = 'grid', onReorderPlans,
  onGoToPlan, onRenamePlan, onCopyPlan, onDeletePlan,
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

  const openContextMenu = (e: React.MouseEvent, planId: number) => {
    e.preventDefault()
    e.stopPropagation()
    const menuWidth = 160
    const menuHeight = 220
    const x = e.clientX + menuWidth > window.innerWidth ? e.clientX - menuWidth : e.clientX
    const y = e.clientY + menuHeight > window.innerHeight ? e.clientY - menuHeight : e.clientY
    setContextMenu({ x, y, planId })
  }

  const closeContextMenu = () => setContextMenu(null)

  const startRename = (planId: number, name: string) => {
    closeContextMenu()
    setRenamingId(planId)
    setRenameValue(name)
  }

  const commitRename = (planId: number) => {
    if (renameValue.trim()) onRenamePlan(planId, renameValue.trim())
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
    if (draggedId === null || draggedId === targetId || !onReorderPlans) return
    const ids = plans.map(p => p.id)
    const withoutDragged = ids.filter(id => id !== draggedId)
    const targetIdx = withoutDragged.indexOf(targetId)
    const insertIdx = dragOverSide === 'before' ? targetIdx : targetIdx + 1
    withoutDragged.splice(insertIdx, 0, draggedId)
    onReorderPlans(withoutDragged)
    setDraggedId(null)
    setDragOverId(null)
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDragOverId(null)
  }

  return (
    <>
      <div className={viewMode === 'list' ? 'plans-mini-list' : 'plans-mini-grid'}>
        {plans.map(plan => {
          let itemClass = 'plan-drag-item'
          if (draggedId === plan.id) itemClass += ' plan-drag-item--dragging'
          else if (dragOverId === plan.id) itemClass += ` plan-drag-item--drag-${dragOverSide}`
          return (
            <div
              key={plan.id}
              className={itemClass}
              draggable={!!onReorderPlans && renamingId !== plan.id}
              onDragStart={onReorderPlans && renamingId !== plan.id ? e => handleDragStart(e, plan.id) : undefined}
              onDragOver={onReorderPlans ? e => handleDragOver(e, plan.id) : undefined}
              onDrop={onReorderPlans ? e => handleDrop(e, plan.id) : undefined}
              onDragEnd={handleDragEnd}
              onContextMenu={e => openContextMenu(e, plan.id)}
            >
              {renamingId === plan.id ? (
                <div className="plan-rename-inline">
                  <input
                    ref={renameInputRef}
                    className="plan-rename-input"
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(plan.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitRename(plan.id)
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                  />
                  <p className="plan-rename-hint">Enter to save · Esc to cancel</p>
                </div>
              ) : (
                <PlanMiniCard
                  plan={plan}
                  isSelected={selectedPlanIds.includes(plan.id)}
                  onClick={(e) => onSelectPlan(plan.id, e.metaKey || e.ctrlKey)}
                  viewMode={viewMode}
                />
              )}
            </div>
          )
        })}
      </div>
      {contextMenu && (() => {
        const plan = plans.find(p => p.id === contextMenu.planId)
        if (!plan) return null
        return (
          <div
            ref={menuRef}
            className="card-context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button className="card-context-menu-item" onClick={() => { closeContextMenu(); onSelectPlan(plan.id, false) }}>Edit</button>
            <button className="card-context-menu-item" onClick={() => startRename(plan.id, plan.planName)}>Rename</button>
            <button className="card-context-menu-item" onClick={() => { closeContextMenu(); onGoToPlan(plan.id) }}>Go to Plan</button>
            <button className="card-context-menu-item" onClick={() => { closeContextMenu(); onCopyPlan(plan) }}>Duplicate</button>
            <button className="card-context-menu-item card-context-menu-item--danger" onClick={() => { closeContextMenu(); onDeletePlan(plan.id) }}>Delete</button>
          </div>
        )
      })()}
    </>
  )
}

export default PlansMiniGrid

