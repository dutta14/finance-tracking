import { FC } from 'react';
import { NavigationProps } from '../types';
import { Profile } from '../hooks/useProfile';
import { GitHubSyncConfig, SyncStatus, SyncDomain, SyncProgress, CommitEntry, ConnectionTestResult, RestoreResult } from '../hooks/useGitHubSync';
import SidebarToggle from './SidebarToggle';
import { SettingsMenu } from '../pages/settings';
import '../styles/SidebarNavigation.css';

interface SidebarNavigationProps extends NavigationProps {
  expanded: boolean;
  setExpanded: (open: boolean) => void;
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  fiTheme?: string;
  onFiThemeChange?: (theme: string) => void;
  gwTheme?: string;
  onGwThemeChange?: (theme: string) => void;
  homeTheme?: string;
  onHomeThemeChange?: (theme: string) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  profile: Profile;
  onUpdateProfile: (updates: Partial<Profile>) => void;
  hasPendingGitHubChanges?: boolean;
  ghConfig?: GitHubSyncConfig;
  ghIsConfigured?: boolean;
  ghSyncStatus?: SyncStatus;
  ghLastSyncAt?: string | null;
  ghLastError?: string | null;
  ghHistory?: CommitEntry[];
  ghHasStoredToken?: boolean;
  ghTokenUnlocked?: boolean;
  ghUsingLegacyToken?: boolean;
  onGhUpdateConfig?: (updates: Partial<GitHubSyncConfig>) => void;
  onGhSaveEncryptedToken?: (token: string, passphrase: string) => Promise<{ ok: boolean; message: string }>;
  onGhMigrateLegacyToken?: (passphrase: string) => Promise<{ ok: boolean; message: string }>;
  onGhUnlockToken?: (passphrase: string) => Promise<{ ok: boolean; message: string }>;
  onGhLockToken?: () => void;
  onGhSyncNow?: (data: object, message?: string) => Promise<void>;
  onGhFetchHistory?: () => Promise<void>;
  onGhTestConnection?: () => Promise<ConnectionTestResult>;
  onGhRestoreLatest?: () => Promise<RestoreResult>;
  onGhRestoreFromCommit?: (commitSha: string) => Promise<RestoreResult>;
  ghDataToSync?: object;
  onGhApplyRestore?: (data: unknown) => Promise<void>;
  ghSyncProgress?: SyncProgress | null;
  ghDirtyFlags?: Record<SyncDomain, boolean>;
  onFactoryReset?: () => void;
  allowCsvImport?: boolean;
  onToggleAllowCsvImport?: () => void;
  settingsOpenToSection?: string;
  onSettingsExternalClose?: () => void;
  onSearchOpen?: () => void;
}

const SidebarNavigation: FC<SidebarNavigationProps> = ({
  currentPage, setCurrentPage, expanded, setExpanded,
  darkMode, setDarkMode, fiTheme, onFiThemeChange, gwTheme, onGwThemeChange, homeTheme, onHomeThemeChange,
  onExport, onImport,
  profile, onUpdateProfile, hasPendingGitHubChanges = false,
  ghConfig, ghIsConfigured = false, ghSyncStatus, ghLastSyncAt, ghLastError, ghHistory = [],
  ghHasStoredToken, ghTokenUnlocked, ghUsingLegacyToken,
  onGhUpdateConfig, onGhSaveEncryptedToken, onGhMigrateLegacyToken, onGhUnlockToken, onGhLockToken,
  onGhSyncNow, onGhFetchHistory, onGhTestConnection, onGhRestoreLatest, onGhRestoreFromCommit,
  ghDataToSync, onGhApplyRestore,
  ghSyncProgress, ghDirtyFlags,
  onFactoryReset = () => {},
  allowCsvImport = false,
  onToggleAllowCsvImport = () => {},
  settingsOpenToSection,
  onSettingsExternalClose,
  onSearchOpen,
}) => {
  return (
    <nav className={`sidebar${expanded ? '' : ' collapsed'}`} aria-label="Main navigation">
      <div className="sidebar-top-row">
        <SidebarToggle expanded={expanded} onToggle={() => setExpanded(false)} />
        {expanded && <div className="sidebar-logo">Finance Tracker</div>}
      </div>
      {expanded && (
        <>
        <button className="sidebar-search-btn" onClick={onSearchOpen}>
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
      {expanded && (
        <div className="sidebar-footer" role="group" aria-label="Utilities">
          <button
            className={`sidebar-footer-btn${currentPage === 'drive' ? ' sidebar-footer-btn--active' : ''}`}
            onClick={() => setCurrentPage('drive')}
            aria-label="Drive"
            aria-current={currentPage === 'drive' ? 'page' : undefined}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
              <path d="M4.5 4H8l1.5 2h6A1.5 1.5 0 0 1 17 7.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5V5.5A1.5 1.5 0 0 1 4.5 4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="sidebar-footer-label">Drive</span>
          </button>
          <SettingsMenu
            darkMode={darkMode}
            onToggleDarkMode={() => setDarkMode(!darkMode)}
            profile={profile}
            onUpdateProfile={onUpdateProfile}
            fiTheme={fiTheme}
            onFiThemeChange={onFiThemeChange}
            gwTheme={gwTheme}
            onGwThemeChange={onGwThemeChange}
            homeTheme={homeTheme}
            onHomeThemeChange={onHomeThemeChange}
            hasPendingChanges={hasPendingGitHubChanges}
            ghConfig={ghConfig}
            ghIsConfigured={ghIsConfigured}
            ghSyncStatus={ghSyncStatus}
            ghLastSyncAt={ghLastSyncAt}
            ghLastError={ghLastError}
            ghHistory={ghHistory}
            ghHasStoredToken={ghHasStoredToken}
            ghTokenUnlocked={ghTokenUnlocked}
            ghUsingLegacyToken={ghUsingLegacyToken}
            onGhUpdateConfig={onGhUpdateConfig}
            onGhSaveEncryptedToken={onGhSaveEncryptedToken}
            onGhMigrateLegacyToken={onGhMigrateLegacyToken}
            onGhUnlockToken={onGhUnlockToken}
            onGhLockToken={onGhLockToken}
            onGhSyncNow={onGhSyncNow}
            onGhFetchHistory={onGhFetchHistory}
            onGhTestConnection={onGhTestConnection}
            onGhRestoreLatest={onGhRestoreLatest}
            onGhRestoreFromCommit={onGhRestoreFromCommit}
            ghData={ghDataToSync}
            onGhApplyRestore={onGhApplyRestore}
            ghSyncProgress={ghSyncProgress}
            ghDirtyFlags={ghDirtyFlags}
            onFactoryReset={onFactoryReset}
            allowCsvImport={allowCsvImport}
            onToggleAllowCsvImport={onToggleAllowCsvImport}
            onExport={onExport}
            onImport={onImport}
            externalOpen={!!settingsOpenToSection}
            externalSection={settingsOpenToSection as any}
            onExternalClose={onSettingsExternalClose}
          />
        </div>
      )}
    </nav>
  );
};

export default SidebarNavigation;
