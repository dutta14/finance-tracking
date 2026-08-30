import { useRef, useState, useEffect, RefObject } from 'react'

interface ChartColors {
  positive: string
  negative: string
  nwLine: string
}

const DEFAULTS: ChartColors = {
  positive: '#4ade80',
  negative: '#f87171',
  nwLine: '#10b981',
}

function read(el: Element): ChartColors {
  const s = getComputedStyle(el)
  return {
    positive: s.getPropertyValue('--chart-positive').trim() || DEFAULTS.positive,
    negative: s.getPropertyValue('--chart-negative').trim() || DEFAULTS.negative,
    nwLine: s.getPropertyValue('--chart-nw-line').trim() || DEFAULTS.nwLine,
  }
}

export function useChartColors(): [RefObject<HTMLDivElement | null>, ChartColors] {
  const ref = useRef<HTMLDivElement>(null)
  const [colors, setColors] = useState<ChartColors>(DEFAULTS)

  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally runs every render to detect theme changes
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const next = read(el)
    if (next.positive !== colors.positive || next.negative !== colors.negative || next.nwLine !== colors.nwLine) {
      setColors(next)
    }
  })

  return [ref, colors]
}
