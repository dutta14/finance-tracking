import { FC, useState } from 'react'
import { AssetAllocation, formatCurrency } from '../../data/types'
import { GROUP_COLORS } from '../constants'

interface RebalancePanelProps {
  groups: { label: string; classes: AssetAllocation[] }[]
  actualValues: number[]
  goalPcts: number[]
  onClose: () => void
}

const RebalancePanel: FC<RebalancePanelProps> = ({ groups, actualValues, goalPcts, onClose }) => {
  const [newMoney, setNewMoney] = useState(0)
  const currentTotal = actualValues.reduce((a, b) => a + b, 0)
  const totalAfterAdd = currentTotal + newMoney

  const targetAmounts = goalPcts.map(p => totalAfterAdd * (p / 100))
  const deltas = targetAmounts.map((t, i) => t - actualValues[i])

  const newMoneyAvailable = Math.max(0, newMoney)

  const needGroups = deltas.map((d, i) => ({ idx: i, need: Math.max(0, d) })).filter(g => g.need > 0)
  const totalNeed = needGroups.reduce((s, g) => s + g.need, 0)

  const newMoneyAlloc = new Array(groups.length).fill(0)
  if (totalNeed > 0 && newMoneyAvailable > 0) {
    const allocatable = Math.min(newMoneyAvailable, totalNeed)
    for (const g of needGroups) {
      newMoneyAlloc[g.idx] = allocatable * (g.need / totalNeed)
    }
  }

  const remainingDelta = deltas.map((d, i) => d - newMoneyAlloc[i])

  const transfers: { from: string; to: string; amount: number }[] = []
  const excess = remainingDelta.map((d, i) => ({ idx: i, amount: Math.max(0, -d) })).filter(g => g.amount > 0.01)
  const deficit = remainingDelta.map((d, i) => ({ idx: i, amount: Math.max(0, d) })).filter(g => g.amount > 0.01)

  let ei = 0, di = 0
  const exCopy = excess.map(e => ({ ...e }))
  const defCopy = deficit.map(d => ({ ...d }))
  while (ei < exCopy.length && di < defCopy.length) {
    const amount = Math.min(exCopy[ei].amount, defCopy[di].amount)
    if (amount > 0.01) {
      transfers.push({
        from: groups[exCopy[ei].idx].label,
        to: groups[defCopy[di].idx].label,
        amount,
      })
    }
    exCopy[ei].amount -= amount
    defCopy[di].amount -= amount
    if (exCopy[ei].amount < 0.01) ei++
    if (defCopy[di].amount < 0.01) di++
  }

  const hasAnyAction = newMoneyAvailable > 0 || transfers.length > 0

  return (
    <div className="alloc-rebal-panel">
      <div className="alloc-rebal-header">
        <span className="alloc-ratio-builder-label">Rebalance</span>
        <button className="alloc-goal-cancel-btn" onClick={onClose}>Close</button>
      </div>

      <div className="alloc-rebal-field">
        <label className="alloc-goal-field-label">Adding new money?</label>
        <div className="alloc-rebal-input-wrap">
          <span className="alloc-rebal-dollar">$</span>
          <input type="number" className="alloc-goal-field-input alloc-rebal-money-input"
            value={newMoney || ''} onChange={e => setNewMoney(Math.max(0, Number(e.target.value)))}
            placeholder="0" min={0} />
        </div>
      </div>

      <div className="alloc-rebal-table">
        <div className="alloc-rebal-row alloc-rebal-row-header">
          <span className="alloc-rebal-cell alloc-rebal-cell-name">Group</span>
          <span className="alloc-rebal-cell">Current</span>
          <span className="alloc-rebal-cell">Target</span>
          <span className="alloc-rebal-cell">Δ</span>
        </div>
        {groups.map((g, i) => {
          const delta = deltas[i]
          return (
            <div key={i} className="alloc-rebal-row">
              <span className="alloc-rebal-cell alloc-rebal-cell-name">
                <span className="alloc-ratio-group-dot" style={{ background: GROUP_COLORS[i % GROUP_COLORS.length] }} />
                {g.label}
              </span>
              <span className="alloc-rebal-cell">{formatCurrency(actualValues[i])}</span>
              <span className="alloc-rebal-cell">{formatCurrency(targetAmounts[i])}</span>
              <span className={`alloc-rebal-cell alloc-rebal-delta${delta > 0.01 ? ' positive' : delta < -0.01 ? ' negative' : ' zero'}`}>
                {delta > 0 ? '+' : ''}{formatCurrency(delta)}
              </span>
            </div>
          )
        })}
        <div className="alloc-rebal-row alloc-rebal-row-total">
          <span className="alloc-rebal-cell alloc-rebal-cell-name">Total</span>
          <span className="alloc-rebal-cell">{formatCurrency(currentTotal)}</span>
          <span className="alloc-rebal-cell">{formatCurrency(totalAfterAdd)}</span>
          <span className="alloc-rebal-cell">{newMoneyAvailable > 0 ? `+${formatCurrency(newMoneyAvailable)}` : '—'}</span>
        </div>
      </div>

      {hasAnyAction && (
        <div className="alloc-rebal-actions">
          <div className="alloc-rebal-actions-title">Action Plan</div>

          {newMoneyAvailable > 0 && newMoneyAlloc.some(a => a > 0.01) && (
            <div className="alloc-rebal-action-group">
              <div className="alloc-rebal-action-heading">Allocate new money</div>
              {newMoneyAlloc.map((amt, i) => amt > 0.01 ? (
                <div key={i} className="alloc-rebal-action-item alloc-rebal-action-add">
                  <span className="alloc-rebal-action-icon">＋</span>
                  <span>Put <strong>{formatCurrency(amt)}</strong> into <strong>{groups[i].label}</strong></span>
                </div>
              ) : null)}
            </div>
          )}

          {transfers.length > 0 && (
            <div className="alloc-rebal-action-group">
              <div className="alloc-rebal-action-heading">Move between groups</div>
              {transfers.map((t, i) => (
                <div key={i} className="alloc-rebal-action-item alloc-rebal-action-move">
                  <span className="alloc-rebal-action-icon">↻</span>
                  <span>Move <strong>{formatCurrency(t.amount)}</strong> from <strong>{t.from}</strong> → <strong>{t.to}</strong></span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!hasAnyAction && (
        <div className="alloc-rebal-on-track">Your allocation is on track with the goal.</div>
      )}
    </div>
  )
}

export default RebalancePanel
