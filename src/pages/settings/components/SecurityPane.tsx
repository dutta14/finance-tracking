import { FC, useState, useCallback, useRef, useEffect, FormEvent } from 'react'
import { useEncryption } from '../../../contexts/EncryptionContext'
import PassphraseInput from '../../../components/PassphraseInput'
import '../../../styles/Encryption.css'

type ActiveForm = 'none' | 'setup' | 'change' | 'disable'

const WarningIcon: FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 1.5l6.93 12H1.07L8 1.5zM8 3.88L3.15 12.5h9.7L8 3.88zM7.25 7v3h1.5V7h-1.5zm0 4v1.5h1.5V11h-1.5z" />
  </svg>
)

const ShieldOffIcon: FC = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M8 1L2 4v3.5c0 3.7 2.56 7.16 6 8 3.44-.84 6-4.3 6-8V4L8 1z" />
  </svg>
)

const ShieldOnIcon: FC = () => (
  <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 1L2 4v3.5c0 3.7 2.56 7.16 6 8 3.44-.84 6-4.3 6-8V4L8 1zm-1 8.5L5 7.5l1-1 1 1.5 3-3 1 1-4 4z" />
  </svg>
)

const SecurityPane: FC = () => {
  const { isEncryptionEnabled, isSettingUp, setupEncryption, changePassphrase, disableEncryption } = useEncryption()

  const [activeForm, setActiveForm] = useState<ActiveForm>('none')
  const [successFlash, setSuccessFlash] = useState('')

  // Setup form state
  const [setupPass, setSetupPass] = useState('')
  const [setupConfirm, setSetupConfirm] = useState('')
  const [setupError, setSetupError] = useState('')
  const [setupLoading, setSetupLoading] = useState(false)

  // Change form state
  const [changeCurrent, setChangeCurrent] = useState('')
  const [changeNew, setChangeNew] = useState('')
  const [changeConfirm, setChangeConfirm] = useState('')
  const [changeError, setChangeError] = useState('')
  const [changeLoading, setChangeLoading] = useState(false)

  // Disable form state
  const [disablePass, setDisablePass] = useState('')
  const [disableError, setDisableError] = useState('')
  const [disableLoading, setDisableLoading] = useState(false)

  // Focus management refs
  const enableBtnRef = useRef<HTMLButtonElement>(null)
  const changeBtnRef = useRef<HTMLButtonElement>(null)
  const disableBtnRef = useRef<HTMLButtonElement>(null)

  // Focus first input when a form opens
  useEffect(() => {
    if (activeForm !== 'none') {
      // Small delay to let the form render
      requestAnimationFrame(() => {
        const targetId =
          activeForm === 'setup'
            ? 'setup-passphrase'
            : activeForm === 'change'
              ? 'change-current'
              : activeForm === 'disable'
                ? 'disable-passphrase'
                : null
        if (targetId) {
          const el = document.getElementById(targetId) as HTMLInputElement | null
          el?.focus()
        }
      })
    }
  }, [activeForm])

  // Handle Escape to close active form
  useEffect(() => {
    if (activeForm === 'none') return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeForm()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  })

  const closeForm = useCallback(() => {
    const returnRef =
      activeForm === 'setup'
        ? enableBtnRef
        : activeForm === 'change'
          ? changeBtnRef
          : activeForm === 'disable'
            ? disableBtnRef
            : null

    setActiveForm('none')
    resetFormState()

    // Return focus to trigger
    requestAnimationFrame(() => returnRef?.current?.focus())
  }, [activeForm])

  const resetFormState = () => {
    setSetupPass('')
    setSetupConfirm('')
    setSetupError('')
    setSetupLoading(false)
    setChangeCurrent('')
    setChangeNew('')
    setChangeConfirm('')
    setChangeError('')
    setChangeLoading(false)
    setDisablePass('')
    setDisableError('')
    setDisableLoading(false)
  }

  // ── Setup encryption ──
  const setupMismatch = setupConfirm.length > 0 && setupPass !== setupConfirm
  const setupValid = setupPass.trim().length > 0 && setupPass === setupConfirm

  const handleSetupSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      if (!setupValid || setupLoading) return
      setSetupLoading(true)
      setSetupError('')
      try {
        await setupEncryption(setupPass)
        resetFormState()
        setActiveForm('none')
      } catch {
        setSetupError('Failed to enable encryption. Please try again.')
      } finally {
        setSetupLoading(false)
      }
    },
    [setupValid, setupLoading, setupPass, setupEncryption],
  )

  // ── Change passphrase ──
  const changeMismatch = changeConfirm.length > 0 && changeNew !== changeConfirm
  const changeValid = changeCurrent.trim().length > 0 && changeNew.trim().length > 0 && changeNew === changeConfirm

  const handleChangeSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      if (!changeValid || changeLoading) return
      setChangeLoading(true)
      setChangeError('')
      try {
        const ok = await changePassphrase(changeCurrent, changeNew)
        if (ok) {
          resetFormState()
          setActiveForm('none')
          setSuccessFlash('Passphrase updated ✓')
          setTimeout(() => setSuccessFlash(''), 2200)
        } else {
          setChangeError('Incorrect passphrase')
        }
      } catch {
        setChangeError('Failed to update passphrase. Please try again.')
      } finally {
        setChangeLoading(false)
      }
    },
    [changeValid, changeLoading, changeCurrent, changeNew, changePassphrase],
  )

  // ── Disable encryption ──
  const handleDisableSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      if (!disablePass.trim() || disableLoading) return
      setDisableLoading(true)
      setDisableError('')
      try {
        const ok = await disableEncryption(disablePass)
        if (ok) {
          resetFormState()
          setActiveForm('none')
        } else {
          setDisableError('Incorrect passphrase')
        }
      } catch {
        setDisableError('Failed to disable encryption. Please try again.')
      } finally {
        setDisableLoading(false)
      }
    },
    [disablePass, disableLoading, disableEncryption],
  )

  return (
    <div className="settings-section">
      <h3>Security</h3>
      <div className="settings-section-content">
        {/* Status row */}
        <div className="security-status">
          <div className={`security-status-icon${isEncryptionEnabled ? ' enabled' : ''}`}>
            {isEncryptionEnabled ? <ShieldOnIcon /> : <ShieldOffIcon />}
          </div>
          <div className="security-status-info">
            <span className="security-status-label" role="status" aria-live="polite">
              {isEncryptionEnabled ? (
                <>
                  Encryption enabled <span className="security-status-check">✓</span>
                </>
              ) : (
                'Encryption disabled'
              )}
            </span>
            <p className="settings-description">
              {isEncryptionEnabled
                ? 'Your financial data is encrypted. A passphrase is required to access the app.'
                : 'Encrypt your financial data with a passphrase to protect it from unauthorized access.'}
            </p>
          </div>
        </div>

        {/* ── Encryption OFF actions ── */}
        {!isEncryptionEnabled && activeForm !== 'setup' && (
          <button ref={enableBtnRef} className="settings-btn" onClick={() => setActiveForm('setup')}>
            Enable Encryption
          </button>
        )}

        {/* ── Setup form ── */}
        {!isEncryptionEnabled && activeForm === 'setup' && (
          <form className="security-setup-form" onSubmit={handleSetupSubmit}>
            <div className="security-form-header">
              <h4>Set up encryption</h4>
              <button type="button" className="security-form-close" onClick={closeForm} aria-label="Cancel setup">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path
                    d="M2 2L14 14M14 2L2 14"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              </button>
            </div>

            <PassphraseInput
              id="setup-passphrase"
              label="New passphrase"
              value={setupPass}
              onChange={val => {
                setSetupPass(val)
                setSetupError('')
              }}
              disabled={setupLoading}
              autoFocus={activeForm === 'setup'}
              placeholder="Choose a passphrase"
            />

            <PassphraseInput
              id="setup-confirm"
              label="Confirm passphrase"
              value={setupConfirm}
              onChange={val => {
                setSetupConfirm(val)
                setSetupError('')
              }}
              error={setupMismatch ? "Passphrases don't match" : setupError}
              disabled={setupLoading}
              placeholder="Confirm your passphrase"
            />

            <div className="security-warning">
              <WarningIcon />
              <p>If you forget your passphrase and don't have GitHub Sync enabled, your data cannot be recovered.</p>
            </div>

            <div className="security-form-actions">
              <button type="button" className="settings-btn settings-btn--outline" onClick={closeForm}>
                Cancel
              </button>
              <button type="submit" className="settings-btn" disabled={!setupValid || setupLoading || isSettingUp}>
                {setupLoading || isSettingUp ? 'Encrypting…' : 'Enable Encryption'}
              </button>
            </div>
          </form>
        )}

        {/* ── Encryption ON actions ── */}
        {isEncryptionEnabled && activeForm === 'none' && (
          <>
            <div className="security-actions">
              <button
                ref={changeBtnRef}
                className="settings-btn settings-btn--secondary"
                onClick={() => setActiveForm('change')}
              >
                Change Passphrase
              </button>
              <button
                ref={disableBtnRef}
                className="settings-btn--danger-outline"
                onClick={() => setActiveForm('disable')}
              >
                Disable Encryption
              </button>
            </div>

            <div className="security-warning">
              <WarningIcon />
              <p>Keep your passphrase safe. Without it, your encrypted data cannot be accessed.</p>
            </div>
          </>
        )}

        {/* Success flash */}
        {successFlash && (
          <span className="settings-save-flash" role="status" aria-live="polite">
            {successFlash}
          </span>
        )}

        {/* ── Change passphrase form ── */}
        {isEncryptionEnabled && activeForm === 'change' && (
          <form className="security-change-form" onSubmit={handleChangeSubmit}>
            <h4>Change passphrase</h4>

            <PassphraseInput
              id="change-current"
              label="Current passphrase"
              value={changeCurrent}
              onChange={val => {
                setChangeCurrent(val)
                setChangeError('')
              }}
              error={changeError}
              disabled={changeLoading}
              autoFocus={activeForm === 'change'}
              placeholder="Enter current passphrase"
            />

            <PassphraseInput
              id="change-new"
              label="New passphrase"
              value={changeNew}
              onChange={val => setChangeNew(val)}
              disabled={changeLoading}
              placeholder="Choose a new passphrase"
            />

            <PassphraseInput
              id="change-confirm"
              label="Confirm new passphrase"
              value={changeConfirm}
              onChange={val => setChangeConfirm(val)}
              error={changeMismatch ? "Passphrases don't match" : ''}
              disabled={changeLoading}
              placeholder="Confirm new passphrase"
            />

            <div className="security-form-actions">
              <button type="button" className="settings-btn settings-btn--outline" onClick={closeForm}>
                Cancel
              </button>
              <button type="submit" className="settings-btn" disabled={!changeValid || changeLoading}>
                {changeLoading ? 'Updating…' : 'Update Passphrase'}
              </button>
            </div>
          </form>
        )}

        {/* ── Disable confirmation ── */}
        {isEncryptionEnabled && activeForm === 'disable' && (
          <form className="security-disable-confirm" onSubmit={handleDisableSubmit}>
            <div className="settings-reset-warning">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--color-negative)" aria-hidden="true">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
              <div>
                <p className="settings-reset-title" id="disable-warning-title">
                  Disable encryption?
                </p>
                <p className="settings-reset-message" id="disable-warning-message">
                  Your data will be decrypted and stored in plain text. Anyone with access to this browser can view it.
                </p>
              </div>
            </div>

            <PassphraseInput
              id="disable-passphrase"
              label="Enter passphrase to confirm"
              value={disablePass}
              onChange={val => {
                setDisablePass(val)
                setDisableError('')
              }}
              error={disableError}
              disabled={disableLoading}
              autoFocus={activeForm === 'disable'}
              placeholder="Enter your passphrase"
              ariaDescribedBy="disable-warning-message"
            />

            <div className="settings-reset-actions">
              <button type="button" className="settings-btn settings-btn--outline" onClick={closeForm}>
                Cancel
              </button>
              <button
                type="submit"
                className="settings-btn settings-btn--danger"
                disabled={!disablePass.trim() || disableLoading}
              >
                {disableLoading ? 'Disabling…' : 'Disable Encryption'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default SecurityPane
