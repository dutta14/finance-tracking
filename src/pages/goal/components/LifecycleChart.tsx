import { FC, useId, useMemo } from 'react'
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

interface Milestone {
  month: string
  label: string
  color: string
  dx: number
  dy: number
}

interface LifecycleChartProps {
  rows: ProjectionRow[]
}

const LifecycleChart: FC<LifecycleChartProps> = ({ rows }) => {
  const descId = useId()

  const milestones = useMemo<Milestone[]>(() => {
    const result: Milestone[] = []
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1]
      const row = rows[i]
      if (prev.growthRate !== undefined && row.growthRate !== undefined && prev.growthRate !== row.growthRate) {
        result.push({
          month: row.month,
          label: `${prev.growthRate}%→${row.growthRate}%`,
          color: 'var(--color-text, #374151)',
          dx: 10,
          dy: 0,
        })
      }
      if (prev.primaryLocked && !row.primaryLocked) {
        result.push({ month: row.month, label: 'Primary', color: 'var(--color-success, #16a34a)', dx: -10, dy: 0 })
      }
      if (prev.phase === 'accumulation' && row.phase === 'drawdown') {
        result.push({ month: row.month, label: 'F.I.R.E.', color: 'var(--accent, #0f766e)', dx: -10, dy: 0 })
      }
      if (prev.partnerLocked && !row.partnerLocked) {
        result.push({ month: row.month, label: 'Partner', color: 'var(--color-success, #16a34a)', dx: -10, dy: 0 })
      }
    }
    // Separate labels that share the same month to avoid overlap
    const byMonth = new Map<string, number>()
    for (const m of result) {
      const idx = byMonth.get(m.month) ?? 0
      m.dy = idx * 14
      byMonth.set(m.month, idx + 1)
    }
    return result
  }, [rows])

  return (
    <div className="projection-chart-wrapper" aria-describedby={descId}>
      <div id={descId} className="sr-only">
        Lifecycle projection chart showing portfolio balance over time.
        {milestones.length > 0 && <> Milestones: {milestones.map(m => `${m.label} at ${m.month}`).join('; ')}.</>}
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={rows} margin={{ top: 28, right: 24, left: 16, bottom: 8 }}>
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
          {milestones.map(m => (
            <ReferenceLine
              key={m.month + m.label}
              x={m.month}
              stroke={m.color}
              strokeDasharray="6 4"
              strokeWidth={2}
              label={{
                value: m.label,
                position: 'center',
                fontSize: 10,
                fill: m.color,
                fontWeight: 600,
                angle: -90,
                dx: m.dx,
                dy: m.dy,
              }}
            />
          ))}
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
}

export default LifecycleChart
