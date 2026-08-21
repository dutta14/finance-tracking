import { FC } from 'react'
import type { AdvancedPaneProps } from '../types'

const AdvancedPane: FC<AdvancedPaneProps> = ({ allowCsvImport, onToggleAllowCsvImport }) => {
  return (
    <div className="settings-section">
      <h3>Advanced</h3>
      <div className="settings-section-content">
        <p className="settings-description">Turn on power-user tools for bulk data entry</p>

        <div className="settings-toggle-row settings-toggle-row--spaced">
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
      </div>
    </div>
  )
}

export default AdvancedPane
