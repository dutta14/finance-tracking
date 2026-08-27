import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TooltipContentProps, TooltipPayloadEntry } from 'recharts'
import { formatMonth } from '../data/types'
import { parseCSV } from '../budget/utils/csvParser'
import { getIncomeGroups, loadBudgetStore, type BudgetStore } from '../budget/utils/budgetStorage'
import type { FileStore } from '../../utils/fileStoreTypes'

type SpendingMode =
  | 'last-month-vs-prior-month'
  | 'last-month-vs-last-year'
  | 'last-month-vs-average-month'
  | 'this-year-vs-last-year'

interface SpendingPeekProps {
  fileStore: FileStore
  hasBudgetData: boolean
  budgetDataLoaded: boolean
  onNavigate: () => void
}

interface ParsedMonthSpending {
  monthKey: string
  year: number
  daysInMonth: number
  spendingByDay: Map<number, number>
  cumulativeByDay: number[]
  total: number
  lastAvailableDay: number
}

interface ParsedYearSpending {
  cumulativeByDay: number[]
  total: number
  lastAvailableDay: number
}

interface SpendingChartPoint {
  day: number
  current: number | null
  comparison: number
}

interface SpendingChartModel {
  data: SpendingChartPoint[]
  currentLabel: string
  comparisonLabel: string
  currentTooltipLabel: string
  comparisonTooltipLabel: string
  subtitle: string
  lastCurrentDay: number | null
  xTicks: number[]
  yTicks: number[]
  yMax: number
}

const MODE_OPTIONS: { value: SpendingMode; label: string }[] = [
  { value: 'last-month-vs-prior-month', label: 'Last month vs. prior month' },
  { value: 'last-month-vs-last-year', label: 'Last month vs. last year' },
  { value: 'last-month-vs-average-month', label: 'Last month vs. average month' },
  { value: 'this-year-vs-last-year', label: 'This year vs. last year' },
]

const ORANGE = '#f97316'
const GRAY = '#9ca3af'
const DAYS_IN_YEAR = 365

const fullCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const compactCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
})

const formatCurrencyFull = (value: number) => fullCurrencyFormatter.format(value)
const formatCurrencyCompact = (value: number) => compactCurrencyFormatter.format(value).replace('.0', '')

const toMonthParts = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number)
  return { year, month }
}

const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate()

const getPreviousMonthKey = (monthKey: string) => {
  const { year, month } = toMonthParts(monthKey)
  const previousDate = new Date(year, month - 2, 1)
  return `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, '0')}`
}

const getSameMonthLastYearKey = (monthKey: string) => {
  const { year, month } = toMonthParts(monthKey)
  return `${year - 1}-${String(month).padStart(2, '0')}`
}

const isLeapYear = (year: number) => new Date(year, 1, 29).getDate() === 29

const normalizeDayOfYear = (isoDate: string) => {
  const date = new Date(`${isoDate}T00:00:00`)
  const start = new Date(date.getFullYear(), 0, 0)
  const actualDay = Math.floor((date.getTime() - start.getTime()) / 86_400_000)
  if (!isLeapYear(date.getFullYear())) return actualDay

  if (date.getMonth() === 1 && date.getDate() === 29) return 59
  if (date.getMonth() > 1) return actualDay - 1
  return actualDay
}

const buildCumulativeArray = (spendingByDay: Map<number, number>, maxDay: number) => {
  const cumulative: number[] = Array.from({ length: maxDay + 1 }, () => 0)
  let running = 0
  for (let day = 1; day <= maxDay; day += 1) {
    running += spendingByDay.get(day) ?? 0
    cumulative[day] = running
  }
  return cumulative
}

