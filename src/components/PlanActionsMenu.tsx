import { FC, useRef, useEffect, useState } from 'react'
import '../styles/PlanActionsMenu.css'

interface PlanActionsMenuProps {
  onEdit?: () => void
  onRename?: () => void
  onGoToPlan?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
}

const PlanActionsMenu: FC<PlanActionsMenuProps> = ({ onEdit, onRename, onGoToPlan, onDuplicate, onDelete }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const run = (fn?: () => void) => { setOpen(false); fn?.() }

  return (
    <div className="plan-actions-menu" ref={ref}>
      <button
        className="plan-actions-menu-trigger"
        onClick={() => setOpen(v => !v)}
        aria-label="Plan actions"
        aria-expanded={open}
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="3" cy="8" r="1.5"/>
          <circle cx="8" cy="8" r="1.5"/>
          <circle cx="13" cy="8" r="1.5"/>
        </svg>
      </button>
      {open && (
        <div className="plan-actions-menu-dropdown">
          {onEdit && <button className="plan-actions-menu-item" onClick={() => run(onEdit)}>Edit</button>}
          {onRename && <button className="plan-actions-menu-item" onClick={() => run(onRename)}>Rename</button>}
          {onGoToPlan && <button className="plan-actions-menu-item" onClick={() => run(onGoToPlan)}>Go to Plan</button>}
          {onDuplicate && <button className="plan-actions-menu-item" onClick={() => run(onDuplicate)}>Duplicate</button>}
          {onDelete && <button className="plan-actions-menu-item plan-actions-menu-item--danger" onClick={() => run(onDelete)}>Delete</button>}
        </div>
      )}
    </div>
  )
}

export default PlanActionsMenu
