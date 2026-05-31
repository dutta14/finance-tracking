import { FC } from 'react'
import type { AppearancePaneProps } from '../types'

const ACCENT_OPTIONS = [
  { id: 'blue', label: 'Blue', color: '#3b82f6' },
  { id: 'teal', label: 'Teal', color: '#14b8a6' },
  { id: 'purple', label: 'Purple', color: '#8b5cf6' },
  { id: 'green', label: 'Green', color: '#22c55e' },
  { id: 'orange', label: 'Orange', color: '#f97316' },
]

const AppearancePane: FC<AppearancePaneProps> = ({ darkMode, onToggleDarkMode, accentTheme, onChangeAccent }) => {
  return (
    <div className="settings-section">
      <h3>Appearance</h3>
      <div className="settings-section-content">
        <p className="settings-description">Choose your preferred theme</p>
        <div className="settings-theme-selector">
          <button
            className={`settings-theme-option${!darkMode ? ' active' : ''}`}
            onClick={() => darkMode && onToggleDarkMode()}
            aria-pressed={!darkMode}
            aria-label="Light theme"
          >
            <div className="settings-theme-preview settings-theme-light">
              <div className="settings-theme-toolbar" />
              <div className="settings-theme-content">
                <div className="settings-theme-bar" />
                <div className="settings-theme-bar" />
                <div className="settings-theme-bar short" />
              </div>
            </div>
            <span className="settings-theme-name">Light</span>
          </button>
          <button
            className={`settings-theme-option${darkMode ? ' active' : ''}`}
            onClick={() => !darkMode && onToggleDarkMode()}
            aria-pressed={darkMode}
            aria-label="Dark theme"
          >
            <div className="settings-theme-preview settings-theme-dark">
              <div className="settings-theme-toolbar" />
              <div className="settings-theme-content">
                <div className="settings-theme-bar" />
                <div className="settings-theme-bar" />
                <div className="settings-theme-bar short" />
              </div>
            </div>
            <span className="settings-theme-name">Dark</span>
          </button>
        </div>

        <p className="settings-description" style={{ marginTop: '1.5rem' }}>
          Accent color
        </p>
        <div className="settings-accent-picker">
          {ACCENT_OPTIONS.map(opt => (
            <button
              key={opt.id}
              className={`settings-accent-swatch${accentTheme === opt.id ? ' active' : ''}`}
              onClick={() => onChangeAccent(opt.id)}
              aria-label={`${opt.label} accent`}
              aria-pressed={accentTheme === opt.id}
              style={{ '--swatch-color': opt.color } as React.CSSProperties}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default AppearancePane
