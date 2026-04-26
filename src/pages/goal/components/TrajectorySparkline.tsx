import { FC, useMemo } from 'react'

export type TrajectoryStatus = 'ahead' | 'behind' | 'on-track'

/** Mini area chart showing net worth trajectory from now to FI goal */
const TrajectorySparkline: FC<{
  currentNetWorth: number
  fiGoal: number
  annualSavings: number
  growthRate: number
  months: number
  dateLabel: string
  trajectoryStatus: TrajectoryStatus
  caption: string
}> = ({ currentNetWorth, fiGoal, annualSavings, growthRate, months, dateLabel, trajectoryStatus, caption }) => {
  const points = useMemo(() => {
    const monthlyRate = growthRate / 100 / 12
    const monthlySavings = annualSavings / 12
    let balance = currentNetWorth
    const step = Math.max(1, Math.floor(months / 40))
    const pts: number[] = [balance]
    for (let m = 1; m <= months; m++) {
      balance = monthlyRate > 0 ? balance * (1 + monthlyRate) + monthlySavings : balance + monthlySavings
      if (m % step === 0 || m === months) pts.push(Math.min(balance, fiGoal * 1.05))
    }
    return pts
  }, [currentNetWorth, fiGoal, annualSavings, growthRate, months])

  const W = 280
  const H = 80
  // Margins reserve space for annotations outside the data area:
  // top: date label above endpoint dot; right: "Goal" label; bottom: "Now" label; left: text start
  const margin = { top: 14, right: 35, bottom: 12, left: 4 }
  const dataW = W - margin.left - margin.right
  const dataH = H - margin.top - margin.bottom
  const max = Math.max(...points, fiGoal)
  const min = Math.min(...points, 0)
  const range = max - min || 1
  const toX = (i: number) => margin.left + (i / (points.length - 1)) * dataW
  const toY = (v: number) => margin.top + dataH - ((v - min) / range) * dataH

  const dataBottom = margin.top + dataH
  const linePath = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')
  const areaPath =
    linePath +
    ` L${toX(points.length - 1).toFixed(1)},${dataBottom.toFixed(1)} L${margin.left},${dataBottom.toFixed(1)} Z`
  const goalY = toY(fiGoal)
  const endX = toX(points.length - 1)
  const endY = toY(points[points.length - 1])

  // Place date label above dot, but shift further up if it overlaps the goal line
  const dateLabelGap = Math.abs(endY - goalY) < 12 ? 14 : 7
  const dateLabelY = Math.max(9, endY - dateLabelGap)

  return (
    <figure
      className="fi-card-trajectory"
      data-status={trajectoryStatus}
      role="figure"
      aria-label="Savings trajectory projection"
    >
      <figcaption className="sr-only">{caption}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
        <line
          x1={margin.left}
          y1={goalY}
          x2={margin.left + dataW}
          y2={goalY}
          stroke="var(--color-text-muted)"
          strokeWidth="1"
          strokeDasharray="4 3"
        />
        <text
          x={margin.left + dataW + 4}
          y={goalY + 3}
          fill="var(--color-text-muted)"
          fontSize="9"
          fontWeight="500"
          textAnchor="start"
        >
          Goal
        </text>
        <path d={areaPath} fill="var(--trajectory-fill)" opacity="0.12" />
        <path
          d={linePath}
          fill="none"
          stroke="var(--trajectory-stroke)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={endX} cy={endY} r="3" fill="var(--trajectory-stroke)" />
        <text
          x={endX}
          y={dateLabelY}
          fill="var(--trajectory-stroke)"
          fontSize="9"
          fontWeight="600"
          textAnchor={endX > margin.left + dataW - 20 ? 'end' : 'middle'}
        >
          {dateLabel}
        </text>
        <text x={margin.left} y={H - 2} fill="var(--color-text-muted)" fontSize="8" fontWeight="400">
          Now
        </text>
      </svg>
    </figure>
  )
}

export default TrajectorySparkline
