import { FC, useState } from 'react'
import { FinancialPlan } from '../../types'
import PlanFormModal from './components/PlanFormModal'
import PlansSection from './components/PlansSection'
import { useFormData } from './hooks/useFormData'
import { useEditingState } from './hooks/useEditingState'
import NewPlanButton from './components/NewPlanButton'

interface PlanProps {
  plans: FinancialPlan[]
  profileBirthday: string
  onOpenProfile: () => void
  createPlan: (plan: FinancialPlan) => void
  updatePlan: (planId: number, plan: FinancialPlan) => void
  deletePlan: (planId: number) => void
  onDeleteMultiplePlans: (ids: number[]) => void
  reorderPlans: (orderedIds: number[]) => void
  selectedPlanIds: number[]
  onSetSelectedPlanIds: (ids: number[]) => void
  onGoToPlan: (planId: number) => void
}

const Plan: FC<PlanProps> = ({
  plans,
  profileBirthday,
  onOpenProfile,
  createPlan,
  updatePlan,
  deletePlan,
  reorderPlans,
  selectedPlanIds,
  onSetSelectedPlanIds,
  onGoToPlan,
}) => {
  const { formData, error, setError, handleInputChange, populateFromPlan, resetForm } = useFormData()
  const { editingPlanId, startEditing, stopEditing } = useEditingState()
  const [showForm, setShowForm] = useState(false)

  const handleCreatePlan = (plan: FinancialPlan): void => {
    if (editingPlanId) {
      updatePlan(editingPlanId, plan)
      stopEditing()
    } else {
      createPlan(plan)
    }
    resetForm()
    setShowForm(false)
  }

  const handleEditPlan = (plan: FinancialPlan): void => {
    populateFromPlan(plan)
    startEditing(plan.id)
    setShowForm(true)
  }

  const handleCopyPlan = (plan: FinancialPlan): void => {
    populateFromPlan(plan, '(Copy)')
    stopEditing()
    setShowForm(true)
  }

  const handleCancelEdit = (): void => {
    resetForm()
    stopEditing()
    setShowForm(false)
  }

  const handleSelectPlan = (planId: number, multi: boolean): void => {
    if (multi) {
      onSetSelectedPlanIds(
        selectedPlanIds.includes(planId)
          ? selectedPlanIds.filter(id => id !== planId)
          : [...selectedPlanIds, planId]
      )
    } else {
      onSetSelectedPlanIds(selectedPlanIds.includes(planId) ? [] : [planId])
    }
  }

  return (
    <section className="plan">
      <div className="plan-header">
        <h1>Plan</h1>
        <p>Model different financial scenarios</p>
      </div>
      <div className="plan-new-btn-row" style={{ display: 'flex', justifyContent: 'flex-end', margin: '0 24px 1.2rem 0' }}>
        <NewPlanButton
          onClick={() => {
            resetForm()
            stopEditing()
            setShowForm(true)
          }}
        />
      </div>

      <div className="plan-content">
        <div className="plan-container">
          <PlansSection
            plans={plans}
            profileBirthday={profileBirthday}
            selectedPlanIds={selectedPlanIds}
            onSelectPlan={handleSelectPlan}
            onGoToPlan={onGoToPlan}
            onEditPlan={handleEditPlan}
            onCopyPlan={handleCopyPlan}
            onDeletePlan={deletePlan}
            onUpdatePlan={updatePlan}
            onRenamePlan={(planId, name) => {
              const plan = plans.find(p => p.id === planId)
              if (plan) updatePlan(planId, { ...plan, planName: name })
            }}
            reorderPlans={reorderPlans}
          />
        </div>
      </div>

      {showForm && (
        <PlanFormModal
          formData={formData}
          error={error}
          editingPlanId={editingPlanId}
          profileBirthday={profileBirthday}
          onOpenProfile={onOpenProfile}
          onInputChange={handleInputChange}
          onSubmit={handleCreatePlan}
          onCancel={handleCancelEdit}
          setError={setError}
        />
      )}
    </section>
  )
}

export default Plan

