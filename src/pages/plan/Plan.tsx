import { FC } from 'react'
import { FinancialPlan } from '../../types'
import PlanForm from './components/PlanForm'
import PlansSection from './components/PlansSection'
import { useFinancialPlans } from './hooks/useFinancialPlans'
import { useFormData } from './hooks/useFormData'
import { useEditingState } from './hooks/useEditingState'
import '../Plan.css'

const Plan: FC = () => {
  const { plans, createPlan, updatePlan, deletePlan } = useFinancialPlans()
  const { formData, error, setError, handleInputChange, populateFromPlan, resetForm } = useFormData()
  const { selectedPlanId, editingPlanId, togglePlanSelection, startEditing, stopEditing } = useEditingState()

  const handleCreatePlan = (plan: FinancialPlan): void => {
    if (editingPlanId) {
      updatePlan(editingPlanId, plan)
      stopEditing()
    } else {
      createPlan(plan)
    }
    resetForm()
  }

  const handleEditPlan = (plan: FinancialPlan): void => {
    populateFromPlan(plan)
    startEditing(plan.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCopyPlan = (plan: FinancialPlan): void => {
    populateFromPlan(plan)
    stopEditing()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancelEdit = (): void => {
    resetForm()
    stopEditing()
  }

  const handleSelectPlan = (planId: number): void => {
    togglePlanSelection(planId)
  }

  return (
    <section className="plan">
      <div className="plan-header">
        <h1>Financial Planning</h1>
        <p>Model different financial scenarios and track your progress</p>
      </div>

      <div className="plan-content">
        <div className="plan-container">
          <div className="plan-layout">
            <PlanForm
              formData={formData}
              error={error}
              editingPlanId={editingPlanId}
              onInputChange={handleInputChange}
              onSubmit={handleCreatePlan}
              onCancel={handleCancelEdit}
              setError={setError}
            />

            <PlansSection
              plans={plans}
              selectedPlanId={selectedPlanId}
              onSelectPlan={handleSelectPlan}
              onEditPlan={handleEditPlan}
              onCopyPlan={handleCopyPlan}
              onDeletePlan={deletePlan}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

export default Plan
