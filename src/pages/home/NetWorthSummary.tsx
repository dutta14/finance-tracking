import { FC, useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { Account, BalanceEntry, formatCurrency, ACCOUNT_TYPE_LABELS } from '../data/types'

interface NetWorthSummaryProps {
  accounts: Account[]
  balances: BalanceEntry[]
  allMonths: string[] // sorted desc (newest first)
  onNavigate: () => void
}

const LONG_PRESS_MS = 400

const sumAccountBalances = (accounts: Account[], balanceMap: Map<number, number>) =>
  accounts.reduce((sum, account) => sum + (balanceMap.get(account.id) ?? 0), 0)

const NetWorthSummary: FC<NetWorthSummaryProps> = ({ accounts, balances, allMonths, onNavigate }) => {
  const [monthIdx, setMonthIdx] = useState(0) // 0 = latest
  const [jumpOpen, setJumpOpen] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)
  const jumpRef = useRef<HTMLDivElement>(null)

  const selectedMonth = allMonths[monthIdx] || ''

  const balanceMapsByMonth = useMemo(() => {
    const monthMaps = new Map<string, Map<number, number>>()
    for (const balance of balances) {
      let monthMap = monthMaps.get(balance.month)
      if (!monthMap) {
        monthMap = new Map<number, number>()
        monthMaps.set(balance.month, monthMap)
      }
      monthMap.set(balance.accountId, balance.balance)
    }
    return monthMaps
  }, [balances])

  const {
    netWorth,
    prevNw,
    fiTotal,
    fiRetirementTotal,
    fiNonRetirementTotal,
    gwTotal,
    gwLiquidTotal,
    gwIlliquidTotal,
  } = useMemo(() => {
    if (!selectedMonth) {
      return {
        netWorth: 0,
        prevNw: null as number | null,
        fiTotal: 0,
        fiRetirementTotal: 0,
        fiNonRetirementTotal: 0,
        gwTotal: 0,
        gwLiquidTotal: 0,
        gwIlliquidTotal: 0,
      }
    }

    const balMap = balanceMapsByMonth.get(selectedMonth) ?? new Map<number, number>()

    // Previous month net worth
    const prevMonthKey = allMonths[monthIdx + 1] || null
    let prevNwVal: number | null = null
    if (prevMonthKey) {
      const prevMap = balanceMapsByMonth.get(prevMonthKey) ?? new Map<number, number>()
      prevNwVal = sumAccountBalances(accounts, prevMap)
    }

    const fiAccounts = accounts.filter(a => a.goalType === 'fi')
    const gwAccounts = accounts.filter(a => a.goalType === 'gw')

    const fiRetirement = fiAccounts.filter(a => a.type === 'retirement')
    const fiNonRetirement = fiAccounts.filter(a => a.type === 'non-retirement')
    const gwLiquid = gwAccounts.filter(a => a.type === 'liquid')
    const gwIlliquid = gwAccounts.filter(a => a.type === 'illiquid')

    const fiTotal = sumAccountBalances(fiAccounts, balMap)
    const gwTotal = sumAccountBalances(gwAccounts, balMap)
    const fiRetirementTotal = sumAccountBalances(fiRetirement, balMap)
    const fiNonRetirementTotal = sumAccountBalances(fiNonRetirement, balMap)
    const gwLiquidTotal = sumAccountBalances(gwLiquid, balMap)
    const gwIlliquidTotal = sumAccountBalances(gwIlliquid, balMap)
    const nw = sumAccountBalances(accounts, balMap)

    return {
      netWorth: nw,
      prevNw: prevNwVal,
      fiTotal,
      fiRetirementTotal,
      fiNonRetirementTotal,
      gwTotal,
      gwLiquidTotal,
      gwIlliquidTotal,
    }
  }, [accounts, selectedMonth, allMonths, monthIdx, balanceMapsByMonth])

  const formatMonth = (ym: string) => {
    if (!ym) return ''
    const [y, m] = ym.split('-')
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${names[parseInt(m, 10) - 1]} ${y}`
  }

  const proseParts = useMemo(() => {
    const monthLabel = formatMonth(selectedMonth)
    const diff = prevNw === null ? null : netWorth - prevNw

    const fiChildren = [
      fiRetirementTotal > 0
        ? { amount: formatCurrency(fiRetirementTotal), label: ACCOUNT_TYPE_LABELS.retirement }
        : null,
      fiNonRetirementTotal > 0
        ? { amount: formatCurrency(fiNonRetirementTotal), label: ACCOUNT_TYPE_LABELS['non-retirement'] }
        : null,
    ].filter(Boolean) as Array<{ amount: string; label: string }>

    const gwChildren = [
      gwLiquidTotal > 0 ? { amount: formatCurrency(gwLiquidTotal), label: ACCOUNT_TYPE_LABELS.liquid } : null,
      gwIlliquidTotal > 0 ? { amount: formatCurrency(gwIlliquidTotal), label: ACCOUNT_TYPE_LABELS.illiquid } : null,
    ].filter(Boolean) as Array<{ amount: string; label: string }>

    const clauses = [
      fiChildren.length > 0 ? { label: 'FI accounts', total: fiTotal, children: fiChildren, includeIsIn: true } : null,
      gwChildren.length > 0 ? { label: 'GW', total: gwTotal, children: gwChildren, includeIsIn: false } : null,
    ].filter(Boolean) as Array<{
      label: string
      total: number
      children: Array<{ amount: string; label: string }>
      includeIsIn: boolean
    }>

    return { monthLabel, diff, clauses }
  }, [
    selectedMonth,
    prevNw,
    netWorth,
    fiRetirementTotal,
    fiNonRetirementTotal,
    gwLiquidTotal,
    gwIlliquidTotal,
    fiTotal,
    gwTotal,
  ])

  const breakdownBars = useMemo(() => {
    const toPct = (value: number) => {
      if (netWorth === 0) return 0
      return Math.max(0, Math.min(100, (value / netWorth) * 100))
    }

    return [
      { label: 'FI', value: fiTotal, pct: toPct(fiTotal), fillClass: 'nw-bar-fill--fi' },
      { label: 'GW', value: gwTotal, pct: toPct(gwTotal), fillClass: 'nw-bar-fill--gw' },
    ]
  }, [fiTotal, gwTotal, netWorth])

  // Long-press helpers
  const clearLP = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const startLP = useCallback(() => {
    didLongPress.current = false
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true
      setJumpOpen(true)
    }, LONG_PRESS_MS)
  }, [])

  const stepMonth = useCallback(
    (dir: 'prev' | 'next') => {
      if (dir === 'prev') setMonthIdx(i => Math.min(i + 1, allMonths.length - 1))
      else setMonthIdx(i => Math.max(i - 1, 0))
    },
    [allMonths.length],
  )

  const endLP = useCallback(() => {
    clearLP()
  }, [clearLP])

  const handleMonthClick = useCallback(
    (dir: 'prev' | 'next') => {
      if (didLongPress.current) {
        didLongPress.current = false
        return
      }
      stepMonth(dir)
    },
    [stepMonth],
  )

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
          <button className="home-card-link" onClick={onNavigate}>
            View Data →
          </button>
        </div>
        <div className="home-card-cta">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
          <p>Add accounts and record your first balance to see your net worth here.</p>
          <button className="home-card-cta-btn" onClick={onNavigate}>
            Add your data →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="home-card home-card--nw">
      <div className="home-card-header">
        <button className="home-card-link" onClick={onNavigate}>
          View Data →
        </button>
      </div>
      <div className="nw-headline">
        <button
          className="nw-month-arrow"
          disabled={monthIdx >= allMonths.length - 1}
          onMouseDown={startLP}
          onMouseUp={endLP}
          onMouseLeave={clearLP}
          onTouchStart={startLP}
          onTouchEnd={endLP}
          onClick={() => handleMonthClick('prev')}
          aria-label="Previous month"
        >
          ‹
        </button>
        <div className="nw-headline-center">
          <span className="nw-amount">
            {formatCurrency(netWorth)} <span className="nw-amount-label">net worth</span>
            {prevNw !== null &&
              (() => {
                const diff = netWorth - prevNw
                const pct = prevNw !== 0 ? ((diff / prevNw) * 100).toFixed(1) : '0.0'
                const cls = diff > 0 ? 'nw-change up' : diff < 0 ? 'nw-change down' : 'nw-change flat'
                const arrow = diff > 0 ? '↗' : diff < 0 ? '↘' : ''
                return (
                  <span className={cls}>
                    {arrow} {formatCurrency(Math.abs(diff))} ({pct}%)
                  </span>
                )
              })()}
          </span>
        </div>
        <button
          className="nw-month-arrow"
          disabled={monthIdx <= 0}
          onMouseDown={startLP}
          onMouseUp={endLP}
          onMouseLeave={clearLP}
          onTouchStart={startLP}
          onTouchEnd={endLP}
          onClick={() => handleMonthClick('next')}
          aria-label="Next month"
        >
          ›
        </button>
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
                      onClick={() => {
                        setMonthIdx(idx)
                        setJumpOpen(false)
                      }}
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
      <p className="nw-prose">
        {proseParts.diff !== null && proseParts.diff !== 0 && (
          <>
            {proseParts.diff > 0 ? 'Up' : 'Down'}{' '}
            <strong className={proseParts.diff > 0 ? 'nw-change up' : 'nw-change down'}>
              {formatCurrency(Math.abs(proseParts.diff))}
            </strong>{' '}
            from last month.
          </>
        )}
        {proseParts.clauses.length > 0 && (
          <>
            {proseParts.diff !== null && proseParts.diff !== 0 ? ' ' : ''}
            {proseParts.clauses.map((clause, idx) => (
              <span key={clause.label}>
                {idx > 0 && <>{idx === proseParts.clauses.length - 1 ? ' and ' : ', '}</>}
                <strong>{formatCurrency(clause.total)}</strong> {clause.includeIsIn ? 'is in ' : 'in '}
                {clause.label} (
                {clause.children.map((child, childIdx) => (
                  <span key={`${clause.label}-${child.label}`}>
                    {childIdx > 0 ? ', ' : ''}
                    <strong>{child.amount}</strong> {child.label}
                  </span>
                ))}
                )
              </span>
            ))}
            .
          </>
        )}
      </p>
      {breakdownBars.length === 2 && (
        <div className="nw-stacked-bar" aria-label="Net worth goal breakdown">
          <div
            className="nw-stacked-fill nw-stacked-fill--fi"
            style={{ width: `${breakdownBars[0].pct.toFixed(1)}%` }}
            title={`FI: ${breakdownBars[0].pct.toFixed(1)}%`}
          />
          <div
            className="nw-stacked-fill nw-stacked-fill--gw"
            style={{ width: `${breakdownBars[1].pct.toFixed(1)}%` }}
            title={`GW: ${breakdownBars[1].pct.toFixed(1)}%`}
          />
        </div>
      )}
      {breakdownBars.length === 2 && (
        <div className="nw-stacked-legend">
          <span className="nw-stacked-legend-item">
            <span className="nw-stacked-dot nw-stacked-dot--fi" /> FI {breakdownBars[0].pct.toFixed(1)}%
          </span>
          <span className="nw-stacked-legend-item">
            <span className="nw-stacked-dot nw-stacked-dot--gw" /> GW {breakdownBars[1].pct.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  )
}

export default NetWorthSummary
