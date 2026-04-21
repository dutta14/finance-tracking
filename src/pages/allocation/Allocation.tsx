import { FC } from 'react'
import '../../styles/Allocation.css'

import { useAllocationData } from './hooks/useAllocationData'
import { useCustomRatios } from './hooks/useCustomRatios'
import { useGoals } from './hooks/useGoals'
import BreakdownSection from './components/BreakdownSection'
import RatioTabs from './components/RatioTabs'
import RatioResult from './components/RatioResult'
import RatioBuilder from './components/RatioBuilder'
import GoalSection from './components/GoalSection'

const Allocation: FC = () => {
  const { allocMap, getSlices, computeRatio } = useAllocationData()
  const {
    customRatios, activeRatioId, setActiveRatioId,
    setActivePreset, activeRatio,
    confirmDeleteId, setConfirmDeleteId,
    createMenuOpen, setCreateMenuOpen, createMenuRef,
    createRatio, createFromPreset, requestDeleteRatio, doDeleteRatio,
    updateGroupLabel, toggleClass, addGroup, removeGroup,
    updateRatioName, updateRatioScope,
    setGoalForScope,
  } = useCustomRatios()
  const { profile, getAge, computeGoalPcts } = useGoals()

  const customRatioData = activeRatio ? computeRatio(activeRatio.groups, activeRatio.scope) : []
  const customRatioTotal = customRatioData.reduce((s, d) => s + d.value, 0)

  return (
    <div className="alloc-page">


      <BreakdownSection getSlices={getSlices} />

      <section className="alloc-page-section">
        <RatioTabs
          customRatios={customRatios}
          activeRatioId={activeRatioId}
          confirmDeleteId={confirmDeleteId}
          createMenuOpen={createMenuOpen}
          createMenuRef={createMenuRef}
          onSelectRatio={id => { setActiveRatioId(id); setActivePreset(null); setConfirmDeleteId(null) }}
          onRequestDelete={requestDeleteRatio}
          onConfirmDelete={doDeleteRatio}
          onCancelDelete={() => setConfirmDeleteId(null)}
          onCreateBlank={() => { createRatio(); setCreateMenuOpen(false) }}
          onCreateFromPreset={createFromPreset}
          onToggleCreateMenu={() => setCreateMenuOpen(v => !v)}
        />

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
            onUpdateName={updateRatioName}
            onUpdateScope={updateRatioScope}
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
    </div>
  )
}

export default Allocation