const buildMonthSummary = (
  monthKey: string,
  csvText: string,
  incomeCats: Set<string>,
  removedCats: Set<string>,
): ParsedMonthSpending => {
  const transactions = parseCSV(csvText)
  const { year, month } = toMonthParts(monthKey)
  const daysInMonth = getDaysInMonth(year, month)
  const spendingByDay = new Map<number, number>()

  let total = 0
  let lastAvailableDay = 0

  for (const transaction of transactions) {
    const [, , dayText] = transaction.date.split('-')
    const day = Number(dayText)
    lastAvailableDay = Math.max(lastAvailableDay, day)

    if (incomeCats.has(transaction.category) || removedCats.has(transaction.category)) continue

    const spending = Math.abs(transaction.amount)
    total += spending
    spendingByDay.set(day, (spendingByDay.get(day) ?? 0) + spending)
  }

  return {
    monthKey,
    year,
    daysInMonth,
    spendingByDay,
    cumulativeByDay: buildCumulativeArray(spendingByDay, daysInMonth),
    total,
    lastAvailableDay,
  }
}

const buildYearSummary = (year: number, monthSummaries: ParsedMonthSpending[]): ParsedYearSpending => {
  const spendingByDay = new Map<number, number>()
  let total = 0
  let lastAvailableDay = 0

  monthSummaries.forEach(summary => {
    if (summary.year !== year) return

    summary.spendingByDay.forEach((amount, day) => {
      const normalizedDay = normalizeDayOfYear(`${summary.monthKey}-${String(day).padStart(2, '0')}`)
      spendingByDay.set(normalizedDay, (spendingByDay.get(normalizedDay) ?? 0) + amount)
    })
    total += summary.total
    lastAvailableDay = Math.max(
      lastAvailableDay,
      normalizeDayOfYear(`${summary.monthKey}-${String(Math.max(summary.lastAvailableDay, 1)).padStart(2, '0')}`),
    )
  })

  return {
    cumulativeByDay: buildCumulativeArray(spendingByDay, DAYS_IN_YEAR),
    total,
    lastAvailableDay,
  }
}

const getCumulativeValue = (values: number[], day: number) => values[Math.min(day, values.length - 1)] ?? 0

const buildMonthTicks = (daysInMonth: number) => {
  const ticks: number[] = []
  for (let day = 1; day <= daysInMonth; day += 4) ticks.push(day)
  if (ticks[ticks.length - 1] !== daysInMonth) ticks.push(daysInMonth)
  return ticks
}

const buildYearTicks = () => [1, 49, 97, 145, 193, 241, 289, 337, 365]

const buildYAxisTicks = (maxValue: number) => {
  const step = maxValue <= 5_000 ? 1_000 : maxValue <= 20_000 ? 5_000 : maxValue <= 50_000 ? 10_000 : 25_000
  const roundedMax = Math.max(step, Math.ceil(maxValue / step) * step)
  const ticks: number[] = []
  for (let value = 0; value <= roundedMax; value += step) ticks.push(value)
  return { ticks, roundedMax }
}

const parseBudgetStore = (store: BudgetStore) => {
  const incomeGroups = getIncomeGroups(store.categoryGroups || [])
  const incomeCats = new Set(incomeGroups.flatMap(group => group.categories))
  const removedGroup = (store.categoryGroups || []).find(group => group.id === 'removed')
  const removedCats = new Set(removedGroup?.categories || [])

  const monthKeys = Object.keys(store.csvs).sort((a, b) => b.localeCompare(a))
  const csvMap = Object.fromEntries(monthKeys.map(monthKey => [monthKey, store.csvs[monthKey].csv]))
  const monthSummaries = monthKeys.map(monthKey =>
    buildMonthSummary(monthKey, csvMap[monthKey], incomeCats, removedCats),
  )

  return { monthSummaries }
}

const buildAverageComparison = (monthSummaries: ParsedMonthSpending[], daysInMonth: number) => {
  if (monthSummaries.length === 0) return Array.from({ length: daysInMonth + 1 }, () => 0)

  const cumulativeAverage = Array.from({ length: daysInMonth + 1 }, () => 0)
  for (let day = 1; day <= daysInMonth; day += 1) {
    const totalForDay = monthSummaries.reduce(
      (sum, summary) => sum + getCumulativeValue(summary.cumulativeByDay, day),
      0,
    )
    cumulativeAverage[day] = totalForDay / monthSummaries.length
  }
  return cumulativeAverage
}

