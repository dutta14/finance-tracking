import { FC, useEffect, useRef } from 'react'
import { FinancialGoal } from '../../../types'
import { FormData } from '../hooks/useFormData'
import GoalForm from './GoalForm'
import { useFocusTrap } from '../../../hooks/useFocusTrap'
import '../../../styles/GoalFormModal.css'

interface GoalFormModalProps {
  formData: FormData
  error: string
  editingGoalId: number | null
  profileBirthday: string
  onOpenProfile: () => void
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  onSetFormFields: (fields: Partial<FormData>) => void
  onSubmit: (goal: FinancialGoal) => void
  onCancel: () => void
  setError: (error: string) => void
}

const GoalFormModal: FC<GoalFormModalProps> = props => {
  const { onCancel, editingGoalId } = props
  const modalRef = useRef<HTMLDivElement>(null)
  useFocusTrap(modalRef, true)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onCancel])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  return (
    <div className="goal-form-modal-backdrop">
      <div
        ref={modalRef}
        className="goal-form-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={editingGoalId ? 'Edit goal' : 'Create new goal'}
      >
        <GoalForm {...props} />
      </div>
    </div>
  )
}

export default GoalFormModal
