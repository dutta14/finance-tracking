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
  onRenameGroup: (oldName: string, newName: string) => void
  onClose: () => void
}

const AccountsModal: FC<AccountsModalProps> = ({ accounts, profile, onAdd, onUpdate, onBulkUpdate, onDelete, onToggleStatus, onRenameGroup, onClose }) => {
  const ownerLabels = getOwnerLabels(profile)
  const hasPartner = !!profile.partner
  const existingGroups = [...new Set(accounts.map(a => a.group).filter((g): g is string => !!g))]
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const lastSelectedRef = useRef<number | null>(null)
  const [newGroupName, setNewGroupName] = useState<string | null>(null)
  const newGroupInputRef = useRef<HTMLInputElement>(null)
  const [page, setPage] = useState<'accounts' | 'groups'>('accounts')
  const [renamingGroup, setRenamingGroup] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [newGroupInput, setNewGroupInput] = useState('')
  const [pendingGroupName, setPendingGroupName] = useState<string | null>(null)
  const newGroupRef = useRef<HTMLInputElement>(null)
  const [dragAccountId, setDragAccountId] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

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
          {page === 'accounts' ? (
            <>
              <h2>Accounts</h2>
              <div className="data-modal-header-actions">
                <button className="data-groups-page-btn" onClick={() => setPage('groups')}>
                  Groups{existingGroups.length > 0 ? ` (${existingGroups.length})` : ''}
                </button>
                <button className="data-modal-close" onClick={onClose} aria-label="Close">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="data-modal-header-back">
                <button className="data-back-btn" onClick={() => { setPage('accounts'); setRenamingGroup(null) }}>
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                    <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <h2>Groups</h2>
              </div>
              <button className="data-modal-close" onClick={onClose} aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </button>
            </>
          )}
        </div>
        <div className="data-modal-body">
          {page === 'groups' ? (
            <div className="data-groups-page">
              {existingGroups.map(g => {
                const members = accounts.filter(a => a.group === g)
                return (
                  <div
                    key={g}
                    className={`data-group-card${dropTarget === g ? ' data-group-card--drop' : ''}`}
                    onDragOver={e => { e.preventDefault(); setDropTarget(g) }}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null) }}
                    onDrop={() => { if (dragAccountId != null) { onUpdate(dragAccountId, { group: g }); setDragAccountId(null); setDropTarget(null) } }}
                  >
                    <div className="data-group-card-header">
                      {renamingGroup === g ? (
                        <input
                          ref={renameInputRef}
                          className="data-group-rename-input"
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && renameValue.trim() && renameValue.trim() !== g) {
                              onRenameGroup(g, renameValue.trim())
                              setRenamingGroup(null)
                            }
                            if (e.key === 'Escape') setRenamingGroup(null)
                          }}
                          onBlur={() => {
                            if (renameValue.trim() && renameValue.trim() !== g) onRenameGroup(g, renameValue.trim())
                            setRenamingGroup(null)
                          }}
                        />
                      ) : (
                        <>
                          <span className="data-group-card-name">{g}</span>
                          <button
                            className="data-group-rename-btn"
                            title="Rename group"
                            onClick={() => { setRenamingGroup(g); setRenameValue(g); setTimeout(() => renameInputRef.current?.select(), 0) }}
                          >
                            <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
                              <path d="M3 17h14M10 3l4 4-7 7H3v-4l7-7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                    <div className="data-group-card-members">
                      {members.map(a => (
                        <span
                          key={a.id}
                          className="data-group-member"
                          draggable
                          onDragStart={() => setDragAccountId(a.id)}
                          onDragEnd={() => { setDragAccountId(null); setDropTarget(null) }}
                        >
                          <span className={`data-group-member-dot data-group-member-dot--${a.owner}`} />
                          {a.name}
                          {a.status === 'inactive' && <span className="data-group-member-inactive">inactive</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}

              {creatingGroup ? (
                <div className="data-group-card data-group-card--new">
                  <div className="data-group-card-header">
                    <input
                      ref={newGroupRef}
                      className="data-group-rename-input"
                      value={newGroupInput}
                      onChange={e => setNewGroupInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newGroupInput.trim()) {
                          setPendingGroupName(newGroupInput.trim())
                          setCreatingGroup(false)
                          setNewGroupInput('')
                        }
                        if (e.key === 'Escape') { setCreatingGroup(false); setNewGroupInput('') }
                      }}
                      onBlur={() => {
                        if (newGroupInput.trim()) {
                          setPendingGroupName(newGroupInput.trim())
                        }
                        setCreatingGroup(false)
                        setNewGroupInput('')
                      }}
                      placeholder="Group name"
                    />
                  </div>
                  <div className="data-group-card-members data-group-card-members--empty">
                    <span className="data-group-empty-hint">Type a name then press Enter</span>
                  </div>
                </div>
              ) : pendingGroupName && !existingGroups.includes(pendingGroupName) ? (
                <div
                  className={`data-group-card data-group-card--new${dropTarget === `__pending__` ? ' data-group-card--drop' : ''}`}
                  onDragOver={e => { e.preventDefault(); setDropTarget('__pending__') }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null) }}
                  onDrop={() => {
                    if (dragAccountId != null && pendingGroupName) {
                      onUpdate(dragAccountId, { group: pendingGroupName })
                      setDragAccountId(null)
                      setDropTarget(null)
                      setPendingGroupName(null)
                    }
                  }}
                >
                  <div className="data-group-card-header">
                    <span className="data-group-card-name">{pendingGroupName}</span>
                    <button className="data-group-rename-btn" style={{ opacity: 1 }} title="Remove" onClick={() => setPendingGroupName(null)}>
                      <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
                        <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                  <div className="data-group-card-members data-group-card-members--empty">
                    <span className="data-group-empty-hint">Drag accounts here</span>
                  </div>
                </div>
              ) : (
                <button className="data-group-add-btn" onClick={() => { setCreatingGroup(true); setPendingGroupName(null); setTimeout(() => newGroupRef.current?.focus(), 0) }}>
                  + New Group
                </button>
              )}

              {(() => {
                const ungrouped = accounts.filter(a => !a.group)
                if (ungrouped.length === 0) return null
                return (
                  <div
                    className={`data-group-card data-group-card--ungrouped${dropTarget === '__ungrouped__' ? ' data-group-card--drop' : ''}`}
                    onDragOver={e => { e.preventDefault(); setDropTarget('__ungrouped__') }}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null) }}
                    onDrop={() => { if (dragAccountId != null) { onUpdate(dragAccountId, { group: undefined }); setDragAccountId(null); setDropTarget(null) } }}
                  >
                    <div className="data-group-card-header">
                      <span className="data-group-card-name data-group-card-name--muted">Ungrouped</span>
                    </div>
                    <div className="data-group-card-members">
                      {ungrouped.map(a => (
                        <span
                          key={a.id}
                          className="data-group-member"
                          draggable
                          onDragStart={() => setDragAccountId(a.id)}
                          onDragEnd={() => { setDragAccountId(null); setDropTarget(null) }}
                        >
                          <span className={`data-group-member-dot data-group-member-dot--${a.owner}`} />
                          {a.name}
                          {a.status === 'inactive' && <span className="data-group-member-inactive">inactive</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
          ) : (
          <>
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
              existingGroups={existingGroups}
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
              <select defaultValue="" onChange={e => {
                const v = e.target.value
                if (!v) return
                if (v === '__new__') {
                  setNewGroupName('')
                  setTimeout(() => newGroupInputRef.current?.focus(), 0)
                } else if (v === '__none__') {
                  applyBulkUpdate({ group: undefined })
                } else {
                  applyBulkUpdate({ group: v })
                }
                e.target.value = ''
              }}>
                <option value="" disabled>Group…</option>
                <option value="__none__">No group</option>
                {existingGroups.map(g => <option key={g} value={g}>{g}</option>)}
                <option value="__new__">New group…</option>
              </select>
              {newGroupName !== null && (
                <div className="data-bulk-new-group">
                  <input
                    ref={newGroupInputRef}
                    type="text"
                    className="data-bulk-group-input"
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newGroupName.trim()) { applyBulkUpdate({ group: newGroupName.trim() }); setNewGroupName(null) }
                      if (e.key === 'Escape') setNewGroupName(null)
                    }}
                    placeholder="Group name"
                  />
                  <button className="data-bulk-group-ok" onClick={() => { if (newGroupName.trim()) { applyBulkUpdate({ group: newGroupName.trim() }); setNewGroupName(null) } }}>
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M4 10l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  <button className="data-bulk-group-cancel" onClick={() => setNewGroupName(null)}>
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </button>
                </div>
              )}
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
                            existingGroups={existingGroups}
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
                            {account.group && <span className="data-account-parent">↳ {account.group}</span>}
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
          </>
          )}
        </div>
      </div>
    </div>
  )
}

export default AccountsModal
