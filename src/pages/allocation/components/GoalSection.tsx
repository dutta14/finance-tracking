import { FC, useState } from 'react'
import { AssetAllocation } from '../../data/types'
import { Scope, CustomRatio, RatioGoal, ConstantGoal, GradualGoal } from '../types'
import { Profile } from '../../../hooks/useProfile'
import GoalEditor from './GoalEditor'
import RebalancePanel from './RebalancePanel'

interface GoalSectionProps {
  activeRatio: CustomRatio
  profile: Profile
  allocMap: Map<string, Map<AssetAllocation, number>>
  computeGoalPcts: (goal: RatioGoal, numGroups: number) => number[] | null
  onSetGoal: (scopeKey: Scope, goal: RatioGoal | null) => void
}

const GoalSection: FC<GoalSectionProps> = ({ activeRatio, profile, allocMap, computeGoalPcts, onSetGoal }) => {
  const [goalEditing, setGoalEditing] = useState(false)
  const [rebalOpen, setRebalOpen] = useState(false)

  const scopeGoal = activeRatio.goals?.[activeRatio.scope] ?? null
  const otherScopes = (['total', 'fi', 'gw'] as Scope[]).filter(s => s !== activeRatio.scope && activeRatio.goals?.[s])

  return (
    <div className="alloc-goal-section">
      <div className="alloc-goal-scope-label">Goal for <strong>{activeRatio.scope === 'total' ? 'Total' : activeRatio.scope.toUpperCase()}</strong></div>

      {!scopeGoal && !goalEditing && (
        <button className="alloc-goal-set-btn" onClick={() => setGoalEditing(true)}>
          Set Goal
        </button>
      )}

      {scopeGoal && !goalEditing && (
        <div className="alloc-goal-summary">
          <span className="alloc-goal-summary-text">
            {scopeGoal.type === 'constant'
              ? activeRatio.groups.map((g, i) => `${g.label} ${(scopeGoal as ConstantGoal).pcts[i] ?? 0}%`).join(' / ')
              : (() => {
                  const gr = scopeGoal as GradualGoal
                  return `Age ${gr.startAge}→${gr.endAge} (${gr.owner}): ${activeRatio.groups.map((g, i) => `${g.label} ${gr.startPcts[i]}→${gr.endPcts[i]}%`).join(' / ')}`
                })()
            }
          </span>
          <button className="alloc-goal-edit-btn" onClick={() => { setGoalEditing(true); setRebalOpen(false) }}>Edit</button>
          <button className="alloc-goal-edit-btn" onClick={() => { setRebalOpen(v => !v); setGoalEditing(false) }}>
            {rebalOpen ? 'Hide Rebalance' : 'Rebalance'}
          </button>
          <button className="alloc-goal-remove-btn" onClick={() => onSetGoal(activeRatio.scope, null)}>Remove</button>
        </div>
      )}

      {goalEditing && <GoalEditor
        groups={activeRatio.groups}
        existingGoal={scopeGoal}
        hasPrimary={!!profile.birthday}
        hasPartner={!!profile.partner?.birthday}
        primaryName={profile.name || ''}
        partnerName={profile.partner?.name || ''}
        onSave={g => { onSetGoal(activeRatio.scope, g); setGoalEditing(false) }}
        onCancel={() => setGoalEditing(false)}
      />}

      {rebalOpen && !goalEditing && scopeGoal && (() => {
        const gp = computeGoalPcts(scopeGoal, activeRatio.groups.length)
        if (!gp) return null
        const actuals = activeRatio.groups.map(g => {
          const m = allocMap.get(activeRatio.scope)
          if (!m) return 0
          return g.classes.reduce((sum, cls) => sum + Math.max(0, m.get(cls) ?? 0), 0)
        })
        return <RebalancePanel
          groups={activeRatio.groups}
          actualValues={actuals}
          goalPcts={gp}
          onClose={() => setRebalOpen(false)}
        />
      })()}

      {otherScopes.length > 0 && (
        <div className="alloc-goal-other-scopes">
          {otherScopes.map(s => (
            <span key={s} className="alloc-goal-other-badge">{s === 'total' ? 'Total' : s.toUpperCase()} has goal</span>
          ))}
        </div>
      )}
    </div>
  )
}

export default GoalSection
