import { FC, useState } from 'react'
import { FinancialPlan, GwPlan } from '../../types'
import PlanFormModal from './components/PlanFormModal'
import PlansSection from './components/PlansSection'
import PlanMixer from './components/PlanMixer'
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
  onCopyGwGoals: (sourcePlanId: number, newPlanId: number) => void
  gwPlans: GwPlan[]
  onCreateGwPlan: (plan: Omit<GwPlan, 'id' | 'createdAt'>) => void
}

const Plan: FC<PlanProps> = ({ plans, profileBirthday, onOpenProfile, createPlan, updatePlan, deletePlan, onDeleteMultiplePlans, reorderPlans, selectedPlanIds, onSetSelectedPlanIds, onGoToPlan, onGoToPlanEdit, onCopyGwGoals, gwPlans, onCreateGwPlan }) => {
  const { formData, error, setError, handleInputChange, populateFromPlan, resetForm } = useFormData()
  const { editingPlanId, stopEditing } = useEditingState()
  const [showForm, setShowForm] = useState(false)
  const [copySourcePlanId, setCopySourcePlanId] = useState<number | null>(null)
  const [mixerOpen, setMixerOpen] = useState(false)

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
      if (copySourcePlanId !== null) {
        onCopyGwGoals(copySourcePlanId, plan.id)
        setCopySourcePlanId(null)
      }
    }
    resetForm()
    setShowForm(false)
  }

  const handleCopyPlan = (plan: FinancialPlan): void => {
    onSetSelectedPlanIds([])
    setCopySourcePlanId(plan.id)
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
    setCopySourcePlanId(null)
    setShowForm(false)
  }

  return (
    <section className="plan">
      <div className="plan-header">
        <h1>Plans</h1>
        <p>Model different financial scenarios</p>
      </div>
      <div className="plan-new-btn-row" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', margin: '0 24px 1.2rem 0' }}>
        {plans.length > 0 && gwPlans.length > 0 && (
          <button
            className="btn-create btn-small"
            style={{ width: '130px', fontSize: '0.92rem', padding: '0.35rem 0', borderRadius: 4, fontWeight: 500, boxShadow: 'none', cursor: 'pointer', textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
            onClick={() => setMixerOpen(true)}
            title="Mix & Match plans"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M2 4h5l2 8h5M2 12h5l2-8h5"/>
              <circle cx="2" cy="4" r="1" fill="currentColor" stroke="none"/>
              <circle cx="2" cy="12" r="1" fill="currentColor" stroke="none"/>
              <circle cx="14" cy="4" r="1" fill="currentColor" stroke="none"/>
              <circle cx="14" cy="12" r="1" fill="currentColor" stroke="none"/>
            </svg>
            Mix &amp; Match
          </button>
        )}
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
            gwPlans={gwPlans}
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
      {mixerOpen && (
        <PlanMixer
          plans={plans}
          gwPlans={gwPlans}
          profileBirthday={profileBirthday}
          onCreatePlan={createPlan}
          onCreateGwPlan={onCreateGwPlan}
          onClose={() => setMixerOpen(false)}
          onGoToPlan={onGoToPlan}
        />
      )}
    </section>
  )
}

export default Plan

