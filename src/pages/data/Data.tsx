import { FC, useState, useRef } from 'react'
import { Profile } from '../../hooks/useProfile'
import '../../styles/Data.css'

type AccountType = 'checking' | 'savings' | 'investment' | 'retirement' | 'credit' | 'other'
type AccountOwner = 'primary' | 'partner' | 'joint'
type AccountGoalType = 'fi' | 'gw' | 'none'
type AccountStatus = 'active' | 'inactive'

export interface Account {
  id: number
  name: string
  type: AccountType
  owner: AccountOwner
  status: AccountStatus
  goalType: AccountGoalType
  institution?: string
}

export interface BalanceEntry {
  id: number
  accountId: number
  month: string // YYYY-MM
  balance: number
}

interface DataProps {
  profile: Profile
  allowCsvImport?: boolean
}

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Checking',
  savings: 'Savings',
  investment: 'Investment',
  retirement: 'Retirement',
  credit: 'Credit',
  other: 'Other',
}

const OWNER_LABELS: Record<AccountOwner, string> = {
  primary: 'Primary',
  partner: 'Partner',
  joint: 'Joint',
}

const GOAL_TYPE_LABELS: Record<AccountGoalType, string> = {
  fi: 'FI',
  gw: 'GW',
  none: 'None',
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const formatMonth = (ym: string) => {
  const [y, m] = ym.split('-')
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`
}

const formatCurrency = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })

const Data: FC<DataProps> = ({ profile, allowCsvImport = false }) => {
  const [accounts, setAccounts] = useState<Account[]>(() => {
    const stored = localStorage.getItem('data-accounts')
    return stored ? JSON.parse(stored) : []
  })

  const [balances, setBalances] = useState<BalanceEntry[]>(() => {
    const stored = localStorage.getItem('data-balances')
    return stored ? JSON.parse(stored) : []
  })

  const [showAccountsModal, setShowAccountsModal] = useState(false)
  const [inlineEntry, setInlineEntry] = useState<{ month: string; values: Record<number, string> } | null>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)

  const saveAccounts = (updated: Account[]) => {
    setAccounts(updated)
    localStorage.setItem('data-accounts', JSON.stringify(updated))
  }

  const saveBalances = (updated: BalanceEntry[]) => {
    setBalances(updated)
    localStorage.setItem('data-balances', JSON.stringify(updated))
  }

  /* Account CRUD */
  const handleAddAccount = (account: Omit<Account, 'id'>) => {
    const id = accounts.length > 0 ? Math.max(...accounts.map(a => a.id)) + 1 : 1
    saveAccounts([...accounts, { ...account, id }])
  }

  const handleUpdateAccount = (id: number, updates: Partial<Account>) => {
    saveAccounts(accounts.map(a => a.id === id ? { ...a, ...updates } : a))
  }

  const handleDeleteAccount = (id: number) => {
    saveAccounts(accounts.filter(a => a.id !== id))
    saveBalances(balances.filter(b => b.accountId !== id))
  }

  const handleToggleStatus = (id: number) => {
    saveAccounts(accounts.map(a =>
      a.id === id ? { ...a, status: a.status === 'active' ? 'inactive' as const : 'active' as const } : a
    ))
  }

  /* Balance entry CRUD */
  const handleStartInlineEntry = () => {
    const now = new Date()
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const values: Record<number, string> = {}
    for (const a of activeAccounts) values[a.id] = ''
    setInlineEntry({ month: ym, values })
  }

  const handleSaveInlineEntry = () => {
    if (!inlineEntry) return
    let updated = [...balances]
    let nextId = updated.length > 0 ? Math.max(...updated.map(b => b.id)) + 1 : 1
    for (const a of activeAccounts) {
      const raw = inlineEntry.values[a.id]
      if (!raw || raw.trim() === '') continue
      const balance = parseFloat(raw.replace(/[$,]/g, ''))
      if (isNaN(balance)) continue
      const existing = updated.find(b => b.accountId === a.id && b.month === inlineEntry.month)
      if (existing) {
        updated = updated.map(b => b.id === existing.id ? { ...b, balance } : b)
      } else {
        updated.push({ id: nextId++, accountId: a.id, month: inlineEntry.month, balance })
      }
    }
    saveBalances(updated)
    setInlineEntry(null)
  }

  const handleCancelInlineEntry = () => {
    setInlineEntry(null)
  }

  /* CSV import */
  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target?.result as string
      if (!text) return
      const lines = text.split(/\r?\n/).filter(l => l.trim())
      if (lines.length < 3) return

      const parseRow = (line: string): string[] => {
        const result: string[] = []
        let current = ''
        let inQuotes = false
        for (const ch of line) {
          if (ch === '"') { inQuotes = !inQuotes }
          else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = '' }
          else { current += ch }
        }
        result.push(current.trim())
        return result
      }

      const institutionRow = parseRow(lines[0])
      const accountRow = parseRow(lines[1])

      // Build column info (skip col 0 which is the month column)
      const columns: { institution: string; accountName: string }[] = []
      for (let c = 1; c < Math.max(institutionRow.length, accountRow.length); c++) {
        const inst = institutionRow[c] || ''
        const name = accountRow[c] || ''
        if (name) columns.push({ institution: inst, accountName: name })
      }

      if (columns.length === 0) return

      // Create a new account for every CSV column (keep duplicates)
      let nextAccountId = accounts.length > 0 ? Math.max(...accounts.map(a => a.id)) + 1 : 1
      const newAccounts = [...accounts]
      const columnAccountIds: number[] = []

      for (const col of columns) {
        const newAccount: Account = {
          id: nextAccountId++,
          name: col.accountName,
          type: 'other',
          owner: 'primary',
          status: 'active',
          goalType: 'none',
          institution: col.institution || undefined,
        }
        newAccounts.push(newAccount)
        columnAccountIds.push(newAccount.id)
      }

      // Parse balance rows
      let nextBalanceId = balances.length > 0 ? Math.max(...balances.map(b => b.id)) + 1 : 1
      const newBalances = [...balances]

      for (let r = 2; r < lines.length; r++) {
        const row = parseRow(lines[r])
        const monthRaw = row[0]
        if (!monthRaw) continue

        // Try to parse month — support YYYY-MM, MM/YYYY, Mon YYYY, etc.
        let ym = ''
        const isoMatch = monthRaw.match(/^(\d{4})-(\d{1,2})/)
        if (isoMatch) {
          ym = `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}`
        } else {
          const slashMatch = monthRaw.match(/^(\d{1,2})\/(\d{4})/)
          if (slashMatch) {
            ym = `${slashMatch[2]}-${slashMatch[1].padStart(2, '0')}`
          } else {
            // Try "Mon YYYY" or "Month YYYY"
            const d = new Date(monthRaw + ' 1')
            if (!isNaN(d.getTime())) {
              ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            }
          }
        }
        if (!ym) continue

        for (let c = 0; c < columnAccountIds.length; c++) {
          const val = row[c + 1]
          if (!val || val.trim() === '') continue
          const balance = parseFloat(val.replace(/[$,]/g, ''))
          if (isNaN(balance)) continue

          const accountId = columnAccountIds[c]
          const existingEntry = newBalances.find(b => b.accountId === accountId && b.month === ym)
          if (existingEntry) {
            existingEntry.balance = balance
          } else {
            newBalances.push({ id: nextBalanceId++, accountId, month: ym, balance })
          }
        }
      }

      saveAccounts(newAccounts)
      saveBalances(newBalances)
    }
    reader.readAsText(file)
    // Reset input so re-importing the same file works
    e.target.value = ''
  }

  const hasPartner = !!profile.partner
  const hasAccounts = accounts.length > 0
  const activeAccounts = accounts.filter(a => a.status === 'active')

  // Build spreadsheet-style table data: months as rows, all active accounts as columns
  const allMonths = [...new Set(balances.map(b => b.month))].sort((a, b) => b.localeCompare(a))
  const spreadsheetAccounts = activeAccounts

  // Build a lookup map for fast access
  const balanceMap = new Map<string, number>()
  for (const b of balances) {
    balanceMap.set(`${b.accountId}:${b.month}`, b.balance)
  }

  return (
    <div className="data-page">
      <input ref={csvInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCsvImport} />

      <div className="data-header">
        <div>
          <h1>Data</h1>
          <p className="data-subtitle">Track balances across your accounts over time</p>
        </div>
        <div className="data-header-actions">
          {allowCsvImport && (
            <button className="data-import-csv-btn" onClick={() => csvInputRef.current?.click()}>
              Import from CSV
            </button>
          )}
          {allowCsvImport && (hasAccounts || balances.length > 0) && (
            <button className="data-reset-btn" onClick={() => { if (confirm('Clear all accounts and balance entries? This cannot be undone.')) { saveAccounts([]); saveBalances([]) } }}>
              Reset Data
            </button>
          )}
          {hasAccounts && (
            <button className="data-view-accounts-btn" onClick={() => setShowAccountsModal(true)}>
              View Accounts ({accounts.length})
            </button>
          )}
        </div>
      </div>

      <div className="data-content">
        {!hasAccounts ? (
          <div className="data-empty">
            <div className="data-empty-icon">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <rect x="6" y="10" width="36" height="28" rx="4" stroke="currentColor" strokeWidth="2"/>
                <path d="M6 18h36" stroke="currentColor" strokeWidth="2"/>
                <path d="M18 18v20" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <p className="data-empty-title">No accounts yet</p>
            <p className="data-empty-subtitle">Add your first account{allowCsvImport ? ' or import from a CSV' : ''} to get started</p>
            <div className="data-empty-actions">
              <button className="data-add-btn" onClick={() => setShowAccountsModal(true)}>
                + Add Account
              </button>
              {allowCsvImport && (
                <button className="data-import-csv-btn" onClick={() => csvInputRef.current?.click()}>
                  Import from CSV
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="data-toolbar">
              <span className="data-entry-count">{balances.length} balance {balances.length === 1 ? 'entry' : 'entries'}</span>
              <button className="data-add-entry-btn" onClick={handleStartInlineEntry} disabled={!!inlineEntry}>
                + Add Entry
              </button>
            </div>

            {balances.length === 0 && !inlineEntry ? (
              <div className="data-empty">
                <div className="data-empty-icon">
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    <path d="M12 36V20m8 16V16m8 20V24m8 12V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <p className="data-empty-title">No balance entries yet</p>
                <p className="data-empty-subtitle">Record your first monthly balance or import from CSV</p>
                <div className="data-empty-actions">
                  <button className="data-add-entry-btn" onClick={handleStartInlineEntry}>
                    + Add Entry
                  </button>
                </div>
              </div>
            ) : (
              /* Spreadsheet table view */
              <div className="data-spreadsheet-wrap">
                <table className="data-spreadsheet">
                  <thead>
                    <tr>
                      <th className="data-spreadsheet-corner"></th>
                      {spreadsheetAccounts.map(a => (
                        <th key={a.id} className="data-spreadsheet-col-header">
                          <span className="data-spreadsheet-account-name">{a.name}</span>
                          {a.institution && <span className="data-spreadsheet-institution">{a.institution}</span>}
                        </th>
                      ))}
                      <th className="data-spreadsheet-col-header data-spreadsheet-total-col">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Inline entry row */}
                    {inlineEntry && (
                      <tr className="data-spreadsheet-inline-row">
                        <td className="data-spreadsheet-row-header data-spreadsheet-inline-month">
                          <input
                            type="month"
                            className="data-inline-month-input"
                            value={inlineEntry.month}
                            onChange={e => setInlineEntry({ ...inlineEntry, month: e.target.value })}
                          />
                        </td>
                        {spreadsheetAccounts.map(a => (
                          <td key={a.id} className="data-spreadsheet-cell data-spreadsheet-inline-cell">
                            <input
                              type="number"
                              step="0.01"
                              className="data-inline-balance-input"
                              placeholder="—"
                              value={inlineEntry.values[a.id] || ''}
                              onChange={e => setInlineEntry({
                                ...inlineEntry,
                                values: { ...inlineEntry.values, [a.id]: e.target.value }
                              })}
                            />
                          </td>
                        ))}
                        <td className="data-spreadsheet-cell data-spreadsheet-total-cell">
                          <div className="data-inline-actions">
                            <button className="data-inline-save" onClick={handleSaveInlineEntry} title="Save">
                              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                                <path d="M4 10l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                            <button className="data-inline-cancel" onClick={handleCancelInlineEntry} title="Cancel">
                              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                                <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                    {allMonths.map(month => {
                      let rowTotal = 0
                      return (
                        <tr key={month}>
                          <td className="data-spreadsheet-row-header">{formatMonth(month)}</td>
                          {spreadsheetAccounts.map(a => {
                            const val = balanceMap.get(`${a.id}:${month}`)
                            if (val !== undefined) rowTotal += val
                            return (
                              <td key={a.id} className="data-spreadsheet-cell">
                                {val !== undefined ? formatCurrency(val) : ''}
                              </td>
                            )
                          })}
                          <td className="data-spreadsheet-cell data-spreadsheet-total-cell">{formatCurrency(rowTotal)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Accounts Modal */}
      {showAccountsModal && (
        <AccountsModal
          accounts={accounts}
          hasPartner={hasPartner}
          onAdd={handleAddAccount}
          onUpdate={handleUpdateAccount}
          onDelete={handleDeleteAccount}
          onToggleStatus={handleToggleStatus}
          onClose={() => setShowAccountsModal(false)}
        />
      )}

    </div>
  )
}

/* ═══════════════════════════════════════════
   Accounts Modal
   ═══════════════════════════════════════════ */
interface AccountsModalProps {
  accounts: Account[]
  hasPartner: boolean
  onAdd: (account: Omit<Account, 'id'>) => void
  onUpdate: (id: number, updates: Partial<Account>) => void
  onDelete: (id: number) => void
  onToggleStatus: (id: number) => void
  onClose: () => void
}

const AccountsModal: FC<AccountsModalProps> = ({ accounts, hasPartner, onAdd, onUpdate, onDelete, onToggleStatus, onClose }) => {
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const filteredAccounts = filter === 'all'
    ? accounts
    : accounts.filter(a => a.status === filter)

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
              hasPartner={hasPartner}
              onSave={(data) => { onAdd(data); setShowAddForm(false) }}
              onCancel={() => setShowAddForm(false)}
            />
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
                    <th>Account</th>
                    <th>Type</th>
                    <th>Owner</th>
                    <th>Goal</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.map(account => (
                    editingId === account.id ? (
                      <tr key={account.id} className="data-row--editing">
                        <td colSpan={6}>
                          <AccountForm
                            hasPartner={hasPartner}
                            initial={account}
                            onSave={(updates) => { onUpdate(account.id, updates); setEditingId(null) }}
                            onCancel={() => setEditingId(null)}
                          />
                        </td>
                      </tr>
                    ) : (
                      <tr key={account.id} className={account.status === 'inactive' ? 'data-row--inactive' : ''}>
                        <td>
                          <div className="data-account-name">
                            <span>{account.name}</span>
                            {account.institution && <span className="data-account-institution">{account.institution}</span>}
                          </div>
                        </td>
                        <td><span className="data-badge data-badge--type">{ACCOUNT_TYPE_LABELS[account.type]}</span></td>
                        <td><span className={`data-badge data-badge--owner-${account.owner}`}>{OWNER_LABELS[account.owner]}</span></td>
                        <td><span className={`data-badge data-badge--goal-${account.goalType}`}>{GOAL_TYPE_LABELS[account.goalType]}</span></td>
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

/* ═══════════════════════════════════════════
   Account Form (shared by modal)
   ═══════════════════════════════════════════ */
interface AccountFormProps {
  hasPartner: boolean
  initial?: Account
  onSave: (data: Omit<Account, 'id'>) => void
  onCancel: () => void
}

const AccountForm: FC<AccountFormProps> = ({ hasPartner, initial, onSave, onCancel }) => {
  const [name, setName] = useState(initial?.name || '')
  const [type, setType] = useState<AccountType>(initial?.type || 'checking')
  const [owner, setOwner] = useState<AccountOwner>(initial?.owner || 'primary')
  const [goalType, setGoalType] = useState<AccountGoalType>(initial?.goalType || 'none')
  const [status, setStatus] = useState<AccountStatus>(initial?.status || 'active')
  const [institution, setInstitution] = useState(initial?.institution || '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave({ name: name.trim(), type, owner, goalType, status, institution: institution.trim() || undefined })
  }

  return (
    <form className="data-form" onSubmit={handleSubmit}>
      <div className="data-form-row">
        <div className="data-form-field">
          <label>Account Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Chase Checking" autoFocus />
        </div>
        <div className="data-form-field">
          <label>Institution</label>
          <input type="text" value={institution} onChange={e => setInstitution(e.target.value)} placeholder="e.g. Chase" />
        </div>
      </div>
      <div className="data-form-row">
        <div className="data-form-field">
          <label>Type</label>
          <select value={type} onChange={e => setType(e.target.value as AccountType)}>
            {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="data-form-field">
          <label>Owner</label>
          <select value={owner} onChange={e => setOwner(e.target.value as AccountOwner)}>
            <option value="primary">Primary</option>
            {hasPartner && <option value="partner">Partner</option>}
            <option value="joint">Joint</option>
          </select>
        </div>
        <div className="data-form-field">
          <label>Goal Allocation</label>
          <select value={goalType} onChange={e => setGoalType(e.target.value as AccountGoalType)}>
            <option value="none">None</option>
            <option value="fi">FI</option>
            <option value="gw">GW</option>
          </select>
        </div>
        <div className="data-form-field">
          <label>Status</label>
          <select value={status} onChange={e => setStatus(e.target.value as AccountStatus)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>
      <div className="data-form-actions">
        <button type="submit" className="data-form-save">{initial ? 'Update' : 'Add Account'}</button>
        <button type="button" className="data-form-cancel" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

export default Data
