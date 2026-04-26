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
import { Account, BalanceEntry, formatMonth, formatCurrency } from './types'

type ChartType = 'fi-gw' | 'net-worth' | 'assets-liabilities'
type DateFilter = 'all' | 'ytd' | 'last-12' | 'eoy' | 'custom'

interface BalanceChartsProps {
  accounts: Account[]
  balances: BalanceEntry[]
  allMonths: string[]
  balanceMap: Map<string, number>
}

const CHART_OPTIONS: { key: ChartType; label: string }[] = [
  { key: 'fi-gw', label: 'FI vs GW' },
  { key: 'net-worth', label: 'Net Worth' },
  { key: 'assets-liabilities', label: 'Assets vs Liabilities' },
]

const BalanceCharts: FC<BalanceChartsProps> = ({ accounts, balances: _balances, allMonths, balanceMap }) => {
  const [chartType, setChartType] = useState<ChartType>('fi-gw')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
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
    // allMonths is sorted descending; we want ascending for charts
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

  // Build chart data
  const fiAccounts = accounts.filter(a => a.goalType === 'fi')
  const gwAccounts = accounts.filter(a => a.goalType === 'gw')
  const assetAccounts = accounts.filter(a => (a.nature || 'asset') === 'asset')
  const liabilityAccounts = accounts.filter(a => (a.nature || 'asset') === 'liability')

  const sumForMonth = useCallback(
    (accs: Account[], month: string) =>
      accs.reduce((sum, a) => {
        const val = balanceMap.get(`${a.id}:${month}`)
        return val !== undefined ? sum + val : sum
      }, 0),
    [balanceMap],
  )

  const chartData = useMemo(
    () =>
      filteredMonths.map(month => {
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
      }),
    [filteredMonths, fiAccounts, gwAccounts, assetAccounts, liabilityAccounts, sumForMonth],
  )

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

  const currencyFormatter = (v: number) => formatCurrency(v)
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

  const renderLegend = (props: LegendContentProps) => {
    const { payload } = props
    if (!payload) return null
    return (
      <div className="data-chart-legend">
        {payload.map((entry, i) => (
          <span key={i} className="data-chart-legend-item">
            <span className="data-chart-legend-dot" style={{ background: entry.color }} />
            {entry.value}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="data-charts">
      <div className="data-charts-controls">
        <div className="data-charts-type-picker">
          {CHART_OPTIONS.map(opt => (
            <button
              key={opt.key}
              className={`data-filter-btn${chartType === opt.key ? ' active' : ''}`}
              onClick={() => setChartType(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="data-charts-date-filter">
          {(
            [
              ['all', 'All'],
              ['ytd', 'YTD'],
              ['last-12', 'Last 12 mo'],
              ['eoy', 'Year-End'],
              ['custom', 'Custom'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={`data-filter-btn data-filter-btn--sm${dateFilter === key ? ' active' : ''}`}
              onClick={() => setDateFilter(key as DateFilter)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {dateFilter === 'custom' && (
        <div className="data-charts-custom-range">
          <div className="data-range-picker">
            <select
              className="data-range-select"
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
              className="data-range-select"
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
          <span className="data-range-sep">to</span>
          <div className="data-range-picker">
            <select
              className="data-range-select"
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
              className="data-range-select"
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

      <div className="data-chart-area">
        {chartData.length === 0 ? (
          <div className="data-chart-empty">No data for the selected range</div>
        ) : chartType === 'fi-gw' ? (
          <ResponsiveContainer width="100%" height={380}>
            <LineChart data={chartData} margin={{ top: 10, right: 24, bottom: 0, left: 10 }}>
              <defs>
                <linearGradient id="gradFi" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradGw" x1="0" y1="0" x2="0" y2="1">
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
                tickFormatter={currencyFormatter}
                tick={axisTickStyle}
                axisLine={false}
                tickLine={false}
                width={80}
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
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: '#6366f1' }}
              />
              <Line
                type="natural"
                dataKey="gw"
                name="GW"
                stroke="#f59e0b"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: '#f59e0b' }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : chartType === 'net-worth' ? (
          <ResponsiveContainer width="100%" height={380}>
            <LineChart data={chartData} margin={{ top: 10, right: 24, bottom: 0, left: 10 }}>
              <defs>
                <linearGradient id="gradNw" x1="0" y1="0" x2="0" y2="1">
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
                tickFormatter={currencyFormatter}
                tick={axisTickStyle}
                axisLine={false}
                tickLine={false}
                width={80}
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
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: '#10b981' }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={380}>
            <BarChart data={chartData} margin={{ top: 10, right: 24, bottom: 0, left: 10 }} stackOffset="sign">
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
                tickFormatter={currencyFormatter}
                tick={axisTickStyle}
                axisLine={false}
                tickLine={false}
                width={80}
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
              <Bar dataKey="assets" name="Assets" fill="#6366f1" radius={[3, 3, 0, 0]} />
              <Bar dataKey="liabilities" name="Liabilities" fill="#ef4444" radius={[0, 0, 3, 3]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

export default BalanceCharts
