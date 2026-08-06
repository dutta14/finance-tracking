import { FC, useCallback, useMemo } from 'react'
import { NavigationProps } from '../types'
import { useGoals } from '../contexts/GoalsContext'
import { useSettings } from '../contexts/SettingsContext'
import { useGitHubSyncContext } from '../contexts/GitHubSyncContext'
import { useBudgetSync } from '../contexts/BudgetSyncContext'
import { useTaxSync } from '../contexts/TaxSyncContext'
import { useImportExport } from '../contexts/ImportExportContext'
import { useLayout } from '../contexts/LayoutContext'
import SidebarToggle from './SidebarToggle'
import { SettingsMenu } from '../pages/settings'
import type { SettingsSection } from '../pages/settings/types'
import '../styles/SidebarNavigation.css'

const SidebarNavigation: FC<NavigationProps> = ({ currentPage, setCurrentPage }) => {
  const { darkMode, setDarkMode, allowCsvImport, setAllowCsvImport } = useSettings()
  const { profile, updateProfile } = useGoals()
  const ghContext = useGitHubSyncContext()
  const { handleSyncNow, dirtyFlags } = ghContext
  const gh = useMemo(() => ghContext, [ghContext])
  const { taxes: taxesDirty } = dirtyFlags
  const budgetSync = useBudgetSync()
  const taxSync = useTaxSync()
  const combinedSyncNow = useCallback(
    async (data: object, message?: string, forceFull?: boolean) => {
      await Promise.allSettled([
        handleSyncNow(data, message, forceFull),
        ...(forceFull || taxesDirty ? [taxSync.syncTaxNow(message)] : []),
      ])
    },
    [handleSyncNow, taxesDirty, taxSync],
  )
  const combinedRestore = useCallback(
    async (data: unknown) => {
      await gh.applyRestoredSnapshot(data)
      await budgetSync.restoreBudgetFromGitHub()
      await taxSync.restoreTaxFromGitHub()
      setTimeout(() => window.location.reload(), 100)
    },
    [gh, budgetSync, taxSync],
  )
  const { handleExport, handleImport, handleFactoryReset } = useImportExport()
  const { sidebarOpen, setSidebarOpen, settingsOpenSection, setSettingsOpenSection, setSearchOpen } = useLayout()

  return (
    <nav className={`sidebar${sidebarOpen ? '' : ' collapsed'}`} aria-label="Main navigation">
      <div className="sidebar-top-row">
        <SidebarToggle expanded={sidebarOpen} onToggle={() => setSidebarOpen(false)} />
        {sidebarOpen && <div className="sidebar-logo">Finance Tracker</div>}
      </div>
      {sidebarOpen && (
        <>
          <ul className="sidebar-menu">
            <li className="sidebar-item">
              <button
                className={`sidebar-link${currentPage === 'home' ? ' active' : ''}`}
                onClick={() => setCurrentPage('home')}
                aria-current={currentPage === 'home' ? 'page' : undefined}
              >
                Home
              </button>
            </li>
            <li className="sidebar-item">
              <button className="sidebar-link" onClick={() => setSearchOpen(true)}>
                Search
              </button>
            </li>
            <li className="sidebar-item">
              <button
                className={`sidebar-link${currentPage === 'goal' ? ' active' : ''}`}
                onClick={() => setCurrentPage('goal')}
                aria-current={currentPage === 'goal' ? 'page' : undefined}
              >
                Goals
              </button>
            </li>
            <li className="sidebar-item">
              <button
                className={`sidebar-link${currentPage === 'net-worth' ? ' active' : ''}`}
                onClick={() => setCurrentPage('net-worth')}
                aria-current={currentPage === 'net-worth' ? 'page' : undefined}
              >
                Net Worth
              </button>
            </li>
            <li className="sidebar-item">
              <button
                className={`sidebar-link${currentPage === 'budget' ? ' active' : ''}`}
                onClick={() => setCurrentPage('budget')}
                aria-current={currentPage === 'budget' ? 'page' : undefined}
              >
                Budget
              </button>
            </li>
            <li className="sidebar-item">
              <button
                className={`sidebar-link${currentPage === 'transactions' ? ' active' : ''}`}
                onClick={() => setCurrentPage('transactions')}
                aria-current={currentPage === 'transactions' ? 'page' : undefined}
              >
                Transactions
              </button>
            </li>
            <li className="sidebar-item">
              <button
                className={`sidebar-link${currentPage === 'taxes' ? ' active' : ''}`}
                onClick={() => setCurrentPage('taxes')}
                aria-current={currentPage === 'taxes' ? 'page' : undefined}
              >
                Taxes
              </button>
            </li>
          </ul>
        </>
      )}
      {sidebarOpen && (
        <ul className="sidebar-menu sidebar-footer-menu" role="group" aria-label="Utilities">
          <li className="sidebar-item">
            <button
              className={`sidebar-link${currentPage === 'drive' ? ' active' : ''}`}
              onClick={() => setCurrentPage('drive')}
              aria-current={currentPage === 'drive' ? 'page' : undefined}
            >
              Drive
            </button>
          </li>
          <li className="sidebar-item">
            <SettingsMenu
              darkMode={darkMode}
              onToggleDarkMode={() => setDarkMode(!darkMode)}
              profile={profile}
              onUpdateProfile={updateProfile}
              hasPendingChanges={gh.hasPendingChanges}
              ghConfig={gh.config}
              ghIsConfigured={gh.isConfigured}
              ghSyncStatus={gh.syncStatus}
              ghLastSyncAt={gh.lastSyncAt}
              ghLastError={gh.lastError}
              ghHistory={gh.history}
              ghHasStoredToken={gh.hasStoredToken}
              ghTokenUnlocked={gh.tokenUnlocked}
              onGhUpdateConfig={gh.updateConfig}
              onGhSaveEncryptedToken={gh.saveEncryptedToken}
              onGhUnlockToken={gh.unlockToken}
              onGhLockToken={gh.lockToken}
              onGhSyncNow={combinedSyncNow}
              onGhFetchHistory={gh.fetchHistory}
              onGhTestConnection={gh.testConnection}
              onGhRestoreLatest={gh.restoreLatest}
              onGhRestoreFromCommit={gh.restoreFromCommit}
              ghData={gh.ghDataToSync}
              onGhApplyRestore={combinedRestore}
              ghSyncProgress={gh.syncProgress}
              ghDirtyFlags={gh.dirtyFlags}
              onFactoryReset={handleFactoryReset}
              allowCsvImport={allowCsvImport}
              onToggleAllowCsvImport={() => setAllowCsvImport(v => !v)}
              onExport={handleExport}
              onImport={handleImport}
              externalOpen={!!settingsOpenSection}
              externalSection={settingsOpenSection as SettingsSection | undefined}
              onExternalClose={() => setSettingsOpenSection(undefined)}
            />
          </li>
          <li className="sidebar-item">
            <a
              className="sidebar-link"
              href="https://github.com/dutta14/finance-tracking#readme"
              target="_blank"
              rel="noopener noreferrer"
            >
              User Guide
            </a>
          </li>
        </ul>
      )}
    </nav>
  )
}

export default SidebarNavigation
