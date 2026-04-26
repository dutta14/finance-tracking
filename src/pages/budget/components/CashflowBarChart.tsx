import { FC, useMemo } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid, Cell } from 'recharts'
import { Transaction, TimePeriod } from '../types'

interface CashflowBarChartProps {
  year: number
  yearTransactions: Record<string, Transaction[]>
  timePeriod: TimePeriod
  removedCategories: Set<string>
  categorySums: Record<string, Record<string, number>>
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
  categorySums,
}) => {
  // Classify categories the same way as the budget table:
  // A category with ANY negative month value is "expense"; otherwise "income".
  const expenseCats = useMemo(() => {
    const set = new Set<string>()
    Object.entries(categorySums).forEach(([cat, months]) => {
      if (Object.values(months).some(v => v < 0)) set.add(cat)
    })
    return set
  }, [categorySums])

  const data = useMemo(() => {
    const filter = (txns: Transaction[]) => txns.filter(t => !removedCategories.has(t.category))
    const isExpense = (t: Transaction) => expenseCats.has(t.category)
    const isIncome = (t: Transaction) => !expenseCats.has(t.category) && t.amount > 0

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
        const { income, expense } = aggregate(filter(yearTransactions[key] || []))
        return { label, income, expense, net: income + expense }
      })
    }
    if (timePeriod === 'quarter') {
      return QUARTERS.map((label, qi) => {
        let income = 0,
          expense = 0
        for (let m = qi * 3; m < qi * 3 + 3; m++) {
          const key = `${year}-${String(m + 1).padStart(2, '0')}`
          const agg = aggregate(filter(yearTransactions[key] || []))
          income += agg.income
          expense += agg.expense
        }
        return { label, income, expense, net: income + expense }
      })
    }
    // half
    return HALVES.map((label, hi) => {
      let income = 0,
        expense = 0
      for (let m = hi * 6; m < hi * 6 + 6; m++) {
        const key = `${year}-${String(m + 1).padStart(2, '0')}`
        const agg = aggregate(filter(yearTransactions[key] || []))
        income += agg.income
        expense += agg.expense
      }
      return { label, income, expense, net: income + expense }
    })
  }, [year, yearTransactions, timePeriod, removedCategories, expenseCats])

  const maxVal = Math.max(...data.map(d => d.income), 1)
  const minVal = Math.min(...data.map(d => d.expense), -1)
  // Scale each side independently so small expenses aren't dwarfed by large income
  const domainTop = Math.ceil((maxVal * 1.1) / 1000) * 1000 || 1000
  const domainBottom = Math.floor((minVal * 1.1) / 1000) * 1000 || -1000
  const domain: [number, number] = [domainBottom, domainTop]

  return (
    <div className="cashflow-bar-wrap">
      <h3 className="cashflow-section-title">Cashflow — {year}</h3>
      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={data} margin={{ top: 10, right: 20, bottom: 5, left: 10 }} barGap={0} barCategoryGap="20%">
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
            formatter={(value: number, name: string) => [
              fmt(Math.abs(value)),
              name === 'income' ? 'Income' : 'Expense',
            ]}
            labelFormatter={(label: string) => `${label} ${year}`}
            contentStyle={{ fontSize: '0.82rem', borderRadius: 8 }}
          />
          <ReferenceLine y={0} stroke="var(--cashflow-zero, #9ca3af)" strokeWidth={1} />
          <Bar dataKey="income" name="Income" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {data.map((_, i) => (
              <Cell key={i} fill="var(--cashflow-income, #22c55e)" />
            ))}
          </Bar>
          <Bar dataKey="expense" name="Expense" radius={[0, 0, 4, 4]} maxBarSize={48}>
            {data.map((_, i) => (
              <Cell key={i} fill="var(--cashflow-expense, #ef4444)" />
            ))}
          </Bar>
        </BarChart>
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
