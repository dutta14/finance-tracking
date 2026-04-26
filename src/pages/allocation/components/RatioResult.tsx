import { FC } from 'react'
import { AssetAllocation } from '../../data/types'
import { CustomRatio, RatioGoal, GradualGoal } from '../types'
import { GROUP_COLORS } from '../constants'
import { DonutChart, RatioBar } from './ChartHelpers'

interface RatioResultProps {
  activeRatio: CustomRatio
  ratioData: { name: string; value: number; color: string }[]
  ratioTotal: number
  computeGoalPcts: (goal: RatioGoal, numGroups: number) => number[] | null
  getAge: (owner: 'primary' | 'partner') => number | null
}

const RatioResult: FC<RatioResultProps> = ({ activeRatio, ratioData, ratioTotal, computeGoalPcts, getAge }) => {
  if (ratioData.length === 0) return null

  const scopeGoal = activeRatio.goals?.[activeRatio.scope] ?? null
  const goalPcts = scopeGoal ? computeGoalPcts(scopeGoal, activeRatio.groups.length) : null
  const goalData = goalPcts
    ? activeRatio.groups.map((g, i) => ({
        name: g.label,
        pct: goalPcts[i],
        color: GROUP_COLORS[i % GROUP_COLORS.length],
      }))
    : null

  return (
    <div className="alloc-ratio-result">
      <div className="alloc-ratio-result-row">
        <div className="alloc-ratio-donut">
          <DonutChart data={ratioData} innerR={40} outerR={72} height={180} />
        </div>
        <div className="alloc-ratio-detail">
          <div className="alloc-ratio-bar-label">Actual</div>
          <RatioBar data={ratioData} total={ratioTotal} />

          {goalData && (
            <>
              <div className="alloc-ratio-bar-label" style={{ marginTop: '0.75rem' }}>
                Goal{scopeGoal?.type === 'gradual' ? ` (age ${getAge((scopeGoal as GradualGoal).owner) ?? '?'})` : ''}
              </div>
              <div className="alloc-ratio-bar-wrap">
                <div className="alloc-ratio-bar">
                  {goalData.map((d, i) => (
                    <div
                      key={i}
                      className="alloc-ratio-seg"
                      style={{ width: `${d.pct}%`, background: d.color, opacity: 0.5 }}
                    >
                      {d.pct > 8 && <span className="alloc-ratio-seg-label">{d.pct}%</span>}
                    </div>
                  ))}
                </div>
                <div className="alloc-ratio-labels">
                  {goalData.map((d, i) => {
                    const actualPct =
                      ratioTotal > 0 ? ((ratioData.find(cd => cd.name === d.name)?.value ?? 0) / ratioTotal) * 100 : 0
                    const diff = actualPct - d.pct
                    const diffStr = diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)
                    return (
                      <span key={i} className="alloc-ratio-label">
                        <span className="alloc-ratio-label-dot" style={{ background: d.color }} />
                        {d.name}: {d.pct}%
                        <span
                          className={`alloc-ratio-diff${Math.abs(diff) < 1 ? ' on-track' : diff > 0 ? ' over' : ' under'}`}
                        >
                          ({diffStr}%)
                        </span>
                      </span>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default RatioResult
