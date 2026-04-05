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
  onGoToPlanEdit: (planId: number) => void
}

const Plan: FC<PlanProps> = ({ plans, profileBirthday, onOpenProfile, createPlan, updatePlan, deletePlan, onDeleteMultiplePlans, reorderPlans, selectedPlanIds, onSetSelectedPlanIds, onGoToPlan, onGoToPlanEdit }) => {
  const { formData, error, setError, handleInputChange, populateFromPlan, resetForm } = useFormData()
  const { editingPlanId, stopEditing } = useEditingState()
  const [showForm, setShowForm] = useState(false)

  const handleSelectPlan = (planId: number, multi: boolean): void => {
    if (multi) {
      onSetSelectedPlanIds(
        selectedPlanIds.includes(planId)
          ? selectedPlanIds.filter(id => id !== planId)
          : [...selectedPlanIds, planId]
      )
    } else {
      onSetSelectedPlanIds(
        selectedPlanIds.length === 1 && selectedPlanIds[0] === planId ? [] : [planId]
      )
    }
  }

  const handleDeleteMultiple = (ids: number[]): void => {
    onDeleteMultiplePlans(ids)
    onSetSelectedPlanIds([])
  }

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

  const handleCopyPlan = (plan: FinancialPlan): void => {
    onSetSelectedPlanIds([])
    populateFromPlan(plan, '- Duplicate')
    stopEditing()
    setShowForm(true)
  }

  const handleRenamePlan = (planId: number, name: string): void => {
    const plan = plans.find(p => p.id === planId)
    if (plan) updatePlan(planId, { ...plan, planName: name })
  }

  const handleCancelEdit = (): void => {
    resetForm()
    stopEditing()
    setShowForm(false)
  }

  return (
    <section className="plan">
      <div className="plan-header">
        <h1>Plans</h1>
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
            onUpdatePlan={updatePlan}
            onCopyPlan={handleCopyPlan}
            onDeletePlan={deletePlan}
            onDeleteMultiple={handleDeleteMultiple}
            onClearSelection={() => onSetSelectedPlanIds([])}
            onGoToPlan={onGoToPlan}
            onGoToPlanEdit={onGoToPlanEdit}
            onReorderPlans={reorderPlans}
            onRenamePlan={handleRenamePlan}
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

