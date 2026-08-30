import { FC, useMemo, useState, useEffect } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import {
  Account,
  BalanceEntry,
  ALLOCATION_LABELS,
  AssetAllocation,
  formatCurrency,
  getDefaultAllocation,
} from '../data/types'
import TermAbbr from '../../components/TermAbbr'

interface AllocationBreakdownProps {
  accounts: Account[]
  balances: BalanceEntry[]
  onNavigate?: () => void
}

const ALLOC_COLOR_VARS: Record<AssetAllocation, string> = {
  'us-stock': '--accent',
  'intl-stock': '--accent-text-mid',
  bonds: '_#0f766e',
  'real-estate': '_#92400e',
  cash: '_#475569',
  others: '_#3f6212',
  debt: '_#b91c1c',
}

function resolveAllocColors(): Record<AssetAllocation, string> {
  const s = getComputedStyle(document.body)
  const resolved = {} as Record<AssetAllocation, string>
  for (const [key, val] of Object.entries(ALLOC_COLOR_VARS)) {
    if (val.startsWith('--')) {
      resolved[key as AssetAllocation] = s.getPropertyValue(val).trim() || val
    } else {
      resolved[key as AssetAllocation] = val.slice(1)
    }
  }
  return resolved
}

const AllocationBreakdown: FC<AllocationBreakdownProps> = ({ accounts, balances, onNavigate }) => {
  const [legendMode, setLegendMode] = useState<'pct' | 'val'>('pct')
  const [chartMode, setChartMode] = useState<'pie' | 'bar'>('pie')
  const [ALLOC_COLORS, setAllocColors] = useState(resolveAllocColors)

  useEffect(() => {
    setAllocColors(resolveAllocColors())
    const observer = new MutationObserver(() => setAllocColors(resolveAllocColors()))
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const { fiData, gwData, totalData } = useMemo(() => {
    if (balances.length === 0) return { fiData: [], gwData: [], totalData: [] }

    const months = [...new Set(balances.map(b => b.month))].sort()
    const latest = months[months.length - 1]
    const latestBalances = balances.filter(b => b.month === latest)
    const balMap = new Map<number, number>()
    for (const b of latestBalances) balMap.set(b.accountId, b.balance)

    const buildAlloc = (goalFilter?: 'fi' | 'gw') => {
      const grouped = new Map<AssetAllocation, number>()

      // First, add all assets
      for (const a of accounts) {
        if (a.status !== 'active' || (a.nature || 'asset') !== 'asset') continue
        if (goalFilter && a.goalType !== goalFilter) continue
        const bal = balMap.get(a.id)
        if (!bal || bal === 0) continue
        const alloc = a.allocation || getDefaultAllocation('asset')
        grouped.set(alloc, (grouped.get(alloc) ?? 0) + bal)
      }

      // Then subtract linked liabilities from their linked asset's allocation category
      // Unlinked liabilities get their own "Debt" slice
      for (const a of accounts) {
        if (a.status !== 'active' || (a.nature || 'asset') !== 'liability') continue
        if (goalFilter && a.goalType !== goalFilter) continue
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

    return { fiData: buildAlloc('fi'), gwData: buildAlloc('gw'), totalData: buildAlloc() }
  }, [accounts, balances, ALLOC_COLORS])

  const tooltipBg = 'var(--color-surface)'
  const tooltipBorder = 'var(--color-border)'

  const renderLegend = (data: { name: string; value: number; color: string }[], total: number) => (
    <div className="alloc-legend">
      {data.map((entry, i) => (
        <div key={i} className="alloc-legend-row">
          <span className="alloc-legend-dot" style={{ background: entry.color }} />
          <span className="alloc-legend-label">{entry.name}</span>
          <span className="alloc-legend-pct">
            {legendMode === 'pct' ? `${((entry.value / total) * 100).toFixed(0)}%` : formatCurrency(entry.value)}
          </span>
        </div>
      ))}
    </div>
  )

  const renderSection = (data: { name: string; value: number; color: string }[], label: string) => {
    if (data.length === 0) {
      return (
        <div className="alloc-section">
          <h4 className="alloc-section-title">
            {label === 'FI' || label === 'GW' ? <TermAbbr term={label} /> : label}
          </h4>
          <div className="alloc-empty">No data</div>
        </div>
      )
    }

    const total = data.reduce((s, d) => s + d.value, 0)

    if (chartMode === 'bar') {
      return (
        <div className="alloc-section">
          <h4 className="alloc-section-title">
            {label === 'FI' || label === 'GW' ? <TermAbbr term={label} /> : label}
          </h4>
          <div className="alloc-bar-wrap">
            <div className="alloc-stacked-bar">
              {data.map((entry, i) => {
                const pct = ((entry.value / total) * 100).toFixed(1)
                return (
                  <div key={i} className="alloc-bar-seg" style={{ width: `${pct}%`, background: entry.color }}>
                    <span className="alloc-bar-tooltip">
                      {entry.name}: {pct}% — {formatCurrency(entry.value)}
                    </span>
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
        <h4 className="alloc-section-title">{label === 'FI' || label === 'GW' ? <TermAbbr term={label} /> : label}</h4>
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
                  contentStyle={{
                    backgroundColor: tooltipBg,
                    border: `1px solid ${tooltipBorder}`,
                    borderRadius: 8,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    padding: '6px 10px',
                    fontSize: 11,
                    color: 'var(--color-text)',
                  }}
                  itemStyle={{ color: 'var(--color-text)' }}
                  formatter={(v: number | string | ReadonlyArray<number | string> | undefined) =>
                    formatCurrency(Number(v))
                  }
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
        {onNavigate && (
          <button className="home-card-link" onClick={onNavigate}>
            View Allocation →
          </button>
        )}
      </div>
      <div className="alloc-toggles">
        <div className="tab-bar">
          <button
            type="button"
            className={`tab-btn tab-btn--sm${chartMode === 'bar' ? ' active' : ''}`}
            onClick={() => setChartMode('bar')}
            aria-label="Show allocation as stacked bar chart"
            aria-pressed={chartMode === 'bar'}
          >
            <svg width="14" height="14" viewBox="0 0 14 14">
              <rect x="1" y="3" width="12" height="3" rx="1" fill="currentColor" opacity=".6" />
              <rect x="1" y="8" width="8" height="3" rx="1" fill="currentColor" />
            </svg>
          </button>
          <button
            type="button"
            className={`tab-btn tab-btn--sm${chartMode === 'pie' ? ' active' : ''}`}
            onClick={() => setChartMode('pie')}
            aria-label="Show allocation as donut chart"
            aria-pressed={chartMode === 'pie'}
          >
            <svg width="14" height="14" viewBox="0 0 14 14">
              <circle
                cx="7"
                cy="7"
                r="5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeDasharray="10 21.4"
                strokeDashoffset="0"
              />
              <circle
                cx="7"
                cy="7"
                r="5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeDasharray="8 23.4"
                strokeDashoffset="-10"
                opacity=".5"
              />
            </svg>
          </button>
        </div>
        <div className="tab-bar">
          <button
            type="button"
            className={`tab-btn tab-btn--sm${legendMode === 'pct' ? ' active' : ''}`}
            onClick={() => setLegendMode('pct')}
            aria-label="Show allocation legend as percentages"
            aria-pressed={legendMode === 'pct'}
          >
            %
          </button>
          <button
            type="button"
            className={`tab-btn tab-btn--sm${legendMode === 'val' ? ' active' : ''}`}
            onClick={() => setLegendMode('val')}
            aria-label="Show allocation legend as currency values"
            aria-pressed={legendMode === 'val'}
          >
            $
          </button>
        </div>
      </div>
      {balances.length === 0 ? (
        <div className="home-card-cta">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 11-9-9" />
            <path d="M12 3v9h9" />
          </svg>
          <p>See how your assets are distributed once you add accounts and balances.</p>
          <button className="home-card-cta-btn" onClick={onNavigate}>
            Set up allocation →
          </button>
        </div>
      ) : (
        <div className={`alloc-grid${chartMode === 'bar' ? ' alloc-grid--vertical' : ''}`}>
          {renderSection(totalData, 'Total')}
          {renderSection(fiData, 'FI')}
          {renderSection(gwData, 'GW')}
        </div>
      )}
    </div>
  )
}

export default AllocationBreakdown
