import { FC, useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import '../../../styles/GoalActionsMenu.css'

interface GoalActionsMenuProps {
  onEdit?: () => void
  onRename?: () => void
  onGoToGoal?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
}

const GoalActionsMenu: FC<GoalActionsMenuProps> = ({ onEdit, onRename, onGoToGoal, onDuplicate, onDelete }) => {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t)) return
      if (dropdownRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleToggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.right })
    }
    setOpen(v => !v)
  }

  const run = (fn?: () => void) => {
    setOpen(false)
    fn?.()
  }

  return (
    <div className="goal-actions-menu">
      <button
        ref={triggerRef}
        className="goal-actions-menu-trigger"
        onClick={handleToggle}
        aria-label="Goal actions"
        aria-expanded={open}
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="3" cy="8" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="13" cy="8" r="1.5" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            className="goal-actions-menu-dropdown goal-actions-menu-dropdown--portal"
            style={{ position: 'fixed', top: pos.top, left: pos.left, transform: 'translateX(-100%)' }}
          >
            {onEdit && (
              <button className="goal-actions-menu-item" onClick={() => run(onEdit)}>
                Edit
              </button>
            )}
            {onRename && (
              <button className="goal-actions-menu-item" onClick={() => run(onRename)}>
                Rename
              </button>
            )}
            {onGoToGoal && (
              <button className="goal-actions-menu-item" onClick={() => run(onGoToGoal)}>
                Go to Goal
              </button>
            )}
            {onDuplicate && (
              <button className="goal-actions-menu-item" onClick={() => run(onDuplicate)}>
                Duplicate
              </button>
            )}
            {onDelete && (
              <button className="goal-actions-menu-item goal-actions-menu-item--danger" onClick={() => run(onDelete)}>
                Delete
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}

export default GoalActionsMenu
