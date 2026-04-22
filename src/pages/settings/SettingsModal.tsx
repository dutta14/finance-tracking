import { FC, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { SettingsModalProps, SettingsSection } from './types'
import ProfilePane from './components/ProfilePane'
import GitHubSyncPane from './components/GitHubSyncPane'
import AppearancePane from './components/AppearancePane'
import AdvancedPane from './components/AdvancedPane'
import LabsPane from './components/LabsPane'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import '../../styles/SettingsModal.css'

const SettingsModal: FC<SettingsModalProps> = (props) => {
  const {
    darkMode, onToggleDarkMode, profile, onUpdateProfile,
    hasPendingChanges = false, fiTheme = 'blue', onFiThemeChange = () => {},
    onClose = () => {}, initialSection = 'profile',
  } = props

  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection)
  const modalRef = useRef<HTMLDivElement>(null)
  useFocusTrap(modalRef, true)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return createPortal(
    <div className="settings-modal-backdrop" onClick={onClose}>
      <div ref={modalRef} className="settings-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="settings-modal-header">
          <h2 className="settings-modal-title">Settings</h2>
          <button className="settings-modal-close" onClick={onClose} aria-label="Close">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 2L14 14M14 2L2 14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="settings-modal-container">
          <nav className="settings-modal-nav">
            <button className={`settings-modal-nav-item${activeSection === 'profile' ? ' active' : ''}`} onClick={() => setActiveSection('profile')}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="5" r="2.5" /><path d="M 2 14 Q 2 10 8 10 Q 14 10 14 14" /></svg>
              Profile
            </button>
            <button className={`settings-modal-nav-item${activeSection === 'github' ? ' active' : ''}`} onClick={() => setActiveSection('github')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
              GitHub Sync
              {hasPendingChanges && <span className="settings-modal-badge" />}
            </button>
            <button className={`settings-modal-nav-item${activeSection === 'appearance' ? ' active' : ''}`} onClick={() => setActiveSection('appearance')}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                {darkMode
                  ? <path d="M8.5 3a5.5 5.5 0 0 0 4.384 8.624A5.5 5.5 0 1 1 8.5 3z" />
                  : <><circle cx="8" cy="8" r="3" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" /></>}
              </svg>
              Appearance
            </button>
            <button className={`settings-modal-nav-item${activeSection === 'advanced' ? ' active' : ''}`} onClick={() => setActiveSection('advanced')}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a1 1 0 0 1 1 1v1.5h2a1 1 0 0 1 1 1v1h1.5a1 1 0 0 1 0 2H13v3h1.5a1 1 0 0 1 0 2H13v1a1 1 0 0 1-1 1h-2v1.5a1 1 0 0 1-2 0V14H6v1.5a1 1 0 0 1-2 0V14H2a1 1 0 0 1-1-1v-2H.5a1 1 0 0 1 0-2H1V7H.5a1 1 0 0 1 0-2H1V4a1 1 0 0 1 1-1h2V1.5a1 1 0 0 1 2 0V3h2V1.5a1 1 0 0 1 1-1z"/></svg>
              Advanced
            </button>
            <button className={`settings-modal-nav-item${activeSection === 'labs' ? ' active' : ''}`} onClick={() => setActiveSection('labs')}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M6 1h4v1H9v4.2l3.7 5.5c.4.6 0 1.3-.7 1.3H4c-.7 0-1.1-.7-.7-1.3L7 6.2V2H6V1zm2 5.5L5.2 11h5.6L8 6.5z"/></svg>
              Labs
            </button>
          </nav>

          <div className="settings-modal-detail">
            {activeSection === 'profile' && <ProfilePane profile={profile} onUpdateProfile={onUpdateProfile} />}
            {activeSection === 'github' && (
              <GitHubSyncPane
                hasPendingChanges={hasPendingChanges}
                ghConfig={props.ghConfig}
                ghIsConfigured={props.ghIsConfigured}
                ghSyncStatus={props.ghSyncStatus}
                ghLastSyncAt={props.ghLastSyncAt}
                ghLastError={props.ghLastError}
                ghHistory={props.ghHistory}
                ghHasStoredToken={props.ghHasStoredToken}
                ghTokenUnlocked={props.ghTokenUnlocked}
                ghUsingLegacyToken={props.ghUsingLegacyToken}
                onGhUpdateConfig={props.onGhUpdateConfig}
                onGhSaveEncryptedToken={props.onGhSaveEncryptedToken}
                onGhMigrateLegacyToken={props.onGhMigrateLegacyToken}
                onGhUnlockToken={props.onGhUnlockToken}
                onGhLockToken={props.onGhLockToken}
                onGhSyncNow={props.onGhSyncNow}
                onGhFetchHistory={props.onGhFetchHistory}
                onGhTestConnection={props.onGhTestConnection}
                onGhRestoreLatest={props.onGhRestoreLatest}
                onGhRestoreFromCommit={props.onGhRestoreFromCommit}
                onGhApplyRestore={props.onGhApplyRestore}
                ghData={props.ghData}
              />
            )}
            {activeSection === 'appearance' && (
              <AppearancePane darkMode={darkMode} onToggleDarkMode={onToggleDarkMode} fiTheme={fiTheme} onFiThemeChange={onFiThemeChange} />
            )}
            {activeSection === 'advanced' && (
              <AdvancedPane
                allowCsvImport={props.allowCsvImport ?? false}
                onToggleAllowCsvImport={props.onToggleAllowCsvImport ?? (() => {})}
                onExport={props.onExport ?? (() => {})}
                onImport={props.onImport ?? (() => {})}
                onFactoryReset={props.onFactoryReset ?? (() => {})}
                onClose={onClose}
              />
            )}
            {activeSection === 'labs' && <LabsPane />}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default SettingsModal