const buildChartModel = (mode: SpendingMode, monthSummaries: ParsedMonthSpending[]): SpendingChartModel | null => {
  const currentMonth = monthSummaries[0]
  if (!currentMonth) return null

  const now = new Date()
  const currentCalendarMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const isCurrentMonthIncomplete = currentMonth.monthKey === currentCalendarMonthKey
  const isCurrentYearIncomplete = currentMonth.year === now.getFullYear()

  if (mode === 'this-year-vs-last-year') {
    const currentYear = currentMonth.year
    const previousYear = currentYear - 1
    const currentYearSummary = buildYearSummary(currentYear, monthSummaries)
    const previousYearSummary = buildYearSummary(previousYear, monthSummaries)
    const currentLastDay = isCurrentYearIncomplete ? Math.max(currentYearSummary.lastAvailableDay, 1) : DAYS_IN_YEAR

    const data = Array.from({ length: DAYS_IN_YEAR }, (_, index) => {
      const day = index + 1
      return {
        day,
        current: day <= currentLastDay ? getCumulativeValue(currentYearSummary.cumulativeByDay, day) : null,
        comparison: getCumulativeValue(previousYearSummary.cumulativeByDay, day),
      }
    })

    const maxValue = Math.max(
      ...data.map(point => Math.max(point.current ?? 0, point.comparison)),
      currentYearSummary.total,
      previousYearSummary.total,
    )
    const { ticks, roundedMax } = buildYAxisTicks(maxValue)

    return {
      data,
      currentLabel: 'This year',
      comparisonLabel: 'Last year',
      currentTooltipLabel: String(currentYear),
      comparisonTooltipLabel: String(previousYear),
      subtitle: `${formatCurrencyFull(currentYearSummary.total)} this year`,
      lastCurrentDay: isCurrentYearIncomplete ? currentLastDay : null,
      xTicks: buildYearTicks(),
      yTicks: ticks,
      yMax: roundedMax,
    }
  }

  const comparisonMonthKey =
    mode === 'last-month-vs-prior-month'
      ? getPreviousMonthKey(currentMonth.monthKey)
      : mode === 'last-month-vs-last-year'
        ? getSameMonthLastYearKey(currentMonth.monthKey)
        : null

  const comparisonMonth = comparisonMonthKey
    ? (monthSummaries.find(summary => summary.monthKey === comparisonMonthKey) ?? null)
    : null

  const averageComparison =
    mode === 'last-month-vs-average-month' ? buildAverageComparison(monthSummaries, currentMonth.daysInMonth) : null

  const currentLastDay = isCurrentMonthIncomplete
    ? Math.max(currentMonth.lastAvailableDay, 1)
    : currentMonth.daysInMonth
  const data = Array.from({ length: currentMonth.daysInMonth }, (_, index) => {
    const day = index + 1
    const comparison =
      mode === 'last-month-vs-average-month'
        ? (averageComparison?.[day] ?? 0)
        : comparisonMonth
          ? getCumulativeValue(comparisonMonth.cumulativeByDay, day)
          : 0

    return {
      day,
      current: day <= currentLastDay ? getCumulativeValue(currentMonth.cumulativeByDay, day) : null,
      comparison,
    }
  })

  const maxValue = Math.max(...data.map(point => Math.max(point.current ?? 0, point.comparison)), currentMonth.total)
  const { ticks, roundedMax } = buildYAxisTicks(maxValue)

  return {
    data,
    currentLabel: 'Last month',
    comparisonLabel:
      mode === 'last-month-vs-prior-month'
        ? 'Prior month'
        : mode === 'last-month-vs-last-year'
          ? 'Last year'
          : 'Average month',
    currentTooltipLabel: formatMonth(currentMonth.monthKey),
    comparisonTooltipLabel:
      mode === 'last-month-vs-prior-month'
        ? formatMonth(comparisonMonthKey ?? currentMonth.monthKey)
        : mode === 'last-month-vs-last-year'
          ? formatMonth(comparisonMonthKey ?? currentMonth.monthKey)
          : 'Average month',
    subtitle: `${formatCurrencyFull(currentMonth.total)} ${isCurrentMonthIncomplete ? 'this month' : 'last month'}`,
    lastCurrentDay: isCurrentMonthIncomplete ? currentLastDay : null,
    xTicks: buildMonthTicks(currentMonth.daysInMonth),
    yTicks: ticks,
    yMax: roundedMax,
  }
}

