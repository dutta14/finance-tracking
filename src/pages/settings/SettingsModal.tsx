import { FC, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { SettingsModalProps, SettingsSection } from './types'
import ProfilePane from './components/ProfilePane'
import DataFolderPane from './components/DataFolderPane'
import AppearancePane from './components/AppearancePane'
import AdvancedPane from './components/AdvancedPane'
import LabsPane from './components/LabsPane'
import FlagAdminPane from './components/FlagAdminPane'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useFlagContext } from '../../flags/FlagContext'
import { useSettings } from '../../contexts/SettingsContext'
import '../../styles/SettingsModal.css'

const SettingsModal: FC<SettingsModalProps> = props => {
  const { darkMode, onToggleDarkMode, profile, onUpdateProfile, onClose = () => {}, initialSection = 'profile' } = props

  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection)
  const modalRef = useRef<HTMLDivElement>(null)
  const { isAdmin } = useFlagContext()
  const { accentTheme, setAccentTheme } = useSettings()
  useFocusTrap(modalRef, true)

  useEffect(() => {
    if (!isAdmin && activeSection === 'flags') {
      setActiveSection('profile')
    }
  }, [isAdmin, activeSection])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return createPortal(
    <div className="settings-modal-backdrop" onClick={onClose}>
      <div
        ref={modalRef}
        className="settings-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
      >
        <div className="settings-modal-header">
          <h2 className="settings-modal-title" id="settings-modal-title">
            Settings
          </h2>
          <button className="settings-modal-close" onClick={onClose} aria-label="Close">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 2L14 14M14 2L2 14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="settings-modal-container">
          <div className="settings-modal-nav" role="tablist" aria-label="Settings sections">
            <button
              className={`settings-modal-nav-item${activeSection === 'profile' ? ' active' : ''}`}
              role="tab"
              id="settings-tab-profile"
              aria-selected={activeSection === 'profile'}
              onClick={() => setActiveSection('profile')}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="8" cy="5" r="2.5" />
                <path d="M 2 14 Q 2 10 8 10 Q 14 10 14 14" />
              </svg>
              Profile
            </button>
            <button
              className={`settings-modal-nav-item${activeSection === 'folder' ? ' active' : ''}`}
              role="tab"
              id="settings-tab-folder"
              aria-selected={activeSection === 'folder'}
              onClick={() => setActiveSection('folder')}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1.5 4a1 1 0 0 1 1-1h3l1.2 1.5H13.5a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V4z" />
              </svg>
              Data Folder
            </button>
            <button
              className={`settings-modal-nav-item${activeSection === 'appearance' ? ' active' : ''}`}
              role="tab"
              id="settings-tab-appearance"
              aria-selected={activeSection === 'appearance'}
              onClick={() => setActiveSection('appearance')}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                {darkMode ? (
                  <path d="M8.5 3a5.5 5.5 0 0 0 4.384 8.624A5.5 5.5 0 1 1 8.5 3z" />
                ) : (
                  <>
                    <circle cx="8" cy="8" r="3" />
                    <path
                      d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      fill="none"
                    />
                  </>
                )}
              </svg>
              Appearance
            </button>
            <button
              className={`settings-modal-nav-item${activeSection === 'advanced' ? ' active' : ''}`}
              role="tab"
              id="settings-tab-advanced"
              aria-selected={activeSection === 'advanced'}
              onClick={() => setActiveSection('advanced')}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a1 1 0 0 1 1 1v1.5h2a1 1 0 0 1 1 1v1h1.5a1 1 0 0 1 0 2H13v3h1.5a1 1 0 0 1 0 2H13v1a1 1 0 0 1-1 1h-2v1.5a1 1 0 0 1-2 0V14H6v1.5a1 1 0 0 1-2 0V14H2a1 1 0 0 1-1-1v-2H.5a1 1 0 0 1 0-2H1V7H.5a1 1 0 0 1 0-2H1V4a1 1 0 0 1 1-1h2V1.5a1 1 0 0 1 2 0V3h2V1.5a1 1 0 0 1 1-1z" />
              </svg>
              Advanced
            </button>
            <button
              className={`settings-modal-nav-item${activeSection === 'labs' ? ' active' : ''}`}
              role="tab"
              id="settings-tab-labs"
              aria-selected={activeSection === 'labs'}
              onClick={() => setActiveSection('labs')}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M6 1h4v1H9v4.2l3.7 5.5c.4.6 0 1.3-.7 1.3H4c-.7 0-1.1-.7-.7-1.3L7 6.2V2H6V1zm2 5.5L5.2 11h5.6L8 6.5z" />
              </svg>
              Labs
            </button>
            {isAdmin && (
              <button
                className={`settings-modal-nav-item${activeSection === 'flags' ? ' active' : ''}`}
                role="tab"
                id="settings-tab-flags"
                aria-selected={activeSection === 'flags'}
                onClick={() => setActiveSection('flags')}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M3 1v14h1V9h8l-2-4 2-4H4V1H3zm1 1.5h6.5L9 6l1.5 2.5H4V2.5z" />
                </svg>
                Feature Flags
              </button>
            )}
          </div>

          <div className="settings-modal-detail" role="tabpanel" aria-labelledby={`settings-tab-${activeSection}`}>
            {activeSection === 'profile' && <ProfilePane profile={profile} onUpdateProfile={onUpdateProfile} />}
            {activeSection === 'folder' && <DataFolderPane />}
            {activeSection === 'appearance' && (
              <AppearancePane
                darkMode={darkMode}
                onToggleDarkMode={onToggleDarkMode}
                accentTheme={accentTheme}
                onChangeAccent={setAccentTheme}
              />
            )}
            {activeSection === 'advanced' && (
              <AdvancedPane
                allowCsvImport={props.allowCsvImport ?? false}
                onToggleAllowCsvImport={props.onToggleAllowCsvImport ?? (() => {})}
              />
            )}
            {activeSection === 'labs' && <LabsPane />}
            {activeSection === 'flags' && isAdmin && <FlagAdminPane />}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default SettingsModal
