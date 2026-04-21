import { FC, useState, lazy, Suspense } from 'react'
import { NavLink, useLocation, useNavigate, Routes, Route } from 'react-router-dom'
import { FinancialGoal, GwGoal } from '../../types'
import GoalFormModal from './components/GoalFormModal'
import GoalsSection from './components/GoalsSection'
import GoalMixer from './components/GoalMixer'
import GoalDetail from './components/GoalDetail'
import { useFormData } from './hooks/useFormData'
import { useEditingState } from './hooks/useEditingState'
import NewGoalButton from './components/NewGoalButton'

const FICalculator = lazy(() => import('../tools/components/FICalculator'))

interface GoalProps {
  goals: FinancialGoal[]
  profileBirthday: string
  onOpenProfile: () => void
  createGoal: (goal: FinancialGoal) => void
  updateGoal: (goalId: number, goal: FinancialGoal) => void
  deleteGoal: (goalId: number) => void
  onDeleteMultipleGoals: (ids: number[]) => void
  reorderGoals: (orderedIds: number[]) => void
  selectedGoalIds: number[]
  onSetSelectedGoalIds: (ids: number[]) => void
  onCopyGwGoals: (sourcePlanId: number, newPlanId: number) => void
  gwGoals: GwGoal[]
  onCreateGwGoal: (goal: Omit<GwGoal, 'id' | 'createdAt'>) => void
  onUpdateGwGoal: (id: number, updates: Partial<Omit<GwGoal, 'id' | 'createdAt' | 'fiGoalId'>>) => void
  onDeleteGwGoal: (id: number) => void
}

const Goal: FC<GoalProps> = ({ goals, profileBirthday, onOpenProfile, createGoal, updateGoal, deleteGoal, onDeleteMultipleGoals, reorderGoals, selectedGoalIds, onSetSelectedGoalIds, onCopyGwGoals, gwGoals, onCreateGwGoal, onUpdateGwGoal, onDeleteGwGoal }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const subPath = location.pathname.replace('/goal', '').replace(/^\//, '') || 'plans'
  const isDetailView = /^\d+$/.test(subPath)
  const activeTab = isDetailView ? 'plans' : subPath
  const { formData, setFormData, error, setError, handleInputChange, populateFromGoal, resetForm } = useFormData()
  const { editingGoalId, stopEditing } = useEditingState()
  const [showForm, setShowForm] = useState(false)
  const [copySourceGoalId, setCopySourceGoalId] = useState<number | null>(null)
  const [mixerOpen, setMixerOpen] = useState(false)

  const handleSelectGoal = (goalId: number, multi: boolean): void => {
    if (multi) {
      // Cmd+Click: toggle multi-select for compare
      onSetSelectedGoalIds(
        selectedGoalIds.includes(goalId)
          ? selectedGoalIds.filter(id => id !== goalId)
          : [...selectedGoalIds, goalId]
      )
    } else {
      // Single click: navigate to detail page
      navigate(`/goal/${goalId}`)
    }
  }

  const handleDeleteMultiple = (ids: number[]): void => {
    onDeleteMultipleGoals(ids)
    onSetSelectedGoalIds([])
  }

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
    onSetSelectedGoalIds([])
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
              {activeTab === 'plans' && (
                <div className="goal-header-actions">
                  {goals.length > 0 && gwGoals.length > 0 && (
                    <button
                      className="goal-action-btn"
                      onClick={() => setMixerOpen(true)}
                      title="Mix & Match goals"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                        <path d="M2 4h5l2 8h5M2 12h5l2-8h5"/>
                        <circle cx="2" cy="4" r="1" fill="currentColor" stroke="none"/>
                        <circle cx="2" cy="12" r="1" fill="currentColor" stroke="none"/>
                        <circle cx="14" cy="4" r="1" fill="currentColor" stroke="none"/>
                        <circle cx="14" cy="12" r="1" fill="currentColor" stroke="none"/>
                      </svg>
                      Mix &amp; Match
                    </button>
                  )}
                  <NewGoalButton
                    onClick={() => {
                      resetForm()
                      stopEditing()
                      setShowForm(true)
                    }}
                  />
                </div>
              )}
            </div>

            <nav className="goal-tab-bar" aria-label="Goals sections">
              <NavLink to="/goal" end className={({ isActive }) => `goal-tab${isActive || activeTab === 'plans' ? ' active' : ''}`}>Plans</NavLink>
              <NavLink to="/goal/calculator" className={({ isActive }) => `goal-tab${isActive ? ' active' : ''}`}>Calculator</NavLink>
            </nav>
          </>
        )}

        <Routes>
          <Route index element={
            <>
              <div className="goal-container">
                <GoalsSection
                  goals={goals}
                  profileBirthday={profileBirthday}
                  gwGoals={gwGoals}
                  selectedGoalIds={selectedGoalIds}
                  onSelectGoal={handleSelectGoal}
                  onUpdateGoal={updateGoal}
                  onCopyGoal={handleCopyGoal}
                  onDeleteGoal={deleteGoal}
                  onDeleteMultiple={handleDeleteMultiple}
                  onClearSelection={() => onSetSelectedGoalIds([])}
                  onReorderGoals={reorderGoals}
                  onRenameGoal={handleRenameGoal}
                  onCreateGwGoal={onCreateGwGoal}
                  onUpdateGwGoal={onUpdateGwGoal}
                  onDeleteGwGoal={onDeleteGwGoal}
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
                  onSetFormFields={(fields) => setFormData(prev => ({ ...prev, ...fields }))}
                  onSubmit={handleCreateGoal}
                  onCancel={handleCancelEdit}
                  setError={setError}
                />
              )}
              {mixerOpen && (
                <GoalMixer
                  goals={goals}
                  gwGoals={gwGoals}
                  profileBirthday={profileBirthday}
                  onCreateGoal={createGoal}
                  onCreateGwGoal={onCreateGwGoal}
                  onClose={() => setMixerOpen(false)}
                  onGoToGoal={(goalId) => onSetSelectedGoalIds([goalId])}
                />
              )}
            </>
          } />
          <Route path="calculator" element={
            <Suspense fallback={<div className="goal-tab-loading" role="status">Loading…</div>}>
              <FICalculator />
            </Suspense>
          } />
          <Route path=":id" element={
            <GoalDetail
              goals={goals}
              profileBirthday={profileBirthday}
              gwGoals={gwGoals}
              onUpdateGoal={updateGoal}
              onCopyGoal={handleCopyGoal}
              onDeleteGoal={deleteGoal}
              onRenameGoal={handleRenameGoal}
              onCreateGwGoal={onCreateGwGoal}
              onUpdateGwGoal={onUpdateGwGoal}
              onDeleteGwGoal={onDeleteGwGoal}
            />
          } />
        </Routes>
      </div>
    </section>
  )
}

export default Goal

