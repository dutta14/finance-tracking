import { FC, useState, useRef } from 'react'
import { Profile } from '../../hooks/useProfile'
import { Account, BalanceEntry } from './types'
import { parseCsvImport } from './csvImport'
import { exportCsv } from './csvExport'
import AccountsModal from './AccountsModal'
import BalanceSpreadsheet from './BalanceSpreadsheet'
import '../../styles/Data.css'

interface DataProps {
  profile: Profile
  allowCsvImport?: boolean
  onDataChange?: (accounts: Account[], balances: BalanceEntry[]) => void
}

const Data: FC<DataProps> = ({ profile, allowCsvImport = false, onDataChange }) => {
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
  const [showInactive, setShowInactive] = useState(false)

  const saveAccounts = (updated: Account[]) => {
    setAccounts(updated)
    localStorage.setItem('data-accounts', JSON.stringify(updated))
    onDataChange?.(updated, balances)
  }

  const saveBalances = (updated: BalanceEntry[]) => {
    setBalances(updated)
    localStorage.setItem('data-balances', JSON.stringify(updated))
    onDataChange?.(accounts, updated)
  }

  /* Account CRUD */
  const handleAddAccount = (account: Omit<Account, 'id'>) => {
    const id = accounts.length > 0 ? Math.max(...accounts.map(a => a.id)) + 1 : 1
    saveAccounts([...accounts, { ...account, id }])
  }

  const handleUpdateAccount = (id: number, updates: Partial<Account>) => {
    saveAccounts(accounts.map(a => a.id === id ? { ...a, ...updates } : a))
  }

  const handleBulkUpdateAccounts = (ids: Set<number>, updates: Partial<Account>) => {
    saveAccounts(accounts.map(a => ids.has(a.id) ? { ...a, ...updates } : a))
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

  const handleRenameGroup = (oldName: string, newName: string) => {
    saveAccounts(accounts.map(a => a.group === oldName ? { ...a, group: newName } : a))
  }

  /* Balance entry inline editing */
  const activeAccounts = accounts.filter(a => a.status === 'active')

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

  const handleDeleteMonth = (month: string) => {
    saveBalances(balances.filter(b => b.month !== month))
  }

  /* CSV import */
  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target?.result as string
      if (!text) return
      const result = parseCsvImport(text, accounts, balances)
      saveAccounts(result.accounts)
      saveBalances(result.balances)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  /* Derived data */
  const hasAccounts = accounts.length > 0
  const spreadsheetAccounts = showInactive ? accounts : activeAccounts
  const allMonths = [...new Set(balances.map(b => b.month))].sort((a, b) => b.localeCompare(a))
  const balanceMap = new Map<string, number>()
  for (const b of balances) balanceMap.set(`${b.accountId}:${b.month}`, b.balance)

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
          {allowCsvImport && hasAccounts && balances.length > 0 && (
            <button className="data-export-csv-btn" onClick={() => exportCsv(accounts, balances)}>
              Export CSV
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
              <div className="data-toolbar-actions">
                <label className="data-filter-toggle">
                  <input type="checkbox" checked={showInactive} onChange={() => setShowInactive(v => !v)} />
                  Show inactive
                </label>
                <button className="data-add-entry-btn" onClick={handleStartInlineEntry} disabled={!!inlineEntry}>
                  + Add Entry
                </button>
              </div>
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
              <BalanceSpreadsheet
                spreadsheetAccounts={spreadsheetAccounts}
                allAccounts={accounts}
                balances={balances}
                allMonths={allMonths}
                balanceMap={balanceMap}
                profile={profile}
                inlineEntry={inlineEntry}
                onInlineEntryChange={setInlineEntry}
                onSaveInlineEntry={handleSaveInlineEntry}
                onCancelInlineEntry={() => setInlineEntry(null)}
                onDeleteMonth={handleDeleteMonth}
              />
            )}
          </>
        )}
      </div>

      {showAccountsModal && (
        <AccountsModal
          accounts={accounts}
          profile={profile}
          onAdd={handleAddAccount}
          onUpdate={handleUpdateAccount}
          onBulkUpdate={handleBulkUpdateAccounts}
          onDelete={handleDeleteAccount}
          onToggleStatus={handleToggleStatus}
          onRenameGroup={handleRenameGroup}
          onClose={() => setShowAccountsModal(false)}
        />
      )}
    </div>
  )
}

export default Data
