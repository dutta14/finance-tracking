import { FC, useState, useMemo, useCallback } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
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

type MiniChartType = 'fi-gw' | 'net-worth' | 'assets-liabilities'
type DateFilter = 'all' | 'ytd' | 'last-12' | 'eoy' | 'custom'

interface MiniChartsProps {
  accounts: Account[]
  balances: BalanceEntry[]
  balanceMap: Map<string, number>
  allMonths: string[]
  onNavigate: () => void
}

const CHART_OPTIONS: { key: MiniChartType; label: string }[] = [
  { key: 'fi-gw', label: 'FI vs GW' },
  { key: 'net-worth', label: 'Net Worth' },
  { key: 'assets-liabilities', label: 'Assets / Liabilities' },
]

const MiniCharts: FC<MiniChartsProps> = ({ accounts, balances, balanceMap, allMonths, onNavigate }) => {
  const [chartType, setChartType] = useState<MiniChartType>('net-worth')
  const [dateFilter, setDateFilter] = useState<DateFilter>('last-12')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const availableYears = useMemo(() => {
    const years = new Set(allMonths.map(m => m.slice(0, 4)))
    return [...years].sort()
  }, [allMonths])

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const val = String(i + 1).padStart(2, '0')
        const label = new Date(2000, i).toLocaleString('default', { month: 'short' })
        return { val, label }
      }),
    [],
  )

  const filteredMonths = useMemo(() => {
    const ascending = [...allMonths].reverse()
    if (dateFilter === 'all') return ascending
    const now = new Date()
    const yr = now.getFullYear().toString()
    const cur = `${yr}-${String(now.getMonth() + 1).padStart(2, '0')}`
    switch (dateFilter) {
      case 'ytd':
        return ascending.filter(m => m >= `${yr}-01` && m <= cur)
      case 'last-12':
        return ascending.slice(-12)
      case 'eoy':
        return ascending.filter(m => m.endsWith('-12'))
      case 'custom':
        return ascending.filter(m => (!customFrom || m >= customFrom) && (!customTo || m <= customTo))
      default:
        return ascending
    }
  }, [dateFilter, allMonths, customFrom, customTo])

  const setCustomMonth = (which: 'from' | 'to', part: 'year' | 'month', value: string) => {
    const setter = which === 'from' ? setCustomFrom : setCustomTo
    const current = which === 'from' ? customFrom : customTo
    const [y, m] = current ? current.split('-') : ['', '']
    if (part === 'year') setter(value ? `${value}-${m || '01'}` : '')
    else setter(y ? `${y}-${value}` : '')
  }

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

  const chartData = useMemo(() => {
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
      <div className="data-chart-legend" style={{ paddingTop: 4, gap: 10 }}>
        {payload.map((entry, i) => (
          <span key={i} className="data-chart-legend-item" style={{ fontSize: '0.7rem' }}>
            <span className="data-chart-legend-dot" style={{ background: entry.color, width: 6, height: 6 }} />
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
            View Data →
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
          View Data →
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
      <div className="home-mini-date-filter">
        {(
          [
            ['all', 'All'],
            ['ytd', 'YTD'],
            ['last-12', '12 mo'],
            ['eoy', 'Year-End'],
            ['custom', 'Custom'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            className={`home-mini-date-btn${dateFilter === key ? ' active' : ''}`}
            onClick={() => setDateFilter(key as DateFilter)}
          >
            {label}
          </button>
        ))}
      </div>
      {dateFilter === 'custom' && (
        <div className="home-mini-custom-range">
          <div className="home-mini-range-picker">
            <select
              className="home-mini-range-select"
              value={customFrom ? customFrom.split('-')[0] : ''}
              onChange={e => setCustomMonth('from', 'year', e.target.value)}
            >
              <option value="">Year</option>
              {availableYears.map(yr => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
            <select
              className="home-mini-range-select"
              value={customFrom ? customFrom.split('-')[1] : ''}
              onChange={e => setCustomMonth('from', 'month', e.target.value)}
            >
              <option value="">Month</option>
              {monthOptions.map(({ val, label }) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <span className="home-mini-range-sep">to</span>
          <div className="home-mini-range-picker">
            <select
              className="home-mini-range-select"
              value={customTo ? customTo.split('-')[0] : ''}
              onChange={e => setCustomMonth('to', 'year', e.target.value)}
            >
              <option value="">Year</option>
              {availableYears.map(yr => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
            <select
              className="home-mini-range-select"
              value={customTo ? customTo.split('-')[1] : ''}
              onChange={e => setCustomMonth('to', 'month', e.target.value)}
            >
              <option value="">Month</option>
              {monthOptions.map(({ val, label }) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      <div className="home-mini-chart-area">
        {chartType === 'fi-gw' ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
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
                contentStyle={tooltipStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
                formatter={(v: number | string | ReadonlyArray<number | string> | undefined) =>
                  formatCurrency(Number(v))
                }
              />
              <Legend content={renderLegend} />
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
            </LineChart>
          </ResponsiveContainer>
        ) : chartType === 'net-worth' ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
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
                contentStyle={tooltipStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
                formatter={(v: number | string | ReadonlyArray<number | string> | undefined) =>
                  formatCurrency(Number(v))
                }
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
            </LineChart>
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
                contentStyle={tooltipStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
                formatter={(v: number | string | ReadonlyArray<number | string> | undefined) =>
                  formatCurrency(Math.abs(Number(v)))
                }
              />
              <Legend content={renderLegend} />
              <ReferenceLine y={0} stroke="var(--color-border-light)" strokeWidth={1} />
              <Bar dataKey="assets" name="Assets" fill="#6366f1" radius={[2, 2, 0, 0]} />
              <Bar dataKey="liabilities" name="Liabilities" fill="#ef4444" radius={[0, 0, 2, 2]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

export default MiniCharts
