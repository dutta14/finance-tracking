import { FC, useState, useEffect } from 'react'
import { NavLink, useLocation, useNavigate, Routes, Route, Navigate } from 'react-router-dom'
import { FinancialGoal } from '../../types'
import { useGoals } from '../../contexts/GoalsContext'
import { useLayout } from '../../contexts/LayoutContext'
import GoalFormModal from './components/GoalFormModal'
import GoalsSection from './components/GoalsSection'
import GoalMixer from './components/GoalMixer'
import GoalDetail from './components/GoalDetail'
import GoalActionsMenu from './components/GoalActionsMenu'
import { useFormData } from './hooks/useFormData'
import { useEditingState } from './hooks/useEditingState'
import { useGrowthSettings } from '../../hooks/useGrowthSettings'
import GrowthSettingsPanel from '../../components/GrowthSettingsPanel'
import MonthPicker from '../../components/MonthPicker'
import { useLeverageSettings } from '../../hooks/useLeverage'
import { useData } from '../../contexts/DataContext'

import FICalculator from '../tools/components/FICalculator'
import '../../styles/Goal.css'
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
  const { allMonths } = useData()
  const { settings: leverageSettings, setSettings: setLeverageSettings } = useLeverageSettings()
  const leverageStartMonth = leverageSettings.chartStart || allMonths[0] || ''
  const subPath = location.pathname.replace('/goal', '').replace(/^\//, '') || 'plans'
  const isDetailView = /^plans\/\d+$/.test(subPath)
  const activeTab = isDetailView ? 'plans' : subPath
  const { formData, setFormData, error, setError, handleInputChange, populateFromGoal, resetForm } = useFormData()
  const { editingGoalId, stopEditing } = useEditingState()
  const [showForm, setShowForm] = useState(false)
  const [copySourceGoalId, setCopySourceGoalId] = useState<number | null>(null)
  const [mixerOpen, setMixerOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Close drawer when leaving detail view
  useEffect(() => {
    if (!isDetailView) setDrawerOpen(false)
  }, [isDetailView])

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
        <div className="goal-header">
          <h1>
            {isDetailView
              ? (goals.find(g => String(g.id) === subPath.replace('plans/', ''))?.goalName ?? 'Goals')
              : 'Goals'}
          </h1>
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
          {(subPath === 'calculator' || isDetailView) && (
            <div className="goal-header-actions">
              {isDetailView && (
                <button
                  type="button"
                  className="growth-settings-toggle"
                  onClick={() => setDrawerOpen(o => !o)}
                  aria-label={drawerOpen ? 'Close goal drawer' : 'Open goal drawer'}
                >
                  Switch Plan
                </button>
              )}
              <GrowthSettingsPanel settings={growthCtx.settings} onUpdate={growthCtx.updateSettings} />
            </div>
          )}
          {subPath === 'leverage' && (
            <div className="goal-header-actions">
              <MonthPicker
                compact
                allMonths={allMonths}
                selectedMonth={leverageStartMonth}
                onMonthChange={(v: string) => setLeverageSettings(prev => ({ ...prev, chartStart: v }))}
              />
            </div>
          )}
        </div>

        <Routes>
          <Route index element={<Navigate to="/goal/plans" replace />} />
          <Route
            path="plans/*"
            element={
              <>
                {/* Right-side drawer for goal navigation */}
                {isDetailView && (
                  <>
                    <div
                      className={`goal-drawer-backdrop${drawerOpen ? ' goal-drawer-backdrop--visible' : ''}`}
                      onClick={() => setDrawerOpen(false)}
                    />
                    <aside className={`goal-drawer${drawerOpen ? ' goal-drawer--open' : ''}`}>
                      <div className="goal-drawer-header">
                        <button
                          type="button"
                          className="goal-drawer-back"
                          onClick={() => {
                            setDrawerOpen(false)
                            navigate('/goal/plans')
                          }}
                        >
                          ← All Plans
                        </button>
                      </div>
                      <ul className="goal-drawer-list">
                        {goals.map(g => {
                          const isActive = String(g.id) === subPath.replace('plans/', '')
                          return (
                            <li
                              key={g.id}
                              className={`goal-drawer-item${isActive ? ' goal-drawer-item--active' : ''}`}
                              onClick={() => {
                                navigate(`/goal/plans/${g.id}`)
                                setDrawerOpen(false)
                              }}
                              role="button"
                              tabIndex={0}
                            >
                              <span className="goal-drawer-item-name">{g.goalName}</span>
                              {isActive && (
                                <span onClick={e => e.stopPropagation()}>
                                  <GoalActionsMenu
                                    onRename={() => {
                                      const name = prompt('Rename goal:', g.goalName)
                                      if (name && name.trim()) handleRenameGoal(g.id, name.trim())
                                    }}
                                    onDuplicate={() => handleCopyGoal(g)}
                                    onDelete={() => {
                                      deleteGoal(g.id)
                                      const other = goals.find(x => x.id !== g.id)
                                      navigate(other ? `/goal/plans/${other.id}` : '/goal/plans')
                                    }}
                                  />
                                </span>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </aside>
                  </>
                )}

                {/* Cards grid — visible when NOT in detail view, animates out */}
                <div className={`goal-cards-container${isDetailView ? ' goal-cards-container--collapsed' : ''}`}>
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
                </div>

                {/* Detail panel — slides up when in detail view */}
                <div className={`goal-detail-panel${isDetailView ? ' goal-detail-panel--visible' : ''}`}>
                  {isDetailView && (
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
                  )}
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
                    onGoToGoal={goalId => navigate(`/goal/plans/${goalId}`)}
                  />
                )}
              </>
            }
          />
          <Route path="leverage" element={<LeverageGoal />} />
          <Route path="calculator" element={<FICalculator />} />
          <Route path="paydown" element={<PayDown />} />
        </Routes>
      </div>
    </section>
  )
}

export default Goal
