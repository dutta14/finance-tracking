import { FC } from 'react'
import { Profile } from '../../../hooks/useProfile'
import { Account } from '../types'
import { SortCol } from '../hooks/useColumnSort'
import AccountRow from './AccountRow'
import AccountForm from '../AccountForm'

interface AccountListProps {
  filteredAccounts: Account[]
  accounts: Account[]
  profile: Profile
  existingGroups: string[]
  ownerLabels: Record<string, string>
  editingId: number | null
  showMultiSelect: boolean
  allFilteredSelected: boolean
  selectedIds: Set<number>
  sortCol: SortCol | null
  sortDir: 'asc' | 'desc'
  columnFilters: Partial<Record<SortCol, Set<string>>>
  openFilterCol: SortCol | null
  filterDropdownRef: React.RefObject<HTMLDivElement | null>
  onToggleSort: (col: SortCol) => void
  onToggleColumnFilter: (col: SortCol, value: string) => void
  onClearColumnFilter: (col: SortCol) => void
  onSetOpenFilterCol: (col: SortCol | null) => void
  colUniqueValues: (col: SortCol) => string[]
  getColLabel: (col: SortCol, val: string) => string
  onToggleSelectAll: () => void
  onToggleSelect: (id: number) => void
  onRowClick: (id: number, e: React.MouseEvent) => void
  onEdit: (id: number) => void
  onCancelEdit: () => void
  onUpdate: (id: number, updates: Partial<Account>) => void
  onDelete: (id: number) => void
}

const AccountList: FC<AccountListProps> = ({
  filteredAccounts,
  accounts,
  profile,
  existingGroups,
  ownerLabels,
  editingId,
  showMultiSelect,
  allFilteredSelected,
  selectedIds,
  sortCol,
  sortDir,
  columnFilters,
  openFilterCol,
  filterDropdownRef,
  onToggleSort,
  onToggleColumnFilter,
  onClearColumnFilter,
  onSetOpenFilterCol,
  colUniqueValues,
  getColLabel,
  onToggleSelectAll,
  onToggleSelect,
  onRowClick,
  onEdit,
  onCancelEdit,
  onUpdate,
  onDelete,
}) => {
  if (filteredAccounts.length === 0) {
    return (
      <div className="data-empty settings-data-empty">
        <p className="data-empty-title">No accounts</p>
        <p className="data-empty-subtitle">Click &quot;+ Add Account&quot; to create one</p>
      </div>
    )
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {showMultiSelect && (
              <th className="data-th-checkbox">
                <input type="checkbox" checked={allFilteredSelected} onChange={onToggleSelectAll} />
              </th>
            )}
            {(
              [
                ['name', 'Account'],
                ['goalType', 'Goal'],
                ['type', 'Type'],
                ['nature', 'A/L'],
                ['allocation', 'Allocation'],
                ['owner', 'Owner'],
                ['status', 'Status'],
              ] as [SortCol, string][]
            ).map(([col, label]) => {
              const hasFilter = !!(columnFilters[col] && columnFilters[col]!.size > 0)
              return (
                <th key={col} className="data-th-sortable">
                  <div className="data-th-controls">
                    <button className="data-th-sort-btn" onClick={() => onToggleSort(col)} title={`Sort by ${label}`}>
                      {label}
                      <span className={`data-th-sort-icon${sortCol === col ? ' active' : ''}`}>
                        {sortCol === col && sortDir === 'desc' ? '↓' : sortCol === col ? '↑' : '↕'}
                      </span>
                    </button>
                    {col !== 'name' && (
                      <button
                        className={`data-th-filter-btn${hasFilter ? ' active' : ''}`}
                        onClick={e => {
                          e.stopPropagation()
                          onSetOpenFilterCol(openFilterCol === col ? null : col)
                        }}
                        title={`Filter ${label}`}
                      >
                        <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                          <path
                            d="M1 2h14l-5.5 6.5V14l-3-1.5V8.5L1 2z"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    )}
                    {openFilterCol === col && col !== 'name' && (
                      <div
                        className="data-th-filter-dropdown"
                        ref={filterDropdownRef}
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="data-th-filter-options">
                          {colUniqueValues(col).map(val => {
                            const checked = columnFilters[col]?.has(val) ?? false
                            return (
                              <label key={val} className="data-th-filter-option">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => onToggleColumnFilter(col, val)}
                                />
                                <span>{getColLabel(col, val)}</span>
                              </label>
                            )
                          })}
                        </div>
                        {hasFilter && (
                          <button className="data-th-filter-clear" onClick={() => onClearColumnFilter(col)}>
                            Clear filter
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </th>
              )
            })}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filteredAccounts.map(account =>
            editingId === account.id ? (
              <tr key={account.id} className="data-row--editing">
                <td colSpan={showMultiSelect ? 10 : 9}>
                  <AccountForm
                    profile={profile}
                    existingGroups={existingGroups}
                    allAccounts={accounts}
                    initial={account}
                    onSave={updates => {
                      onUpdate(account.id, updates)
                      onCancelEdit()
                    }}
                    onCancel={onCancelEdit}
                  />
                </td>
              </tr>
            ) : (
              <AccountRow
                key={account.id}
                account={account}
                accounts={accounts}
                ownerLabels={ownerLabels}
                isSelected={selectedIds.has(account.id)}
                showMultiSelect={showMultiSelect}
                onToggleSelect={onToggleSelect}
                onRowClick={onRowClick}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ),
          )}
        </tbody>
      </table>
    </div>
  )
}

export default AccountList
