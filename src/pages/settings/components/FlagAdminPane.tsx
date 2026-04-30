import { FC, useState, useEffect, useCallback, useRef } from 'react'
import { FLAGS } from '../../../flags/flagDefinitions'
import { useFlagContext, type RolloutFlagConfig } from '../../../flags/FlagContext'
import type { FlagDefinition, FlagType } from '../../../flags/flagSystem'
import '../../../styles/FlagAdmin.css'

interface FlagEntry {
  key: string
  def: FlagDefinition<FlagType>
}

function getFlagList(): FlagEntry[] {
  return Object.entries(FLAGS).map(([key, def]) => ({
    key,
    def: def as FlagDefinition<FlagType>,
  }))
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

const FlagAdminPane: FC = () => {
  const {
    resolveFlag,
    overrides,
    rolloutConfig,
    setOverride,
    resetAllOverrides,
    saveRolloutConfig,
    refresh,
    isAdmin,
    isLoading,
    error,
    environment,
  } = useFlagContext()

  const [resetAnnouncement, setResetAnnouncement] = useState('')
  const [localRollout, setLocalRollout] = useState<Record<string, RolloutFlagConfig>>({})
  const [rolloutDirty, setRolloutDirty] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const flagList = getFlagList()

  useEffect(() => {
    if (rolloutConfig) {
      setLocalRollout({ ...rolloutConfig.flags })
    }
  }, [rolloutConfig])

  const handleOverrideChange = useCallback(
    (flagId: string, type: FlagType, rawValue: string | boolean) => {
      let parsed: unknown = rawValue
      if (type === 'number') {
        parsed = Number(rawValue)
      } else if (type === 'json') {
        try {
          parsed = JSON.parse(rawValue as string)
        } catch {
          parsed = rawValue
        }
      }
      setOverride(flagId, parsed)
    },
    [setOverride],
  )

  const handleResetAll = useCallback(() => {
    resetAllOverrides()
    setResetAnnouncement('All overrides cleared')
    setTimeout(() => setResetAnnouncement(''), 3000)
  }, [resetAllOverrides])

  const handleRolloutChange = useCallback((flagId: string, field: 'percentage' | 'value', rawValue: string) => {
    setLocalRollout(prev => {
      const existing = prev[flagId] ?? {}
      const updated = { ...existing }
      if (field === 'percentage') {
        const num = Math.min(100, Math.max(0, Number(rawValue) || 0))
        updated.percentage = num
      } else {
        updated.value = rawValue
      }
      return { ...prev, [flagId]: updated }
    })
    setRolloutDirty(true)
  }, [])

  const handleSave = useCallback(async () => {
    setSaveStatus('saving')
    setSaveError('')
    try {
      await saveRolloutConfig({
        version: rolloutConfig.version,
        updatedAt: new Date().toISOString(),
        flags: localRollout,
      })
      setSaveStatus('saved')
      setRolloutDirty(false)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (e) {
      setSaveStatus('error')
      setSaveError(e instanceof Error ? e.message : 'Unknown error')
    }
  }, [localRollout, saveRolloutConfig, rolloutConfig.version])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  if (isLoading) {
    return (
      <div className="settings-section">
        <h3>Feature Flags</h3>
        <div className="settings-section-content">
          <div className="ff-loading" role="status" aria-label="Loading feature flags">
            <div className="ff-skeleton" />
            <div className="ff-skeleton" />
            <div className="ff-skeleton" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="settings-section">
        <h3>Feature Flags</h3>
        <div className="settings-section-content">
          <p className="ff-error-msg" role="alert">
            Could not reach GitHub. Check your connection and try again.
          </p>
          <button className="settings-btn" onClick={refresh} type="button">
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (flagList.length === 0) {
    return (
      <div className="settings-section">
        <h3>Feature Flags</h3>
        <div className="settings-section-content">
          <p className="settings-description">
            No flags defined in code yet. Add flags to src/flags/flagDefinitions.ts to get started.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="settings-section">
      <h3>Feature Flags</h3>
      <div className="settings-section-content">
        {/* My Overrides Section */}
        <section aria-labelledby="ff-overrides-heading">
          <h4 id="ff-overrides-heading" className="ff-section-title">
            My Overrides
          </h4>
          <p className="settings-description">Override flags locally for testing. Changes only affect your browser.</p>

          <ul className="ff-override-list" role="list">
            {flagList.map(({ key, def }) => {
              const resolved = resolveFlag(def)
              const hasOverride = def.id in (overrides ?? {})
              return (
                <li key={key} className="ff-override-item">
                  <div className="ff-override-item-header">
                    <code className="ff-flag-name">{def.id}</code>
                    <span className={`ff-badge ff-badge--${def.type}`}>{def.type}</span>
                  </div>
                  <p className="ff-flag-description">{def.description}</p>
                  <div className="ff-override-item-control">
                    <span className={`ff-resolved-value ${hasOverride ? 'ff-resolved-value--override' : ''}`}>
                      {hasOverride ? `Override: ${formatValue(resolved)}` : 'using public config'}
                    </span>
                    <FlagInput
                      flagKey={def.id}
                      type={def.type}
                      value={resolved}
                      hasOverride={hasOverride}
                      onChange={(val: string | boolean) => handleOverrideChange(def.id, def.type, val)}
                    />
                  </div>
                </li>
              )
            })}
          </ul>

          <button className="ff-reset-btn" onClick={handleResetAll} type="button">
            Reset All Overrides
          </button>
          <div aria-live="polite" className="ff-sr-announcement">
            {resetAnnouncement}
          </div>
        </section>

        {/* Rollout Config Section (admin only) */}
        {isAdmin && (
          <section aria-labelledby="ff-rollout-heading" className="ff-rollout-section">
            <div className="ff-rollout-header">
              <div>
                <h4 id="ff-rollout-heading" className="ff-section-title">
                  Rollout Config
                </h4>
                <p className="settings-description">
                  Configure flag values and rollout percentages for all users. Changes are saved to the repository.
                </p>
              </div>
              <div className="ff-rollout-header-actions">
                <span
                  className={`ff-env-badge ${environment === 'production' ? 'ff-env-badge--production' : 'ff-env-badge--staging'}`}
                >
                  {environment === 'production' ? 'Production' : 'Staging'}
                </span>
                <button className="ff-refresh-btn" onClick={refresh} type="button" aria-label="Refresh rollout config">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <path d="M13.65 2.35A8 8 0 1 0 16 8h-2a6 6 0 1 1-1.76-4.24L10 6h6V0l-2.35 2.35z" />
                  </svg>
                </button>
              </div>
            </div>

            <ul className="ff-override-list" role="list">
              {flagList.map(({ key, def }) => {
                const config = localRollout[def.id] ?? {}
                const percentage = config.percentage ?? 0
                return (
                  <li key={key} className="ff-override-item">
                    <div className="ff-override-item-header">
                      <code className="ff-flag-name">{def.id}</code>
                      <span className={`ff-badge ff-badge--${def.type}`}>{def.type}</span>
                    </div>
                    {def.type === 'boolean' ? (
                      <div className="ff-percentage-row">
                        <label className="ff-percentage-label" htmlFor={`rollout-pct-${def.id}`}>
                          Rollout %
                        </label>
                        <input
                          id={`rollout-pct-${def.id}`}
                          className="ff-percentage-input"
                          type="number"
                          min={0}
                          max={100}
                          value={percentage}
                          onChange={e => handleRolloutChange(def.id, 'percentage', e.target.value)}
                          aria-describedby={`rollout-hint-${def.id}`}
                        />
                        <span id={`rollout-hint-${def.id}`} className="ff-percentage-hint">
                          % of users will see this enabled
                        </span>
                      </div>
                    ) : (
                      <div className="ff-percentage-row">
                        <label className="ff-percentage-label" htmlFor={`rollout-val-${def.id}`}>
                          Value
                        </label>
                        <input
                          id={`rollout-val-${def.id}`}
                          className="settings-input"
                          type="text"
                          value={String(config.value ?? '')}
                          onChange={e => handleRolloutChange(def.id, 'value', e.target.value)}
                        />
                      </div>
                    )}
                    {def.type === 'boolean' && (
                      <p className="ff-helper-text">0% = disabled for all, 100% = enabled for all</p>
                    )}
                  </li>
                )
              })}
            </ul>

            <div className="ff-save-row">
              <button
                className="settings-btn"
                onClick={handleSave}
                disabled={!rolloutDirty || saveStatus === 'saving'}
                type="button"
              >
                {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
              </button>
              <span aria-live="polite" className="ff-save-status">
                {saveStatus === 'saved' && <span className="ff-save-status--success">Saved ✓</span>}
                {saveStatus === 'error' && (
                  <span className="ff-save-status--error" role="alert">
                    Error: {saveError}
                  </span>
                )}
              </span>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

/* ── Flag Input Sub-component ──────────────────────────────── */

interface FlagInputProps {
  flagKey: string
  type: FlagType
  value: unknown
  hasOverride: boolean
  onChange: (value: string | boolean) => void
}

const FlagInput: FC<FlagInputProps> = ({ flagKey, type, value, onChange }) => {
  switch (type) {
    case 'boolean':
      return (
        <button
          className={`settings-toggle-switch${value ? ' on' : ''}`}
          onClick={() => onChange(!value)}
          role="switch"
          aria-checked={!!value}
          aria-label={`Toggle ${flagKey}`}
        >
          <span className="settings-toggle-knob" />
        </button>
      )
    case 'string':
      return (
        <input
          className="settings-input ff-inline-input"
          type="text"
          value={String(value ?? '')}
          onChange={e => onChange(e.target.value)}
          aria-label={`Value for ${flagKey}`}
        />
      )
    case 'number':
      return (
        <input
          className="settings-input ff-inline-input"
          type="number"
          value={String(value ?? '')}
          onChange={e => onChange(e.target.value)}
          aria-label={`Value for ${flagKey}`}
        />
      )
    case 'json':
      return (
        <textarea
          className="settings-input ff-json-input"
          value={typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? '')}
          onChange={e => onChange(e.target.value)}
          aria-label={`JSON value for ${flagKey}`}
          rows={3}
        />
      )
    default:
      return null
  }
}

export default FlagAdminPane