const isPointComplete = (value: number | null | undefined): value is number => typeof value === 'number'
const getTooltipNumericValue = (entry: TooltipPayloadEntry | undefined) =>
  typeof entry?.value === 'number' ? entry.value : null

const SpendingPeek: FC<SpendingPeekProps> = ({ fileStore, hasBudgetData, budgetDataLoaded, onNavigate }) => {
  const [mode, setMode] = useState<SpendingMode>('last-month-vs-prior-month')
  const [budgetStore, setBudgetStore] = useState<BudgetStore | null>(null)
  const [storeLoaded, setStoreLoaded] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const handleSelectMode = useCallback((next: SpendingMode) => {
    setMode(next)
    setDropdownOpen(false)
  }, [])

  useEffect(() => {
    if (!dropdownOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  useEffect(() => {
    if (!hasBudgetData) {
      setBudgetStore(null)
      setStoreLoaded(true)
      return
    }

    let active = true
    setStoreLoaded(false)

    loadBudgetStore(fileStore)
      .then(store => {
        if (active) setBudgetStore(store)
      })
      .catch(() => {
        if (active) setBudgetStore(null)
      })
      .finally(() => {
        if (active) setStoreLoaded(true)
      })

    return () => {
      active = false
    }
  }, [fileStore, hasBudgetData])

  const parsedStore = useMemo(() => {
    if (!budgetStore || Object.keys(budgetStore.csvs || {}).length === 0) return null
    return parseBudgetStore(budgetStore)
  }, [budgetStore])

  const chartModel = useMemo(() => {
    if (!parsedStore) return null
    return buildChartModel(mode, parsedStore.monthSummaries)
  }, [mode, parsedStore])

  const axisTickStyle = {
    fontSize: 10,
    fill: 'var(--color-text-muted)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  }

  const renderCurrentDot = ({ cx, cy, payload }: { cx?: number; cy?: number; payload?: SpendingChartPoint }) => {
    if (
      !chartModel?.lastCurrentDay ||
      !payload ||
      payload.day !== chartModel.lastCurrentDay ||
      !isPointComplete(payload.current) ||
      cx == null ||
      cy == null
    ) {
      return null
    }

    return <circle cx={cx} cy={cy} r={4.5} fill={ORANGE} stroke="var(--color-surface)" strokeWidth={2} />
  }

  const renderTooltip = ({ active, label, payload }: TooltipContentProps) => {
    if (!active || typeof label !== 'number' || !payload?.length || !chartModel) return null

    const currentValue = getTooltipNumericValue(payload.find(item => item.name === chartModel.currentLabel))
    const comparisonValue = getTooltipNumericValue(payload.find(item => item.name === chartModel.comparisonLabel))

    return (
      <div className="spending-peek-tooltip">
        <div className="spending-peek-tooltip-title">Day {label}</div>
        <div className="spending-peek-tooltip-row">
          <span className="spending-peek-tooltip-label">{chartModel.comparisonTooltipLabel}</span>
          <span className="spending-peek-tooltip-value">
            {comparisonValue !== null ? formatCurrencyFull(comparisonValue) : '—'}
          </span>
        </div>
        <div className="spending-peek-tooltip-row">
          <span className="spending-peek-tooltip-label spending-peek-tooltip-label--current">
            {chartModel.currentTooltipLabel}
          </span>
          <span className="spending-peek-tooltip-value">
            {currentValue !== null ? formatCurrencyFull(currentValue) : '—'}
          </span>
        </div>
      </div>
    )
  }

  if (!budgetDataLoaded || (hasBudgetData && !storeLoaded)) {
    return (
      <div className="home-card home-card--spending">
        <div className="home-card-header">
          <h3 className="spending-peek-title">Spending</h3>
          <div className="spending-peek-dropdown">
            <button className="spending-peek-dropdown-trigger" disabled>
              {MODE_OPTIONS[0].label}
              <span className="spending-peek-chevron">▾</span>
            </button>
          </div>
        </div>
        <div className="home-card-empty">Loading spending…</div>
      </div>
    )
  }

  if (!chartModel) {
    return (
      <div className="home-card home-card--spending">
        <div className="home-card-header">
          <h3 className="spending-peek-title">Spending</h3>
          <div className="spending-peek-dropdown" ref={dropdownRef}>
            <button
              className="spending-peek-dropdown-trigger"
              onClick={() => setDropdownOpen(o => !o)}
              aria-haspopup="listbox"
              aria-expanded={dropdownOpen}
              aria-label="Spending comparison mode"
            >
              {MODE_OPTIONS.find(o => o.value === mode)?.label}
              <span className="spending-peek-chevron">▾</span>
            </button>
            {dropdownOpen && (
              <ul className="spending-peek-dropdown-menu" role="listbox">
                {MODE_OPTIONS.map(option => (
                  <li
                    key={option.value}
                    role="option"
                    aria-selected={option.value === mode}
                    className={`spending-peek-dropdown-item${option.value === mode ? ' spending-peek-dropdown-item--active' : ''}`}
                    onClick={() => handleSelectMode(option.value)}
                  >
                    {option.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
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
            aria-hidden="true"
          >
            <path d="M4 19h16" />
            <path d="M6 15l3-4 3 2 6-7" />
          </svg>
          <p>Upload budget CSVs to see how your spending accumulates through the month and year.</p>
          <button className="home-card-cta-btn" onClick={onNavigate}>
            Add budget data →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="home-card home-card--spending">
      <div className="home-card-header">
        <h3>Spending</h3>
        <button className="home-card-link" onClick={onNavigate}>
          View Budget →
        </button>
      </div>
      <div className="spending-peek-controls">
        <span className="spending-peek-total">{chartModel.subtitle}</span>
        <div className="spending-peek-dropdown" ref={dropdownRef}>
          <button
            className="spending-peek-dropdown-trigger"
            onClick={() => setDropdownOpen(o => !o)}
            aria-haspopup="listbox"
            aria-expanded={dropdownOpen}
            aria-label="Spending comparison mode"
          >
            {MODE_OPTIONS.find(o => o.value === mode)?.label}
            <span className="spending-peek-chevron">▾</span>
          </button>
          {dropdownOpen && (
            <ul className="spending-peek-dropdown-menu" role="listbox">
              {MODE_OPTIONS.map(option => (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={option.value === mode}
                  className={`spending-peek-dropdown-item${option.value === mode ? ' spending-peek-dropdown-item--active' : ''}`}
                  onClick={() => handleSelectMode(option.value)}
                >
                  {option.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="spending-peek-chart">
        <ResponsiveContainer width="100%" height={230}>
          <ComposedChart data={chartModel.data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="day"
              type="number"
              domain={[1, chartModel.data.length]}
              ticks={chartModel.xTicks}
              tickFormatter={(value: number) => `Day ${value}`}
              tick={axisTickStyle}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, chartModel.yMax]}
              ticks={chartModel.yTicks}
              tickFormatter={formatCurrencyCompact}
              tick={axisTickStyle}
              axisLine={false}
              tickLine={false}
              width={54}
            />
            <Tooltip content={renderTooltip} />
            <Area
              type="stepAfter"
              dataKey="current"
              name={chartModel.currentLabel}
              stroke={ORANGE}
              strokeWidth={2.5}
              fill={ORANGE}
              fillOpacity={0.18}
              isAnimationActive={false}
              dot={renderCurrentDot}
              activeDot={{ r: 4 }}
              connectNulls={false}
            />
            <Line
              type="stepAfter"
              dataKey="comparison"
              name={chartModel.comparisonLabel}
              stroke={GRAY}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="spending-peek-legend" aria-hidden="true">
        <span className="spending-peek-legend-item">
          <span className="spending-peek-legend-line spending-peek-legend-line--comparison" />
          {chartModel.comparisonLabel}
        </span>
        <span className="spending-peek-legend-item">
          <span className="spending-peek-legend-line spending-peek-legend-line--current" />
          {chartModel.currentLabel}
        </span>
      </div>
    </div>
  )
}

export default SpendingPeek
