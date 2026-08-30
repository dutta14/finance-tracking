import { FC, useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { CategoryGroup, TimePeriod, Transaction } from '../types'

type SankeyMode = 'group' | 'category'

interface CashflowSankeyProps {
  year: number
  yearTransactions: Record<string, Transaction[]>
  categoryGroups: CategoryGroup[]
  removedCategories: Set<string>
  categorySums: Record<string, Record<string, number>>
  incomeCatSet: Set<string>
  selectedPeriod: string | null
  timePeriod: TimePeriod
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

const SAVINGS_COLOR = '#10b981'
const MIN_SVG_WIDTH = 550

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })

/** Proportional heights that always fit within the available column height. */
const proportionalHeights = (items: { amount: number }[], totalAvailH: number, gap: number, minH: number) => {
  if (items.length === 0) return []
  const totalAmt = items.reduce((s, it) => s + it.amount, 0)
  const gapSpace = Math.max(items.length - 1, 0) * gap
  const minSpace = items.length * minH
  const variableSpace = Math.max(totalAvailH - gapSpace - minSpace, 0)

  if (totalAmt === 0) {
    const extraPerItem = items.length > 0 ? variableSpace / items.length : 0
    return items.map(() => minH + extraPerItem)
  }

  return items.map(it => minH + (it.amount / totalAmt) * variableSpace)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const CashflowSankey: FC<CashflowSankeyProps> = ({
  year,
  categoryGroups,
  removedCategories,
  categorySums,
  incomeCatSet,
  selectedPeriod,
  timePeriod,
}) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState<SankeyMode>('group')
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const modeTabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [fixedScrollHeight, setFixedScrollHeight] = useState<number | null>(null)
  const filteredCategorySums = useMemo(() => {
    if (!selectedPeriod) return categorySums

    const monthKeys: string[] = []

    if (timePeriod === 'month') {
      const idx = MONTHS.indexOf(selectedPeriod)
      if (idx >= 0) monthKeys.push(String(idx + 1).padStart(2, '0'))
    } else if (timePeriod === 'quarter') {
      const qi = parseInt(selectedPeriod.replace('Q', '')) - 1
      for (let m = qi * 3; m < qi * 3 + 3; m++) {
        monthKeys.push(String(m + 1).padStart(2, '0'))
      }
    } else {
      const hi = parseInt(selectedPeriod.replace('H', '')) - 1
      for (let m = hi * 6; m < hi * 6 + 6; m++) {
        monthKeys.push(String(m + 1).padStart(2, '0'))
      }
    }

    const filtered: Record<string, Record<string, number>> = {}
    Object.entries(categorySums).forEach(([cat, months]) => {
      const filteredMonths: Record<string, number> = {}
      monthKeys.forEach(monthKey => {
        Object.entries(months).forEach(([key, val]) => {
          if (key === monthKey || key.endsWith(`-${monthKey}`)) {
            filteredMonths[key] = val
          }
        })
      })
      if (Object.keys(filteredMonths).length > 0) {
        filtered[cat] = filteredMonths
      }
    })
    return filtered
  }, [categorySums, selectedPeriod, timePeriod])

  const { incomeCategories, expenseGroups, expenseCatArr, totalIncome, totalExpense } = useMemo(() => {
    // Use incomeCatSet (group membership) as source of truth
    const incomeCats: Record<string, number> = {}
    const expenseCats: Record<string, number> = {}

    Object.entries(filteredCategorySums).forEach(([cat, monthMap]) => {
      if (removedCategories.has(cat)) return
      const total = Object.values(monthMap).reduce((s, v) => s + v, 0)
      if (incomeCatSet.has(cat)) {
        incomeCats[cat] = total
      } else {
        expenseCats[cat] = Math.abs(total)
      }
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
  }, [categoryGroups, removedCategories, filteredCategorySums, incomeCatSet])

  const rightItems = mode === 'group' ? expenseGroups.map(g => ({ name: g.name, amount: g.total })) : expenseCatArr
  const savings = Math.max(0, totalIncome - totalExpense)
  const rightItemsAll = savings > 0 ? [{ name: 'Savings', amount: savings }, ...rightItems] : rightItems
  const groupRightItems = expenseGroups.map(g => ({ name: g.name, amount: g.total }))
  const groupRightItemsAll = savings > 0 ? [{ name: 'Savings', amount: savings }, ...groupRightItems] : groupRightItems
  const rightTotal = savings > 0 ? totalIncome : rightItemsAll.reduce((sum, item) => sum + item.amount, 0)

  const handleNodeClick = useCallback(
    (nodeName: string, side: 'left' | 'right') => {
      if (nodeName === 'Savings') return

      const params = new URLSearchParams()

      // Date range based on selectedPeriod + timePeriod
      if (selectedPeriod && timePeriod === 'month') {
        const idx = MONTHS.indexOf(selectedPeriod)
        if (idx >= 0) {
          const m = String(idx + 1).padStart(2, '0')
          const lastDay = new Date(year, idx + 1, 0).getDate()
          params.set('from', `${year}-${m}-01`)
          params.set('to', `${year}-${m}-${String(lastDay).padStart(2, '0')}`)
        }
      } else if (selectedPeriod && timePeriod === 'quarter') {
        const qi = parseInt(selectedPeriod.replace('Q', '')) - 1
        const startMonth = String(qi * 3 + 1).padStart(2, '0')
        const endMonthNum = qi * 3 + 3
        const endMonth = String(endMonthNum).padStart(2, '0')
        const lastDay = new Date(year, endMonthNum, 0).getDate()
        params.set('from', `${year}-${startMonth}-01`)
        params.set('to', `${year}-${endMonth}-${String(lastDay).padStart(2, '0')}`)
      } else if (selectedPeriod && timePeriod === 'half') {
        const hi = parseInt(selectedPeriod.replace('H', '')) - 1
        const startMonth = String(hi * 6 + 1).padStart(2, '0')
        const endMonthNum = hi * 6 + 6
        const endMonth = String(endMonthNum).padStart(2, '0')
        const lastDay = new Date(year, endMonthNum, 0).getDate()
        params.set('from', `${year}-${startMonth}-01`)
        params.set('to', `${year}-${endMonth}-${String(lastDay).padStart(2, '0')}`)
      } else {
        params.set('from', `${year}-01-01`)
        params.set('to', `${year}-12-31`)
      }

      // Categories
      let categories: string[] = []
      if (side === 'left') {
        // Income node name IS the category name
        categories = [nodeName]
      } else if (mode === 'category') {
        categories = [nodeName]
      } else {
        // Group mode: resolve group name → its categories
        const group = categoryGroups.find(g => g.name === nodeName)
        if (group) categories = group.categories
      }

      if (categories.length > 0) {
        params.set('categories', categories.join(','))
      }

      // Replace current history entry so back-navigation returns to this page with sankey state
      navigate(`${location.pathname}${location.search}`, { replace: true, state: { scrollTo: 'sankey' } })
      navigate(`/transactions?${params.toString()}`)
    },
    [year, selectedPeriod, timePeriod, mode, categoryGroups, navigate, location],
  )

  // Layout
  const W = 800
  const PAD_TOP = 36
  const NODE_W = 18
  const LABEL_PAD = 140
  const COL_LEFT = LABEL_PAD
  const COL_RIGHT = W - LABEL_PAD - NODE_W
  const NODE_GAP = 8
  const NODE_H_MIN = 6

  const groupNodeCount = Math.max(incomeCategories.length, groupRightItemsAll.length, 3)
  const nodeCount = Math.max(incomeCategories.length, rightItemsAll.length, 3)
  const PAD_BOT = 36
  const groupH = PAD_TOP + groupNodeCount * 46 + PAD_BOT
  const H = PAD_TOP + nodeCount * 46 + PAD_BOT
  const availH = H - PAD_TOP - PAD_BOT
  const fallbackScrollHeight = (MIN_SVG_WIDTH * groupH) / W

  useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return

    const updateFixedScrollHeight = () => {
      const renderedWidth = Math.max(scrollEl.clientWidth, MIN_SVG_WIDTH)
      setFixedScrollHeight((renderedWidth * groupH) / W)
    }

    updateFixedScrollHeight()

    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(updateFixedScrollHeight)
    observer.observe(scrollEl)

    return () => observer.disconnect()
  }, [groupH, W])

  // Build node positions with proportional heights
  const layoutNodes = (items: { name: string; amount: number }[], x: number, colorOffset: number) => {
    const heights = proportionalHeights(items, availH, NODE_GAP, NODE_H_MIN)
    const totalH = heights.reduce((s, h) => s + h, 0) + Math.max(items.length - 1, 0) * NODE_GAP
    const startY = PAD_TOP + Math.max(0, (availH - totalH) / 2)
    let y = startY
    return items.map((c, i) => {
      const h = heights[i]
      const node = {
        ...c,
        x,
        y,
        h,
        color: c.name === 'Savings' ? SAVINGS_COLOR : COLORS[(i + colorOffset) % COLORS.length],
      }
      y += h + NODE_GAP
      return node
    })
  }

  const leftNodes = layoutNodes(incomeCategories, COL_LEFT, 0)
  const rightNodes = layoutNodes(rightItemsAll, COL_RIGHT, 5)

  // Central band: a vertical strip in the middle where income flows merge and expense flows fan out
  const BAND_X = W / 2 - 4 // left edge of the central band
  const BAND_W = 8

  // Compute the central band's vertical extent (union of both columns)
  const bandTop = Math.min(leftNodes[0]?.y ?? PAD_TOP, rightNodes[0]?.y ?? PAD_TOP)
  const bandBot = Math.max(
    leftNodes.length > 0 ? leftNodes[leftNodes.length - 1].y + leftNodes[leftNodes.length - 1].h : PAD_TOP,
    rightNodes.length > 0 ? rightNodes[rightNodes.length - 1].y + rightNodes[rightNodes.length - 1].h : PAD_TOP,
  )

  const focusModeTab = useCallback((index: number) => {
    requestAnimationFrame(() => {
      modeTabRefs.current[index]?.focus()
    })
  }, [])

  const activateModeTab = useCallback(
    (index: number) => {
      const nextMode = index === 0 ? 'group' : 'category'
      setMode(nextMode)
      focusModeTab(index)
    },
    [focusModeTab],
  )

  const handleModeTabKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault()
        activateModeTab((index + 1) % 2)
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault()
        activateModeTab((index - 1 + 2) % 2)
      } else if (event.key === 'Home') {
        event.preventDefault()
        activateModeTab(0)
      } else if (event.key === 'End') {
        event.preventDefault()
        activateModeTab(1)
      }
    },
    [activateModeTab],
  )

  const handleSvgActionKeyDown = useCallback((event: React.KeyboardEvent<SVGGElement>, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      action()
    }
  }, [])

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
  }, [leftNodes, bandTop, bandBot, BAND_X, incomeCategories])

  // Band → right links: each expense item fans out from the central band
  const rightLinks = useMemo(() => {
    const totalAmt = rightTotal || 1
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
  }, [rightNodes, rightTotal, bandTop, bandBot, BAND_X])

  if (totalIncome === 0 && totalExpense === 0) {
    return (
      <div id="sankey">
        <h3 className="cashflow-section-title">Breakdown{selectedPeriod ? ` — ${selectedPeriod}` : ''}</h3>
        <div className="cashflow-sankey-wrap">
          <p className="cashflow-empty">No transaction data for this year.</p>
        </div>
      </div>
    )
  }

  return (
    <div id="sankey">
      <div className="cashflow-sankey-header">
        <h3 className="cashflow-section-title cashflow-section-title--flush">
          Breakdown{selectedPeriod ? ` — ${selectedPeriod}` : ''}
        </h3>
        <div className="tab-bar" role="tablist" aria-label="Breakdown views">
          <button
            ref={node => {
              modeTabRefs.current[0] = node
            }}
            type="button"
            className={`tab-btn tab-btn--sm${mode === 'group' ? ' active' : ''}`}
            role="tab"
            id="cashflow-sankey-tab-group"
            aria-selected={mode === 'group'}
            aria-controls="cashflow-sankey-panel"
            tabIndex={mode === 'group' ? 0 : -1}
            onClick={() => setMode('group')}
            onKeyDown={event => handleModeTabKeyDown(event, 0)}
          >
            Group
          </button>
          <button
            ref={node => {
              modeTabRefs.current[1] = node
            }}
            type="button"
            className={`tab-btn tab-btn--sm${mode === 'category' ? ' active' : ''}`}
            role="tab"
            id="cashflow-sankey-tab-category"
            aria-selected={mode === 'category'}
            aria-controls="cashflow-sankey-panel"
            tabIndex={mode === 'category' ? 0 : -1}
            onClick={() => setMode('category')}
            onKeyDown={event => handleModeTabKeyDown(event, 1)}
          >
            Category
          </button>
        </div>
      </div>
      <div
        className="cashflow-sankey-wrap"
        id="cashflow-sankey-panel"
        role="tabpanel"
        aria-labelledby={mode === 'group' ? 'cashflow-sankey-tab-group' : 'cashflow-sankey-tab-category'}
      >
        <div
          ref={scrollRef}
          className="cashflow-sankey-scroll"
          tabIndex={0}
          role="region"
          aria-label={`Cashflow breakdown diagram for ${selectedPeriod ?? year}. Scroll horizontally to review the ${mode} view.`}
          style={{ height: `${fixedScrollHeight ?? fallbackScrollHeight}px` }}
        >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="cashflow-sankey-svg"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={`Cashflow breakdown showing income and ${mode === 'group' ? 'expense groups' : 'expense categories'} for ${selectedPeriod ?? year}.`}
          >
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
              <path
                key={l.key}
                d={l.d}
                fill={l.color}
                opacity={0.18}
                aria-hidden="true"
                style={{ cursor: 'pointer' }}
                onClick={() => handleNodeClick(l.key.slice(2), 'left')}
              />
            ))}
            {/* Band → right links (expense colors) */}
            {rightLinks.map(l => {
              const name = l.key.slice(2)
              const isSavings = name === 'Savings'
              return (
                <path
                  key={l.key}
                  d={l.d}
                  fill={l.color}
                  opacity={0.18}
                  aria-hidden="true"
                  style={{ cursor: isSavings ? 'default' : 'pointer' }}
                  onClick={isSavings ? undefined : () => handleNodeClick(name, 'right')}
                />
              )
            })}
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
                <g
                  key={n.name}
                  className="cashflow-sankey-node"
                  role="button"
                  tabIndex={0}
                  aria-label={`View ${n.name} income transactions totaling ${fmt(n.amount)}, ${pct}% of income.`}
                  onClick={() => handleNodeClick(n.name, 'left')}
                  onKeyDown={event => handleSvgActionKeyDown(event, () => handleNodeClick(n.name, 'left'))}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Invisible hit area spanning labels + node */}
                  <rect
                    className="cashflow-sankey-node-hit"
                    x={0}
                    y={n.y - 2}
                    width={COL_LEFT + NODE_W + LABEL_PAD}
                    height={Math.max(n.h + 4, 16)}
                    rx={6}
                    fill="transparent"
                  />
                  <rect
                    className="cashflow-sankey-node-bar"
                    x={n.x}
                    y={n.y}
                    width={NODE_W}
                    height={n.h}
                    rx={4}
                    fill={n.color}
                  />
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
              const isSavings = n.name === 'Savings'
              const pct = rightTotal > 0 ? ((n.amount / rightTotal) * 100).toFixed(1) : '0.0'
              return (
                <g
                  key={n.name}
                  className={isSavings ? undefined : 'cashflow-sankey-node'}
                  role={isSavings ? undefined : 'button'}
                  tabIndex={isSavings ? undefined : 0}
                  aria-label={
                    isSavings
                      ? undefined
                      : `View ${n.name} transactions totaling ${fmt(n.amount)}, ${pct}% of ${mode === 'group' ? 'the breakdown' : 'expenses'}.`
                  }
                  onClick={isSavings ? undefined : () => handleNodeClick(n.name, 'right')}
                  onKeyDown={
                    isSavings
                      ? undefined
                      : event => handleSvgActionKeyDown(event, () => handleNodeClick(n.name, 'right'))
                  }
                  style={{ cursor: isSavings ? 'default' : 'pointer' }}
                >
                  {/* Invisible hit area spanning labels + node */}
                  <rect
                    className={isSavings ? undefined : 'cashflow-sankey-node-hit'}
                    x={COL_RIGHT - LABEL_PAD}
                    y={n.y - 2}
                    width={LABEL_PAD + NODE_W + LABEL_PAD}
                    height={Math.max(n.h + 4, 16)}
                    rx={6}
                    fill="transparent"
                  />
                  <rect
                    className={isSavings ? undefined : 'cashflow-sankey-node-bar'}
                    x={n.x}
                    y={n.y}
                    width={NODE_W}
                    height={n.h}
                    rx={4}
                    fill={n.color}
                  />
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
    </div>
  )
}

export default CashflowSankey
