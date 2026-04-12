import { FC, useState, useMemo } from 'react'
import { Profile } from '../../hooks/useProfile'
import {
  Account, BalanceEntry, AccountOwner, AccountGoalType, AccountType, AccountNature, AssetAllocation,
  ACCOUNT_TYPE_LABELS, GOAL_TYPE_LABELS, NATURE_LABELS, ALLOCATION_LABELS, getDefaultAllocation, getOwnerLabels, formatMonth, formatCurrency,
} from './types'

type DateFilter = 'all' | 'ytd' | 'last-12' | 'eoy' | 'custom'
type L1Filter = 'date' | 'owner' | 'goal' | 'type' | 'nature' | 'allocation'

interface BalanceSpreadsheetProps {
  spreadsheetAccounts: Account[]
  allAccounts: Account[]
  balances: BalanceEntry[]
  allMonths: string[]
  balanceMap: Map<string, number>
  profile: Profile
  inlineEntry: { month: string; values: Record<number, string> } | null
  onInlineEntryChange: (entry: { month: string; values: Record<number, string> }) => void
  onSaveInlineEntry: () => void
  onCancelInlineEntry: () => void
}

const BalanceSpreadsheet: FC<BalanceSpreadsheetProps> = ({
  spreadsheetAccounts, allAccounts, allMonths, balanceMap, profile,
  inlineEntry, onInlineEntryChange, onSaveInlineEntry, onCancelInlineEntry,
}) => {
  const [activeL1, setActiveL1] = useState<L1Filter | null>(null)
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [ownerFilter, setOwnerFilter] = useState<Set<AccountOwner>>(new Set())
  const [goalFilter, setGoalFilter] = useState<Set<AccountGoalType>>(new Set())
  const [typeFilter, setTypeFilter] = useState<Set<AccountType>>(new Set())
  const [natureFilter, setNatureFilter] = useState<Set<AccountNature>>(new Set())
  const [allocationFilter, setAllocationFilter] = useState<Set<AssetAllocation>>(new Set())

  const ownerLabels = useMemo(() => getOwnerLabels(profile), [profile])

  const toggleL1 = (f: L1Filter) => setActiveL1(prev => prev === f ? null : f)

  const toggleSet = <T,>(setter: React.Dispatch<React.SetStateAction<Set<T>>>, value: T) => {
    setter(prev => {
      const next = new Set(prev)
      next.has(value) ? next.delete(value) : next.add(value)
      return next
    })
  }

  const hasDateFilter = dateFilter !== 'all'
  const hasOwnerFilter = ownerFilter.size > 0
  const hasGoalFilter = goalFilter.size > 0
  const hasTypeFilter = typeFilter.size > 0
  const hasNatureFilter = natureFilter.size > 0
  const hasAllocationFilter = allocationFilter.size > 0
  const hasAnyFilter = hasDateFilter || hasOwnerFilter || hasGoalFilter || hasTypeFilter || hasNatureFilter || hasAllocationFilter

  const clearAllFilters = () => {
    setDateFilter('all')
    setCustomFrom('')
    setCustomTo('')
    setOwnerFilter(new Set())
    setGoalFilter(new Set())
    setTypeFilter(new Set())
    setNatureFilter(new Set())
    setAllocationFilter(new Set())
    setActiveL1(null)
  }

  const matchesFilters = (a: Account) =>
    (ownerFilter.size === 0 || ownerFilter.has(a.owner)) &&
    (goalFilter.size === 0 || goalFilter.has(a.goalType)) &&
    (typeFilter.size === 0 || typeFilter.has(a.type)) &&
    (natureFilter.size === 0 || natureFilter.has(a.nature || 'asset')) &&
    (allocationFilter.size === 0 || allocationFilter.has(a.allocation || getDefaultAllocation(a.nature || 'asset')))

  /* Column filtering */
  const visibleAccounts = useMemo(() =>
    spreadsheetAccounts.filter(matchesFilters), [spreadsheetAccounts, ownerFilter, goalFilter, typeFilter, natureFilter, allocationFilter])

  /* Total includes active + inactive matching filters */
  const totalAccounts = useMemo(() =>
    allAccounts.filter(matchesFilters), [allAccounts, ownerFilter, goalFilter, typeFilter, natureFilter, allocationFilter])

  /* Date filtering */
  const availableYears = useMemo(() => {
    const years = new Set(allMonths.map(m => m.slice(0, 4)))
    return [...years].sort()
  }, [allMonths])

  const monthOptions = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => {
      const val = String(i + 1).padStart(2, '0')
      const label = new Date(2000, i).toLocaleString('default', { month: 'short' })
      return { val, label }
    }), [])

  const filteredMonths = useMemo(() => {
    if (dateFilter === 'all') return allMonths
    const now = new Date()
    const yr = now.getFullYear().toString()
    const cur = `${yr}-${String(now.getMonth() + 1).padStart(2, '0')}`
    switch (dateFilter) {
      case 'ytd': return allMonths.filter(m => m >= `${yr}-01` && m <= cur)
      case 'last-12': return allMonths.slice(0, 12)
      case 'eoy': return allMonths.filter(m => m.endsWith('-12'))
      case 'custom': return allMonths.filter(m => (!customFrom || m >= customFrom) && (!customTo || m <= customTo))
      default: return allMonths
    }
  }, [dateFilter, allMonths, customFrom, customTo])

  const setCustomMonth = (which: 'from' | 'to', part: 'year' | 'month', value: string) => {
    const setter = which === 'from' ? setCustomFrom : setCustomTo
    const current = which === 'from' ? customFrom : customTo
    const [y, m] = current ? current.split('-') : ['', '']
    if (part === 'year') setter(value ? `${value}-${m || '01'}` : '')
    else setter(y ? `${y}-${value}` : '')
  }

  const renderMonthPicker = (value: string, which: 'from' | 'to') => {
    const [y, m] = value ? value.split('-') : ['', '']
    return (
      <div className="data-range-picker">
        <select className="data-range-select" value={y} onChange={e => setCustomMonth(which, 'year', e.target.value)}>
          <option value="">Year</option>
          {availableYears.map(yr => <option key={yr} value={yr}>{yr}</option>)}
        </select>
        <select className="data-range-select" value={m} onChange={e => setCustomMonth(which, 'month', e.target.value)}>
          <option value="">Month</option>
          {monthOptions.map(({ val, label }) => <option key={val} value={val}>{label}</option>)}
        </select>
      </div>
    )
  }

  return (
  <>
    <div className="data-filter-bar">
      <div className="data-filter-l1">
        {([
          ['date', 'Date', hasDateFilter],
          ['owner', 'Owner', hasOwnerFilter],
          ['goal', 'Goal', hasGoalFilter],
          ['type', 'Type', hasTypeFilter],
          ['nature', 'Asset/Liability', hasNatureFilter],
          ['allocation', 'Allocation', hasAllocationFilter],
        ] as [L1Filter, string, boolean][]).map(([key, label, active]) => (
          <button
            key={key}
            className={`data-filter-l1-btn${activeL1 === key ? ' expanded' : ''}${active ? ' filtered' : ''}`}
            onClick={() => toggleL1(key)}
          >{label}{active && <span className="data-filter-dot" />}</button>
        ))}
        {hasAnyFilter && (
          <button className="data-filter-clear-btn" onClick={clearAllFilters}>Clear all</button>
        )}
      </div>

      {activeL1 === 'date' && (
        <div className="data-filter-l2">
          <div className="data-filter-group">
            {([['all', 'All'], ['ytd', 'YTD'], ['last-12', 'Last 12 mo'], ['eoy', 'Year-End'], ['custom', 'Custom']] as const).map(([key, label]) => (
              <button key={key} className={`data-filter-btn${dateFilter === key ? ' active' : ''}`}
                onClick={() => setDateFilter(key as DateFilter)}>{label}</button>
            ))}
          </div>
          {dateFilter === 'custom' && (
            <div className="data-custom-range">
              {renderMonthPicker(customFrom, 'from')}
              <span className="data-range-sep">to</span>
              {renderMonthPicker(customTo, 'to')}
            </div>
          )}
        </div>
      )}

      {activeL1 === 'owner' && (
        <div className="data-filter-l2">
          <div className="data-filter-group">
            {(['primary', 'partner', 'joint'] as const).map(key => (
              <button key={key} className={`data-filter-btn${ownerFilter.has(key) ? ' active' : ''}`}
                onClick={() => toggleSet(setOwnerFilter, key)}>{ownerLabels[key]}</button>
            ))}
          </div>
        </div>
      )}

      {activeL1 === 'goal' && (
        <div className="data-filter-l2">
          <div className="data-filter-group">
            {(['fi', 'gw'] as const).map(key => (
              <button key={key} className={`data-filter-btn${goalFilter.has(key) ? ' active' : ''}`}
                onClick={() => toggleSet(setGoalFilter, key)}>{GOAL_TYPE_LABELS[key]}</button>
            ))}
          </div>
        </div>
      )}

      {activeL1 === 'type' && (
        <div className="data-filter-l2">
          <div className="data-filter-group">
            {(['retirement', 'non-retirement', 'liquid', 'illiquid'] as const).map(key => (
              <button key={key} className={`data-filter-btn${typeFilter.has(key) ? ' active' : ''}`}
                onClick={() => toggleSet(setTypeFilter, key)}>{ACCOUNT_TYPE_LABELS[key]}</button>
            ))}
          </div>
        </div>
      )}

      {activeL1 === 'nature' && (
        <div className="data-filter-l2">
          <div className="data-filter-group">
            {(['asset', 'liability'] as const).map(key => (
              <button key={key} className={`data-filter-btn${natureFilter.has(key) ? ' active' : ''}`}
                onClick={() => toggleSet(setNatureFilter, key)}>{NATURE_LABELS[key]}</button>
            ))}
          </div>
        </div>
      )}

      {activeL1 === 'allocation' && (
        <div className="data-filter-l2">
          <div className="data-filter-group">
            {(['cash', 'us-stock', 'intl-stock', 'bonds', 'real-estate', 'others', 'debt'] as const).map(key => (
              <button key={key} className={`data-filter-btn${allocationFilter.has(key) ? ' active' : ''}`}
                onClick={() => toggleSet(setAllocationFilter, key)}>{ALLOCATION_LABELS[key]}</button>
            ))}
          </div>
        </div>
      )}
    </div>

    <div className="data-spreadsheet-wrap">
    <table className="data-spreadsheet">
      <thead>
        <tr>
          <th className="data-spreadsheet-corner"></th>
          <th className="data-spreadsheet-col-header data-spreadsheet-total-col">Total</th>
          {visibleAccounts.map(a => (
            <th key={a.id} className="data-spreadsheet-col-header">
              <span className="data-spreadsheet-account-name">{a.name}</span>
              {a.institution && <span className="data-spreadsheet-institution">{a.institution}</span>}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {inlineEntry && (
          <tr className="data-spreadsheet-inline-row">
            <td className="data-spreadsheet-row-header data-spreadsheet-inline-month">
              <input
                type="month"
                className="data-inline-month-input"
                value={inlineEntry.month}
                onChange={e => onInlineEntryChange({ ...inlineEntry, month: e.target.value })}
              />
            </td>
            <td className="data-spreadsheet-cell data-spreadsheet-total-cell">
              <div className="data-inline-actions">
                <button className="data-inline-save" onClick={onSaveInlineEntry} title="Save">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                    <path d="M4 10l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button className="data-inline-cancel" onClick={onCancelInlineEntry} title="Cancel">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                    <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            </td>
            {visibleAccounts.map(a => (
              <td key={a.id} className="data-spreadsheet-cell data-spreadsheet-inline-cell">
                <input
                  type="number"
                  step="0.01"
                  className="data-inline-balance-input"
                  placeholder="—"
                  value={inlineEntry.values[a.id] || ''}
                  onChange={e => onInlineEntryChange({
                    ...inlineEntry,
                    values: { ...inlineEntry.values, [a.id]: e.target.value }
                  })}
                />
              </td>
            ))}
          </tr>
        )}
        {filteredMonths.map(month => {
          const rowTotal = totalAccounts.reduce((sum, a) => {
            const val = balanceMap.get(`${a.id}:${month}`)
            return val !== undefined ? sum + val : sum
          }, 0)
          return (
            <tr key={month}>
              <td className="data-spreadsheet-row-header">{formatMonth(month)}</td>
              <td className="data-spreadsheet-cell data-spreadsheet-total-cell">{formatCurrency(rowTotal)}</td>
              {visibleAccounts.map(a => {
                const val = balanceMap.get(`${a.id}:${month}`)
                return (
                  <td key={a.id} className="data-spreadsheet-cell">
                    {val !== undefined ? formatCurrency(val) : ''}
                  </td>
                )
              })}
            </tr>
          )
        })}
      </tbody>
    </table>
  </div>
  </>
  )
}

export default BalanceSpreadsheet
