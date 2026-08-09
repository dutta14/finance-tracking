import { FC } from 'react'
import '../../styles/Allocation.css'

import { Scope } from './types'
import { useAllocationData } from './hooks/useAllocationData'
import { useCustomRatios } from './hooks/useCustomRatios'
import { useGoals } from './hooks/useGoals'
import BreakdownSection from './components/BreakdownSection'
import RatioTabs from './components/RatioTabs'
import RatioResult from './components/RatioResult'
import RatioBuilder from './components/RatioBuilder'
import GoalSection from './components/GoalSection'

interface AllocationProps {
  tab: 'breakdown' | 'ratios'
}

const Allocation: FC<AllocationProps> = ({ tab }) => {
  const { allocMap, getSlices, computeRatio, getAccountsForClass, getClassHistory, getAccountHistory, allMonths } = useAllocationData()
  const {
    customRatios,
    activeRatioId,
    setActiveRatioId,
    setActivePreset,
    activeRatio,
    confirmDeleteId,
    setConfirmDeleteId,
    createMenuOpen,
    setCreateMenuOpen,
    createMenuRef,
    createRatio,
    createFromPreset,
    requestDeleteRatio,
    doDeleteRatio,
    updateGroupLabel,
    toggleClass,
    addGroup,
    removeGroup,
    updateRatioName,
    updateRatioScope,
    setGoalForScope,
  } = useCustomRatios()
  const { profile, getAge, computeGoalPcts } = useGoals()

  const customRatioData = activeRatio ? computeRatio(activeRatio.groups, activeRatio.scope) : []
  const customRatioTotal = customRatioData.reduce((s, d) => s + d.value, 0)

  return (
    <div className="alloc-page">
      {tab === 'breakdown' && <BreakdownSection getSlices={getSlices} getAccountsForClass={getAccountsForClass} getClassHistory={getClassHistory} getAccountHistory={getAccountHistory} allMonths={allMonths} />}

      {tab === 'ratios' && (
        <section className="alloc-page-section">
          <RatioTabs
            customRatios={customRatios}
            activeRatioId={activeRatioId}
            confirmDeleteId={confirmDeleteId}
            createMenuOpen={createMenuOpen}
            createMenuRef={createMenuRef}
            onSelectRatio={id => {
              setActiveRatioId(id)
              setActivePreset(null)
              setConfirmDeleteId(null)
            }}
            onRequestDelete={requestDeleteRatio}
            onConfirmDelete={doDeleteRatio}
            onCancelDelete={() => setConfirmDeleteId(null)}
            onCreateBlank={() => {
              createRatio()
              setCreateMenuOpen(false)
            }}
            onCreateFromPreset={createFromPreset}
            onToggleCreateMenu={() => setCreateMenuOpen(v => !v)}
          />

          {activeRatio && (
            <div className="alloc-ratio-builder-header">
              <span className="alloc-ratio-builder-label">Name</span>
              <input
                className="alloc-ratio-name-input"
                value={activeRatio.name}
                onChange={e => updateRatioName(e.target.value)}
                aria-label="Ratio name"
              />
              <span className="alloc-ratio-builder-label alloc-ratio-builder-label--spaced">Scope</span>
              <div className="alloc-page-scope-tabs">
                {(['total', 'fi', 'gw'] as Scope[]).map(s => (
                  <button
                    key={s}
                    className={`alloc-page-tab${activeRatio.scope === s ? ' active' : ''}`}
                    onClick={() => updateRatioScope(s)}
                    aria-pressed={activeRatio.scope === s}
                  >
                    {s === 'total' ? 'Total' : s.toUpperCase()}
                  </button>
                ))}
              </div>
              <button className="alloc-ratio-delete-btn" onClick={() => requestDeleteRatio(activeRatio.id)}>
                Delete
              </button>
            </div>
          )}

          {activeRatio && (
            <RatioResult
              activeRatio={activeRatio}
              ratioData={customRatioData}
              ratioTotal={customRatioTotal}
              computeGoalPcts={computeGoalPcts}
              getAge={getAge}
            />
          )}

          {activeRatio && (
            <RatioBuilder
              activeRatio={activeRatio}
              onUpdateGroupLabel={updateGroupLabel}
              onToggleClass={toggleClass}
              onAddGroup={addGroup}
              onRemoveGroup={removeGroup}
              goalSection={
                <GoalSection
                  activeRatio={activeRatio}
                  profile={profile}
                  allocMap={allocMap}
                  computeGoalPcts={computeGoalPcts}
                  onSetGoal={setGoalForScope}
                />
              }
            />
          )}
        </section>
      )}
    </div>
  )
}

export default Allocation
