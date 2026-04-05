import { FC, useState } from 'react'
import { FinancialPlan } from '../../types'
import PlanForm from './components/PlanForm'
import PlansSection from './components/PlansSection'
import { useFormData } from './hooks/useFormData'
import { useEditingState } from './hooks/useEditingState'
import NewPlanButton from './components/NewPlanButton'

interface PlanProps {
  plans: FinancialPlan[];
  createPlan: (plan: FinancialPlan) => void;
  updatePlan: (planId: number, plan: FinancialPlan) => void;
  deletePlan: (planId: number) => void;
  selectedPlanIds: number[];
  onSetSelectedPlanIds: (ids: number[]) => void;
  onGoToPlan: (planId: number) => void;
}

const Plan: FC<PlanProps> = ({ plans, createPlan, updatePlan, deletePlan, selectedPlanIds, onSetSelectedPlanIds, onGoToPlan }) => {
  const { formData, error, setError, handleInputChange, populateFromPlan, resetForm } = useFormData()
  const { editingPlanId, startEditing, stopEditing } = useEditingState()
  const [showForm, setShowForm] = useState(false)

  const handleSelectPlan = (planId: number, multi: boolean): void => {
    if (multi) {
      onSetSelectedPlanIds(
        selectedPlanIds.includes(planId)
          ? selectedPlanIds.filter(id => id !== planId)
          : [...selectedPlanIds, planId]
      );
    } else {
      onSetSelectedPlanIds(
        selectedPlanIds.length === 1 && selectedPlanIds[0] === planId ? [] : [planId]
      );
    }
  }

  const handleDeleteMultiple = (ids: number[]): void => {
    ids.forEach(id => deletePlan(id))
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

  const handleEditPlan = (plan: FinancialPlan): void => {
    onSetSelectedPlanIds([])
    populateFromPlan(plan)
    startEditing(plan.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCopyPlan = (plan: FinancialPlan): void => {
    onSetSelectedPlanIds([])
    populateFromPlan(plan)
    stopEditing()
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancelEdit = (): void => {
    resetForm()
    stopEditing()
    setShowForm(false)
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
            resetForm();
            stopEditing();
            setShowForm(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      </div>

      <div className="plan-content">
        <div className="plan-container">
          {showForm ? (
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
                selectedPlanIds={selectedPlanIds}
                onSelectPlan={handleSelectPlan}
                onEditPlan={handleEditPlan}
                onCopyPlan={handleCopyPlan}
                onDeletePlan={deletePlan}
                onDeleteMultiple={handleDeleteMultiple}
                onClearSelection={() => onSetSelectedPlanIds([])}
                onGoToPlan={onGoToPlan}
              />
            </div>
          ) : (
            <div style={{ width: '100%' }}>
              <PlansSection
                plans={plans}
                selectedPlanIds={selectedPlanIds}
                onSelectPlan={handleSelectPlan}
                onEditPlan={handleEditPlan}
                onCopyPlan={handleCopyPlan}
                onDeletePlan={deletePlan}
                onDeleteMultiple={handleDeleteMultiple}
                onClearSelection={() => onSetSelectedPlanIds([])}
                onGoToPlan={onGoToPlan}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default Plan
