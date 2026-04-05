import { FC, useEffect } from 'react'
import { FinancialPlan } from '../../../types'
import { FormData } from '../hooks/useFormData'
import PlanForm from './PlanForm'
import '../../../styles/PlanFormModal.css'

interface PlanFormModalProps {
  formData: FormData
  error: string
  editingPlanId: number | null
  profileBirthday: string
  onOpenProfile: () => void
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  onSubmit: (plan: FinancialPlan) => void
  onCancel: () => void
  setError: (error: string) => void
}

const PlanFormModal: FC<PlanFormModalProps> = (props) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onCancel()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [props.onCancel])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div className="plan-form-modal-backdrop" onClick={props.onCancel}>
      <div
        className="plan-form-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={props.editingPlanId ? 'Edit plan' : 'Create new plan'}
      >
        <PlanForm {...props} />
      </div>
    </div>
  )
}

export default PlanFormModal
