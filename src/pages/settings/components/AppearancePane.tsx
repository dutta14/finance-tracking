import { FC } from 'react'
import type { AppearancePaneProps } from '../types'
import { COLOR_PALETTES } from '../utils'

const AppearancePane: FC<AppearancePaneProps> = ({ darkMode, onToggleDarkMode, fiTheme, onFiThemeChange }) => {
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

        <div className="settings-palette-group">
          <p className="settings-palette-label">Accent color</p>
          <div className="settings-palette-swatches">
            {COLOR_PALETTES.map(p => {
              const isSelected = fiTheme === p.id
              return (
                <div key={p.id} className="settings-swatch-col">
                  <button
                    className={`settings-palette-swatch${isSelected ? ' active' : ''}`}
                    style={{ '--swatch-color': p.color } as React.CSSProperties}
                    onClick={() => onFiThemeChange(p.id)}
                    title={p.label}
                    aria-label={`${p.label}${isSelected ? ' (selected)' : ''}`}
                    aria-pressed={isSelected}
                  >
                    {isSelected && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                        <path
                          d="M1.5 5l2.5 2.5 4.5-4.5"
                          stroke="white"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                  <span className="settings-swatch-tags">{p.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AppearancePane
