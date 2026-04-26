import { FC, useEffect, useState } from 'react'
import '../styles/UndoToast.css'

interface UndoToastProps {
  message: string
  onUndo: () => void
  onDismiss: () => void
  duration?: number
}

const UndoToast: FC<UndoToastProps> = ({ message, onUndo, onDismiss, duration = 10000 }) => {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className={`undo-toast${visible ? ' undo-toast--visible' : ''}`}>
      <span className="undo-toast-message">{message}</span>
      <button className="undo-toast-undo" onClick={onUndo}>
        Undo
      </button>
      <button className="undo-toast-close" onClick={onDismiss} aria-label="Dismiss">
        ✕
      </button>
      <div className="undo-toast-progress">
        <div className="undo-toast-progress-bar" style={{ animationDuration: `${duration}ms` }} />
      </div>
    </div>
  )
}

export default UndoToast
