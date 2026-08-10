import { FC, useState, useMemo, useCallback } from 'react'
import { Profile } from '../../hooks/useProfile'
import {
  Account,
  BalanceEntry,
  AccountOwner,
  ACCOUNT_TYPE_LABELS,
  GOAL_TYPE_LABELS,
  NATURE_LABELS,
  ALLOCATION_LABELS,
  getDefaultAllocation,
  getOwnerLabels,
  formatMonth,
  formatCurrency,
} from './types'
import FilterPanel, { FilterCategory, FilterState } from '../../components/FilterPanel'
import MonthDatePanel, { PresetKey } from '../../components/MonthDatePanel'

interface BalanceSpreadsheetProps {
  spreadsheetAccounts: Account[]
  allAccounts: Account[]
  balances: BalanceEntry[]
  allMonths: string[]
  balanceMap: Map<string, number>
  profile: Profile
  inlineEntry: { month: string; values: Record<number, string>; _focused?: number } | null
  toolbarActions?: React.ReactNode
  onInlineEntryChange: (entry: { month: string; values: Record<number, string>; _focused?: number }) => void
  onSaveInlineEntry: () => void
  onCancelInlineEntry: () => void
  onDeleteMonth: (month: string) => void
}

const BalanceSpreadsheet: FC<BalanceSpreadsheetProps> = ({
  spreadsheetAccounts,
  allAccounts,
  allMonths,
  balanceMap,
  profile,
  inlineEntry,
  toolbarActions,
  onInlineEntryChange,
  onSaveInlineEntry,
  onCancelInlineEntry,
  onDeleteMonth,
}) => {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [datePreset, setDatePreset] = useState<PresetKey>('all')
  const [pendingDeleteMonth, setPendingDeleteMonth] = useState<string | null>(null)
  const [columnFilters, setColumnFilters] = useState<FilterState>({
    status: ['active'],
    owner: [],
    goal: [],
    type: [],
    nature: [],
    allocation: [],
  })

  const ownerLabels = useMemo(() => getOwnerLabels(profile), [profile])

  const filterCategories = useMemo((): FilterCategory[] => [
    { key: 'owner', label: 'Owner', options: (['primary', 'partner', 'joint'] as const).map(k => ({ value: k, label: ownerLabels[k] })) },
    { key: 'goal', label: 'Goal', options: (['fi', 'gw'] as const).map(k => ({ value: k, label: GOAL_TYPE_LABELS[k] })) },
    { key: 'type', label: 'Type', options: (['retirement', 'non-retirement', 'liquid', 'illiquid'] as const).map(k => ({ value: k, label: ACCOUNT_TYPE_LABELS[k] })) },
    { key: 'nature', label: 'Asset/Liability', options: (['asset', 'liability'] as const).map(k => ({ value: k, label: NATURE_LABELS[k] })) },
    { key: 'allocation', label: 'Allocation', options: (['cash', 'us-stock', 'intl-stock', 'bonds', 'real-estate', 'others', 'debt'] as const).map(k => ({ value: k, label: ALLOCATION_LABELS[k] })) },
    { key: 'status', label: 'Status', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] },
  ], [ownerLabels])

  const handleDateApply = (preset: PresetKey, from: string, to: string) => {
    setDatePreset(preset)
    setDateFrom(from)
    setDateTo(to)
  }

  const matchesFilters = useCallback(
    (a: Account) => {
      const { status, owner, goal, type, nature, allocation } = columnFilters
      return (
        (status.length === 0 || status.includes(a.status || 'active')) &&
        (owner.length === 0 || owner.includes(a.owner)) &&
        (goal.length === 0 || goal.includes(a.goalType)) &&
        (type.length === 0 || type.includes(a.type)) &&
        (nature.length === 0 || nature.includes(a.nature || 'asset')) &&
        (allocation.length === 0 || allocation.includes(a.allocation || getDefaultAllocation(a.nature || 'asset')))
      )
    },
    [columnFilters],
  )

  /* Column filtering */
  const visibleAccounts = useMemo(
    () => spreadsheetAccounts.filter(matchesFilters),
    [spreadsheetAccounts, matchesFilters],
  )

  /* Total includes active + inactive matching filters */
  const totalAccounts = useMemo(() => allAccounts.filter(matchesFilters), [allAccounts, matchesFilters])

  /* Parent/child grouping */
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  type DisplayCol =
    | { kind: 'single'; account: Account }
    | { kind: 'group'; groupName: string; children: Account[] }
    | { kind: 'child'; account: Account; groupName: string; isFirst: boolean; isLast: boolean }

  const displayColumns = useMemo(() => {
    // Group visible accounts by group name
    const grouped = new Map<string, Account[]>()
    const ungrouped: Account[] = []

    for (const a of visibleAccounts) {
      if (a.group) {
        const list = grouped.get(a.group) || []
        list.push(a)
        grouped.set(a.group, list)
      } else {
        ungrouped.push(a)
      }
    }

    const cols: DisplayCol[] = []
    const handledGroups = new Set<string>()

    // Maintain order: walk visibleAccounts, emit group on first encounter
    for (const a of visibleAccounts) {
      if (a.group) {
        if (handledGroups.has(a.group)) continue
        handledGroups.add(a.group)
        const children = grouped.get(a.group)!
        if (children.length === 1) {
          // Single member — just show as standalone
          cols.push({ kind: 'single', account: children[0] })
        } else if (expandedGroups.has(a.group)) {
          children.forEach((c, i) =>
            cols.push({
              kind: 'child',
              account: c,
              groupName: a.group!,
              isFirst: i === 0,
              isLast: i === children.length - 1,
            }),
          )
        } else {
          cols.push({ kind: 'group', groupName: a.group, children })
        }
      } else {
        cols.push({ kind: 'single', account: a })
      }
    }

    return cols
  }, [visibleAccounts, expandedGroups])

  const toggleGroupExpand = (groupName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(groupName) ? next.delete(groupName) : next.add(groupName)
      return next
    })
  }

  const sumGroupForMonth = (children: Account[], month: string) =>
    children.reduce((sum, c) => {
      const val = balanceMap.get(`${c.id}:${month}`)
      return val !== undefined ? sum + val : sum
    }, 0)

  const hasGroupBalanceForMonth = (children: Account[], month: string) =>
    children.some(c => balanceMap.has(`${c.id}:${month}`))

  /* Date filtering */
  const filteredMonths = useMemo(() => {
    if (datePreset === 'all') return allMonths
    if (datePreset === 'eoy') return allMonths.filter(m => m.endsWith('-12'))
    const ascending = [...allMonths].sort()
    let result: string[]
    if (datePreset === 'ytd') {
      const yr = new Date().getFullYear().toString()
      const cur = `${yr}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
      result = ascending.filter(m => m >= `${yr}-01` && m <= cur)
    } else if (datePreset === 'last-12') {
      result = ascending.slice(-12)
    } else {
      // custom
      result = ascending.filter(m => (!dateFrom || m >= dateFrom) && (!dateTo || m <= dateTo))
    }
    // Return in descending order (newest first) to match allMonths
    return result.reverse()
  }, [datePreset, dateFrom, dateTo, allMonths])

  return (
    <>
      <div className="data-filter-bar">
        {toolbarActions && <div className="data-toolbar-actions">{toolbarActions}</div>}
        <FilterPanel categories={filterCategories} filters={columnFilters} onChange={setColumnFilters} />
        <MonthDatePanel allMonths={allMonths} fromMonth={dateFrom} toMonth={dateTo} preset={datePreset} onApply={handleDateApply} />
      </div>

      <div className="data-spreadsheet-wrap">
        <table className="data-spreadsheet">
          <thead>
            <tr className="data-spreadsheet-owner-row">
              <th className="data-spreadsheet-owner-corner"></th>
              <th className="data-spreadsheet-owner-cell data-spreadsheet-total-col"></th>
              {displayColumns.map(col => {
                const owner: AccountOwner =
                  col.kind === 'group'
                    ? new Set(col.children.map(c => c.owner)).size === 1
                      ? col.children[0].owner
                      : 'joint'
                    : col.account.owner
                const key = col.kind === 'group' ? `owner-g-${col.groupName}` : `owner-${col.account.id}`
                const primaryInitial = (profile.name || 'P')[0].toUpperCase()
                const partnerInitial = (profile.partner?.name || 'S')[0].toUpperCase()
                return (
                  <th key={key} className="data-spreadsheet-owner-cell">
                    {owner === 'joint' ? (
                      <div className="data-owner-avatar-group">
                        <div className="data-owner-avatar data-owner-avatar-primary">
                          {profile.avatarDataUrl ? <img src={profile.avatarDataUrl} alt="" /> : primaryInitial}
                        </div>
                        <div className="data-owner-avatar data-owner-avatar-partner">
                          {profile.partner?.avatarDataUrl ? (
                            <img src={profile.partner.avatarDataUrl} alt="" />
                          ) : (
                            partnerInitial
                          )}
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`data-owner-avatar ${owner === 'partner' ? 'data-owner-avatar-partner' : 'data-owner-avatar-primary'}`}
                      >
                        {owner === 'partner' ? (
                          profile.partner?.avatarDataUrl ? (
                            <img src={profile.partner.avatarDataUrl} alt="" />
                          ) : (
                            partnerInitial
                          )
                        ) : profile.avatarDataUrl ? (
                          <img src={profile.avatarDataUrl} alt="" />
                        ) : (
                          primaryInitial
                        )}
                      </div>
                    )}
                  </th>
                )
              })}
            </tr>
            <tr>
              <th className="data-spreadsheet-corner"></th>
              <th className="data-spreadsheet-col-header data-spreadsheet-total-col">Total</th>
              {displayColumns.map(col => {
                if (col.kind === 'group') {
                  const allInactive = col.children.every(c => c.status === 'inactive')
                  return (
                    <th
                      key={`g-${col.groupName}`}
                      className={`data-spreadsheet-col-header data-spreadsheet-group-header${allInactive ? ' data-spreadsheet-inactive' : ''}`}
                    >
                      <button
                        className="data-split-btn"
                        onClick={() => toggleGroupExpand(col.groupName)}
                        title="Split into sub-accounts"
                      >
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                          <path
                            d="M10 4v4m0 0l-4 4m4-4l4 4"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      <span className="data-spreadsheet-account-name">{col.groupName}</span>
                    </th>
                  )
                }
                const a = col.account
                const inactive = a.status === 'inactive'
                return (
                  <th
                    key={a.id}
                    className={`data-spreadsheet-col-header${col.kind === 'child' ? ' data-spreadsheet-child-header' : ''}${inactive ? ' data-spreadsheet-inactive' : ''}`}
                  >
                    {col.kind === 'child' && col.isFirst && (
                      <button
                        className="data-merge-btn"
                        onClick={() => toggleGroupExpand(col.groupName)}
                        title="Merge sub-accounts"
                      >
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                          <path
                            d="M6 4l4 4 4-4M10 8v8"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    )}
                    <span className="data-spreadsheet-account-name">{a.name}</span>
                    {a.institution && <span className="data-spreadsheet-institution">{a.institution}</span>}
                  </th>
                )
              })}
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
                        <path
                          d="M4 10l4 4 8-8"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <button className="data-inline-cancel" onClick={onCancelInlineEntry} title="Cancel">
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                        <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                </td>
                {displayColumns.map(col => {
                  if (col.kind === 'group') {
                    return (
                      <td
                        key={`g-${col.groupName}`}
                        className="data-spreadsheet-cell data-spreadsheet-inline-cell data-spreadsheet-group-cell"
                      >
                        {/* Group cells are read-only in inline mode — edit sub-accounts individually */}
                      </td>
                    )
                  }
                  const a = col.account
                  const rawVal = inlineEntry.values[a.id] || ''
                  const numericVal = rawVal ? Number(rawVal) : NaN
                  const displayVal = !isNaN(numericVal) ? formatCurrency(numericVal) : rawVal
                  return (
                    <td
                      key={a.id}
                      className={`data-spreadsheet-cell data-spreadsheet-inline-cell${col.kind === 'child' ? ' data-spreadsheet-child-cell' : ''}`}
                    >
                      <input
                        type="text"
                        inputMode="numeric"
                        className="data-inline-balance-input"
                        placeholder="—"
                        value={inlineEntry._focused === a.id ? rawVal : displayVal}
                        onFocus={() => onInlineEntryChange({ ...inlineEntry, _focused: a.id })}
                        onBlur={() => onInlineEntryChange({ ...inlineEntry, _focused: undefined })}
                        onChange={e => {
                          const v = e.target.value.replace(/[^0-9.-]/g, '')
                          onInlineEntryChange({
                            ...inlineEntry,
                            values: { ...inlineEntry.values, [a.id]: v },
                            _focused: a.id,
                          })
                        }}
                      />
                    </td>
                  )
                })}
              </tr>
            )}
            {filteredMonths.map(month => {
              const rowTotal = totalAccounts.reduce((sum, a) => {
                const val = balanceMap.get(`${a.id}:${month}`)
                return val !== undefined ? sum + val : sum
              }, 0)
              return (
                <tr key={month}>
                  <td className="data-spreadsheet-row-header">
                    <span className="data-spreadsheet-month-label">{formatMonth(month)}</span>
                    <button
                      className="data-delete-row-btn"
                      title={`Delete ${formatMonth(month)}`}
                      onClick={() => setPendingDeleteMonth(month)}
                    >
                      <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
                        <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  </td>
                  <td className="data-spreadsheet-cell data-spreadsheet-total-cell">{formatCurrency(rowTotal)}</td>
                  {displayColumns.map(col => {
                    if (col.kind === 'group') {
                      const groupVal = sumGroupForMonth(col.children, month)
                      const hasGroupBalance = hasGroupBalanceForMonth(col.children, month)
                      const allInactive = col.children.every(c => c.status === 'inactive')
                      return (
                        <td
                          key={`g-${col.groupName}`}
                          className={`data-spreadsheet-cell data-spreadsheet-group-cell${allInactive ? ' data-spreadsheet-inactive' : ''}`}
                        >
                          {hasGroupBalance ? formatCurrency(groupVal) : ''}
                        </td>
                      )
                    }
                    const val = balanceMap.get(`${col.account.id}:${month}`)
                    const inactive = col.account.status === 'inactive'
                    return (
                      <td
                        key={col.account.id}
                        className={`data-spreadsheet-cell${col.kind === 'child' ? ' data-spreadsheet-child-cell' : ''}${inactive ? ' data-spreadsheet-inactive' : ''}`}
                      >
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

      {pendingDeleteMonth && (
        <div className="data-confirm-overlay" onClick={() => setPendingDeleteMonth(null)}>
          <div className="data-confirm-dialog" onClick={e => e.stopPropagation()}>
            <p className="data-confirm-message">
              Delete all balance entries for <strong>{formatMonth(pendingDeleteMonth)}</strong>?<br />
              This cannot be undone.
            </p>
            <div className="data-confirm-actions">
              <button className="data-confirm-cancel" onClick={() => setPendingDeleteMonth(null)}>
                Cancel
              </button>
              <button
                className="data-confirm-delete"
                onClick={() => {
                  onDeleteMonth(pendingDeleteMonth)
                  setPendingDeleteMonth(null)
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default BalanceSpreadsheet
