import { FC, useState, useRef, useEffect } from 'react'
import { Profile } from '../../hooks/useProfile'
import { Account, getOwnerLabels } from './types'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useColumnSort } from './hooks/useColumnSort'
import { useAccountSelection } from './hooks/useAccountSelection'
import AccountForm from './AccountForm'
import GroupManager from './components/GroupManager'
import BulkActions from './components/BulkActions'
import AccountList from './components/AccountList'

interface AccountsModalProps {
  accounts: Account[]
  profile: Profile
  onAdd: (account: Omit<Account, 'id'>) => void
  onUpdate: (id: number, updates: Partial<Account>) => void
  onBulkUpdate: (ids: Set<number>, updates: Partial<Account>) => void
  onDelete: (id: number) => void
  onToggleStatus: (id: number) => void
  onRenameGroup: (oldName: string, newName: string) => void
  onClose: () => void
}

const AccountsModal: FC<AccountsModalProps> = ({
  accounts,
  profile,
  onAdd,
  onUpdate,
  onBulkUpdate,
  onDelete,
  onToggleStatus: _onToggleStatus,
  onRenameGroup,
  onClose,
}) => {
  const ownerLabels = getOwnerLabels(profile)
  const hasPartner = !!profile.partner
  const existingGroups = [...new Set(accounts.map(a => a.group).filter((g): g is string => !!g))]
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [page, setPage] = useState<'accounts' | 'groups'>('accounts')
  const [dragAccountId, setDragAccountId] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  const {
    sortCol,
    sortDir,
    columnFilters,
    openFilterCol,
    setOpenFilterCol,
    filterDropdownRef,
    toggleSort,
    toggleColumnFilter,
    clearColumnFilter,
    getColLabel,
    displayAccounts,
    colUniqueValues,
  } = useColumnSort(accounts, filter, ownerLabels)

  const filteredAccounts = displayAccounts

  const {
    selectedIds,
    selectedCount,
    allFilteredSelected,
    showMultiSelect,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    handleRowClick,
  } = useAccountSelection(filteredAccounts)

  const applyBulkUpdate = (updates: Partial<Account>) => {
    onBulkUpdate(selectedIds, updates)
  }

  const modalRef = useRef<HTMLDivElement>(null)
  useFocusTrap(modalRef, true)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="data-modal-backdrop" onClick={onClose}>
      <div ref={modalRef} className="data-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="data-modal-header">
          {page === 'accounts' ? (
            <>
              <h2>Accounts</h2>
              <div className="data-modal-header-actions">
                <button className="data-groups-page-btn" onClick={() => setPage('groups')}>
                  Groups{existingGroups.length > 0 ? ` (${existingGroups.length})` : ''}
                </button>
                <button className="data-modal-close" onClick={onClose} aria-label="Close">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="data-modal-header-back">
                <button className="data-back-btn" onClick={() => setPage('accounts')}>
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                    <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <h2>Groups</h2>
              </div>
              <button className="data-modal-close" onClick={onClose} aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </>
          )}
        </div>
        <div className="data-modal-body">
          {page === 'groups' ? (
            <GroupManager
              accounts={accounts}
              existingGroups={existingGroups}
              dragAccountId={dragAccountId}
              dropTarget={dropTarget}
              onSetDragAccountId={setDragAccountId}
              onSetDropTarget={setDropTarget}
              onUpdate={onUpdate}
              onRenameGroup={onRenameGroup}
            />
          ) : (
            <>
              <div className="data-toolbar">
                <div className="data-filter-group">
                  <button className={`data-filter-btn${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
                    All ({accounts.length})
                  </button>
                  <button className={`data-filter-btn${filter === 'active' ? ' active' : ''}`} onClick={() => setFilter('active')}>
                    Active ({accounts.filter(a => a.status === 'active').length})
                  </button>
                  <button className={`data-filter-btn${filter === 'inactive' ? ' active' : ''}`} onClick={() => setFilter('inactive')}>
                    Inactive ({accounts.filter(a => a.status === 'inactive').length})
                  </button>
                </div>
                <button className="data-add-btn" onClick={() => setShowAddForm(true)}>+ Add Account</button>
              </div>

              {showAddForm && (
                <AccountForm
                  profile={profile}
                  existingGroups={existingGroups}
                  allAccounts={accounts}
                  onSave={data => { onAdd(data); setShowAddForm(false) }}
                  onCancel={() => setShowAddForm(false)}
                />
              )}

              {selectedCount >= 2 && (
                <BulkActions
                  selectedCount={selectedCount}
                  ownerLabels={ownerLabels}
                  hasPartner={hasPartner}
                  existingGroups={existingGroups}
                  onBulkUpdate={applyBulkUpdate}
                  onClearSelection={clearSelection}
                />
              )}

              <AccountList
                filteredAccounts={filteredAccounts}
                accounts={accounts}
                profile={profile}
                existingGroups={existingGroups}
                ownerLabels={ownerLabels}
                editingId={editingId}
                showMultiSelect={showMultiSelect}
                allFilteredSelected={allFilteredSelected}
                selectedIds={selectedIds}
                sortCol={sortCol}
                sortDir={sortDir}
                columnFilters={columnFilters}
                openFilterCol={openFilterCol}
                filterDropdownRef={filterDropdownRef}
                onToggleSort={toggleSort}
                onToggleColumnFilter={toggleColumnFilter}
                onClearColumnFilter={clearColumnFilter}
                onSetOpenFilterCol={setOpenFilterCol}
                colUniqueValues={colUniqueValues}
                getColLabel={getColLabel}
                onToggleSelectAll={toggleSelectAll}
                onToggleSelect={toggleSelect}
                onRowClick={handleRowClick}
                onEdit={setEditingId}
                onCancelEdit={() => setEditingId(null)}
                onUpdate={onUpdate}
                onDelete={onDelete}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default AccountsModal
