import { FC, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { GrowthSettings } from '../hooks/useGrowthSettings'
import '../styles/GrowthSettingsPanel.css'

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
  eager?: boolean
  fieldName?: string
}

const NumericInput: FC<NumericInputProps> = ({ value, step, min, max, onChange, eager, fieldName }) => {
  const [local, setLocal] = useState(String(value))
  const committed = useRef(value)
  const stepNum = parseFloat(step)
  const decrementLabel = fieldName ? `Decrease ${fieldName}` : 'Decrease'
  const incrementLabel = fieldName ? `Increase ${fieldName}` : 'Increase'

  useEffect(() => {
    if (value !== committed.current) {
      setLocal(String(value))
      committed.current = value
    }
  }, [value])

  const nudge = (dir: 1 | -1) => {
    const current = parseFloat(local) || 0
    let next = +(current + dir * stepNum).toFixed(4)
    if (min != null && next < parseFloat(min)) next = parseFloat(min)
    if (max != null && next > parseFloat(max)) next = parseFloat(max)
    committed.current = next
    setLocal(String(next))
    onChange(next)
  }

  return (
    <div className="growth-numeric">
      <button type="button" className="growth-numeric-btn" onClick={() => nudge(-1)} aria-label={decrementLabel}>
        −
      </button>
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        aria-label={fieldName}
        value={local}
        onChange={e => {
          setLocal(e.target.value)
          if (eager) {
            const parsed = parseFloat(e.target.value)
            if (!isNaN(parsed)) onChange(parsed)
          }
        }}
        onBlur={() => {
          const parsed = parseFloat(local)
          const result = isNaN(parsed) ? 0 : parsed
          committed.current = result
          setLocal(String(result))
          onChange(result)
        }}
      />
      <button type="button" className="growth-numeric-btn" onClick={() => nudge(1)} aria-label={incrementLabel}>
        +
      </button>
    </div>
  )
}

const GrowthSettingsPanel: FC<GrowthSettingsPanelProps> = ({ settings, onUpdate }) => {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<GrowthSettings>(settings)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const wasOpenRef = useRef(false)

  const handleOpen = () => {
    setDraft(settings)
    setOpen(true)
  }

  const handleCancel = () => setOpen(false)

  const handleSave = () => {
    onUpdate(draft)
    setOpen(false)
  }

  const update = (partial: Partial<GrowthSettings>) => {
    setDraft(prev => ({ ...prev, ...partial }))
  }

  useEffect(() => {
    if (!open) return

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  useEffect(() => {
    if (open) {
      const firstInput = dialogRef.current?.querySelector<HTMLElement>('input, select, textarea')
      const firstFocusable =
        firstInput ?? dialogRef.current?.querySelector<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])')
      ;(firstFocusable ?? dialogRef.current)?.focus()
      wasOpenRef.current = true
      return
    }

    if (wasOpenRef.current) {
      triggerRef.current?.focus()
      wasOpenRef.current = false
    }
  }, [open])

  return (
    <div className="growth-settings">
      <button
        type="button"
        className="growth-settings-toggle"
        ref={triggerRef}
        onClick={handleOpen}
        aria-expanded={open}
        aria-controls="growth-settings-modal"
      >
        Goal Parameters
      </button>

      {open &&
        createPortal(
          <div
            className="growth-modal-backdrop"
            onClick={e => {
              if (e.target === e.currentTarget) setOpen(false)
            }}
          >
            <div
              id="growth-settings-modal"
              className="growth-modal"
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="growth-settings-modal-title"
              tabIndex={-1}
            >
              <div className="growth-modal-header">
                <h2 className="growth-modal-title" id="growth-settings-modal-title">
                  Goal Parameters
                </h2>
              </div>

              <div className="growth-settings-body">
                <label className="growth-settings-label">
                  Inflation
                  <div className="growth-settings-input-wrap">
                    <NumericInput
                      value={draft.inflation}
                      step="0.1"
                      fieldName="inflation"
                      onChange={v => update({ inflation: v })}
                    />
                    <span className="growth-settings-unit">%</span>
                  </div>
                </label>

                <div className="growth-settings-divider" aria-hidden="true" />

                <fieldset className="growth-settings-section">
                  <legend className="growth-settings-section-title">Growth</legend>
                  <div className="growth-settings-row">
                    <label className="growth-settings-label">
                      Switch to conservative
                      <div className="growth-settings-input-wrap growth-settings-input-wrap--age">
                        <NumericInput
                          value={draft.ageBoundary}
                          step="1"
                          min="40"
                          max="80"
                          eager
                          fieldName="switch to conservative age"
                          onChange={v => update({ ageBoundary: v || 60 })}
                        />
                        <span className="growth-settings-unit">yrs</span>
                      </div>
                    </label>

                    <label className="growth-settings-label">
                      Pre-{draft.ageBoundary}
                      <div className="growth-settings-input-wrap">
                        <NumericInput
                          value={draft.preBoundaryGrowth}
                          step="0.1"
                          fieldName={`pre-${draft.ageBoundary} growth`}
                          onChange={v => update({ preBoundaryGrowth: v })}
                        />
                        <span className="growth-settings-unit">%</span>
                      </div>
                    </label>

                    <label className="growth-settings-label">
                      Post-{draft.ageBoundary}
                      <div className="growth-settings-input-wrap">
                        <NumericInput
                          value={draft.postBoundaryGrowth}
                          step="0.1"
                          fieldName={`post-${draft.ageBoundary} growth`}
                          onChange={v => update({ postBoundaryGrowth: v })}
                        />
                        <span className="growth-settings-unit">%</span>
                      </div>
                    </label>

                    <label className="growth-settings-label">
                      GW Growth
                      <div className="growth-settings-input-wrap">
                        <NumericInput
                          value={draft.gwGrowth}
                          step="0.1"
                          fieldName="GW growth"
                          onChange={v => update({ gwGrowth: v })}
                        />
                        <span className="growth-settings-unit">%</span>
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
                          value={draft.retirementCap}
                          step="500"
                          min="0"
                          fieldName="retirement cap"
                          onChange={v => update({ retirementCap: v })}
                        />
                        <span className="growth-settings-unit">/mo</span>
                      </div>
                    </label>

                    <label className="growth-settings-label">
                      Non-retirement minimum
                      <div className="growth-settings-input-wrap growth-settings-input-wrap--dollar">
                        <span className="growth-settings-unit">$</span>
                        <NumericInput
                          value={draft.nonRetirementBase}
                          step="500"
                          min="0"
                          fieldName="non-retirement minimum"
                          onChange={v => update({ nonRetirementBase: v })}
                        />
                        <span className="growth-settings-unit">/mo</span>
                      </div>
                    </label>
                  </div>
                </fieldset>
              </div>

              <div className="growth-modal-footer">
                <button type="button" className="action-btn" onClick={handleCancel}>
                  Cancel
                </button>
                <button type="button" className="action-btn action-btn--primary" onClick={handleSave}>
                  Save
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

export default GrowthSettingsPanel
