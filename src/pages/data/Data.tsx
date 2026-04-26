import { FC, useState, useRef, lazy, Suspense } from 'react'
import { NavLink, useLocation, Routes, Route } from 'react-router-dom'
import { useGoals } from '../../contexts/GoalsContext'
import { useSettings } from '../../contexts/SettingsContext'
import { useGitHubSyncContext } from '../../contexts/GitHubSyncContext'
import { useData } from '../../contexts/DataContext'
import { Account, BalanceEntry } from './types'
import { parseCsvImport } from './csvImport'
import { exportCsv } from './csvExport'
import AccountsModal from './AccountsModal'
import BalanceSpreadsheet from './BalanceSpreadsheet'
import BalanceCharts from './BalanceCharts'
import '../../styles/Data.css'

const Allocation = lazy(() => import('../allocation/Allocation'))
const SavingsGrowthTracker = lazy(() => import('../tools/components/SavingsGrowthTracker'))

const Data: FC = () => {
  const { profile } = useGoals()
  const { allowCsvImport } = useSettings()
  const { handleDataChange: onDataChange } = useGitHubSyncContext()
  const { accounts, balances, setAccounts: ctxSetAccounts, setBalances: ctxSetBalances } = useData()

  const [showAccountsModal, setShowAccountsModal] = useState(false)
  const [inlineEntry, setInlineEntry] = useState<{
    month: string
    values: Record<number, string>
    _focused?: number
  } | null>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [dataView, setDataView] = useState<'charts' | 'spreadsheet'>('charts')

  const saveAccounts = (updated: Account[]) => {
    ctxSetAccounts(updated)
    onDataChange?.(updated, balances)
  }

  const saveBalances = (updated: BalanceEntry[]) => {
    ctxSetBalances(updated)
    onDataChange?.(accounts, updated)
  }

  // Use when updating both in the same handler to avoid stale closure
  const saveBoth = (newAccounts: Account[], newBalances: BalanceEntry[]) => {
    ctxSetAccounts(newAccounts)
    ctxSetBalances(newBalances)
    onDataChange?.(newAccounts, newBalances)
  }

  /* Account CRUD */
  const handleAddAccount = (account: Omit<Account, 'id'>) => {
    const id = accounts.length > 0 ? Math.max(...accounts.map(a => a.id)) + 1 : 1
    saveAccounts([...accounts, { ...account, id }])
  }

  const handleUpdateAccount = (id: number, updates: Partial<Account>) => {
    saveAccounts(accounts.map(a => (a.id === id ? { ...a, ...updates } : a)))
  }

  const handleBulkUpdateAccounts = (ids: Set<number>, updates: Partial<Account>) => {
    saveAccounts(accounts.map(a => (ids.has(a.id) ? { ...a, ...updates } : a)))
  }

  const handleDeleteAccount = (id: number) => {
    saveBoth(
      accounts.filter(a => a.id !== id),
      balances.filter(b => b.accountId !== id),
    )
  }

  const handleToggleStatus = (id: number) => {
    saveAccounts(
      accounts.map(a =>
        a.id === id ? { ...a, status: a.status === 'active' ? ('inactive' as const) : ('active' as const) } : a,
      ),
    )
  }

  const handleRenameGroup = (oldName: string, newName: string) => {
    saveAccounts(accounts.map(a => (a.group === oldName ? { ...a, group: newName } : a)))
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

  const handleCopyForwardEntry = () => {
    const now = new Date()
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const lastMonth = allMonths[0]
    if (!lastMonth) return
    const values: Record<number, string> = {}
    for (const a of activeAccounts) {
      const prev = balanceMap.get(`${a.id}:${lastMonth}`)
      values[a.id] = prev !== undefined ? String(prev) : ''
    }
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
        updated = updated.map(b => (b.id === existing.id ? { ...b, balance } : b))
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
    reader.onload = evt => {
      const text = evt.target?.result as string
      if (!text) return
      const result = parseCsvImport(text, accounts, balances)
      saveBoth(result.accounts, result.balances)
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

  const location = useLocation()
  const activeTab = location.pathname.replace('/net-worth', '').replace(/^\//, '') || 'accounts'

  return (
    <div className="data-page">
      <input
        ref={csvInputRef}
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        onChange={handleCsvImport}
        aria-label="Import CSV file"
      />

      <div className="data-header">
        <div>
          <h1>Net Worth</h1>
          <p className="data-subtitle">Track balances across your accounts over time</p>
        </div>
      </div>

      <nav className="nw-tab-bar" aria-label="Net Worth sections">
        <NavLink
          to="/net-worth"
          end
          className={({ isActive }) => `nw-tab${isActive || activeTab === 'accounts' ? ' active' : ''}`}
        >
          Accounts
        </NavLink>
        <NavLink to="/net-worth/allocation" className={({ isActive }) => `nw-tab${isActive ? ' active' : ''}`}>
          Allocation
        </NavLink>
        <NavLink to="/net-worth/growth" className={({ isActive }) => `nw-tab${isActive ? ' active' : ''}`}>
          Growth
        </NavLink>
      </nav>

      <Routes>
        <Route
          index
          element={
            <>
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
                  <button
                    className="data-reset-btn"
                    onClick={() => {
                      if (confirm('Clear all accounts and balance entries? This cannot be undone.')) {
                        saveBoth([], [])
                      }
                    }}
                  >
                    Reset Data
                  </button>
                )}
                {hasAccounts && (
                  <button className="data-view-accounts-btn" onClick={() => setShowAccountsModal(true)}>
                    View Accounts ({accounts.length})
                  </button>
                )}
              </div>

              <div className="data-content">
                {!hasAccounts ? (
                  <div className="data-empty">
                    <div className="data-empty-icon">
                      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                        <rect x="6" y="10" width="36" height="28" rx="4" stroke="currentColor" strokeWidth="2" />
                        <path d="M6 18h36" stroke="currentColor" strokeWidth="2" />
                        <path d="M18 18v20" stroke="currentColor" strokeWidth="2" />
                      </svg>
                    </div>
                    <p className="data-empty-title">No accounts yet</p>
                    <p className="data-empty-subtitle">
                      Add your first account{allowCsvImport ? ' or import from a CSV' : ''} to get started
                    </p>
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
                      <div className="data-view-tabs" role="tablist" aria-label="Data view">
                        <button
                          className={`data-view-tab${dataView === 'charts' ? ' active' : ''}`}
                          role="tab"
                          aria-selected={dataView === 'charts'}
                          onClick={() => setDataView('charts')}
                        >
                          Charts
                        </button>
                        <button
                          className={`data-view-tab${dataView === 'spreadsheet' ? ' active' : ''}`}
                          role="tab"
                          aria-selected={dataView === 'spreadsheet'}
                          onClick={() => setDataView('spreadsheet')}
                        >
                          Spreadsheet
                        </button>
                      </div>
                      <div className="data-toolbar-actions">
                        {dataView === 'spreadsheet' && (
                          <label className="data-filter-toggle">
                            <input type="checkbox" checked={showInactive} onChange={() => setShowInactive(v => !v)} />
                            Show inactive
                          </label>
                        )}
                        {dataView === 'spreadsheet' && (
                          <button
                            className="data-add-entry-btn"
                            onClick={handleStartInlineEntry}
                            disabled={!!inlineEntry}
                          >
                            + Add Entry
                          </button>
                        )}
                        {dataView === 'spreadsheet' && allMonths.length > 0 && (
                          <button
                            className="data-copy-forward-btn"
                            onClick={handleCopyForwardEntry}
                            disabled={!!inlineEntry}
                            title={`Pre-fill with balances from ${allMonths[0]}`}
                            aria-label="Copy balances from last month"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <rect x="9" y="9" width="13" height="13" rx="2" />
                              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                            </svg>
                            <span className="data-copy-forward-label">Copy Last Month</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {balances.length === 0 && !inlineEntry ? (
                      <div className="data-empty">
                        <div className="data-empty-icon">
                          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                            <path
                              d="M12 36V20m8 16V16m8 20V24m8 12V12"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
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
                    ) : dataView === 'charts' ? (
                      <BalanceCharts
                        accounts={accounts}
                        balances={balances}
                        allMonths={allMonths}
                        balanceMap={balanceMap}
                      />
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
            </>
          }
        />
        <Route
          path="allocation"
          element={
            <Suspense
              fallback={
                <div className="nw-tab-loading" role="status">
                  Loading…
                </div>
              }
            >
              <Allocation />
            </Suspense>
          }
        />
        <Route
          path="growth"
          element={
            <Suspense
              fallback={
                <div className="nw-tab-loading" role="status">
                  Loading…
                </div>
              }
            >
              <SavingsGrowthTracker />
            </Suspense>
          }
        />
      </Routes>
    </div>
  )
}

export default Data
