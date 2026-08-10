import { FC, KeyboardEvent, useState, useRef, lazy, Suspense } from 'react'
import { NavLink, useLocation, useNavigate, Routes, Route, Navigate } from 'react-router-dom'
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
import BalanceDetails from './BalanceDetails'
import '../../styles/Data.css'

const Allocation = lazy(() => import('../allocation/Allocation'))
const SavingsGrowthTracker = lazy(() => import('../tools/components/SavingsGrowthTracker'))

const DATA_VIEW_TABS = [
  { id: 'charts', label: 'Charts', path: '/net-worth/dashboard' },
  { id: 'details', label: 'Details', path: '/net-worth/dashboard/details' },
  { id: 'spreadsheet', label: 'Spreadsheet', path: '/net-worth/dashboard/spreadsheet' },
  { id: 'manage', label: 'Accounts', path: '/net-worth/dashboard/manage' },
] as const

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

  const accountsRef = useRef(accounts)
  accountsRef.current = accounts
  const balancesRef = useRef(balances)
  balancesRef.current = balances

  const saveAccounts = (updated: Account[]) => {
    ctxSetAccounts(updated)
    accountsRef.current = updated
    onDataChange?.(updated, balancesRef.current)
  }

  const saveBalances = (updated: BalanceEntry[]) => {
    ctxSetBalances(updated)
    balancesRef.current = updated
    onDataChange?.(accountsRef.current, updated)
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

  const handleSaveMonth = (month: string, values: Record<string, number>) => {
    let updated = [...balances]
    let nextId = updated.length > 0 ? Math.max(...updated.map(b => b.id)) + 1 : 1
    const activeAccountIds = new Set(activeAccounts.map(account => account.id))

    Object.entries(values).forEach(([accountId, balance]) => {
      const parsedAccountId = Number(accountId)

      if (!Number.isInteger(parsedAccountId) || !activeAccountIds.has(parsedAccountId)) return

      const existing = updated.find(entry => entry.accountId === parsedAccountId && entry.month === month)

      if (existing) {
        updated = updated.map(entry => (entry.id === existing.id ? { ...entry, balance } : entry))
        return
      }

      updated.push({ id: nextId++, accountId: parsedAccountId, month, balance })
    })

    saveBalances(updated)
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
  const spreadsheetAccounts = accounts
  const allMonths = [...new Set(balances.map(b => b.month))].sort((a, b) => b.localeCompare(a))
  const balanceMap = new Map<string, number>()
  for (const b of balances) balanceMap.set(`${b.accountId}:${b.month}`, b.balance)

  const location = useLocation()
  const navigate = useNavigate()
  const activeTab = location.pathname.startsWith('/net-worth/allocation')
    ? 'allocation'
    : location.pathname.startsWith('/net-worth/growth')
      ? 'growth'
      : 'accounts'
  const accountsPath = location.pathname
    .replace('/net-worth/dashboard', '')
    .replace('/net-worth', '')
    .replace(/^\//, '')
  const dataView =
    accountsPath === 'details'
      ? 'details'
      : accountsPath === 'spreadsheet'
        ? 'spreadsheet'
        : accountsPath === 'manage'
          ? 'manage'
          : 'charts'
  const growthTab = location.pathname.endsWith('/income') ? 'income' : 'savings'
  const allocTab = location.pathname.endsWith('/ratios') ? 'ratios' : 'breakdown'
  const handleDataViewTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = DATA_VIEW_TABS.findIndex(tabDef => tabDef.id === dataView)
    if (currentIndex === -1) return

    let nextIndex: number
    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % DATA_VIEW_TABS.length
        break
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + DATA_VIEW_TABS.length) % DATA_VIEW_TABS.length
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = DATA_VIEW_TABS.length - 1
        break
      default:
        return
    }

    event.preventDefault()
    navigate(DATA_VIEW_TABS[nextIndex].path)
  }
  const accountsContent = (
    <>
      {allowCsvImport && (
        <div className="data-header-actions">
          <button className="data-import-csv-btn" onClick={() => csvInputRef.current?.click()}>
            Import from CSV
          </button>
          {hasAccounts && balances.length > 0 && (
            <button className="data-export-csv-btn" onClick={() => exportCsv(accounts, balances)}>
              Export CSV
            </button>
          )}
          {(hasAccounts || balances.length > 0) && (
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
        </div>
      )}

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
            {balances.length === 0 && !inlineEntry && dataView !== 'details' && dataView !== 'manage' ? (
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
              <BalanceCharts accounts={accounts} balances={balances} allMonths={allMonths} balanceMap={balanceMap} />
            ) : dataView === 'details' ? (
              <BalanceDetails
                accounts={accounts}
                balances={balances}
                allMonths={allMonths}
                balanceMap={balanceMap}
                profile={profile}
                showInactive={showInactive}
                onToggleShowInactive={() => setShowInactive(v => !v)}
                onSaveMonth={handleSaveMonth}
              />
            ) : dataView === 'manage' ? (
              <AccountsModal
                accounts={accounts}
                profile={profile}
                onAdd={handleAddAccount}
                onUpdate={handleUpdateAccount}
                onBulkUpdate={handleBulkUpdateAccounts}
                onDelete={handleDeleteAccount}
                onToggleStatus={handleToggleStatus}
                onRenameGroup={handleRenameGroup}
                onClose={() => navigate('/net-worth/dashboard')}
                inline
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
                toolbarActions={
                  <>
                    <button className="data-add-entry-btn" onClick={handleStartInlineEntry} disabled={!!inlineEntry}>
                      + Add Entry
                    </button>
                    {allMonths.length > 0 && (
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
                  </>
                }
                onInlineEntryChange={setInlineEntry}
                onSaveInlineEntry={handleSaveInlineEntry}
                onCancelInlineEntry={() => setInlineEntry(null)}
                onDeleteMonth={handleDeleteMonth}
              />
            )}
          </>
        )}
      </div>

      {showAccountsModal && dataView !== 'manage' && (
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
  )

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
        <div className="data-header-left">
          <h1>Net Worth</h1>
        </div>
        <nav className="nw-tab-bar" aria-label="Net Worth sections">
          <NavLink to="/net-worth/dashboard" className={() => `nw-tab${activeTab === 'accounts' ? ' active' : ''}`}>
            Dashboard
          </NavLink>
          <NavLink to="/net-worth/allocation" className={({ isActive }) => `nw-tab${isActive ? ' active' : ''}`}>
            Allocation
          </NavLink>
          <NavLink to="/net-worth/growth" className={({ isActive }) => `nw-tab${isActive ? ' active' : ''}`}>
            Growth
          </NavLink>
        </nav>
        <div className="data-header-right">
          {activeTab === 'accounts' && hasAccounts && (
            <div className="data-view-tabs" role="tablist" aria-label="Data view" onKeyDown={handleDataViewTabKeyDown}>
              {DATA_VIEW_TABS.map(tabDef => (
                <button
                  key={tabDef.id}
                  className={`data-view-tab${dataView === tabDef.id ? ' active' : ''}`}
                  role="tab"
                  aria-selected={dataView === tabDef.id}
                  tabIndex={dataView === tabDef.id ? 0 : -1}
                  onClick={() => navigate(tabDef.path)}
                >
                  {tabDef.label}
                </button>
              ))}
            </div>
          )}
          {activeTab === 'allocation' && (
            <div className="data-view-tabs" role="group" aria-label="Allocation view mode">
              <button
                className={`data-view-tab${allocTab === 'breakdown' ? ' active' : ''}`}
                aria-pressed={allocTab === 'breakdown'}
                onClick={() => navigate('/net-worth/allocation')}
              >
                Breakdown
              </button>
              <button
                className={`data-view-tab${allocTab === 'ratios' ? ' active' : ''}`}
                aria-pressed={allocTab === 'ratios'}
                onClick={() => navigate('/net-worth/allocation/ratios')}
              >
                My Allocation
              </button>
            </div>
          )}
          {activeTab === 'growth' && (
            <div className="data-view-tabs" role="group" aria-label="Growth view mode">
              <button
                className={`data-view-tab${growthTab === 'savings' ? ' active' : ''}`}
                aria-pressed={growthTab === 'savings'}
                onClick={() => navigate('/net-worth/growth/savings')}
              >
                Savings
              </button>
              <button
                className={`data-view-tab${growthTab === 'income' ? ' active' : ''}`}
                aria-pressed={growthTab === 'income'}
                onClick={() => navigate('/net-worth/growth/income')}
              >
                Income
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="data-scroll-area">
        <Routes>
          <Route index element={<Navigate to="/net-worth/dashboard" replace />} />
          <Route path="dashboard/*" element={accountsContent} />
          <Route
            path="allocation/*"
            element={
              <Suspense
                fallback={
                  <div className="nw-tab-loading" role="status">
                    Loading…
                  </div>
                }
              >
                <Allocation tab={allocTab} />
              </Suspense>
            }
          />
          <Route
            path="growth/*"
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
    </div>
  )
}

export default Data
