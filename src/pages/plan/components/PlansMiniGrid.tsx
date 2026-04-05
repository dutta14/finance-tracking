import { FC, useState } from 'react'
import { FinancialPlan } from '../../../types'
import PlanMiniCard from '../../../components/PlanMiniCard'

interface PlansMiniGridProps {
  plans: FinancialPlan[]
  selectedPlanIds: number[]
  onSelectPlan: (planId: number, multi: boolean) => void
  viewMode?: 'grid' | 'list'
  onReorderPlans?: (orderedIds: number[]) => void
}

const PlansMiniGrid: FC<PlansMiniGridProps> = ({ plans, selectedPlanIds, onSelectPlan, viewMode = 'grid', onReorderPlans }) => {
  const [draggedId, setDraggedId] = useState<number | null>(null)
  const [dragOverId, setDragOverId] = useState<number | null>(null)
  const [dragOverSide, setDragOverSide] = useState<'before' | 'after'>('after')

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
    <div className={viewMode === 'list' ? 'plans-mini-list' : 'plans-mini-grid'}>
      {plans.map(plan => {
        let itemClass = 'plan-drag-item'
        if (draggedId === plan.id) itemClass += ' plan-drag-item--dragging'
        else if (dragOverId === plan.id) itemClass += ` plan-drag-item--drag-${dragOverSide}`
        return (
          <div
            key={plan.id}
            className={itemClass}
            draggable={!!onReorderPlans}
            onDragStart={onReorderPlans ? e => handleDragStart(e, plan.id) : undefined}
            onDragOver={onReorderPlans ? e => handleDragOver(e, plan.id) : undefined}
            onDrop={onReorderPlans ? e => handleDrop(e, plan.id) : undefined}
            onDragEnd={handleDragEnd}
          >
            <PlanMiniCard
              plan={plan}
              isSelected={selectedPlanIds.includes(plan.id)}
              onClick={(e) => onSelectPlan(plan.id, e.metaKey || e.ctrlKey)}
              viewMode={viewMode}
            />
          </div>
        )
      })}
    </div>
  )
}

export default PlansMiniGrid

