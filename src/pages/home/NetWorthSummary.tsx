import { FC, useState, useMemo } from 'react'
import { Account, BalanceEntry, formatCurrency, ACCOUNT_TYPE_LABELS } from '../data/types'

interface NetWorthSummaryProps {
  accounts: Account[]
  balances: BalanceEntry[]
  onNavigate: () => void
}

interface TreeNode {
  label: string
  value: number
  children?: TreeNode[]
}

const NetWorthSummary: FC<NetWorthSummaryProps> = ({ accounts, balances, onNavigate }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const { latestMonth, netWorth, tree } = useMemo(() => {
    if (balances.length === 0) return { latestMonth: '', netWorth: 0, tree: [] as TreeNode[] }

    const months = [...new Set(balances.map(b => b.month))].sort()
    const latest = months[months.length - 1]
    const latestBalances = balances.filter(b => b.month === latest)

    const balMap = new Map<number, number>()
    for (const b of latestBalances) balMap.set(b.accountId, b.balance)

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

    return { latestMonth: latest, netWorth: nw, tree }
  }, [accounts, balances])

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
        <span className="nw-amount">{formatCurrency(netWorth)}</span>
        <span className="nw-date">as of {formatMonth(latestMonth)}</span>
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
