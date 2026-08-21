import React, { FC, useId, useMemo, useState, useCallback, useRef } from 'react'
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
  chartData?: ChartRow[]
}

const CustomTooltip: FC<CustomTooltipProps> = ({
  active,
  payload,
  label,
  fiGoal,
  fireMonth,
  goalLabel = 'FI goal',
  chartData,
}) => {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  const { expense, remaining, phase, monthlyGrowth, monthlySaved } = row
  const pctOfGoal = fiGoal && fiGoal > 0 ? ((remaining / fiGoal) * 100).toFixed(0) : null

  // Compute deltas from previous data point
  let prevRow: ChartRow | null = null
  if (chartData) {
    const idx = chartData.findIndex((r: ChartRow) => r.month === label)
    if (idx > 0) prevRow = chartData[idx - 1]
  }

  const getDelta = (curr: number, prev: number | undefined) => {
    if (prev == null || prev === 0) return null
    const d = curr - prev
    const pct = (d / Math.abs(prev)) * 100
    return { d, pct }
  }

  const fmtD = (d: number, pct: number) => `${d >= 0 ? '+' : ''}${dollars(d)} (${d >= 0 ? '+' : ''}${pct.toFixed(1)}%)`

  const items: { label: string; value: number; delta: { d: number; pct: number } | null }[] = []

  if (phase === 'coasting') {
    items.push({ label: 'Saving $0 (coasting)', value: 0, delta: null })
  }
  if (monthlySaved > 0) {
    items.push({ label: 'Saved', value: monthlySaved, delta: getDelta(monthlySaved, prevRow?.monthlySaved) })
  }
  if (monthlyGrowth != null) {
    items.push({ label: 'Growth', value: monthlyGrowth, delta: getDelta(monthlyGrowth, prevRow?.monthlyGrowth) })
  }
  if (expense > 0) {
    items.push({ label: 'Expense', value: expense, delta: getDelta(expense, prevRow?.expense) })
  }
  items.push({ label: 'Balance', value: remaining, delta: getDelta(remaining, prevRow?.remaining) })

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        padding: '6px 10px',
      }}
    >
      <div style={{ color: 'var(--color-text)', fontSize: 10, fontWeight: 500, marginBottom: 2 }}>{label}</div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr 1fr',
          alignItems: 'baseline',
          columnGap: 14,
          rowGap: 4,
        }}
      >
        {items.map(item =>
          item.label === 'Saving $0 (coasting)' ? (
            <React.Fragment key={item.label}>
              <div
                style={{
                  color: 'var(--color-text-secondary, #6b7280)',
                  fontSize: 11,
                  fontWeight: 600,
                  gridColumn: '1 / -1',
                }}
              >
                Saving $0 (coasting)
              </div>
            </React.Fragment>
          ) : (
            <React.Fragment key={item.label}>
              <div style={{ color: 'var(--color-text-heading)', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                {item.label}
              </div>
              <div
                style={{
                  color: 'var(--color-text-heading)',
                  fontSize: 11,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  textAlign: 'right',
                }}
              >
                {dollars(item.value)}
              </div>
              {item.delta ? (
                <div
                  style={{
                    color: item.delta.d >= 0 ? '#15803d' : '#dc2626',
                    fontSize: 11,
                    fontWeight: 500,
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {fmtD(item.delta.d, item.delta.pct)}
                </div>
              ) : (
                <div />
              )}
            </React.Fragment>
          ),
        )}
      </div>
      {phase === 'drawdown' && label === fireMonth && (
        <div
          style={{
            color: 'var(--color-text-secondary, #6b7280)',
            fontSize: 11,
            fontWeight: 600,
            borderTop: '1px solid var(--color-border)',
            marginTop: 4,
            paddingTop: 4,
          }}
        >
          FIRE month
        </div>
      )}
      {pctOfGoal && (phase === 'accumulation' || phase === 'coasting') && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            color: 'var(--color-text-secondary, #6b7280)',
            fontSize: 11,
            fontWeight: 600,
            borderTop: '1px solid var(--color-border)',
            marginTop: 4,
            paddingTop: 4,
          }}
        >
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
        result.push({ month: row.month, label: 'Primary', color: 'var(--color-success, #15803d)', dx: -10, dy: 0 })
      }
      if ((prev.phase === 'accumulation' || prev.phase === 'coasting') && row.phase === 'drawdown') {
        result.push({ month: row.month, label: 'F.I.R.E.', color: 'var(--accent, #0f766e)', dx: -10, dy: 0 })
      }
      if (prev.partnerLocked && !row.partnerLocked) {
        result.push({ month: row.month, label: 'Partner', color: 'var(--color-success, #15803d)', dx: -10, dy: 0 })
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
          <Tooltip
            content={
              <CustomTooltip
                fiGoal={fiGoal}
                fireMonth={fireMonth ?? undefined}
                goalLabel={goalLabel}
                chartData={chartData}
              />
            }
          />
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
