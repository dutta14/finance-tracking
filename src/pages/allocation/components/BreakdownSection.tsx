import { FC, useState, useMemo } from 'react'
import { formatCurrency, AssetAllocation } from '../../data/types'
import { Scope } from '../types'
import { DonutChart, Legend } from './ChartHelpers'
import { useDateFilter } from '../../../hooks/useDateFilter'
import { DateFilterBar } from '../../../components/DateFilterBar'
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

interface BreakdownSectionProps {
  getSlices: (s: Scope) => { key?: string; name: string; value: number; color: string }[]
  getAccountsForClass?: (
    s: Scope,
    cls: AssetAllocation,
  ) => { id: number; name: string; value: number; isDebt: boolean; owner: string; ownerName: string }[]
  getClassHistory?: (s: Scope, cls: AssetAllocation) => { month: string; value: number }[]
  getAccountHistory?: (accountId: number) => { month: string; value: number }[]
  allMonths?: string[]
}

const DRILLDOWN_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#a855f7',
]

const BreakdownSection: FC<BreakdownSectionProps> = ({ getSlices, getAccountsForClass, getClassHistory, getAccountHistory, allMonths = [] }) => {
  const [scope, setScope] = useState<Scope>('total')
  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  const [selectedAcctIdx, setSelectedAcctIdx] = useState<number | null>(null)

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
                setSelectedAcctIdx(null)
              }
            }}
          />
        </div>
        <div className="alloc-page-legend-col">
          {slices.length > 0 && (
            <>
              <div className="alloc-page-total-label">Total: {formatCurrency(total)}</div>
              <Legend
                data={slices}
                total={total}
                selectedIndex={selectedClass ? slices.findIndex(s => (s as { key?: string }).key === selectedClass) : -1}
                onClickRow={(index: number) => {
                  const slice = slices[index] as { key?: string }
                  if (slice?.key) {
                    setSelectedClass(prev => (prev === slice.key ? null : slice.key!))
                    setSelectedAcctIdx(null)
                  }
                }}
              />
            </>
          )}
          {slices.length === 0 && <div className="alloc-page-empty">No data</div>}
        </div>
      </div>

      {!selectedClass && (
        <div className="alloc-drilldown alloc-drilldown--empty">
          <p>Click an asset class above to drill down into individual accounts</p>
        </div>
      )}

      {selectedClass &&
        getAccountsForClass &&
        (() => {
          const selectedSlice = slices.find(s => (s as { key?: string }).key === selectedClass)
          const rawAccts = getAccountsForClass(scope, selectedClass as AssetAllocation)
          if (!selectedSlice || rawAccts.length === 0) return null
          const acctTotal = rawAccts.reduce((s, a) => s + (a.isDebt ? -a.value : a.value), 0)
          const trendTitle = selectedAcctIdx != null && rawAccts[selectedAcctIdx]
            ? `${selectedSlice.name}: ${rawAccts[selectedAcctIdx].ownerName}'s ${rawAccts[selectedAcctIdx].name}`
            : selectedSlice.name
          const headerValue = selectedAcctIdx != null && rawAccts[selectedAcctIdx]
            ? rawAccts[selectedAcctIdx].value
            : acctTotal
          return (
            <div className="alloc-drilldown">
              <div className="alloc-drilldown-header">
                <span className="alloc-drilldown-dot" style={{ background: selectedSlice.color }} />
                <span className="alloc-drilldown-title">{trendTitle}</span>
                <span className="alloc-drilldown-total">{formatCurrency(headerValue)}</span>
              </div>
              <TrendChart
                getClassHistory={getClassHistory}
                getAccountHistory={getAccountHistory}
                scope={scope}
                cls={selectedClass as AssetAllocation}
                color={selectedAcctIdx != null ? DRILLDOWN_COLORS[selectedAcctIdx % DRILLDOWN_COLORS.length] : selectedSlice.color}
                selectedAccountId={selectedAcctIdx != null ? rawAccts[selectedAcctIdx]?.id : undefined}
                allMonths={allMonths}
              />
              <div className="alloc-drilldown-composition">
                <DonutChart
                  data={rawAccts.map((acct, i) => ({
                    name: acct.name,
                    value: acct.value,
                    color: DRILLDOWN_COLORS[i % DRILLDOWN_COLORS.length],
                  }))}
                  innerR={50}
                  outerR={90}
                  height={220}
                  selectedIndex={selectedAcctIdx ?? -1}
                  onClickSlice={(index: number) => {
                    setSelectedAcctIdx(prev => (prev === index ? null : index))
                  }}
                />
                <div className="alloc-drilldown-list">
                  {rawAccts.map((acct, i) => (
                    <div
                      key={i}
                      className={`alloc-drilldown-item clickable${selectedAcctIdx != null && selectedAcctIdx !== i ? ' dimmed' : ''}`}
                      onClick={() => setSelectedAcctIdx(prev => (prev === i ? null : i))}
                    >
                      <span
                        className="alloc-drilldown-dot"
                        style={{ background: DRILLDOWN_COLORS[i % DRILLDOWN_COLORS.length] }}
                      />
                      <span className={`alloc-drilldown-owner data-badge data-badge--owner-${acct.owner}`}>
                        {acct.ownerName}
                      </span>
                      <span className="alloc-drilldown-item-name">
                        {acct.name}
                        {acct.isDebt && <span className="alloc-drilldown-debt-tag">Debt</span>}
                      </span>
                      <span className="alloc-drilldown-item-pct">
                        {acctTotal > 0 ? `${((acct.value / acctTotal) * 100).toFixed(0)}%` : ''}
                      </span>
                      <span
                        className={`alloc-drilldown-item-value${acct.isDebt ? ' alloc-drilldown-item-value--debt' : ''}`}
                      >
                        {acct.isDebt ? '-' : ''}
                        {formatCurrency(acct.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })()}
    </section>
  )
}

/* ─── Growth Trend Line Chart ─── */
interface TrendChartProps {
  getClassHistory?: (s: Scope, cls: AssetAllocation) => { month: string; value: number }[]
  getAccountHistory?: (accountId: number) => { month: string; value: number }[]
  scope: Scope
  cls: AssetAllocation
  color: string
  selectedAccountId?: number
  allMonths: string[]
}

const TrendChart: FC<TrendChartProps> = ({ getClassHistory, getAccountHistory, scope, cls, color, selectedAccountId, allMonths }) => {
  const { dateFilter, setDateFilter, customFrom, customTo, setCustomFrom, setCustomTo, filteredMonths } = useDateFilter(allMonths)

  const rawData = useMemo(() => {
    if (selectedAccountId != null && getAccountHistory) {
      return getAccountHistory(selectedAccountId)
    }
    if (!getClassHistory) return []
    return getClassHistory(scope, cls).filter(d => d.value !== 0)
  }, [getClassHistory, getAccountHistory, scope, cls, selectedAccountId])

  const data = useMemo(() => {
    if (dateFilter === 'all') return rawData
    const monthSet = new Set(filteredMonths)
    return rawData.filter(d => monthSet.has(d.month))
  }, [rawData, filteredMonths, dateFilter])

  if (rawData.length < 2) return null

  const formatMonth = (m: string) => {
    const [y, mo] = m.split('-')
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${months[parseInt(mo, 10) - 1]} '${y.slice(2)}`
  }

  const shortCurrency = (v: number) => {
    const abs = Math.abs(v)
    if (abs >= 1_000_000) return `${v < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000) return `${v < 0 ? '-' : ''}$${(abs / 1_000).toFixed(0)}K`
    return `$${v.toFixed(0)}`
  }

  const gridColor = 'var(--color-surface-hover)'
  const textColor = 'var(--color-text-muted)'
  const tooltipBg = 'var(--color-surface)'
  const tooltipBorder = 'var(--color-border)'
  const tooltipText = 'var(--color-text)'
  const axisTickStyle = {
    fontSize: 10,
    fill: textColor,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  }
  const tooltipStyle = {
    backgroundColor: tooltipBg,
    border: `1px solid ${tooltipBorder}`,
    borderRadius: 8,
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    padding: '8px 12px',
  }
  const tooltipLabelStyle = { color: textColor, fontSize: 11, fontWeight: 500, marginBottom: 4 }
  const tooltipItemStyle = { color: tooltipText, fontSize: 12, fontWeight: 600, padding: 0 }

  const gradientId = `grad-trend-${cls.replace(/\s/g, '')}`

  return (
    <div className="alloc-trend-chart">
      <DateFilterBar
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        customFrom={customFrom}
        customTo={customTo}
        onFromChange={setCustomFrom}
        onToChange={setCustomTo}
        allMonths={allMonths}
      />
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.15} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={gridColor} />
          <XAxis
            dataKey="month"
            tickFormatter={formatMonth}
            tick={axisTickStyle}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={shortCurrency}
            tick={axisTickStyle}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
            formatter={(v: number | string | ReadonlyArray<number | string> | undefined) =>
              formatCurrency(Number(v))
            }
            labelFormatter={(label) => formatMonth(String(label))}
          />
          <Area
            type="natural"
            dataKey="value"
            stroke="none"
            fill={`url(#${gradientId})`}
            activeDot={false}
            tooltipType="none"
          />
          <Line
            type="natural"
            dataKey="value"
            name="Value"
            stroke={color}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: color }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export default BreakdownSection
