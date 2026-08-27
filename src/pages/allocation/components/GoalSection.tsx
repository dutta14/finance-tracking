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
  const [confirmRemove, setConfirmRemove] = useState(false)

  const scopeGoal = activeRatio.goals?.[activeRatio.scope] ?? null
  const otherScopes = (['total', 'fi', 'gw'] as Scope[]).filter(s => s !== activeRatio.scope && activeRatio.goals?.[s])

  return (
    <div className="alloc-goal-section">
      {!scopeGoal && !goalEditing && (
        <div className="alloc-goal-empty">
          <span className="alloc-goal-empty-text">
            No goal set for <strong>{activeRatio.scope === 'total' ? 'Total' : activeRatio.scope.toUpperCase()}</strong>
          </span>
          <button className="alloc-goal-set-btn" onClick={() => setGoalEditing(true)}>
            + Set Goal
          </button>
        </div>
      )}

      {scopeGoal && !goalEditing && (
        <div className="alloc-goal-card">
          <h4 className="alloc-goal-card-title">
            {scopeGoal.type === 'constant' ? 'Constant' : 'Gradual'} Goal
            {scopeGoal.type === 'gradual' && (
              <span className="alloc-goal-card-subtitle">
                {(scopeGoal as GradualGoal).owner === 'primary'
                  ? profile.name || 'Primary'
                  : profile.partner?.name || 'Partner'}{' '}
                · Age {(scopeGoal as GradualGoal).startAge}→{(scopeGoal as GradualGoal).endAge}
              </span>
            )}
          </h4>
          <div className="alloc-goal-card-details">
            {scopeGoal.type === 'constant'
              ? activeRatio.groups.map((g, i) => (
                  <div key={g.label} className="alloc-goal-card-detail">
                    <span className="alloc-goal-card-detail-label">{g.label}</span>
                    <span className="alloc-goal-card-detail-value">{(scopeGoal as ConstantGoal).pcts[i] ?? 0}%</span>
                  </div>
                ))
              : activeRatio.groups.map((g, i) => {
                  const gr = scopeGoal as GradualGoal
                  return (
                    <div key={g.label} className="alloc-goal-card-detail">
                      <span className="alloc-goal-card-detail-label">{g.label}</span>
                      <span className="alloc-goal-card-detail-value">
                        {gr.startPcts[i]}% → {gr.endPcts[i]}%
                      </span>
                    </div>
                  )
                })}
          </div>
          <div className="alloc-goal-card-actions">
            <button
              className="alloc-goal-edit-btn"
              onClick={() => {
                setGoalEditing(true)
                setRebalOpen(false)
              }}
            >
              Edit
            </button>
            <button
              className="alloc-goal-edit-btn"
              onClick={() => {
                setRebalOpen(v => !v)
                setGoalEditing(false)
              }}
            >
              {rebalOpen ? 'Hide Rebalance' : 'Rebalance'}
            </button>
            <button className="alloc-goal-remove-btn" onClick={() => setConfirmRemove(true)}>
              Remove
            </button>
            {confirmRemove && (
              <span className="alloc-goal-confirm">
                Are you sure?
                <button
                  className="alloc-goal-confirm-yes"
                  onClick={() => {
                    onSetGoal(activeRatio.scope, null)
                    setConfirmRemove(false)
                  }}
                >
                  Yes
                </button>
                <button className="alloc-goal-confirm-no" onClick={() => setConfirmRemove(false)}>
                  No
                </button>
              </span>
            )}
          </div>
        </div>
      )}

      {goalEditing && (
        <GoalEditor
          key={activeRatio.id + '-' + activeRatio.scope}
          groups={activeRatio.groups}
          existingGoal={scopeGoal}
          hasPrimary={!!profile.birthday}
          hasPartner={!!profile.partner?.birthday}
          primaryName={profile.name || ''}
          partnerName={profile.partner?.name || ''}
          onSave={g => {
            onSetGoal(activeRatio.scope, g)
            setGoalEditing(false)
          }}
          onCancel={() => setGoalEditing(false)}
        />
      )}

      {rebalOpen &&
        !goalEditing &&
        scopeGoal &&
        (() => {
          const gp = computeGoalPcts(scopeGoal, activeRatio.groups.length)
          if (!gp) return null
          const actuals = activeRatio.groups.map(g => {
            const m = allocMap.get(activeRatio.scope)
            if (!m) return 0
            return g.classes.reduce((sum, cls) => sum + Math.max(0, m.get(cls) ?? 0), 0)
          })
          return (
            <RebalancePanel
              groups={activeRatio.groups}
              actualValues={actuals}
              goalPcts={gp}
              onClose={() => setRebalOpen(false)}
            />
          )
        })()}

      {otherScopes.length > 0 && (
        <div className="alloc-goal-other-scopes">
          {otherScopes.map(s => (
            <span key={s} className="alloc-goal-other-badge">
              {s === 'total' ? 'Total' : s.toUpperCase()} has goal
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default GoalSection
