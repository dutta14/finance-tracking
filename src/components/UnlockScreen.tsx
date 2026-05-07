import { FC, useState, useCallback, FormEvent } from 'react'
import { useEncryption } from '../contexts/EncryptionContext'
import PassphraseInput from './PassphraseInput'
import '../styles/Encryption.css'

const ShieldLockIcon: FC = () => (
  <svg
    className="unlock-brand-icon"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
    <rect x="9" y="11" width="6" height="5" rx="1" />
    <path d="M10 11V9a2 2 0 1 1 4 0v2" />
  </svg>
)

const SpinnerIcon: FC = () => (
  <svg className="unlock-submit-spinner" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle
      cx="8"
      cy="8"
      r="6"
      stroke="currentColor"
      strokeWidth="2"
      strokeDasharray="28"
      strokeDashoffset="8"
      strokeLinecap="round"
    />
  </svg>
)

const UnlockScreen: FC = () => {
  const { unlock, isSettingUp } = useEncryption()
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const [helpExpanded, setHelpExpanded] = useState(false)

  const handlePassphraseChange = useCallback(
    (val: string) => {
      setPassphrase(val)
      if (error) setError('')
    },
    [error],
  )

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      if (!passphrase.trim() || loading) return
      setError('')
      setLoading(true)
      try {
        const ok = await unlock(passphrase)
        if (!ok) {
          setError('Wrong passphrase. Please try again.')
          setShake(true)
          setPassphrase('')
        }
      } catch {
        setError('Unlock failed. Please try again.')
        setShake(true)
        setPassphrase('')
      } finally {
        setLoading(false)
      }
    },
    [passphrase, loading, unlock],
  )

  const handleShakeEnd = useCallback(() => {
    setShake(false)
    // Re-focus input after shake — target the actual input element
    const el = document.getElementById('unlock-passphrase') as HTMLInputElement | null
    el?.focus()
  }, [])

  const isDisabled = loading || isSettingUp

  return (
    <div className="unlock-screen">
      <main className="unlock-card">
        <div className="unlock-brand">
          <ShieldLockIcon />
          <h1 className="unlock-brand-title">Finance Tracker</h1>
        </div>

        <div className="unlock-header">
          <h2 className="unlock-title">Unlock your data</h2>
          <p className="unlock-subtitle">Enter your passphrase to continue</p>
        </div>

        <form className="unlock-form" onSubmit={handleSubmit}>
          <PassphraseInput
            id="unlock-passphrase"
            label="Passphrase"
            value={passphrase}
            onChange={handlePassphraseChange}
            error={error}
            disabled={isDisabled}
            autoFocus
            placeholder="Enter your passphrase"
            shake={shake}
            onShakeEnd={handleShakeEnd}
          />

          <button
            type="submit"
            className={`unlock-submit${loading ? ' unlock-submit--loading' : ''}`}
            disabled={isDisabled || !passphrase.trim()}
          >
            {loading && <SpinnerIcon />}
            <span className="unlock-submit-text">{loading ? 'Unlocking…' : 'Unlock'}</span>
          </button>
        </form>

        <div className="unlock-help">
          <button
            type="button"
            className="unlock-help-trigger"
            onClick={() => setHelpExpanded(v => !v)}
            aria-expanded={helpExpanded}
            aria-controls="unlock-help-panel"
          >
            Forgot your passphrase?
          </button>
          <div
            id="unlock-help-panel"
            className={`unlock-help-panel${helpExpanded ? ' unlock-help-panel--expanded' : ''}`}
            role="region"
            aria-label="Passphrase recovery help"
            hidden={!helpExpanded}
          >
            <p>
              <strong>Your data is encrypted locally.</strong> Without the correct passphrase, it cannot be recovered.
            </p>
            <p>
              <strong>If you have GitHub Sync enabled,</strong> you can clear your local data and restore from your last
              sync.
            </p>
            <p>
              <strong>To start fresh,</strong> clear your browser's localStorage for this site, then reload.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default UnlockScreen
