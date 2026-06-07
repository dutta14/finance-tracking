import { FC } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts'
import { ProjectionRow } from '../utils/lifecycleProjection'

const dollars = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

interface CustomTooltipProps {
  active?: boolean
  payload?: { value: number; payload: ProjectionRow }[]
  label?: string
}

const CustomTooltip: FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const { expense, remaining } = payload[0].payload
  return (
    <div className="projection-tooltip">
      <div className="projection-tooltip-month">{label}</div>
      <div className="projection-tooltip-row">
        <span>Expense</span>
        <span>{dollars(expense)}</span>
      </div>
      <div className={`projection-tooltip-row${remaining < 0 ? ' negative' : ''}`}>
        <span>Remaining</span>
        <span>{dollars(remaining)}</span>
      </div>
    </div>
  )
}

interface LifecycleChartProps {
  rows: ProjectionRow[]
}

const LifecycleChart: FC<LifecycleChartProps> = ({ rows }) => (
  <div
    className="projection-chart-wrapper"
    role="img"
    aria-label="Lifecycle projection chart showing portfolio balance over time"
  >
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={rows} margin={{ top: 8, right: 24, left: 16, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--projection-grid, #e5e7eb)" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} interval="preserveStartEnd" stroke="var(--projection-axis)" />
        <YAxis
          tickFormatter={v => {
            if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
            if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
            return `$${v}`
          }}
          tick={{ fontSize: 11 }}
          stroke="var(--projection-axis)"
          width={72}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={0} stroke="var(--color-text-muted)" strokeDasharray="4 2" strokeWidth={1} />
        <Line
          type="monotone"
          dataKey="remaining"
          stroke="var(--accent-hover)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
)

export default LifecycleChart
