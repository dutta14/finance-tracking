import { FC } from 'react'
import type { AppearancePaneProps } from '../types'

const AppearancePane: FC<AppearancePaneProps> = ({ darkMode, onToggleDarkMode }) => {
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
      </div>
    </div>
  )
}

export default AppearancePane
