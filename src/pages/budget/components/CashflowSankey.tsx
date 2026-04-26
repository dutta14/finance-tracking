import { FC, useState, useMemo } from 'react'
import { CategoryGroup, Transaction } from '../types'

type SankeyMode = 'group' | 'category'

interface CashflowSankeyProps {
  year: number
  yearTransactions: Record<string, Transaction[]>
  categoryGroups: CategoryGroup[]
  removedCategories: Set<string>
  categorySums: Record<string, Record<string, number>>
}

const COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f43f5e',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
  '#a855f7',
  '#d946ef',
  '#f59e0b',
  '#10b981',
  '#0ea5e9',
]

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })

/** Rank-based heights: items are assumed sorted descending by amount.
 *  First item gets maxH, last gets minH, linearly interpolated. */
const rankHeights = (items: { amount: number }[], minH: number, maxH: number) => {
  if (items.length <= 1) return items.map(() => maxH)
  return items.map((_, i) => {
    const t = i / (items.length - 1) // 0 = largest, 1 = smallest
    return maxH - t * (maxH - minH)
  })
}

const CashflowSankey: FC<CashflowSankeyProps> = ({
  yearTransactions,
  categoryGroups,
  removedCategories,
  categorySums,
}) => {
  const [mode, setMode] = useState<SankeyMode>('group')

  const { incomeCategories, expenseGroups, expenseCatArr, totalIncome, totalExpense } = useMemo(() => {
    // Classify categories same as budget table: any negative month → expense
    const expenseCatSet = new Set<string>()
    Object.entries(categorySums).forEach(([cat, months]) => {
      if (Object.values(months).some(v => v < 0)) expenseCatSet.add(cat)
    })

    const incomeCats: Record<string, number> = {}
    const expenseCats: Record<string, number> = {}

    Object.values(yearTransactions).forEach(txns => {
      txns.forEach(t => {
        if (removedCategories.has(t.category)) return
        if (expenseCatSet.has(t.category)) {
          expenseCats[t.category] = (expenseCats[t.category] || 0) + Math.abs(t.amount)
        } else if (t.amount > 0) {
          incomeCats[t.category] = (incomeCats[t.category] || 0) + t.amount
        }
      })
    })

    const catToGroup = new Map<string, string>()
    categoryGroups.forEach(g => g.categories.forEach(c => catToGroup.set(c, g.id)))

    const groupTotals: Record<string, { id: string; name: string; total: number }> = {}
    categoryGroups.forEach(g => {
      groupTotals[g.id] = { id: g.id, name: g.name, total: 0 }
    })

    Object.entries(expenseCats).forEach(([cat, amount]) => {
      const gid = catToGroup.get(cat) || 'others'
      if (!groupTotals[gid]) groupTotals[gid] = { id: gid, name: gid, total: 0 }
      groupTotals[gid].total += amount
    })

    return {
      incomeCategories: Object.entries(incomeCats)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount),
      expenseGroups: Object.values(groupTotals)
        .filter(g => g.total > 0)
        .sort((a, b) => b.total - a.total),
      expenseCatArr: Object.entries(expenseCats)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount),
      totalIncome: Object.values(incomeCats).reduce((s, v) => s + v, 0),
      totalExpense: Object.values(expenseCats).reduce((s, v) => s + v, 0),
    }
  }, [yearTransactions, categoryGroups, removedCategories, categorySums])

  const rightItems = mode === 'group' ? expenseGroups.map(g => ({ name: g.name, amount: g.total })) : expenseCatArr

  // Layout
  const W = 800
  const PAD_TOP = 36
  const NODE_W = 18
  const LABEL_PAD = 140
  const COL_LEFT = LABEL_PAD
  const COL_RIGHT = W - LABEL_PAD - NODE_W
  const NODE_GAP = 8
  const NODE_H_MAX = 38
  const NODE_H_MIN = 10
  const ROW_H = NODE_H_MAX + NODE_GAP

  const nodeCount = Math.max(incomeCategories.length, rightItems.length, 3)
  const H = PAD_TOP * 2 + nodeCount * ROW_H
  const availH = H - PAD_TOP * 2

  // Build node positions with rank-based heights
  const layoutNodes = (items: { name: string; amount: number }[], x: number, colorOffset: number) => {
    const heights = rankHeights(items, NODE_H_MIN, NODE_H_MAX)
    const totalH = heights.reduce((s, h) => s + h, 0) + Math.max(items.length - 1, 0) * NODE_GAP
    const startY = PAD_TOP + Math.max(0, (availH - totalH) / 2)
    let y = startY
    return items.map((c, i) => {
      const h = heights[i]
      const node = { ...c, x, y, h, color: COLORS[(i + colorOffset) % COLORS.length] }
      y += h + NODE_GAP
      return node
    })
  }

  const leftNodes = layoutNodes(incomeCategories, COL_LEFT, 0)
  const rightNodes = layoutNodes(rightItems, COL_RIGHT, 5)

  // Central band: a vertical strip in the middle where income flows merge and expense flows fan out
  const BAND_X = W / 2 - 4 // left edge of the central band
  const BAND_W = 8

  // Compute the central band's vertical extent (union of both columns)
  const bandTop = Math.min(leftNodes[0]?.y ?? PAD_TOP, rightNodes[0]?.y ?? PAD_TOP)
  const bandBot = Math.max(
    leftNodes.length > 0 ? leftNodes[leftNodes.length - 1].y + leftNodes[leftNodes.length - 1].h : PAD_TOP,
    rightNodes.length > 0 ? rightNodes[rightNodes.length - 1].y + rightNodes[rightNodes.length - 1].h : PAD_TOP,
  )

  // Left → band links: each income node flows into the central band, stacking proportionally
  const leftLinks = useMemo(() => {
    const totalAmt = incomeCategories.reduce((s, c) => s + c.amount, 0) || 1
    const bandH = bandBot - bandTop
    let bandY = bandTop
    return leftNodes.map(ln => {
      const share = (ln.amount / totalAmt) * bandH
      const x1 = ln.x + NODE_W
      const x2 = BAND_X
      const cx1 = x1 + (x2 - x1) * 0.4
      const cx2 = x2 - (x2 - x1) * 0.4
      const tY = bandY
      bandY += share
      return {
        key: `l-${ln.name}`,
        d: `M${x1},${ln.y} C${cx1},${ln.y} ${cx2},${tY} ${x2},${tY} L${x2},${tY + share} C${cx2},${tY + share} ${cx1},${ln.y + ln.h} ${x1},${ln.y + ln.h} Z`,
        color: ln.color,
      }
    })
  }, [leftNodes, bandTop, bandBot])

  // Band → right links: each expense item fans out from the central band
  const rightLinks = useMemo(() => {
    const totalAmt = rightItems.reduce((s, c) => s + c.amount, 0) || 1
    const bandH = bandBot - bandTop
    let bandY = bandTop
    return rightNodes.map(rn => {
      const share = (rn.amount / totalAmt) * bandH
      const x1 = BAND_X + BAND_W
      const x2 = rn.x
      const cx1 = x1 + (x2 - x1) * 0.4
      const cx2 = x2 - (x2 - x1) * 0.4
      const tY = bandY
      bandY += share
      return {
        key: `r-${rn.name}`,
        d: `M${x1},${tY} C${cx1},${tY} ${cx2},${rn.y} ${x2},${rn.y} L${x2},${rn.y + rn.h} C${cx2},${rn.y + rn.h} ${cx1},${tY + share} ${x1},${tY + share} Z`,
        color: rn.color,
      }
    })
  }, [rightNodes, rightItems, bandTop, bandBot])

  if (totalIncome === 0 && totalExpense === 0) {
    return (
      <div className="cashflow-sankey-wrap">
        <h3 className="cashflow-section-title">Cashflow Sankey</h3>
        <p className="cashflow-empty">No transaction data for this year.</p>
      </div>
    )
  }

  return (
    <div className="cashflow-sankey-wrap">
      <div className="cashflow-sankey-header">
        <h3 className="cashflow-section-title" style={{ margin: 0 }}>
          Cashflow Sankey
        </h3>
        <div className="cashflow-sankey-pills">
          <button
            className={`cashflow-sankey-pill${mode === 'group' ? ' active' : ''}`}
            onClick={() => setMode('group')}
          >
            Group
          </button>
          <button
            className={`cashflow-sankey-pill${mode === 'category' ? ' active' : ''}`}
            onClick={() => setMode('category')}
          >
            Category
          </button>
        </div>
      </div>
      <div className="cashflow-sankey-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} className="cashflow-sankey-svg" preserveAspectRatio="xMidYMid meet">
          {/* Column headers */}
          <text
            x={COL_LEFT + NODE_W / 2}
            y={20}
            textAnchor="middle"
            fontSize={11}
            fontWeight={700}
            fill="var(--cashflow-subtext, #9ca3af)"
            className="cashflow-sankey-label"
          >
            INCOME ({fmt(totalIncome)})
          </text>
          <text
            x={COL_RIGHT + NODE_W / 2}
            y={20}
            textAnchor="middle"
            fontSize={11}
            fontWeight={700}
            fill="var(--cashflow-subtext, #9ca3af)"
            className="cashflow-sankey-label"
          >
            {mode === 'group' ? 'EXPENSE GROUPS' : 'EXPENSE CATEGORIES'} ({fmt(totalExpense)})
          </text>
          {/* Left → band links (income colors) */}
          {leftLinks.map(l => (
            <path key={l.key} d={l.d} fill={l.color} opacity={0.18} />
          ))}
          {/* Band → right links (expense colors) */}
          {rightLinks.map(l => (
            <path key={l.key} d={l.d} fill={l.color} opacity={0.18} />
          ))}
          {/* Central band */}
          {leftNodes.length > 0 && rightNodes.length > 0 && (
            <rect
              x={BAND_X}
              y={bandTop}
              width={BAND_W}
              height={bandBot - bandTop}
              rx={4}
              fill="var(--cashflow-subtext, #9ca3af)"
              opacity={0.18}
            />
          )}
          {/* Left nodes (income) */}
          {leftNodes.map(n => {
            const pct = totalIncome > 0 ? ((n.amount / totalIncome) * 100).toFixed(1) : '0.0'
            return (
              <g key={n.name}>
                <rect x={n.x} y={n.y} width={NODE_W} height={n.h} rx={4} fill={n.color} />
                <text
                  x={n.x - 8}
                  y={n.y + n.h / 2}
                  textAnchor="end"
                  dominantBaseline="central"
                  fontSize={9.5}
                  fill="var(--cashflow-text, #374151)"
                  className="cashflow-sankey-label"
                >
                  {n.name}
                </text>
                <text
                  x={n.x + NODE_W + 6}
                  y={n.y + n.h / 2}
                  textAnchor="start"
                  dominantBaseline="central"
                  fontSize={8}
                  fill="var(--cashflow-subtext, #9ca3af)"
                  className="cashflow-sankey-label"
                >
                  {fmt(n.amount)} <tspan fill="var(--cashflow-pct, #b0b8c4)">({pct}%)</tspan>
                </text>
              </g>
            )
          })}
          {/* Right nodes */}
          {rightNodes.map(n => {
            const pct = totalExpense > 0 ? ((n.amount / totalExpense) * 100).toFixed(1) : '0.0'
            return (
              <g key={n.name}>
                <rect x={n.x} y={n.y} width={NODE_W} height={n.h} rx={4} fill={n.color} />
                <text
                  x={n.x + NODE_W + 8}
                  y={n.y + n.h / 2}
                  textAnchor="start"
                  dominantBaseline="central"
                  fontSize={9.5}
                  fill="var(--cashflow-text, #374151)"
                  className="cashflow-sankey-label"
                >
                  {n.name}
                </text>
                <text
                  x={n.x - 6}
                  y={n.y + n.h / 2}
                  textAnchor="end"
                  dominantBaseline="central"
                  fontSize={8}
                  fill="var(--cashflow-subtext, #9ca3af)"
                  className="cashflow-sankey-label"
                >
                  {fmt(n.amount)} <tspan fill="var(--cashflow-pct, #b0b8c4)">({pct}%)</tspan>
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

export default CashflowSankey
