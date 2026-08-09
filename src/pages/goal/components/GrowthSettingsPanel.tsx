import { FC, useEffect, useRef, useState } from 'react'
import { GrowthSettings } from '../hooks/useGrowthSettings'

interface GrowthSettingsPanelProps {
  settings: GrowthSettings
  onUpdate: (partial: Partial<GrowthSettings>) => void
}

interface NumericInputProps {
  value: number
  step: string
  min?: string
  max?: string
  onChange: (n: number) => void
}

const NumericInput: FC<NumericInputProps> = ({ value, step, min, max, onChange }) => {
  const [local, setLocal] = useState(String(value))
  const committed = useRef(value)

  useEffect(() => {
    if (value !== committed.current) {
      setLocal(String(value))
      committed.current = value
    }
  }, [value])

  return (
    <input
      type="number"
      step={step}
      min={min}
      max={max}
      value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => {
        const parsed = parseFloat(local)
        const result = isNaN(parsed) ? 0 : parsed
        committed.current = result
        setLocal(String(result))
        onChange(result)
      }}
    />
  )
}

const GrowthSettingsPanel: FC<GrowthSettingsPanelProps> = ({ settings, onUpdate }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="growth-settings" ref={ref}>
      <button
        type="button"
        className="growth-settings-toggle"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls="growth-settings-body"
      >
        Goal Parameters
      </button>

      {open && (
        <div id="growth-settings-body" className="growth-settings-body">
          <fieldset className="growth-settings-section">
            <legend className="growth-settings-section-title">Growth</legend>
            <div className="growth-settings-row">
              <label className="growth-settings-label">
                Pre-{settings.ageBoundary}
                <div className="growth-settings-input-wrap">
                  <NumericInput
                    value={settings.preBoundaryGrowth}
                    step="0.1"
                    onChange={v => onUpdate({ preBoundaryGrowth: v })}
                  />
                  <span className="growth-settings-unit">%</span>
                </div>
              </label>

              <label className="growth-settings-label">
                Post-{settings.ageBoundary}
                <div className="growth-settings-input-wrap">
                  <NumericInput
                    value={settings.postBoundaryGrowth}
                    step="0.1"
                    onChange={v => onUpdate({ postBoundaryGrowth: v })}
                  />
                  <span className="growth-settings-unit">%</span>
                </div>
              </label>

              <label className="growth-settings-label">
                GW
                <div className="growth-settings-input-wrap">
                  <NumericInput value={settings.gwGrowth} step="0.1" onChange={v => onUpdate({ gwGrowth: v })} />
                  <span className="growth-settings-unit">%</span>
                </div>
              </label>

              <label className="growth-settings-label">
                Inflation
                <div className="growth-settings-input-wrap">
                  <NumericInput value={settings.inflation} step="0.1" onChange={v => onUpdate({ inflation: v })} />
                  <span className="growth-settings-unit">%</span>
                </div>
              </label>

              <label className="growth-settings-label">
                Boundary
                <div className="growth-settings-input-wrap growth-settings-input-wrap--age">
                  <NumericInput
                    value={settings.ageBoundary}
                    step="1"
                    min="40"
                    max="80"
                    onChange={v => onUpdate({ ageBoundary: v || 60 })}
                  />
                  <span className="growth-settings-unit">yrs</span>
                </div>
              </label>
            </div>
          </fieldset>

          <div className="growth-settings-divider" aria-hidden="true" />

          <fieldset className="growth-settings-section">
            <legend className="growth-settings-section-title">Allocation</legend>
            <div className="growth-settings-row">
              <label className="growth-settings-label">
                Retirement cap
                <div className="growth-settings-input-wrap growth-settings-input-wrap--dollar">
                  <span className="growth-settings-unit">$</span>
                  <NumericInput
                    value={settings.retirementCap}
                    step="500"
                    min="0"
                    onChange={v => onUpdate({ retirementCap: v })}
                  />
                  <span className="growth-settings-unit">/mo</span>
                </div>
              </label>

              <label className="growth-settings-label">
                Non-retirement minimum
                <div className="growth-settings-input-wrap growth-settings-input-wrap--dollar">
                  <span className="growth-settings-unit">$</span>
                  <NumericInput
                    value={settings.nonRetirementBase}
                    step="500"
                    min="0"
                    onChange={v => onUpdate({ nonRetirementBase: v })}
                  />
                  <span className="growth-settings-unit">/mo</span>
                </div>
              </label>
            </div>
          </fieldset>
        </div>
      )}
    </div>
  )
}

export default GrowthSettingsPanel
