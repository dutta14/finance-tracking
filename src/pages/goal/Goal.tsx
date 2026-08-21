import { FC, useState } from 'react'
import { NavLink, useLocation, useNavigate, Routes, Route, Navigate } from 'react-router-dom'
import { FinancialGoal } from '../../types'
import { useGoals } from '../../contexts/GoalsContext'
import { useLayout } from '../../contexts/LayoutContext'
import GoalFormModal from './components/GoalFormModal'
import GoalsSection from './components/GoalsSection'
import GoalMixer from './components/GoalMixer'
import GoalDetail from './components/GoalDetail'
import { useFormData } from './hooks/useFormData'
import { useEditingState } from './hooks/useEditingState'
import { useGrowthSettings } from '../../hooks/useGrowthSettings'
import GrowthSettingsPanel from '../../components/GrowthSettingsPanel'

import FICalculator from '../tools/components/FICalculator'
import LeverageGoal from './components/LeverageGoal'
import PayDown from './components/PayDown'

const Goal: FC = () => {
  const {
    visibleGoals: goals,
    gwGoals,
    profile,
    createGoal,
    updateGoal,
    handleDeleteGoal: deleteGoal,
    handleDeleteWithUndo: onDeleteMultipleGoals,
    reorderGoals,
    handleCopyGwGoals: onCopyGwGoals,
    createGwGoal: onCreateGwGoal,
    updateGwGoal: onUpdateGwGoal,
    deleteGwGoal: onDeleteGwGoal,
  } = useGoals()
  const { handleOpenProfile: onOpenProfile } = useLayout()
  const profileBirthday = profile.birthday
  const location = useLocation()
  const navigate = useNavigate()
  const growthCtx = useGrowthSettings()
  const subPath = location.pathname.replace('/goal', '').replace(/^\//, '') || 'plans'
  const isDetailView = /^\d+$/.test(subPath)
  const activeTab = isDetailView ? 'plans' : subPath
  const { formData, setFormData, error, setError, handleInputChange, populateFromGoal, resetForm } = useFormData()
  const { editingGoalId, stopEditing } = useEditingState()
  const [showForm, setShowForm] = useState(false)
  const [copySourceGoalId, setCopySourceGoalId] = useState<number | null>(null)
  const [mixerOpen, setMixerOpen] = useState(false)

  const handleCreateGoal = (goal: FinancialGoal): void => {
    if (editingGoalId) {
      updateGoal(editingGoalId, goal)
      stopEditing()
    } else {
      createGoal(goal)
      if (copySourceGoalId !== null) {
        onCopyGwGoals(copySourceGoalId, goal.id)
        setCopySourceGoalId(null)
      }
    }
    resetForm()
    setShowForm(false)
  }

  const handleCopyGoal = (goal: FinancialGoal): void => {
    setCopySourceGoalId(goal.id)
    populateFromGoal(goal, '- Duplicate')
    stopEditing()
    setShowForm(true)
  }

  const handleRenameGoal = (goalId: number, name: string): void => {
    const goal = goals.find(p => p.id === goalId)
    if (goal) updateGoal(goalId, { ...goal, goalName: name })
  }

  const handleCancelEdit = (): void => {
    resetForm()
    stopEditing()
    setCopySourceGoalId(null)
    setShowForm(false)
  }

  return (
    <section className="goal">
      <div className="goal-content">
        {!isDetailView && (
          <>
            <div className="goal-header">
              <h1>Goals</h1>
              <nav className="tab-bar" aria-label="Goals sections">
                <NavLink
                  to="/goal/plans"
                  className={({ isActive }) => `tab-btn${isActive || activeTab === 'plans' ? ' active' : ''}`}
                >
                  FIRE Plans
                </NavLink>
                <NavLink to="/goal/leverage" className={({ isActive }) => `tab-btn${isActive ? ' active' : ''}`}>
                  Leverage
                </NavLink>
                <NavLink to="/goal/paydown" className={({ isActive }) => `tab-btn${isActive ? ' active' : ''}`}>
                  Pay Down
                </NavLink>
                <NavLink to="/goal/calculator" className={({ isActive }) => `tab-btn${isActive ? ' active' : ''}`}>
                  FIRE Calculator
                </NavLink>
              </nav>
              {subPath === 'calculator' && (
                <div className="goal-header-actions">
                  <GrowthSettingsPanel settings={growthCtx.settings} onUpdate={growthCtx.updateSettings} />
                </div>
              )}
            </div>
          </>
        )}

        <Routes>
          <Route index element={<Navigate to="/goal/plans" replace />} />
          <Route
            path="plans"
            element={
              <>
                <div className="goal-container">
                  <GoalsSection
                    goals={goals}
                    profileBirthday={profileBirthday}
                    gwGoals={gwGoals}
                    growthSettings={growthCtx}
                    onUpdateGoal={updateGoal}
                    onCopyGoal={handleCopyGoal}
                    onDeleteGoal={deleteGoal}
                    onDeleteMultiple={onDeleteMultipleGoals}
                    onReorderGoals={reorderGoals}
                    onRenameGoal={handleRenameGoal}
                    onCreateGwGoal={onCreateGwGoal}
                    onUpdateGwGoal={onUpdateGwGoal}
                    onDeleteGwGoal={onDeleteGwGoal}
                    onMixMatch={() => setMixerOpen(true)}
                    onNewGoal={() => {
                      resetForm()
                      stopEditing()
                      setShowForm(true)
                    }}
                  />
                </div>

                {showForm && (
                  <GoalFormModal
                    formData={formData}
                    error={error}
                    editingGoalId={editingGoalId}
                    profileBirthday={profileBirthday}
                    onOpenProfile={onOpenProfile}
                    onInputChange={handleInputChange}
                    onSetFormFields={fields => setFormData(prev => ({ ...prev, ...fields }))}
                    onSubmit={handleCreateGoal}
                    onCancel={handleCancelEdit}
                    setError={setError}
                    inflation={growthCtx.settings.inflation}
                  />
                )}
                {mixerOpen && (
                  <GoalMixer
                    goals={goals}
                    gwGoals={gwGoals}
                    profileBirthday={profileBirthday}
                    inflation={growthCtx.settings.inflation}
                    onCreateGoal={createGoal}
                    onCreateGwGoal={onCreateGwGoal}
                    onClose={() => setMixerOpen(false)}
                    onGoToGoal={goalId => navigate(`/goal/${goalId}`)}
                  />
                )}
              </>
            }
          />
          <Route path="leverage" element={<LeverageGoal />} />
          <Route path="calculator" element={<FICalculator />} />
          <Route path="paydown" element={<PayDown />} />
          <Route
            path=":id"
            element={
              <GoalDetail
                goals={goals}
                profileBirthday={profileBirthday}
                partnerBirthday={profile.partner?.birthday || ''}
                gwGoals={gwGoals}
                growthSettings={growthCtx}
                onUpdateGoal={updateGoal}
                onCopyGoal={handleCopyGoal}
                onDeleteGoal={deleteGoal}
                onRenameGoal={handleRenameGoal}
                onCreateGwGoal={onCreateGwGoal}
                onUpdateGwGoal={onUpdateGwGoal}
                onDeleteGwGoal={onDeleteGwGoal}
              />
            }
          />
        </Routes>
      </div>
    </section>
  )
}

export default Goal
