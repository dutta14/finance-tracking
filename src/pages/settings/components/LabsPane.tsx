import { FC, useState } from 'react'
import { isDemoActive, enterDemoMode, exitDemoMode } from '../demoMode'

const LabsPane: FC = () => {
  const [labPdfToCsv, setLabPdfToCsv] = useState(() => localStorage.getItem('lab-pdf-to-csv') === '1')
  const [demoActive] = useState(isDemoActive)

  return (
    <div className="settings-section">
      <h3>Labs</h3>
      <div className="settings-section-content">
        <p className="settings-description">
          Try experimental features. These may be incomplete or change without notice.
        </p>

        <div className="settings-toggle-row">
          <div>
            <span className="settings-toggle-label">PDF → CSV</span>
            <span className="settings-toggle-hint">
              Extract transaction tables from bank or brokerage PDFs into CSV format
            </span>
          </div>
          <button
            className={`settings-toggle-switch${labPdfToCsv ? ' on' : ''}`}
            onClick={() => {
              const next = !labPdfToCsv
              setLabPdfToCsv(next)
              localStorage.setItem('lab-pdf-to-csv', next ? '1' : '0')
              window.dispatchEvent(new Event('labs-changed'))
            }}
            role="switch"
            aria-checked={labPdfToCsv}
          >
            <span className="settings-toggle-knob" />
          </button>
        </div>

        <div className="settings-toggle-row" style={{ marginTop: '0.75rem' }}>
          <div>
            <span className="settings-toggle-label">Demo Mode</span>
            <span className="settings-toggle-hint">
              {demoActive
                ? 'Currently active — your real data is safely backed up. Turn off to restore.'
                : 'Replace your data with realistic sample data for demos. Your real data is backed up and restored when you turn it off.'}
            </span>
          </div>
          <button
            className={`settings-toggle-switch${demoActive ? ' on' : ''}`}
            onClick={() => {
              demoActive ? exitDemoMode() : enterDemoMode()
            }}
            role="switch"
            aria-checked={demoActive}
          >
            <span className="settings-toggle-knob" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default LabsPane
