import { FC } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { formatCurrency } from '../../data/types'

type ChartDatum = { name: string; value: number; color: string }

interface DonutChartProps {
  data: ChartDatum[]
  innerR?: number
  outerR?: number
  height?: number
}

export const DonutChart: FC<DonutChartProps> = ({ data, innerR = 50, outerR = 90, height = 220 }) => {
  const isDark = document.body.classList.contains('dark')
  const tooltipBg = isDark ? '#1f2937' : '#fff'
  const tooltipBorder = isDark ? '#374151' : '#e5e7eb'

  if (data.length === 0) return <div className="alloc-page-empty">No data for this scope</div>
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={innerR} outerRadius={outerR}
          paddingAngle={2} dataKey="value" stroke="none">
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Pie>
        <Tooltip
          contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', padding: '6px 10px', fontSize: 12 }}
          formatter={(v) => formatCurrency(v as number)}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

interface LegendProps {
  data: ChartDatum[]
  total: number
  mode: 'pct' | 'val'
}

export const Legend: FC<LegendProps> = ({ data, total, mode }) => (
  <div className="alloc-page-legend">
    {data.map((d, i) => (
      <div key={i} className="alloc-page-legend-row">
        <span className="alloc-page-legend-dot" style={{ background: d.color }} />
        <span className="alloc-page-legend-label">{d.name}</span>
        <span className="alloc-page-legend-val">
          {mode === 'pct' ? `${((d.value / total) * 100).toFixed(1)}%` : formatCurrency(d.value)}
        </span>
      </div>
    ))}
  </div>
)

interface RatioBarProps {
  data: ChartDatum[]
  total: number
}

export const RatioBar: FC<RatioBarProps> = ({ data, total }) => {
  if (data.length === 0 || total === 0) return null
  return (
    <div className="alloc-ratio-bar-wrap">
      <div className="alloc-ratio-bar">
        {data.map((d, i) => {
          const pct = ((d.value / total) * 100).toFixed(1)
          return (
            <div key={i} className="alloc-ratio-seg" style={{ width: `${pct}%`, background: d.color }}>
              {Number(pct) > 8 && <span className="alloc-ratio-seg-label">{pct}%</span>}
            </div>
          )
        })}
      </div>
      <div className="alloc-ratio-labels">
        {data.map((d, i) => {
          const pct = ((d.value / total) * 100).toFixed(1)
          return (
            <span key={i} className="alloc-ratio-label">
              <span className="alloc-ratio-label-dot" style={{ background: d.color }} />
              {d.name}: {pct}% ({formatCurrency(d.value)})
            </span>
          )
        })}
      </div>
    </div>
  )
}
