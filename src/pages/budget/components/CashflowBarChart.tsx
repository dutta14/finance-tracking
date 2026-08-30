import { FC, useMemo, useRef, useState, useEffect, useCallback } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
  Cell,
} from 'recharts'
import { Transaction, TimePeriod } from '../types'

interface CashflowBarChartProps {
  year: number
  yearTransactions: Record<string, Transaction[]>
  timePeriod: TimePeriod
  removedCategories: Set<string>
  incomeCatSet: Set<string>
  selectedPeriod: string | null
  onSelectPeriod: (label: string | null) => void
}

type CashflowView = 'combined' | 'income' | 'expenses'
const VIEW_LABELS: { key: CashflowView; label: string }[] = [
  { key: 'combined', label: 'Combined' },
  { key: 'income', label: 'Income' },
  { key: 'expenses', label: 'Expenses' },
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']
const HALVES = ['H1', 'H2']

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })

const CashflowBarChart: FC<CashflowBarChartProps> = ({
  year,
  yearTransactions,
  timePeriod,
  removedCategories,
  incomeCatSet,
  selectedPeriod,
  onSelectPeriod,
}) => {
  const wrapRef = useRef<HTMLDivElement>(null)
  const viewTabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [incomeColor, setIncomeColor] = useState('#4ade80')
  const [expenseColor, setExpenseColor] = useState('#f87171')
  const [viewMode, setViewMode] = useState<CashflowView>('combined')

  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally runs every render to detect theme changes
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const styles = getComputedStyle(el)
    const nextIncome = styles.getPropertyValue('--chart-positive').trim() || '#4ade80'
    const nextExpense = styles.getPropertyValue('--chart-negative').trim() || '#f87171'
    if (nextIncome !== incomeColor) setIncomeColor(nextIncome)
    if (nextExpense !== expenseColor) setExpenseColor(nextExpense)
  })

  const data = useMemo(() => {
    const filter = (txns: Transaction[]) => txns.filter(t => !removedCategories.has(t.category))
    const isIncome = (t: Transaction) => incomeCatSet.has(t.category)
    const isExpense = (t: Transaction) => !incomeCatSet.has(t.category)

    const aggregate = (txns: Transaction[]) => {
      let income = 0,
        expense = 0
      txns.forEach(t => {
        if (isIncome(t)) income += t.amount
        else if (isExpense(t)) expense += t.amount // t.amount is already negative for expenses
      })
      return { income, expense }
    }

    if (timePeriod === 'month') {
      return MONTHS.map((label, i) => {
        const key = `${year}-${String(i + 1).padStart(2, '0')}`
        const txns = yearTransactions[key] || []
        const { income, expense } = aggregate(filter(txns))
        const hasData = txns.length > 0
        return { label, income, expense, net: income + expense, netLine: hasData ? income + expense : null }
      })
    }
    if (timePeriod === 'quarter') {
      return QUARTERS.map((label, qi) => {
        let income = 0,
          expense = 0,
          hasData = false
        for (let m = qi * 3; m < qi * 3 + 3; m++) {
          const key = `${year}-${String(m + 1).padStart(2, '0')}`
          const txns = yearTransactions[key] || []
          if (txns.length > 0) hasData = true
          const agg = aggregate(filter(txns))
          income += agg.income
          expense += agg.expense
        }
        return { label, income, expense, net: income + expense, netLine: hasData ? income + expense : null }
      })
    }
    // half
    return HALVES.map((label, hi) => {
      let income = 0,
        expense = 0,
        hasData = false
      for (let m = hi * 6; m < hi * 6 + 6; m++) {
        const key = `${year}-${String(m + 1).padStart(2, '0')}`
        const txns = yearTransactions[key] || []
        if (txns.length > 0) hasData = true
        const agg = aggregate(filter(txns))
        income += agg.income
        expense += agg.expense
      }
      return { label, income, expense, net: income + expense, netLine: hasData ? income + expense : null }
    })
  }, [year, yearTransactions, timePeriod, removedCategories, incomeCatSet])

  const maxVal = Math.max(...data.map(d => d.income), 1)
  const minVal = Math.min(...data.map(d => d.expense), -1)

  const domain: [number, number] = useMemo(() => {
    if (viewMode === 'income') {
      const top = Math.ceil((maxVal * 1.1) / 1000) * 1000 || 1000
      return [0, top]
    }
    if (viewMode === 'expenses') {
      const bottom = Math.floor((minVal * 1.1) / 1000) * 1000 || -1000
      return [bottom, 0]
    }
    const top = Math.ceil((maxVal * 1.1) / 1000) * 1000 || 1000
    const bottom = Math.floor((minVal * 1.1) / 1000) * 1000 || -1000
    return [bottom, top]
  }, [maxVal, minVal, viewMode])

  const expenseValues = data.filter(d => d.netLine !== null).map(d => d.expense)
  const avgExpense = expenseValues.length > 0 ? expenseValues.reduce((a, b) => a + b, 0) / expenseValues.length : 0
  const medianExpense = (() => {
    const sorted = [...expenseValues].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  })()

  const incomeValues = data.filter(d => d.netLine !== null).map(d => d.income)
  const avgIncome = incomeValues.length > 0 ? incomeValues.reduce((a, b) => a + b, 0) / incomeValues.length : 0
  const selectablePeriods = data.filter(d => d.netLine !== null)

  const showIncome = viewMode !== 'expenses'
  const showExpenses = viewMode !== 'income'
  const showNetLine = viewMode === 'combined'

  const focusViewTab = useCallback((index: number) => {
    requestAnimationFrame(() => {
      viewTabRefs.current[index]?.focus()
    })
  }, [])

  const activateViewTab = useCallback(
    (index: number) => {
      const nextView = VIEW_LABELS[index]
      if (!nextView) return
      setViewMode(nextView.key)
      focusViewTab(index)
    },
    [focusViewTab],
  )

  const handleViewTabKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault()
        activateViewTab((index + 1) % VIEW_LABELS.length)
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault()
        activateViewTab((index - 1 + VIEW_LABELS.length) % VIEW_LABELS.length)
      } else if (event.key === 'Home') {
        event.preventDefault()
        activateViewTab(0)
      } else if (event.key === 'End') {
        event.preventDefault()
        activateViewTab(VIEW_LABELS.length - 1)
      }
    },
    [activateViewTab],
  )

  return (
    <>
      <div className="cashflow-header">
        <h3 className="cashflow-section-title">Cashflow — {year}</h3>
        <div className="cashflow-view-tabs tab-bar" role="tablist" aria-label="Cashflow views">
          {VIEW_LABELS.map(({ key, label }, index) => (
            <button
              key={key}
              ref={node => {
                viewTabRefs.current[index] = node
              }}
              type="button"
              className={`tab-btn tab-btn--sm${viewMode === key ? ' active' : ''}`}
              role="tab"
              id={`cashflow-bar-tab-${key}`}
              aria-selected={viewMode === key}
              aria-controls="cashflow-bar-panel"
              tabIndex={viewMode === key ? 0 : -1}
              onClick={() => setViewMode(key)}
              onKeyDown={event => handleViewTabKeyDown(event, index)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div
        className="cashflow-bar-wrap"
        ref={wrapRef}
        id="cashflow-bar-panel"
        role="tabpanel"
        aria-labelledby={`cashflow-bar-tab-${viewMode}`}
      >
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 20, bottom: 5, left: 10 }}
            barGap={viewMode === 'combined' ? -48 : 0}
            barCategoryGap="20%"
            onClick={e => {
              const activeLabel = typeof e?.activeLabel === 'string' ? e.activeLabel : null
              if (!activeLabel) return
              onSelectPeriod(activeLabel === selectedPeriod ? null : activeLabel)
            }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--cashflow-grid, #e5e7eb)" />
            <XAxis
              dataKey="label"
              tick={({ x, y, payload }: { x: number | string; y: number | string; payload: { value: string } }) => {
                const label = payload.value
                const hasData = selectablePeriods.some(d => d.label === label)
                const isActive = selectedPeriod === label
                if (!hasData) {
                  return (
                    <g transform={`translate(${x},${y})`}>
                      <text x={0} y={0} dy={16} textAnchor="middle" fontSize={12} fill="var(--text-tertiary, #9ca3af)">
                        {label}
                      </text>
                    </g>
                  )
                }
                const btnW = 36
                const btnH = 22
                return (
                  <g transform={`translate(${x},${y})`}>
                    <foreignObject x={-btnW / 2} y={2} width={btnW} height={btnH}>
                      <button
                        type="button"
                        className={`cashflow-axis-btn${isActive ? ' cashflow-axis-btn--active' : ''}`}
                        aria-pressed={isActive}
                        aria-label={`Filter ${label}`}
                        onClick={e => {
                          e.stopPropagation()
                          onSelectPeriod(isActive ? null : label)
                        }}
                      >
                        {label}
                      </button>
                    </foreignObject>
                  </g>
                )
              }}
            />
            <YAxis
              domain={domain}
              tickFormatter={v => {
                const abs = Math.abs(v as number)
                if (abs >= 1000) return `$${(abs / 1000).toFixed(0)}k`
                return `$${abs}`
              }}
              tick={{ fontSize: 11 }}
              width={55}
            />
            <Tooltip
              content={({ active, label, payload }) => {
                if (!active || !payload || payload.length === 0) return null
                const income = (payload.find(p => p.dataKey === 'income')?.value as number) || 0
                const expense = (payload.find(p => p.dataKey === 'expense')?.value as number) || 0
                const net = income + expense
                const savingsRate = income > 0 ? (net / income) * 100 : 0

                // Find previous period for delta
                const idx = data.findIndex(d => d.label === label)
                const prev = idx > 0 ? data[idx - 1] : null
                const prevNet = prev ? prev.income + prev.expense : null
                const prevSavingsRate =
                  prev && prev.income > 0 ? ((prev.income + prev.expense) / prev.income) * 100 : null

                const deltaIncome = prev ? income - prev.income : null
                const deltaExpense = prev ? expense - prev.expense : null
                const deltaNet = prevNet !== null ? net - prevNet : null
                const deltaSavings = prevSavingsRate !== null ? savingsRate - prevSavingsRate : null

                const fmtDelta = (d: number | null) => {
                  if (d === null) return null
                  const sign = d >= 0 ? '+' : ''
                  return `${sign}${fmt(d)}`
                }
                const fmtDeltaPct = (d: number | null) => {
                  if (d === null) return null
                  const sign = d >= 0 ? '+' : ''
                  return `${sign}${d.toFixed(1)}%`
                }

                const deltaClass = (d: number | null) => {
                  if (d === null || d === 0) return ''
                  return d > 0 ? 'cashflow-tooltip-delta--positive' : 'cashflow-tooltip-delta--negative'
                }

                return (
                  <div className="cashflow-tooltip">
                    <div className="cashflow-tooltip-title">
                      {label} {year}
                    </div>
                    {showIncome && (
                      <div className="cashflow-tooltip-row">
                        <span className="cashflow-tooltip-dot" style={{ background: incomeColor }} />
                        <span className="cashflow-tooltip-label">Income</span>
                        <span className="cashflow-tooltip-value">{fmt(income)}</span>
                        {deltaIncome !== null && (
                          <span className={`cashflow-tooltip-delta ${deltaClass(deltaIncome)}`}>
                            {fmtDelta(deltaIncome)}
                          </span>
                        )}
                      </div>
                    )}
                    {showExpenses && (
                      <div className="cashflow-tooltip-row">
                        <span className="cashflow-tooltip-dot" style={{ background: expenseColor }} />
                        <span className="cashflow-tooltip-label">Expenses</span>
                        <span className="cashflow-tooltip-value">{fmt(expense)}</span>
                        {deltaExpense !== null && (
                          <span className={`cashflow-tooltip-delta ${deltaClass(deltaExpense)}`}>
                            {fmtDelta(deltaExpense)}
                          </span>
                        )}
                      </div>
                    )}
                    {showNetLine && (
                      <>
                        <div className="cashflow-tooltip-row">
                          <span className="cashflow-tooltip-dot" style={{ background: 'var(--color-text-muted)' }} />
                          <span className="cashflow-tooltip-label">Net Income</span>
                          <span className="cashflow-tooltip-value">{fmt(net)}</span>
                          {deltaNet !== null && (
                            <span className={`cashflow-tooltip-delta ${deltaClass(deltaNet)}`}>
                              {fmtDelta(deltaNet)}
                            </span>
                          )}
                        </div>
                        <div className="cashflow-tooltip-row">
                          <span className="cashflow-tooltip-dot" style={{ background: 'var(--color-text-muted)' }} />
                          <span className="cashflow-tooltip-label">Savings Rate</span>
                          <span className="cashflow-tooltip-value">{savingsRate.toFixed(1)}%</span>
                          {deltaSavings !== null && (
                            <span className={`cashflow-tooltip-delta ${deltaClass(deltaSavings)}`}>
                              {fmtDeltaPct(deltaSavings)}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )
              }}
            />
            <ReferenceLine y={0} stroke="var(--cashflow-zero, #9ca3af)" strokeWidth={1} />
            {showIncome && (
              <Bar dataKey="income" name="Income" radius={[4, 4, 0, 0]} maxBarSize={48} cursor="pointer">
                {data.map((_, i) => (
                  <Cell
                    key={i}
                    fill={incomeColor}
                    opacity={selectedPeriod && data[i].label !== selectedPeriod ? 0.35 : 1}
                  />
                ))}
              </Bar>
            )}
            {showExpenses && (
              <Bar dataKey="expense" name="Expense" radius={[4, 4, 0, 0]} maxBarSize={48} cursor="pointer">
                {data.map((_, i) => (
                  <Cell
                    key={i}
                    fill={expenseColor}
                    opacity={selectedPeriod && data[i].label !== selectedPeriod ? 0.35 : 1}
                  />
                ))}
              </Bar>
            )}
            {showNetLine && (
              <Line
                dataKey="netLine"
                type="monotone"
                stroke="var(--color-text)"
                strokeWidth={2}
                dot={false}
                activeDot={false}
                connectNulls={false}
              />
            )}
            {viewMode === 'income' && (
              <ReferenceLine
                y={avgIncome}
                stroke="var(--color-text-muted)"
                strokeDasharray="4 4"
                strokeWidth={1}
                label={
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ((props: any) => {
                    const { viewBox } = props
                    const cx = viewBox.x + viewBox.width + 8
                    const cy = viewBox.y
                    return (
                      <g className="cashflow-line-endpoint">
                        <circle
                          cx={cx}
                          cy={cy}
                          r={5}
                          fill="var(--color-text)"
                          stroke="var(--color-surface)"
                          strokeWidth={2}
                        />
                        <foreignObject x={cx - 190} y={cy - 62} width={180} height={60} className="cashflow-line-fo">
                          <div className="cashflow-line-dot-tooltip">
                            <div className="cashflow-line-dot-row">
                              <span>Avg Income</span>
                              <span>{fmt(avgIncome)}</span>
                            </div>
                          </div>
                        </foreignObject>
                      </g>
                    )
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  }) as any
                }
              />
            )}
            {showExpenses && (
              <ReferenceLine
                y={avgExpense}
                stroke="var(--color-text-muted)"
                strokeDasharray="4 4"
                strokeWidth={1}
                label={
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ((props: any) => {
                    const { viewBox } = props
                    const cx = viewBox.x + viewBox.width + 8
                    const cy = viewBox.y
                    return (
                      <g className="cashflow-line-endpoint">
                        <circle
                          cx={cx}
                          cy={cy}
                          r={5}
                          fill="var(--color-text)"
                          stroke="var(--color-surface)"
                          strokeWidth={2}
                        />
                        <foreignObject x={cx - 190} y={cy - 62} width={180} height={60} className="cashflow-line-fo">
                          <div className="cashflow-line-dot-tooltip">
                            <div className="cashflow-line-dot-row">
                              <span>Average</span>
                              <span>{fmt(avgExpense)}</span>
                            </div>
                            <div className="cashflow-line-dot-row">
                              <span>Median</span>
                              <span>{fmt(medianExpense)}</span>
                            </div>
                          </div>
                        </foreignObject>
                      </g>
                    )
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  }) as any
                }
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}

export default CashflowBarChart
