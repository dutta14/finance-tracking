import { FC, useId, useMemo, useState, useCallback, useRef } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'
import { ProjectionRow } from '../utils/lifecycleProjection'

const dollars = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

const abbreviate = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}

interface CustomTooltipProps {
  active?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: { value: number; payload: any }[]
  label?: string
  fiGoal?: number
  fireMonth?: string
  goalLabel?: string
}

const CustomTooltip: FC<CustomTooltipProps> = ({ active, payload, label, fiGoal, fireMonth, goalLabel = 'FI goal' }) => {
  if (!active || !payload?.length) return null
  const { expense, remaining, phase, monthlyGrowth, monthlySaved } = payload[0].payload
  const pctOfGoal = fiGoal && fiGoal > 0 ? ((remaining / fiGoal) * 100).toFixed(0) : null
  return (
    <div className="projection-tooltip">
      <div className="projection-tooltip-month">{label}</div>
      {phase === 'coasting' && (
        <div className="projection-tooltip-row projection-tooltip-row--pct">
          <span>Saving $0 (coasting)</span>
        </div>
      )}
      {monthlySaved > 0 && (
        <div className="projection-tooltip-row">
          <span>Saved</span>
          <span>{dollars(monthlySaved)}</span>
        </div>
      )}
      {monthlyGrowth != null && (
        <div className="projection-tooltip-row">
          <span>Growth</span>
          <span>{dollars(monthlyGrowth)}</span>
        </div>
      )}
      {expense > 0 && (
        <div className="projection-tooltip-row">
          <span>Expense</span>
          <span>{dollars(expense)}</span>
        </div>
      )}
      <div className="projection-tooltip-row">
        <span>Balance</span>
        <span>{dollars(remaining)}</span>
      </div>
      {phase === 'drawdown' && label === fireMonth && (
        <div className="projection-tooltip-row projection-tooltip-row--pct">
          <span>🔥 FIRE month</span>
        </div>
      )}
      {pctOfGoal && (phase === 'accumulation' || phase === 'coasting') && (
        <div className="projection-tooltip-row projection-tooltip-row--pct">
          <span>% of {goalLabel}</span>
          <span>{pctOfGoal}%</span>
        </div>
      )}
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
  fiGoal?: number
  goalLabel?: string
}

interface ChartRow extends ProjectionRow {
  accum: number | null
  draw: number | null
}

const LifecycleChart: FC<LifecycleChartProps> = ({ rows, fiGoal, goalLabel = 'FI goal' }) => {
  const descId = useId()
  const chartRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  // Split remaining into accumulation/drawdown series for visual distinction
  const chartData = useMemo<ChartRow[]>(() => {
    const fireIdx = rows.findIndex(r => r.phase === 'drawdown')
    return rows.map((r, i) => ({
      ...r,
      // Overlap one point at the boundary so lines connect
      accum: fireIdx < 0 || i <= fireIdx ? r.remaining : null,
      draw: fireIdx >= 0 && i >= fireIdx ? r.remaining : null,
    }))
  }, [rows])

  const fireMonth = useMemo(() => {
    const fireRow = rows.find(r => r.phase === 'drawdown')
    return fireRow?.month ?? null
  }, [rows])

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
      if ((prev.phase === 'accumulation' || prev.phase === 'coasting') && row.phase === 'drawdown') {
        result.push({ month: row.month, label: 'F.I.R.E.', color: 'var(--accent, #0f766e)', dx: -10, dy: 0 })
      }
      if (prev.partnerLocked && !row.partnerLocked) {
        result.push({ month: row.month, label: 'Partner', color: 'var(--color-success, #16a34a)', dx: -10, dy: 0 })
      }
    }
    const byMonth = new Map<string, number>()
    for (const m of result) {
      const idx = byMonth.get(m.month) ?? 0
      m.dy = idx * 14
      byMonth.set(m.month, idx + 1)
    }
    return result
  }, [rows])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (rows.length === 0) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        setActiveIndex(prev => (prev === null ? 0 : Math.min(prev + 1, rows.length - 1)))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setActiveIndex(prev => (prev === null ? rows.length - 1 : Math.max(prev - 1, 0)))
      } else if (e.key === 'Home') {
        e.preventDefault()
        setActiveIndex(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        setActiveIndex(rows.length - 1)
      } else if (e.key === 'Escape') {
        setActiveIndex(null)
      }
    },
    [rows.length],
  )

  const ariaDescription = useMemo(() => {
    let desc = 'Lifecycle projection chart showing portfolio balance over time.'
    if (milestones.length > 0) {
      desc += ` Milestones: ${milestones.map(m => `${m.label} at ${m.month}`).join('; ')}.`
    }
    if (fiGoal && fiGoal > 0) {
      desc += ` FI target: ${dollars(fiGoal)}.`
    }
    return desc
  }, [milestones, fiGoal])

  const activeRow = activeIndex !== null ? rows[activeIndex] : null

  return (
    <div
      className="projection-chart-wrapper"
      aria-describedby={descId}
      ref={chartRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="img"
      aria-label="FI lifecycle projection chart"
    >
      <div id={descId} className="sr-only">
        {ariaDescription}
      </div>

      {activeRow && (
        <div className="projection-chart-live" aria-live="polite" aria-atomic="true">
          {activeRow.month}: {dollars(activeRow.remaining)}
          {fiGoal && fiGoal > 0 ? ` (${((activeRow.remaining / fiGoal) * 100).toFixed(0)}% of ${goalLabel})` : ''}
        </div>
      )}

      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={chartData} margin={{ top: 28, right: 40, left: 16, bottom: 8 }}>
          <defs>
            <linearGradient id="areaGradientAccum" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent, #0f766e)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--accent, #0f766e)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="areaGradientDraw" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-warning, #d97706)" stopOpacity={0.12} />
              <stop offset="100%" stopColor="var(--color-warning, #d97706)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--projection-grid, #e5e7eb)" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} interval="preserveStartEnd" stroke="var(--projection-axis)" />
          <YAxis tickFormatter={abbreviate} tick={{ fontSize: 11 }} stroke="var(--projection-axis)" width={72} />
          <Tooltip content={<CustomTooltip fiGoal={fiGoal} fireMonth={fireMonth ?? undefined} goalLabel={goalLabel} />} />
          <ReferenceLine y={0} stroke="var(--color-text-muted)" strokeDasharray="4 2" strokeWidth={1} />

          {fiGoal && fiGoal > 0 && (
            <ReferenceLine
              y={fiGoal}
              stroke="var(--color-text-muted)"
              strokeDasharray="6 5"
              strokeWidth={1.5}
              strokeOpacity={0.6}
              label={{
                value: abbreviate(fiGoal),
                position: 'insideTopRight',
                fontSize: 11,
                fill: 'var(--color-text-muted)',
                fontWeight: 500,
                dy: -16,
              }}
            />
          )}

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

          <Area
            type="monotone"
            dataKey="accum"
            fill="url(#areaGradientAccum)"
            stroke="none"
            isAnimationActive={false}
            connectNulls={false}
          />
          <Area
            type="monotone"
            dataKey="draw"
            fill="url(#areaGradientDraw)"
            stroke="none"
            isAnimationActive={false}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="accum"
            stroke="var(--accent, #0f766e)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, stroke: 'var(--color-surface, #fff)', strokeWidth: 2 }}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="draw"
            stroke="var(--color-warning, #d97706)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, stroke: 'var(--color-surface, #fff)', strokeWidth: 2 }}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export default LifecycleChart
