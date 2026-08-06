import { FC, useState } from 'react'
import { formatCurrency, AssetAllocation } from '../../data/types'
import { Scope } from '../types'
import { DonutChart, Legend } from './ChartHelpers'

interface BreakdownSectionProps {
  getSlices: (s: Scope) => { key?: string; name: string; value: number; color: string }[]
  getAccountsForClass?: (
    s: Scope,
    cls: AssetAllocation,
  ) => { name: string; value: number; isDebt: boolean; owner: string; ownerName: string }[]
}

const BreakdownSection: FC<BreakdownSectionProps> = ({ getSlices, getAccountsForClass }) => {
  const [scope, setScope] = useState<Scope>('total')
  const [legendMode, setLegendMode] = useState<'pct' | 'val'>('pct')
  const [selectedClass, setSelectedClass] = useState<string | null>(null)

  const slices = getSlices(scope)
  const total = slices.reduce((s, d) => s + d.value, 0)

  return (
    <section className="alloc-page-section">
      <div className="alloc-page-section-header">
        <div className="alloc-page-controls">
          <div className="alloc-page-scope-tabs">
            {(['total', 'fi', 'gw'] as Scope[]).map(s => (
              <button
                key={s}
                className={`alloc-page-tab${scope === s ? ' active' : ''}`}
                onClick={() => {
                  setScope(s)
                  setSelectedClass(null)
                }}
              >
                {s === 'total' ? 'Total' : s.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="alloc-page-toggle">
            <button
              className={`alloc-page-toggle-btn${legendMode === 'pct' ? ' active' : ''}`}
              onClick={() => setLegendMode('pct')}
            >
              %
            </button>
            <button
              className={`alloc-page-toggle-btn${legendMode === 'val' ? ' active' : ''}`}
              onClick={() => setLegendMode('val')}
            >
              $
            </button>
          </div>
        </div>
      </div>
      <div className="alloc-page-chart-row">
        <div className="alloc-page-donut">
          <DonutChart
            data={slices}
            selectedIndex={selectedClass ? slices.findIndex(s => (s as { key?: string }).key === selectedClass) : -1}
            onClickSlice={(index: number) => {
              const slice = slices[index] as { key?: string }
              if (slice?.key) {
                setSelectedClass(prev => (prev === slice.key ? null : slice.key!))
              }
            }}
          />
        </div>
        <div className="alloc-page-legend-col">
          {slices.length > 0 && (
            <>
              <div className="alloc-page-total-label">Total: {formatCurrency(total)}</div>
              <Legend data={slices} total={total} mode={legendMode} />
            </>
          )}
          {slices.length === 0 && <div className="alloc-page-empty">No data</div>}
        </div>
      </div>

      {selectedClass &&
        getAccountsForClass &&
        (() => {
          const selectedSlice = slices.find(s => (s as { key?: string }).key === selectedClass)
          const rawAccts = getAccountsForClass(scope, selectedClass as AssetAllocation)
          if (!selectedSlice || rawAccts.length === 0) return null
          const acctTotal = rawAccts.reduce((s, a) => s + (a.isDebt ? -a.value : a.value), 0)
          const maxVal = Math.max(...rawAccts.map(a => a.value))
          return (
            <div className="alloc-drilldown">
              <div className="alloc-drilldown-header">
                <span className="alloc-drilldown-dot" style={{ background: selectedSlice.color }} />
                <span className="alloc-drilldown-title">{selectedSlice.name}</span>
                <span className="alloc-drilldown-total">{formatCurrency(acctTotal)}</span>
              </div>
              <div className="alloc-drilldown-list">
                {rawAccts.map((acct, i) => (
                  <div key={i} className="alloc-drilldown-item">
                    <span className={`alloc-drilldown-owner data-badge data-badge--owner-${acct.owner}`}>
                      {acct.ownerName}
                    </span>
                    <span className="alloc-drilldown-item-name">
                      {acct.name}
                      {acct.isDebt && <span className="alloc-drilldown-debt-tag">Debt</span>}
                    </span>
                    <span
                      className={`alloc-drilldown-item-value${acct.isDebt ? ' alloc-drilldown-item-value--debt' : ''}`}
                    >
                      {acct.isDebt ? '-' : ''}
                      {formatCurrency(acct.value)}
                    </span>
                    <div className="alloc-drilldown-bar-track">
                      <div
                        className="alloc-drilldown-bar-fill"
                        style={{
                          width: `${(acct.value / maxVal) * 100}%`,
                          background: acct.isDebt ? '#f87171' : selectedSlice.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
    </section>
  )
}

export default BreakdownSection
