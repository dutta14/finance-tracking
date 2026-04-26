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
  const { darkMode, setDarkMode, accentTheme, setAccentTheme, allowCsvImport, setAllowCsvImport } = useSettings()
  const { profile, updateProfile } = useGoals()
  const ghContext = useGitHubSyncContext()
  const { handleSyncNow, dirtyFlags } = ghContext
  const gh = useMemo(() => ghContext, [ghContext])
  const { budget: budgetDirty, taxes: taxesDirty } = dirtyFlags
  const budgetSync = useBudgetSync()
  const taxSync = useTaxSync()
  const combinedSyncNow = useCallback(
    async (data: object, message?: string, forceFull?: boolean) => {
      await Promise.allSettled([
        handleSyncNow(data, message, forceFull),
        ...(forceFull || budgetDirty ? [budgetSync.syncBudgetNow()] : []),
        ...(forceFull || taxesDirty ? [taxSync.syncTaxNow(message)] : []),
      ])
    },
    [handleSyncNow, budgetDirty, taxesDirty, budgetSync, taxSync],
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
          <button className="sidebar-search-btn" onClick={() => setSearchOpen(true)}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.8" />
              <path d="M13 13l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Search
            <kbd className="sidebar-search-kbd">{navigator.platform?.includes('Mac') ? '⌘K' : 'Ctrl+K'}</kbd>
          </button>
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
        <div className="sidebar-footer" role="group" aria-label="Utilities">
          <button
            className={`sidebar-footer-btn${currentPage === 'drive' ? ' sidebar-footer-btn--active' : ''}`}
            onClick={() => setCurrentPage('drive')}
            aria-label="Drive"
            aria-current={currentPage === 'drive' ? 'page' : undefined}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
              <path
                d="M4.5 4H8l1.5 2h6A1.5 1.5 0 0 1 17 7.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5V5.5A1.5 1.5 0 0 1 4.5 4z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="sidebar-footer-label">Drive</span>
          </button>
          <SettingsMenu
            darkMode={darkMode}
            onToggleDarkMode={() => setDarkMode(!darkMode)}
            profile={profile}
            onUpdateProfile={updateProfile}
            fiTheme={accentTheme}
            onFiThemeChange={setAccentTheme}
            gwTheme={accentTheme}
            onGwThemeChange={setAccentTheme}
            homeTheme={accentTheme}
            onHomeThemeChange={setAccentTheme}
            hasPendingChanges={gh.hasPendingChanges}
            ghConfig={gh.config}
            ghIsConfigured={gh.isConfigured}
            ghSyncStatus={gh.syncStatus}
            ghLastSyncAt={gh.lastSyncAt}
            ghLastError={gh.lastError}
            ghHistory={gh.history}
            ghHasStoredToken={gh.hasStoredToken}
            ghTokenUnlocked={gh.tokenUnlocked}
            ghUsingLegacyToken={gh.usingLegacyToken}
            onGhUpdateConfig={gh.updateConfig}
            onGhSaveEncryptedToken={gh.saveEncryptedToken}
            onGhMigrateLegacyToken={gh.migrateLegacyToken}
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
        </div>
      )}
    </nav>
  )
}

export default SidebarNavigation
