import { FC, useMemo, useState } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { Account, BalanceEntry, ALLOCATION_LABELS, AssetAllocation, formatCurrency, getDefaultAllocation } from '../data/types'

interface AllocationBreakdownProps {
  accounts: Account[]
  balances: BalanceEntry[]
}

const ALLOC_COLORS: Record<AssetAllocation, string> = {
  cash: '#6b7280',
  'us-stock': '#6366f1',
  'intl-stock': '#8b5cf6',
  bonds: '#0ea5e9',
  'real-estate': '#f59e0b',
  others: '#84cc16',
  debt: '#ef4444',
}

const AllocationBreakdown: FC<AllocationBreakdownProps> = ({ accounts, balances }) => {
  const [legendMode, setLegendMode] = useState<'pct' | 'val'>('pct')
  const [chartMode, setChartMode] = useState<'pie' | 'bar'>('bar')

  const { fiData, gwData } = useMemo(() => {
    if (balances.length === 0) return { fiData: [], gwData: [] }

    const months = [...new Set(balances.map(b => b.month))].sort()
    const latest = months[months.length - 1]
    const latestBalances = balances.filter(b => b.month === latest)
    const balMap = new Map<number, number>()
    for (const b of latestBalances) balMap.set(b.accountId, b.balance)

    const buildAlloc = (goalType: 'fi' | 'gw') => {
      const grouped = new Map<AssetAllocation, number>()

      // First, add all assets
      for (const a of accounts) {
        if (a.status !== 'active' || a.goalType !== goalType || (a.nature || 'asset') !== 'asset') continue
        const bal = balMap.get(a.id)
        if (!bal || bal === 0) continue
        const alloc = a.allocation || getDefaultAllocation('asset')
        grouped.set(alloc, (grouped.get(alloc) ?? 0) + bal)
      }

      // Then subtract linked liabilities from their linked asset's allocation category
      // Unlinked liabilities get their own "Debt" slice
      for (const a of accounts) {
        if (a.status !== 'active' || a.goalType !== goalType || (a.nature || 'asset') !== 'liability') continue
        const bal = balMap.get(a.id)
        if (!bal || bal === 0) continue
        const absBal = Math.abs(bal)

        if (a.linkedAccountId != null) {
          const linked = accounts.find(la => la.id === a.linkedAccountId)
          if (linked) {
            const linkedAlloc = linked.allocation || getDefaultAllocation(linked.nature || 'asset')
            grouped.set(linkedAlloc, (grouped.get(linkedAlloc) ?? 0) - absBal)
            continue
          }
        }
        // Unlinked liability — show as Debt
        const alloc = a.allocation || getDefaultAllocation('liability')
        grouped.set(alloc, (grouped.get(alloc) ?? 0) + absBal)
      }

      return [...grouped.entries()]
        .filter(([, value]) => value > 0)
        .map(([key, value]) => ({ name: ALLOCATION_LABELS[key], value, color: ALLOC_COLORS[key] }))
        .sort((a, b) => b.value - a.value)
    }

    return { fiData: buildAlloc('fi'), gwData: buildAlloc('gw') }
  }, [accounts, balances])

  const isDark = document.body.classList.contains('dark')
  const tooltipBg = isDark ? '#1f2937' : '#fff'
  const tooltipBorder = isDark ? '#374151' : '#e5e7eb'

  const renderLegend = (data: { name: string; value: number; color: string }[], total: number) => (
    <div className="alloc-legend">
      {data.map((entry, i) => (
        <div key={i} className="alloc-legend-row">
          <span className="alloc-legend-dot" style={{ background: entry.color }} />
          <span className="alloc-legend-label">{entry.name}</span>
          <span className="alloc-legend-pct">
            {legendMode === 'pct'
              ? `${((entry.value / total) * 100).toFixed(0)}%`
              : formatCurrency(entry.value)}
          </span>
        </div>
      ))}
    </div>
  )

  const renderSection = (data: { name: string; value: number; color: string }[], label: string) => {
    if (data.length === 0) {
      return (
        <div className="alloc-section">
          <h4 className="alloc-section-title">{label}</h4>
          <div className="alloc-empty">No data</div>
        </div>
      )
    }

    const total = data.reduce((s, d) => s + d.value, 0)

    if (chartMode === 'bar') {
      return (
        <div className="alloc-section">
          <h4 className="alloc-section-title">{label}</h4>
          <div className="alloc-bar-wrap">
            <div className="alloc-stacked-bar">
              {data.map((entry, i) => {
                const pct = ((entry.value / total) * 100).toFixed(1)
                return (
                  <div
                    key={i}
                    className="alloc-bar-seg"
                    style={{ width: `${pct}%`, background: entry.color }}
                  >
                    <span className="alloc-bar-tooltip">{entry.name}: {pct}% — {formatCurrency(entry.value)}</span>
                  </div>
                )
              })}
            </div>
          </div>
          {renderLegend(data, total)}
        </div>
      )
    }

    return (
      <div className="alloc-section">
        <h4 className="alloc-section-title">{label}</h4>
        <div className="alloc-chart-row">
          <div className="alloc-pie-wrap">
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={32}
                  outerRadius={58}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {data.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', padding: '6px 10px', fontSize: 11 }}
                  formatter={(v: any) => formatCurrency(Number(v))}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {renderLegend(data, total)}
        </div>
      </div>
    )
  }

  return (
    <div className="home-card home-card--alloc">
      <div className="home-card-header">
        <h3>Asset Allocation</h3>
        <div className="alloc-toggles">
          <div className="alloc-toggle">
            <button className={`alloc-toggle-btn${chartMode === 'bar' ? ' active' : ''}`} onClick={() => setChartMode('bar')} title="Stacked bar">
              <svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="3" width="12" height="3" rx="1" fill="currentColor" opacity=".6"/><rect x="1" y="8" width="8" height="3" rx="1" fill="currentColor"/></svg>
            </button>
            <button className={`alloc-toggle-btn${chartMode === 'pie' ? ' active' : ''}`} onClick={() => setChartMode('pie')} title="Donut chart">
              <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="10 21.4" strokeDashoffset="0"/><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="8 23.4" strokeDashoffset="-10" opacity=".5"/></svg>
            </button>
          </div>
          <div className="alloc-toggle">
            <button className={`alloc-toggle-btn${legendMode === 'pct' ? ' active' : ''}`} onClick={() => setLegendMode('pct')}>%</button>
            <button className={`alloc-toggle-btn${legendMode === 'val' ? ' active' : ''}`} onClick={() => setLegendMode('val')}>$</button>
          </div>
        </div>
      </div>
      {balances.length === 0 ? (
        <div className="home-card-empty">No balance data yet</div>
      ) : (
        <div className={`alloc-grid${chartMode === 'bar' ? ' alloc-grid--vertical' : ''}`}>
          {renderSection(fiData, 'FI')}
          {renderSection(gwData, 'GW')}
        </div>
      )}
    </div>
  )
}

export default AllocationBreakdown
