import { FC, useMemo } from 'react'
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
  // Scale each side independently so small expenses aren't dwarfed by large income
  const domainTop = Math.ceil((maxVal * 1.1) / 1000) * 1000 || 1000
  const domainBottom = Math.floor((minVal * 1.1) / 1000) * 1000 || -1000
  const domain: [number, number] = [domainBottom, domainTop]

  const expenseValues = data.filter(d => d.netLine !== null).map(d => d.expense)
  const avgExpense = expenseValues.length > 0 ? expenseValues.reduce((a, b) => a + b, 0) / expenseValues.length : 0
  const medianExpense = (() => {
    const sorted = [...expenseValues].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  })()

  return (
    <div className="cashflow-bar-wrap">
      <h3 className="cashflow-section-title">Cashflow — {year}</h3>
      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart
          data={data}
          margin={{ top: 10, right: 20, bottom: 5, left: 10 }}
          barGap={-48}
          barCategoryGap="20%"
          onClick={e => {
            const activeLabel = typeof e?.activeLabel === 'string' ? e.activeLabel : null
            if (!activeLabel) return
            onSelectPeriod(activeLabel === selectedPeriod ? null : activeLabel)
          }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--cashflow-grid, #e5e7eb)" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
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
                  <div className="cashflow-tooltip-row">
                    <span className="cashflow-tooltip-dot" style={{ background: '#4ade80' }} />
                    <span className="cashflow-tooltip-label">Income</span>
                    <span className="cashflow-tooltip-value">{fmt(income)}</span>
                    {deltaIncome !== null && (
                      <span className={`cashflow-tooltip-delta ${deltaClass(deltaIncome)}`}>
                        {fmtDelta(deltaIncome)}
                      </span>
                    )}
                  </div>
                  <div className="cashflow-tooltip-row">
                    <span className="cashflow-tooltip-dot" style={{ background: '#f87171' }} />
                    <span className="cashflow-tooltip-label">Expenses</span>
                    <span className="cashflow-tooltip-value">{fmt(expense)}</span>
                    {deltaExpense !== null && (
                      <span className={`cashflow-tooltip-delta ${deltaClass(deltaExpense)}`}>
                        {fmtDelta(deltaExpense)}
                      </span>
                    )}
                  </div>
                  <div className="cashflow-tooltip-row">
                    <span className="cashflow-tooltip-dot" style={{ background: 'var(--color-text-muted)' }} />
                    <span className="cashflow-tooltip-label">Net Income</span>
                    <span className="cashflow-tooltip-value">{fmt(net)}</span>
                    {deltaNet !== null && (
                      <span className={`cashflow-tooltip-delta ${deltaClass(deltaNet)}`}>{fmtDelta(deltaNet)}</span>
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
                </div>
              )
            }}
          />
          <ReferenceLine y={0} stroke="var(--cashflow-zero, #9ca3af)" strokeWidth={1} />
          <Bar dataKey="income" name="Income" radius={[4, 4, 0, 0]} maxBarSize={48} cursor="pointer">
            {data.map((_, i) => (
              <Cell key={i} fill="#4ade80" opacity={selectedPeriod && data[i].label !== selectedPeriod ? 0.35 : 1} />
            ))}
          </Bar>
          <Bar dataKey="expense" name="Expense" radius={[4, 4, 0, 0]} maxBarSize={48} cursor="pointer">
            {data.map((_, i) => (
              <Cell key={i} fill="#f87171" opacity={selectedPeriod && data[i].label !== selectedPeriod ? 0.35 : 1} />
            ))}
          </Bar>
          <Line
            dataKey="netLine"
            type="monotone"
            stroke="var(--color-text)"
            strokeWidth={2}
            dot={false}
            activeDot={false}
            connectNulls={false}
          />
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
                    <foreignObject x={cx - 190} y={cy - 30} width={180} height={60} className="cashflow-line-fo">
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
        </ComposedChart>
      </ResponsiveContainer>
      {/* Net cashflow legend */}
      <div className="cashflow-bar-legend">
        {data.map(d => (
          <div key={d.label} className="cashflow-bar-legend-item">
            <span className="cashflow-bar-legend-label">{d.label}</span>
            <span className={`cashflow-bar-legend-net ${d.net >= 0 ? 'positive' : 'negative'}`}>
              {d.net >= 0 ? '+' : ''}
              {fmt(d.net)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default CashflowBarChart
