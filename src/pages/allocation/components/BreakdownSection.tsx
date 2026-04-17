import { FC, useState } from 'react'
import { formatCurrency } from '../../data/types'
import { Scope } from '../types'
import { DonutChart, Legend } from './ChartHelpers'

interface BreakdownSectionProps {
  getSlices: (s: Scope) => { name: string; value: number; color: string }[]
}

const BreakdownSection: FC<BreakdownSectionProps> = ({ getSlices }) => {
  const [scope, setScope] = useState<Scope>('total')
  const [legendMode, setLegendMode] = useState<'pct' | 'val'>('pct')

  const slices = getSlices(scope)
  const total = slices.reduce((s, d) => s + d.value, 0)

  return (
    <section className="alloc-page-section">
      <div className="alloc-page-section-header">
        <h2>Breakdown</h2>
        <div className="alloc-page-controls">
          <div className="alloc-page-scope-tabs">
            {(['total', 'fi', 'gw'] as Scope[]).map(s => (
              <button key={s} className={`alloc-page-tab${scope === s ? ' active' : ''}`}
                onClick={() => setScope(s)}>
                {s === 'total' ? 'Total' : s.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="alloc-page-toggle">
            <button className={`alloc-page-toggle-btn${legendMode === 'pct' ? ' active' : ''}`}
              onClick={() => setLegendMode('pct')}>%</button>
            <button className={`alloc-page-toggle-btn${legendMode === 'val' ? ' active' : ''}`}
              onClick={() => setLegendMode('val')}>$</button>
          </div>
        </div>
      </div>
      <div className="alloc-page-chart-row">
        <div className="alloc-page-donut">
          <DonutChart data={slices} />
        </div>
        <div className="alloc-page-legend-col">
          {slices.length > 0 && (
            <>
              <div className="alloc-page-total-label">
                Total: {formatCurrency(total)}
              </div>
              <Legend data={slices} total={total} mode={legendMode} />
            </>
          )}
          {slices.length === 0 && <div className="alloc-page-empty">No data</div>}
        </div>
      </div>
    </section>
  )
}

export default BreakdownSection
