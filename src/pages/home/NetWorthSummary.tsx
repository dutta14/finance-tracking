import { FC, useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { Account, BalanceEntry, formatCurrency, ACCOUNT_TYPE_LABELS } from '../data/types'

interface NetWorthSummaryProps {
  accounts: Account[]
  balances: BalanceEntry[]
  allMonths: string[] // sorted desc (newest first)
  onNavigate: () => void
}

interface TreeNode {
  label: string
  value: number
  children?: TreeNode[]
}

const LONG_PRESS_MS = 400

const NetWorthSummary: FC<NetWorthSummaryProps> = ({ accounts, balances, allMonths, onNavigate }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [monthIdx, setMonthIdx] = useState(0) // 0 = latest
  const [jumpOpen, setJumpOpen] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)
  const jumpRef = useRef<HTMLDivElement>(null)

  const selectedMonth = allMonths[monthIdx] || ''

  const { netWorth, prevNw, tree } = useMemo(() => {
    if (!selectedMonth) return { netWorth: 0, prevNw: null as number | null, tree: [] as TreeNode[] }

    const monthBalances = balances.filter(b => b.month === selectedMonth)

    const balMap = new Map<number, number>()
    for (const b of monthBalances) balMap.set(b.accountId, b.balance)

    // Previous month net worth
    const prevMonthKey = allMonths[monthIdx + 1] || null
    let prevNwVal: number | null = null
    if (prevMonthKey) {
      const prevBals = balances.filter(b => b.month === prevMonthKey)
      const prevMap = new Map<number, number>()
      for (const b of prevBals) prevMap.set(b.accountId, b.balance)
      prevNwVal = accounts.filter(a => a.status === 'active').reduce((s, a) => s + (prevMap.get(a.id) ?? 0), 0)
    }

    const sum = (accs: Account[]) => accs.reduce((s, a) => s + (balMap.get(a.id) ?? 0), 0)

    const fiAccounts = accounts.filter(a => a.goalType === 'fi' && a.status === 'active')
    const gwAccounts = accounts.filter(a => a.goalType === 'gw' && a.status === 'active')

    const fiRetirement = fiAccounts.filter(a => a.type === 'retirement')
    const fiNonRetirement = fiAccounts.filter(a => a.type === 'non-retirement')
    const gwLiquid = gwAccounts.filter(a => a.type === 'liquid')
    const gwIlliquid = gwAccounts.filter(a => a.type === 'illiquid')

    const fiTotal = sum(fiAccounts)
    const gwTotal = sum(gwAccounts)
    const nw = sum(accounts.filter(a => a.status === 'active'))

    const tree: TreeNode[] = [
      {
        label: 'FI',
        value: fiTotal,
        children: [
          { label: ACCOUNT_TYPE_LABELS.retirement, value: sum(fiRetirement) },
          { label: ACCOUNT_TYPE_LABELS['non-retirement'], value: sum(fiNonRetirement) },
        ].filter(c => c.value !== 0),
      },
      {
        label: 'GW',
        value: gwTotal,
        children: [
          { label: ACCOUNT_TYPE_LABELS.liquid, value: sum(gwLiquid) },
          { label: ACCOUNT_TYPE_LABELS.illiquid, value: sum(gwIlliquid) },
        ].filter(c => c.value !== 0),
      },
    ]

    return { netWorth: nw, prevNw: prevNwVal, tree }
  }, [accounts, balances, selectedMonth, allMonths, monthIdx])

  const toggle = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const formatMonth = (ym: string) => {
    if (!ym) return ''
    const [y, m] = ym.split('-')
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${names[parseInt(m, 10) - 1]} ${y}`
  }

  // Long-press helpers
  const clearLP = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
  }, [])

  const startLP = useCallback(() => {
    didLongPress.current = false
    longPressTimer.current = setTimeout(() => { didLongPress.current = true; setJumpOpen(true) }, LONG_PRESS_MS)
  }, [])

  const endLP = useCallback((dir: 'prev' | 'next') => {
    clearLP()
    if (didLongPress.current) return // long-press already opened picker
    if (dir === 'prev') setMonthIdx(i => Math.min(i + 1, allMonths.length - 1))
    else setMonthIdx(i => Math.max(i - 1, 0))
  }, [allMonths.length, clearLP])

  // Close jump picker on outside click
  useEffect(() => {
    if (!jumpOpen) return
    const handler = (e: MouseEvent) => {
      if (jumpRef.current && !jumpRef.current.contains(e.target as Node)) setJumpOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [jumpOpen])

  // Group months by year for the jump picker
  const monthsByYear = useMemo(() => {
    const map = new Map<string, { month: string; idx: number }[]>()
    for (let i = 0; i < allMonths.length; i++) {
      const ym = allMonths[i]
      const y = ym.split('-')[0]
      if (!map.has(y)) map.set(y, [])
      map.get(y)!.push({ month: ym, idx: i })
    }
    // sort months within each year ascending
    for (const arr of map.values()) arr.sort((a, b) => a.month.localeCompare(b.month))
    return map
  }, [allMonths])

  if (balances.length === 0) {
    return (
      <div className="home-card home-card--nw">
        <div className="home-card-header">
          <h3>Net Worth</h3>
          <button className="home-card-link" onClick={onNavigate}>View Data →</button>
        </div>
        <div className="home-card-empty">No balance data yet</div>
      </div>
    )
  }

  return (
    <div className="home-card home-card--nw">
      <div className="home-card-header">
        <h3>Net Worth</h3>
        <button className="home-card-link" onClick={onNavigate}>View Data →</button>
      </div>
      <div className="nw-headline">
        <button
          className="nw-month-arrow"
          disabled={monthIdx >= allMonths.length - 1}
          onMouseDown={startLP}
          onMouseUp={() => endLP('prev')}
          onMouseLeave={clearLP}
          onTouchStart={startLP}
          onTouchEnd={() => { endLP('prev') }}
          aria-label="Previous month"
        >‹</button>
        <div className="nw-headline-center">
          <span className="nw-amount">{formatCurrency(netWorth)}
            {prevNw !== null && (() => {
              const diff = netWorth - prevNw
              const cls = diff > 0 ? 'nw-change up' : diff < 0 ? 'nw-change down' : 'nw-change flat'
              const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : ''
              return <span className={cls}>{arrow} {formatCurrency(Math.abs(diff))}</span>
            })()}
          </span>
          <span className="nw-date">{formatMonth(selectedMonth)}</span>
        </div>
        <button
          className="nw-month-arrow"
          disabled={monthIdx <= 0}
          onMouseDown={startLP}
          onMouseUp={() => endLP('next')}
          onMouseLeave={clearLP}
          onTouchStart={startLP}
          onTouchEnd={() => { endLP('next') }}
          aria-label="Next month"
        >›</button>
        {jumpOpen && (
          <div className="nw-jump-picker" ref={jumpRef}>
            {[...monthsByYear.entries()].map(([year, months]) => (
              <div key={year} className="nw-jump-year">
                <div className="nw-jump-year-label">{year}</div>
                <div className="nw-jump-months">
                  {months.map(({ month, idx }) => (
                    <button
                      key={month}
                      className={`nw-jump-month-btn${idx === monthIdx ? ' active' : ''}`}
                      onClick={() => { setMonthIdx(idx); setJumpOpen(false) }}
                    >
                      {month.split('-')[1]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="nw-tree">
        {tree.map(node => (
          <div key={node.label} className="nw-tree-branch">
            <button
              className={`nw-tree-node nw-tree-node--parent${expanded.has(node.label) ? ' open' : ''}`}
              onClick={() => toggle(node.label)}
            >
              <span className="nw-tree-chevron">
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <path d={expanded.has(node.label) ? 'M2 3l3 4 3-4' : 'M3 2l4 3-4 3'} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="nw-tree-label">{node.label}</span>
              <span className="nw-tree-value">{formatCurrency(node.value)}</span>
            </button>
            {expanded.has(node.label) && node.children && (
              <div className="nw-tree-children">
                {node.children.map(child => (
                  <div key={child.label} className="nw-tree-node nw-tree-node--leaf">
                    <span className="nw-tree-label">{child.label}</span>
                    <span className="nw-tree-value">{formatCurrency(child.value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default NetWorthSummary
