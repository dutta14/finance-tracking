import React, { FC, useState, useMemo, useCallback } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from 'recharts'
import type { Props as LegendContentProps } from 'recharts/types/component/DefaultLegendContent'
import { Account, BalanceEntry, formatMonth, formatCurrency } from '../data/types'
import { useDateFilter } from '../../hooks/useDateFilter'
import { DateFilterBar } from '../../components/DateFilterBar'

type MiniChartType = 'fi-gw' | 'net-worth' | 'assets-liabilities'

interface MiniChartsProps {
  accounts: Account[]
  balances: BalanceEntry[]
  balanceMap: Map<string, number>
  allMonths: string[]
  onNavigate: () => void
}

interface ChartDatum {
  month: string
  label: string
  fi: number
  gw: number
  netWorth: number
  assets: number
  liabilities: number
}

type ChartMetricKey = 'fi' | 'gw' | 'netWorth' | 'assets' | 'liabilities'

interface TooltipPayloadItem {
  color?: string
  dataKey?: string | number | ((obj: unknown) => unknown)
  name?: string | number
  value?: unknown
}

const isChartMetricKey = (dataKey: string): dataKey is ChartMetricKey =>
  ['fi', 'gw', 'netWorth', 'assets', 'liabilities'].includes(dataKey)

const CHART_OPTIONS: { key: MiniChartType; label: string }[] = [
  { key: 'net-worth', label: 'Net Worth' },
  { key: 'fi-gw', label: 'FI vs GW' },
  { key: 'assets-liabilities', label: 'Assets / Liabilities' },
]

