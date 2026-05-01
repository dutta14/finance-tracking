import { FC, useState, FormEvent } from 'react'
import { useEncryption } from '../contexts/EncryptionContext'

/**
 * Minimal unlock screen — placeholder for Phase 3 (Kai's design).
 * Renders when encryption is enabled and the app is locked.
 */
const UnlockScreen: FC = () => {
  const { unlock, isSettingUp } = useEncryption()
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!passphrase.trim()) return
    setError('')
    setLoading(true)
    try {
      const ok = await unlock(passphrase)
      if (!ok) {
        setError('Wrong passphrase. Please try again.')
      }
    } catch {
      setError('Unlock failed. Please try again.')
    } finally {
      setLoading(false)
      setPassphrase('')
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '1rem',
        background: 'var(--bg, #f5f5f5)',
        color: 'var(--text, #1a1a1a)',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          width: '100%',
          maxWidth: '360px',
          padding: '2rem',
          borderRadius: '12px',
          background: 'var(--card-bg, #fff)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Unlock Your Data</h1>
        <p style={{ margin: 0, fontSize: '0.875rem', opacity: 0.7 }}>
          Your data is encrypted. Enter your passphrase to continue.
        </p>

        <input
          type="password"
          aria-label="Passphrase"
          placeholder="Enter passphrase"
          value={passphrase}
          onChange={e => setPassphrase(e.target.value)}
          disabled={loading || isSettingUp}
          autoFocus
          style={{
            padding: '0.625rem 0.75rem',
            fontSize: '0.9375rem',
            border: '1px solid var(--border, #d1d5db)',
            borderRadius: '8px',
            outline: 'none',
            background: 'var(--input-bg, #fff)',
            color: 'inherit',
          }}
        />

        {error && (
          <p role="alert" style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--danger, #dc2626)' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || isSettingUp || !passphrase.trim()}
          style={{
            padding: '0.625rem',
            fontSize: '0.9375rem',
            fontWeight: 600,
            border: 'none',
            borderRadius: '8px',
            cursor: loading ? 'wait' : 'pointer',
            background: 'var(--accent, #2563eb)',
            color: '#fff',
            opacity: loading || !passphrase.trim() ? 0.6 : 1,
          }}
        >
          {loading ? 'Unlocking…' : 'Unlock'}
        </button>
      </form>
    </div>
  )
}

export default UnlockScreen
