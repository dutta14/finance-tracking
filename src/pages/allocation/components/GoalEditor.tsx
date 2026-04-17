import { FC, useState } from 'react'
import { AssetAllocation } from '../../data/types'
import { GoalOwner, RatioGoal } from '../types'
import { GROUP_COLORS } from '../constants'

interface GoalEditorProps {
  groups: { label: string; classes: AssetAllocation[] }[]
  existingGoal: RatioGoal | null
  hasPrimary: boolean
  hasPartner: boolean
  primaryName: string
  partnerName: string
  onSave: (goal: RatioGoal) => void
  onCancel: () => void
}

const GoalEditor: FC<GoalEditorProps> = ({ groups, existingGoal, hasPrimary, hasPartner, primaryName, partnerName, onSave, onCancel }) => {
  const n = groups.length
  const evenPct = Math.floor(100 / n)
  const remainder = 100 - evenPct * n

  const [goalType, setGoalType] = useState<'constant' | 'gradual'>(existingGoal?.type ?? 'constant')
  const [owner, setOwner] = useState<GoalOwner>(existingGoal?.type === 'gradual' ? existingGoal.owner : 'primary')
  const [startAge, setStartAge] = useState(existingGoal?.type === 'gradual' ? existingGoal.startAge : 30)
  const [endAge, setEndAge] = useState(existingGoal?.type === 'gradual' ? existingGoal.endAge : 60)
  const [pcts, setPcts] = useState<number[]>(
    existingGoal?.type === 'constant' ? [...existingGoal.pcts] : Array.from({ length: n }, (_, i) => evenPct + (i === 0 ? remainder : 0))
  )
  const [startPcts, setStartPcts] = useState<number[]>(
    existingGoal?.type === 'gradual' ? [...existingGoal.startPcts] : Array.from({ length: n }, (_, i) => evenPct + (i === 0 ? remainder : 0))
  )
  const [endPcts, setEndPcts] = useState<number[]>(
    existingGoal?.type === 'gradual' ? [...existingGoal.endPcts] : Array.from({ length: n }, (_, i) => evenPct + (i === 0 ? remainder : 0))
  )

  const updatePct = (arr: number[], setArr: (v: number[]) => void, idx: number, val: number) => {
    const clamped = Math.max(0, Math.min(100, val))
    const next = [...arr]
    next[idx] = clamped
    setArr(next)
  }

  const pctSum = (arr: number[]) => arr.reduce((a, b) => a + b, 0)

  const handleSave = () => {
    if (goalType === 'constant') {
      onSave({ type: 'constant', pcts: [...pcts] })
    } else {
      onSave({ type: 'gradual', owner, startAge, endAge, startPcts: [...startPcts], endPcts: [...endPcts] })
    }
  }

  const constantValid = pctSum(pcts) === 100
  const gradualValid = startAge < endAge && pctSum(startPcts) === 100 && pctSum(endPcts) === 100

  return (
    <div className="alloc-goal-editor">
      <div className="alloc-goal-editor-header">
        <span className="alloc-ratio-builder-label">Goal Type</span>
        <div className="alloc-page-scope-tabs">
          <button className={`alloc-page-tab${goalType === 'constant' ? ' active' : ''}`}
            onClick={() => setGoalType('constant')}>Constant</button>
          <button className={`alloc-page-tab${goalType === 'gradual' ? ' active' : ''}`}
            onClick={() => setGoalType('gradual')}>Gradual</button>
        </div>
      </div>

      {goalType === 'gradual' && (
        <div className="alloc-goal-gradual-fields">
          <div className="alloc-goal-field-row">
            <label className="alloc-goal-field-label">Based on</label>
            <div className="alloc-page-scope-tabs">
              <button className={`alloc-page-tab${owner === 'primary' ? ' active' : ''}`}
                onClick={() => setOwner('primary')} disabled={!hasPrimary}>{primaryName || 'Primary'}</button>
              <button className={`alloc-page-tab${owner === 'partner' ? ' active' : ''}`}
                onClick={() => setOwner('partner')} disabled={!hasPartner}>{partnerName || 'Partner'}</button>
            </div>
          </div>
          <div className="alloc-goal-field-row">
            <label className="alloc-goal-field-label">Start age</label>
            <input type="number" className="alloc-goal-field-input" value={startAge}
              onChange={e => setStartAge(Number(e.target.value))} min={0} max={120} />
            <label className="alloc-goal-field-label" style={{ marginLeft: '0.75rem' }}>End age</label>
            <input type="number" className="alloc-goal-field-input" value={endAge}
              onChange={e => setEndAge(Number(e.target.value))} min={0} max={120} />
          </div>
        </div>
      )}

      {goalType === 'constant' && (
        <div className="alloc-goal-pct-grid">
          <div className="alloc-goal-pct-header">Target %</div>
          {groups.map((g, i) => (
            <div key={i} className="alloc-goal-pct-row">
              <span className="alloc-goal-pct-label">
                <span className="alloc-ratio-group-dot" style={{ background: GROUP_COLORS[i % GROUP_COLORS.length] }} />
                {g.label}
              </span>
              <input type="number" className="alloc-goal-field-input" value={pcts[i] ?? 0}
                onChange={e => updatePct(pcts, setPcts, i, Number(e.target.value))} min={0} max={100} />
              <span className="alloc-goal-pct-unit">%</span>
            </div>
          ))}
          <div className={`alloc-goal-pct-sum${pctSum(pcts) === 100 ? ' valid' : ' invalid'}`}>
            Sum: {pctSum(pcts)}%{pctSum(pcts) !== 100 && ' (must be 100%)'}
          </div>
        </div>
      )}

      {goalType === 'gradual' && (
        <div className="alloc-goal-pct-grid">
          <div className="alloc-goal-pct-cols">
            <span className="alloc-goal-pct-header" style={{ flex: 1 }} />
            <span className="alloc-goal-pct-header">Start %</span>
            <span className="alloc-goal-pct-header">End %</span>
          </div>
          {groups.map((g, i) => (
            <div key={i} className="alloc-goal-pct-row alloc-goal-pct-row-dual">
              <span className="alloc-goal-pct-label">
                <span className="alloc-ratio-group-dot" style={{ background: GROUP_COLORS[i % GROUP_COLORS.length] }} />
                {g.label}
              </span>
              <div className="alloc-goal-pct-pair">
                <input type="number" className="alloc-goal-field-input" value={startPcts[i] ?? 0}
                  onChange={e => updatePct(startPcts, setStartPcts, i, Number(e.target.value))} min={0} max={100} />
                <span className="alloc-goal-pct-arrow">→</span>
                <input type="number" className="alloc-goal-field-input" value={endPcts[i] ?? 0}
                  onChange={e => updatePct(endPcts, setEndPcts, i, Number(e.target.value))} min={0} max={100} />
              </div>
            </div>
          ))}
          <div className="alloc-goal-pct-sums">
            <div className={`alloc-goal-pct-sum${pctSum(startPcts) === 100 ? ' valid' : ' invalid'}`}>
              Start: {pctSum(startPcts)}%{pctSum(startPcts) !== 100 && ' ≠ 100'}
            </div>
            <div className={`alloc-goal-pct-sum${pctSum(endPcts) === 100 ? ' valid' : ' invalid'}`}>
              End: {pctSum(endPcts)}%{pctSum(endPcts) !== 100 && ' ≠ 100'}
            </div>
          </div>
        </div>
      )}

      <div className="alloc-goal-editor-actions">
        <button className="alloc-goal-save-btn"
          disabled={goalType === 'constant' ? !constantValid : !gradualValid}
          onClick={handleSave}>Save Goal</button>
        <button className="alloc-goal-cancel-btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

export default GoalEditor