const MiniCharts: FC<MiniChartsProps> = ({ accounts, balances, balanceMap, allMonths, onNavigate }) => {
  const [chartType, setChartType] = useState<MiniChartType>('net-worth')
  const { dateFilter, setDateFilter, customFrom, customTo, setCustomFrom, setCustomTo, filteredMonths } = useDateFilter(
    allMonths,
    'last-12',
  )

  const fiAccounts = useMemo(() => accounts.filter(a => a.goalType === 'fi'), [accounts])
  const gwAccounts = useMemo(() => accounts.filter(a => a.goalType === 'gw'), [accounts])
  const assetAccounts = useMemo(() => accounts.filter(a => (a.nature || 'asset') === 'asset'), [accounts])
  const liabilityAccounts = useMemo(() => accounts.filter(a => (a.nature || 'asset') === 'liability'), [accounts])

  const sumForMonth = useCallback(
    (accs: Account[], month: string) =>
      accs.reduce((sum, a) => {
        const val = balanceMap.get(`${a.id}:${month}`)
        return val !== undefined ? sum + val : sum
      }, 0),
    [balanceMap],
  )

  const chartData = useMemo<ChartDatum[]>(() => {
    return filteredMonths.map(month => {
      const fi = sumForMonth(fiAccounts, month)
      const gw = sumForMonth(gwAccounts, month)
      const assets = sumForMonth(assetAccounts, month)
      const liabilities = sumForMonth(liabilityAccounts, month)
      return {
        month,
        label: formatMonth(month),
        fi,
        gw,
        netWorth: assets + liabilities,
        assets,
        liabilities,
      }
    })
  }, [filteredMonths, fiAccounts, gwAccounts, assetAccounts, liabilityAccounts, sumForMonth])

  const yDomain = useMemo((): [number, number] => {
    if (chartData.length === 0) return [0, 0]
    let min = Infinity,
      max = -Infinity
    for (const d of chartData) {
      const vals =
        chartType === 'fi-gw' ? [d.fi, d.gw] : chartType === 'net-worth' ? [d.netWorth] : [d.assets, d.liabilities]
      for (const v of vals) {
        if (v < min) min = v
        if (v > max) max = v
      }
    }
    const pad = (max - min) * 0.05 || 1
    return [min - pad, max + pad]
  }, [chartData, chartType])

  const gridColor = 'var(--color-surface-hover)'
  const textColor = 'var(--color-text-muted)'
  const tooltipBg = 'var(--color-surface)'
  const tooltipBorder = 'var(--color-border)'
  const tooltipText = 'var(--color-text)'

  const axisTickStyle = {
    fontSize: 9,
    fill: textColor,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  }
  const tooltipStyle = {
    backgroundColor: tooltipBg,
    border: `1px solid ${tooltipBorder}`,
    borderRadius: 8,
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    padding: '6px 10px',
  }
  const tooltipLabelStyle = { color: textColor, fontSize: 10, fontWeight: 500, marginBottom: 2 }
  const tooltipItemStyle = { color: tooltipText, fontSize: 11, fontWeight: 600, padding: 0 }
  const positiveDeltaColor = '#16a34a'
  const negativeDeltaColor = '#dc2626'
  const getRawTooltipValue = useCallback((point: ChartDatum, dataKey?: ChartMetricKey) => (dataKey ? point[dataKey] : null), [])
  const getTooltipValue = useCallback(
    (point: ChartDatum, dataKey?: ChartMetricKey) => {
      if (!dataKey) return null
      const value = point[dataKey]
      return typeof value === 'number' ? (chartType === 'assets-liabilities' ? Math.abs(value) : value) : null
    },
    [chartType],
  )
  const formatDelta = useCallback((value: number, prevValue: number) => {
    const delta = value - prevValue
    const sign = delta >= 0 ? '+' : '-'
    const amount = `${sign}${formatCurrency(Math.abs(delta))}`
    if (prevValue === 0) return amount
    const pct = `${sign}${((Math.abs(delta) / Math.abs(prevValue)) * 100).toFixed(1)}%`
    return `${amount} (${pct})`
  }, [])
  const renderTooltip = useCallback(
    ({
      active,
      label,
      payload,
    }: {
      active?: boolean
      label?: string | number
      payload?: readonly TooltipPayloadItem[]
    }) => {
      if (!active || !payload?.length || typeof label !== 'string') return null
      const index = chartData.findIndex(point => point.label === label)
      if (index < 0) return null
      const prevPoint = index > 0 ? chartData[index - 1] : null
      const seen = new Set<string>()
      const items = payload
        .map(item => {
          if (
            typeof item.name !== 'string' ||
            typeof item.dataKey !== 'string' ||
            !isChartMetricKey(item.dataKey) ||
            item.value == null ||
            seen.has(item.dataKey)
          ) {
            return null
          }
          seen.add(item.dataKey)
          const value = getTooltipValue(chartData[index], item.dataKey)
          if (value == null) return null
          const prevValue = prevPoint ? getTooltipValue(prevPoint, item.dataKey) : null
          const rawValue = getRawTooltipValue(chartData[index], item.dataKey)
          const prevRawValue = prevPoint ? getRawTooltipValue(prevPoint, item.dataKey) : null
          const deltaColor =
            rawValue != null && prevRawValue != null
              ? rawValue - prevRawValue > 0
                ? positiveDeltaColor
                : rawValue - prevRawValue < 0
                  ? negativeDeltaColor
                  : tooltipText
              : null
          return { ...item, value, delta: prevValue == null ? null : formatDelta(value, prevValue), deltaColor }
        })
        .filter((item): item is TooltipPayloadItem & { value: number; delta: string | null; deltaColor: string | null } => item !== null)
      if (!items.length) return null
      return (
        <div style={tooltipStyle}>
          <div style={tooltipLabelStyle}>{label}</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr 1fr',
              alignItems: 'baseline',
              columnGap: 14,
              rowGap: 4,
            }}
          >
            {items.map((item, itemIndex) => (
              <React.Fragment key={`${String(item.dataKey)}-${itemIndex}`}>
                <div style={{ ...tooltipItemStyle, whiteSpace: 'nowrap' }}>{item.name}</div>
                <div style={{ ...tooltipItemStyle, whiteSpace: 'nowrap', textAlign: 'right' }}>
                  {formatCurrency(item.value)}
                </div>
                {item.delta ? (
                  <div
                    style={{
                      color: item.deltaColor ?? tooltipText,
                      fontSize: 11,
                      fontWeight: 500,
                      textAlign: 'right',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.delta}
                  </div>
                ) : (
                  <div />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )
    },
    [
      chartData,
      formatDelta,
      getRawTooltipValue,
      getTooltipValue,
      negativeDeltaColor,
      positiveDeltaColor,
      tooltipLabelStyle,
      tooltipStyle,
      tooltipItemStyle,
      tooltipText,
    ],
  )
  const shortCurrency = (v: number) => {
    const abs = Math.abs(v)
    if (abs >= 1_000_000) return `${v < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000) return `${v < 0 ? '-' : ''}$${(abs / 1_000).toFixed(0)}K`
    return formatCurrency(v)
  }

  const renderLegend = (props: LegendContentProps) => {
    const { payload } = props
    if (!payload) return null
    return (
      <div className="data-chart-legend data-chart-legend--compact">
        {payload.map((entry, i) => (
          <span key={i} className="data-chart-legend-item data-chart-legend-item--sm">
            <span className="data-chart-legend-dot data-chart-legend-dot--sm" style={{ background: entry.color }} />
            {entry.value}
          </span>
        ))}
      </div>
    )
  }

  if (balances.length === 0) {
    return (
      <div className="home-card home-card--charts">
        <div className="home-card-header">
          <h3>Charts</h3>
          <button className="home-card-link" onClick={onNavigate}>
            View Charts →
          </button>
        </div>
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
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <p>Charts will appear once you have balance data across multiple months.</p>
          <button className="home-card-cta-btn" onClick={onNavigate}>
            Record balances →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="home-card home-card--charts">
      <div className="home-card-header">
        <h3>Charts</h3>
        <button className="home-card-link" onClick={onNavigate}>
          View Charts →
        </button>
      </div>
      <div className="home-mini-chart-tabs">
        {CHART_OPTIONS.map(opt => (
          <button
            key={opt.key}
            className={`home-mini-tab${chartType === opt.key ? ' active' : ''}`}
            onClick={() => setChartType(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <DateFilterBar
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        customFrom={customFrom}
        customTo={customTo}
        onFromChange={setCustomFrom}
        onToChange={setCustomTo}
        allMonths={allMonths}
      />
      <div className="home-mini-chart-area">
        {chartType === 'fi-gw' ? (
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="miniGradFi" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="miniGradGw" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={gridColor} />
              <XAxis
                dataKey="label"
                tick={axisTickStyle}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={yDomain}
                tickFormatter={shortCurrency}
                tick={axisTickStyle}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip
                content={renderTooltip}
              />
              <Legend content={renderLegend} />
              <Area
                type="natural"
                dataKey="fi"
                name="FI"
                stroke="none"
                fill="url(#miniGradFi)"
                activeDot={false}
                tooltipType="none"
                legendType="none"
              />
              <Area
                type="natural"
                dataKey="gw"
                name="GW"
                stroke="none"
                fill="url(#miniGradGw)"
                activeDot={false}
                tooltipType="none"
                legendType="none"
              />
              <Line
                type="natural"
                dataKey="fi"
                name="FI"
                stroke="#6366f1"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0, fill: '#6366f1' }}
              />
              <Line
                type="natural"
                dataKey="gw"
                name="GW"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0, fill: '#f59e0b' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : chartType === 'net-worth' ? (
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="miniGradNw" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={gridColor} />
              <XAxis
                dataKey="label"
                tick={axisTickStyle}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={yDomain}
                tickFormatter={shortCurrency}
                tick={axisTickStyle}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip
                content={renderTooltip}
              />
              <Area
                type="natural"
                dataKey="netWorth"
                name="Net Worth"
                stroke="none"
                fill="url(#miniGradNw)"
                activeDot={false}
                tooltipType="none"
                legendType="none"
              />
              <Line
                type="natural"
                dataKey="netWorth"
                name="Net Worth"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0, fill: '#10b981' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }} stackOffset="sign">
              <CartesianGrid vertical={false} stroke={gridColor} />
              <XAxis
                dataKey="label"
                tick={axisTickStyle}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={yDomain}
                tickFormatter={shortCurrency}
                tick={axisTickStyle}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip
                content={renderTooltip}
              />
              <Legend content={renderLegend} />
              <ReferenceLine y={0} stroke="var(--color-border-light)" strokeWidth={1} />
              <Bar dataKey="assets" name="Assets" stackId="al" fill="#4ade80" radius={[3, 3, 0, 0]} />
              <Bar dataKey="liabilities" name="Liabilities" stackId="al" fill="#f87171" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

export default MiniCharts
