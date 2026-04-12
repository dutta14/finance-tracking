import { FC, useState, useRef } from 'react'
import { Profile } from '../../hooks/useProfile'
import {
  Account, AccountType, AccountOwner, AccountGoalType, AccountStatus, AccountNature, AssetAllocation,
  ACCOUNT_TYPE_LABELS, GOAL_TYPE_LABELS, NATURE_LABELS, ALLOCATION_LABELS, getDefaultType, getDefaultAllocation, getOwnerLabels,
} from './types'
import AccountForm from './AccountForm'

interface AccountsModalProps {
  accounts: Account[]
  profile: Profile
  onAdd: (account: Omit<Account, 'id'>) => void
  onUpdate: (id: number, updates: Partial<Account>) => void
  onBulkUpdate: (ids: Set<number>, updates: Partial<Account>) => void
  onDelete: (id: number) => void
  onToggleStatus: (id: number) => void
  onClose: () => void
}

const AccountsModal: FC<AccountsModalProps> = ({ accounts, profile, onAdd, onUpdate, onBulkUpdate, onDelete, onToggleStatus, onClose }) => {
  const ownerLabels = getOwnerLabels(profile)
  const hasPartner = !!profile.partner
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const lastSelectedRef = useRef<number | null>(null)

  const filteredAccounts = filter === 'all'
    ? accounts
    : accounts.filter(a => a.status === filter)

  const allFilteredSelected = filteredAccounts.length > 0 && filteredAccounts.every(a => selectedIds.has(a.id))

  const toggleSelect = (id: number) => {
    lastSelectedRef.current = id
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const rangeSelect = (id: number) => {
    const lastId = lastSelectedRef.current
    if (lastId == null) { toggleSelect(id); return }
    const ids = filteredAccounts.map(a => a.id)
    const from = ids.indexOf(lastId)
    const to = ids.indexOf(id)
    if (from === -1 || to === -1) { toggleSelect(id); return }
    const start = Math.min(from, to)
    const end = Math.max(from, to)
    setSelectedIds(prev => {
      const next = new Set(prev)
      for (let i = start; i <= end; i++) next.add(ids[i])
      return next
    })
    lastSelectedRef.current = id
  }

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        for (const a of filteredAccounts) next.delete(a.id)
        return next
      })
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        for (const a of filteredAccounts) next.add(a.id)
        return next
      })
    }
  }

  const applyBulkUpdate = (updates: Partial<Account>) => {
    onBulkUpdate(selectedIds, updates)
  }

  const selectedCount = filteredAccounts.filter(a => selectedIds.has(a.id)).length

  const handleRowClick = (id: number, e: React.MouseEvent) => {
    if (e.shiftKey && selectedIds.size > 0) {
      e.preventDefault()
      rangeSelect(id)
    } else if (e.metaKey || e.ctrlKey) {
      e.preventDefault()
      toggleSelect(id)
    }
  }

  const showMultiSelect = selectedCount >= 2

  return (
    <div className="data-modal-backdrop" onClick={onClose}>
      <div className="data-modal" onClick={e => e.stopPropagation()}>
        <div className="data-modal-header">
          <h2>Accounts</h2>
          <button className="data-modal-close" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div className="data-modal-body">
          <div className="data-toolbar">
            <div className="data-filter-group">
              <button className={`data-filter-btn${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>All ({accounts.length})</button>
              <button className={`data-filter-btn${filter === 'active' ? ' active' : ''}`} onClick={() => setFilter('active')}>Active ({accounts.filter(a => a.status === 'active').length})</button>
              <button className={`data-filter-btn${filter === 'inactive' ? ' active' : ''}`} onClick={() => setFilter('inactive')}>Inactive ({accounts.filter(a => a.status === 'inactive').length})</button>
            </div>
            <button className="data-add-btn" onClick={() => setShowAddForm(true)}>+ Add Account</button>
          </div>

          {showAddForm && (
            <AccountForm
              profile={profile}
              onSave={(data) => { onAdd(data); setShowAddForm(false) }}
              onCancel={() => setShowAddForm(false)}
            />
          )}

          {selectedCount >= 2 && (
            <div className="data-bulk-bar">
              <span className="data-bulk-count">{selectedCount} selected</span>
              <select defaultValue="" onChange={e => { if (e.target.value) { const g = e.target.value as AccountGoalType; applyBulkUpdate({ goalType: g, type: getDefaultType(g) }); e.target.value = '' } }}>
                <option value="" disabled>Goal…</option>
                {Object.entries(GOAL_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select defaultValue="" onChange={e => { if (e.target.value) { applyBulkUpdate({ type: e.target.value as AccountType }); e.target.value = '' } }}>
                <option value="" disabled>Type…</option>
                {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select defaultValue="" onChange={e => { if (e.target.value) { applyBulkUpdate({ owner: e.target.value as AccountOwner }); e.target.value = '' } }}>
                <option value="" disabled>Owner…</option>
                <option value="primary">{ownerLabels.primary}</option>
                {hasPartner && <option value="partner">{ownerLabels.partner}</option>}
                <option value="joint">{ownerLabels.joint}</option>
              </select>
              <select defaultValue="" onChange={e => { if (e.target.value) { applyBulkUpdate({ status: e.target.value as AccountStatus }); e.target.value = '' } }}>
                <option value="" disabled>Status…</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <select defaultValue="" onChange={e => { if (e.target.value) { applyBulkUpdate({ nature: e.target.value as AccountNature }); e.target.value = '' } }}>
                <option value="" disabled>A/L…</option>
                {Object.entries(NATURE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select defaultValue="" onChange={e => { if (e.target.value) { applyBulkUpdate({ allocation: e.target.value as AssetAllocation }); e.target.value = '' } }}>
                <option value="" disabled>Allocation…</option>
                {Object.entries(ALLOCATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button className="data-bulk-clear" onClick={() => setSelectedIds(new Set())}>Clear</button>
            </div>
          )}

          {filteredAccounts.length === 0 ? (
            <div className="data-empty" style={{ padding: '2rem 1rem' }}>
              <p className="data-empty-title">No accounts</p>
              <p className="data-empty-subtitle">Click "+ Add Account" to create one</p>
            </div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    {showMultiSelect && <th className="data-th-checkbox"><input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} /></th>}
                    <th>Account</th>
                    <th>Goal</th>
                    <th>Type</th>
                    <th>A/L</th>
                    <th>Allocation</th>
                    <th>Owner</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.map(account => (
                    editingId === account.id ? (
                      <tr key={account.id} className="data-row--editing">
                        <td colSpan={showMultiSelect ? 10 : 9}>
                          <AccountForm
                              profile={profile}
                            initial={account}
                            onSave={(updates) => { onUpdate(account.id, updates); setEditingId(null) }}
                            onCancel={() => setEditingId(null)}
                          />
                        </td>
                      </tr>
                    ) : (
                      <tr key={account.id} className={`${account.status === 'inactive' ? 'data-row--inactive' : ''}${selectedIds.has(account.id) ? ' data-row--selected' : ''}`} onClick={e => handleRowClick(account.id, e)}>
                        {showMultiSelect && <td className="data-td-checkbox"><input type="checkbox" checked={selectedIds.has(account.id)} onChange={() => toggleSelect(account.id)} /></td>}
                        <td>
                          <div className="data-account-name">
                            <span>{account.name}</span>
                            {account.institution && <span className="data-account-institution">{account.institution}</span>}
                          </div>
                        </td>
                        <td><span className={`data-badge data-badge--goal-${account.goalType}`}>{GOAL_TYPE_LABELS[account.goalType]}</span></td>
                        <td><span className="data-badge data-badge--type">{ACCOUNT_TYPE_LABELS[account.type]}</span></td>
                        <td><span className={`data-badge data-badge--nature-${account.nature || 'asset'}`}>{NATURE_LABELS[account.nature || 'asset']}</span></td>
                        <td><span className="data-badge data-badge--allocation">{ALLOCATION_LABELS[account.allocation || getDefaultAllocation(account.nature || 'asset')]}</span></td>
                        <td><span className={`data-badge data-badge--owner-${account.owner}`}>{ownerLabels[account.owner]}</span></td>
                        <td>
                          <button className={`data-status-toggle ${account.status}`} onClick={() => onToggleStatus(account.id)} title={`Mark as ${account.status === 'active' ? 'inactive' : 'active'}`}>
                            {account.status === 'active' ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td>
                          <div className="data-row-actions">
                            <button className="data-action-btn" onClick={() => setEditingId(account.id)} title="Edit">
                              <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                                <path d="M3 17h14M10 3l4 4-7 7H3v-4l7-7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                            <button className="data-action-btn data-action-btn--delete" onClick={() => onDelete(account.id)} title="Delete">
                              <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                                <path d="M4 6h12M8 6V4h4v2m-6 0v10h8V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AccountsModal
