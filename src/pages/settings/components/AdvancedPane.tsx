import { FC, useState, useRef } from 'react'
import type { AdvancedPaneProps } from '../types'

const AdvancedPane: FC<AdvancedPaneProps> = ({
  allowCsvImport,
  onToggleAllowCsvImport,
  onExport,
  onImport,
  onFactoryReset,
  onClose,
}) => {
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const importFileInputRef = useRef<HTMLInputElement>(null)

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onImport(file)
      if (importFileInputRef.current) importFileInputRef.current.value = ''
    }
  }

  return (
    <div className="settings-section">
      <h3>Advanced</h3>
      <div className="settings-section-content">
        <p className="settings-description">Manage app data and reset your application</p>

        <div className="settings-toggle-row" style={{ marginBottom: '1rem' }}>
          <div>
            <span className="settings-toggle-label">Allow CSV imports &amp; resets</span>
            <span className="settings-toggle-hint">Show import and reset buttons on the Data page</span>
          </div>
          <button
            className={`settings-toggle-switch${allowCsvImport ? ' on' : ''}`}
            onClick={onToggleAllowCsvImport}
            role="switch"
            aria-checked={allowCsvImport}
          >
            <span className="settings-toggle-knob" />
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button className="settings-btn settings-btn--secondary" onClick={onExport}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M8 2v9M4 7l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect x="2" y="12" width="12" height="2" rx="1" fill="currentColor" />
            </svg>
            Export
          </button>
          <button className="settings-btn settings-btn--secondary" onClick={() => importFileInputRef.current?.click()}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M8 11V2M4 6l4-4 4 4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect x="2" y="12" width="12" height="2" rx="1" fill="currentColor" />
            </svg>
            Import
          </button>
          <input
            ref={importFileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportFileChange}
            style={{ display: 'none' }}
          />
        </div>

        {!resetConfirmOpen ? (
          <button className="settings-btn settings-btn--danger" onClick={() => setResetConfirmOpen(true)}>
            Factory Reset App
          </button>
        ) : (
          <div className="settings-reset-confirm">
            <div className="settings-reset-warning">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#dc2626">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
              <div>
                <p className="settings-reset-title">Permanently reset the app?</p>
                <p className="settings-reset-message">
                  This will erase all goals, data, and settings. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="settings-reset-actions">
              <button className="settings-btn settings-btn--outline" onClick={() => setResetConfirmOpen(false)}>
                Cancel
              </button>
              <button
                className="settings-btn settings-btn--danger"
                onClick={() => {
                  onFactoryReset()
                  onClose()
                }}
              >
                Yes, Reset Everything
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdvancedPane
