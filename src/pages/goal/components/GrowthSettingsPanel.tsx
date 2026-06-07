import { FC, useState } from 'react'
import { GrowthSettings } from '../hooks/useGrowthSettings'

interface GrowthSettingsPanelProps {
  settings: GrowthSettings
  onUpdate: (partial: Partial<GrowthSettings>) => void
}

const GrowthSettingsPanel: FC<GrowthSettingsPanelProps> = ({ settings, onUpdate }) => {
  const [open, setOpen] = useState(false)

  return (
    <div className="growth-settings">
      <button
        type="button"
        className="growth-settings-toggle"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls="growth-settings-body"
      >
        <svg
          className={`growth-settings-chevron${open ? ' open' : ''}`}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M3 4.5l3 3 3-3" />
        </svg>
        Growth Assumptions
      </button>

      {open && (
        <div id="growth-settings-body" className="growth-settings-body">
          <div className="growth-settings-grid">
            <label className="growth-settings-label">
              Pre-{settings.ageBoundary} growth
              <div className="growth-settings-input-wrap">
                <input
                  type="number"
                  step="0.1"
                  value={settings.preBoundaryGrowth}
                  onChange={e => onUpdate({ preBoundaryGrowth: parseFloat(e.target.value) || 0 })}
                />
                <span className="growth-settings-unit">%</span>
              </div>
            </label>

            <label className="growth-settings-label">
              Post-{settings.ageBoundary} growth
              <div className="growth-settings-input-wrap">
                <input
                  type="number"
                  step="0.1"
                  value={settings.postBoundaryGrowth}
                  onChange={e => onUpdate({ postBoundaryGrowth: parseFloat(e.target.value) || 0 })}
                />
                <span className="growth-settings-unit">%</span>
              </div>
            </label>

            <label className="growth-settings-label">
              Age boundary
              <div className="growth-settings-input-wrap">
                <input
                  type="number"
                  step="1"
                  min="40"
                  max="80"
                  value={settings.ageBoundary}
                  onChange={e => onUpdate({ ageBoundary: parseInt(e.target.value, 10) || 60 })}
                />
              </div>
            </label>

            <label className="growth-settings-label">
              GW growth
              <div className="growth-settings-input-wrap">
                <input
                  type="number"
                  step="0.1"
                  value={settings.gwGrowth}
                  onChange={e => onUpdate({ gwGrowth: parseFloat(e.target.value) || 0 })}
                />
                <span className="growth-settings-unit">%</span>
              </div>
            </label>
          </div>
        </div>
      )}
    </div>
  )
}

export default GrowthSettingsPanel
