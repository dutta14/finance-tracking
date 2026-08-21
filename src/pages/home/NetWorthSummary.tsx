import { FC, useState, useMemo, useCallback } from 'react'
import { Account, BalanceEntry, formatCurrency, ACCOUNT_TYPE_LABELS } from '../data/types'
import MonthPicker from '../../components/MonthPicker'

interface NetWorthSummaryProps {
  accounts: Account[]
  balances: BalanceEntry[]
  allMonths: string[] // sorted desc (newest first)
  onNavigate: () => void
}

const sumAccountBalances = (accounts: Account[], balanceMap: Map<number, number>) =>
  accounts.reduce((sum, account) => sum + (balanceMap.get(account.id) ?? 0), 0)

const NetWorthSummary: FC<NetWorthSummaryProps> = ({ accounts, balances, allMonths, onNavigate }) => {
  const [monthIdx, setMonthIdx] = useState(0) // 0 = latest

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
      fiChildren.length > 0
        ? { label: 'FI accounts', shortLabel: 'FI', total: fiTotal, children: fiChildren, includeIsIn: true }
        : null,
      gwChildren.length > 0
        ? { label: 'GW', shortLabel: 'GW', total: gwTotal, children: gwChildren, includeIsIn: false }
        : null,
    ].filter(Boolean) as Array<{
      label: string
      shortLabel: string
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

  const handleMonthChange = useCallback(
    (month: string) => {
      const idx = allMonths.indexOf(month)
      if (idx >= 0) setMonthIdx(idx)
    },
    [allMonths],
  )

  if (balances.length === 0) {
    return (
      <div className="home-card home-card--nw">
        <div className="home-card-header">
          <h3>Net Worth</h3>
          <button className="home-card-link" onClick={onNavigate}>
            View Details →
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
          View Details →
        </button>
      </div>
      <div className="nw-headline">
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
      </div>
      <MonthPicker allMonths={allMonths} selectedMonth={selectedMonth} onMonthChange={handleMonthChange} />
      <p className="nw-prose">
        {proseParts.diff !== null && proseParts.diff !== 0 && (
          <span className="nw-prose-line">
            {proseParts.diff > 0 ? 'Up' : 'Down'}{' '}
            <strong className={proseParts.diff > 0 ? 'nw-change up' : 'nw-change down'}>
              {formatCurrency(Math.abs(proseParts.diff))}
            </strong>{' '}
            from last month.
          </span>
        )}
        {proseParts.clauses.map(clause => (
          <span key={clause.label} className="nw-prose-line nw-prose-line--goal">
            <strong>{formatCurrency(clause.total)}</strong> saved towards {clause.shortLabel}
            <span className="nw-prose-subline">
              {clause.children.map((child, childIdx) => (
                <span key={`${clause.label}-${child.label}`}>
                  {childIdx > 0 ? ', ' : ''}
                  <strong>{child.amount}</strong> {child.label}
                </span>
              ))}
            </span>
          </span>
        ))}
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
