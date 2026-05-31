import { createContext, useContext, useState, useCallback, useEffect, useMemo, FC, ReactNode } from 'react'
import { deriveKey, encryptString, decryptString, bytesToB64, b64ToBytes } from '../utils/crypto'
import type { EncryptedEnvelope } from '../utils/crypto'
import { SENSITIVE_KEYS } from '../utils/encryptedStorage'
import { migratePlaintextToEncrypted, isMigrationIncomplete, recoverMigration } from '../utils/migratePlaintext'
import { reencryptIDBContents, decryptIDBContents } from '../utils/taxFileDB'
import { appStorage } from '../utils/appStorage'

// ── Constants ────────────────────────────────────────────────────

const LS_SALT = 'encryption-salt'
const LS_VERIFY = 'encryption-verify'
const LS_ENABLED = 'encryption-enabled'
const VERIFY_PLAINTEXT = 'encryption-verify-ok'

// ── Types ────────────────────────────────────────────────────────

export interface EncryptionContextValue {
  cryptoKey: CryptoKey | null
  isEncryptionEnabled: boolean
  isLocked: boolean
  isSettingUp: boolean
  unlock: (passphrase: string) => Promise<boolean>
  lock: () => void
  setupEncryption: (passphrase: string) => Promise<void>
  changePassphrase: (oldPassphrase: string, newPassphrase: string) => Promise<boolean>
  disableEncryption: (passphrase: string) => Promise<boolean>
}

// ── Context ──────────────────────────────────────────────────────

const EncryptionContext = createContext<EncryptionContextValue | null>(null)

export const useEncryption = (): EncryptionContextValue => {
  const ctx = useContext(EncryptionContext)
  if (!ctx) {
    throw new Error(
      'useEncryption must be used within an <EncryptionProvider>. Wrap a parent component in <EncryptionProvider> before calling useEncryption().',
    )
  }
  return ctx
}

// ── Helpers ──────────────────────────────────────────────────────

function readEnabled(): boolean {
  return localStorage.getItem(LS_ENABLED) === '1'
}

function readSalt(): Uint8Array<ArrayBuffer> | null {
  const raw = localStorage.getItem(LS_SALT)
  if (!raw) return null
  try {
    return b64ToBytes(raw)
  } catch {
    return null
  }
}

function readVerifyEnvelope(): EncryptedEnvelope | null {
  const raw = localStorage.getItem(LS_VERIFY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as EncryptedEnvelope
  } catch {
    return null
  }
}

async function verifyPassphrase(key: CryptoKey): Promise<boolean> {
  const envelope = readVerifyEnvelope()
  if (!envelope) return false
  try {
    const plaintext = await decryptString(envelope, key)
    return plaintext === VERIFY_PLAINTEXT
  } catch {
    return false
  }
}

// ── Provider ─────────────────────────────────────────────────────

export const EncryptionProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null)
  const [isEncryptionEnabled, setIsEncryptionEnabled] = useState<boolean>(readEnabled)
  const [isSettingUp, setIsSettingUp] = useState(false)

  // Set initial appStorage mode on mount
  useEffect(() => {
    appStorage.setMode(isEncryptionEnabled ? 'enabled' : 'disabled')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Recover from interrupted migration on mount
  useEffect(() => {
    if (isMigrationIncomplete()) {
      recoverMigration()
    }
  }, [])

  // Listen for remote lock signal from other tabs
  useEffect(() => {
    const handler = () => {
      setCryptoKey(null)
    }
    window.addEventListener('encryption-remote-lock', handler)
    return () => window.removeEventListener('encryption-remote-lock', handler)
  }, [])

  // Cross-tab `encryption-enabled` propagation. The existing
  // `_encryption-lock-signal` mechanism propagates lock events, but a tab
  // that was already mounted before another tab enabled encryption would
  // otherwise keep operating in the unencrypted state — a stale-tab security
  // gap. This listener fires on the native browser `storage` event when
  // another tab toggles `encryption-enabled`, and forces this tab into the
  // locked or disabled state to match.
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== LS_ENABLED) return
      if (e.newValue === '1') {
        // Disposal first: lockWithoutBroadcast() clears _memoryStore, drops
        // _pendingPersists (so any queued plaintext write from disabled
        // mode cannot flush to LS after this point), and flips _isReady
        // to false. This closes the stale-tab plaintext gap that motivated
        // the listener — setCryptoKey(null) alone left _memoryStore and
        // _pendingPersists intact. We use lockWithoutBroadcast rather than
        // lock() because lock() emits `_encryption-lock-signal` to other
        // tabs, which would loop back and lock the tab that just enabled.
        appStorage.lockWithoutBroadcast()
        appStorage.setMode('enabled')
        setCryptoKey(null)
        setIsEncryptionEnabled(true)
      } else if (e.newValue === null || e.newValue === '0') {
        // Same disposal for remote-disable: drop any queued persists tied
        // to the old enabled-mode cryptoKey and clear stale memory before
        // flipping to disabled mode.
        appStorage.lockWithoutBroadcast()
        appStorage.setMode('disabled')
        setCryptoKey(null)
        setIsEncryptionEnabled(false)
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const isLocked = isEncryptionEnabled && cryptoKey === null

  const unlock = useCallback(async (passphrase: string): Promise<boolean> => {
    const salt = readSalt()
    if (!salt) return false
    try {
      const key = await deriveKey(passphrase, salt)
      const ok = await verifyPassphrase(key)
      if (ok) {
        appStorage.setCryptoKey(key)
        await appStorage.hydrate(key)
        setCryptoKey(key)
        return true
      }
      return false
    } catch {
      return false
    }
  }, [])

  const lock = useCallback((): void => {
    appStorage.lock()
    setCryptoKey(null)
  }, [])

  const setupEncryption = useCallback(async (passphrase: string): Promise<void> => {
    setIsSettingUp(true)
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16))
      const key = await deriveKey(passphrase, salt)

      // Store salt and verification first (needed for unlock if app restarts)
      localStorage.setItem(LS_SALT, bytesToB64(salt))
      const verifyEnvelope = await encryptString(VERIFY_PLAINTEXT, key)
      localStorage.setItem(LS_VERIFY, JSON.stringify(verifyEnvelope))

      // Atomic migration: encrypt to temp keys → verify → swap
      await migratePlaintextToEncrypted(key)

      localStorage.setItem(LS_ENABLED, '1')

      appStorage.setMode('enabled')
      appStorage.setCryptoKey(key)
      await appStorage.hydrate(key)

      setCryptoKey(key)
      setIsEncryptionEnabled(true)
    } finally {
      setIsSettingUp(false)
    }
  }, [])

  const changePassphrase = useCallback(async (oldPassphrase: string, newPassphrase: string): Promise<boolean> => {
    // Verify old passphrase
    const oldSalt = readSalt()
    if (!oldSalt) return false
    let oldKey: CryptoKey
    try {
      oldKey = await deriveKey(oldPassphrase, oldSalt)
      const ok = await verifyPassphrase(oldKey)
      if (!ok) return false
    } catch {
      return false
    }

    // Generate new salt + key
    const newSalt = crypto.getRandomValues(new Uint8Array(16))
    const newKey = await deriveKey(newPassphrase, newSalt)

    // Re-encrypt all 13 sensitive keys
    for (const k of SENSITIVE_KEYS) {
      const raw = localStorage.getItem(k)
      if (raw === null) continue
      try {
        const envelope: EncryptedEnvelope = JSON.parse(raw)
        if (envelope.v === 1 && typeof envelope.iv === 'string' && typeof envelope.ct === 'string') {
          const plaintext = await decryptString(envelope, oldKey)
          const newEnvelope = await encryptString(plaintext, newKey)
          localStorage.setItem(k, JSON.stringify(newEnvelope))
        }
      } catch {
        // Not an encrypted envelope — skip
      }
    }

    // Update salt + verify
    localStorage.setItem(LS_SALT, bytesToB64(newSalt))
    const verifyEnvelope = await encryptString(VERIFY_PLAINTEXT, newKey)
    localStorage.setItem(LS_VERIFY, JSON.stringify(verifyEnvelope))

    // Re-encrypt IndexedDB tax file content
    await reencryptIDBContents(oldKey, newKey)

    setCryptoKey(newKey)
    return true
  }, [])

  const disableEncryption = useCallback(async (passphrase: string): Promise<boolean> => {
    const salt = readSalt()
    if (!salt) return false
    let key: CryptoKey
    try {
      key = await deriveKey(passphrase, salt)
      const ok = await verifyPassphrase(key)
      if (!ok) return false
    } catch {
      return false
    }

    // Decrypt all 13 sensitive keys back to plaintext
    for (const k of SENSITIVE_KEYS) {
      const raw = localStorage.getItem(k)
      if (raw === null) continue
      try {
        const envelope: EncryptedEnvelope = JSON.parse(raw)
        if (envelope.v === 1 && typeof envelope.iv === 'string' && typeof envelope.ct === 'string') {
          const plaintext = await decryptString(envelope, key)
          localStorage.setItem(k, plaintext)
        }
      } catch {
        // Not an encrypted envelope — leave as-is
      }
    }

    // Decrypt IndexedDB tax file content back to plaintext
    await decryptIDBContents(key)

    // Remove encryption artifacts
    localStorage.removeItem(LS_SALT)
    localStorage.removeItem(LS_VERIFY)
    localStorage.removeItem(LS_ENABLED)

    appStorage.setMode('disabled')
    appStorage.setCryptoKey(null)
    appStorage.lock()

    setCryptoKey(null)
    setIsEncryptionEnabled(false)
    return true
  }, [])

  const value = useMemo<EncryptionContextValue>(
    () => ({
      cryptoKey,
      isEncryptionEnabled,
      isLocked,
      isSettingUp,
      unlock,
      lock,
      setupEncryption,
      changePassphrase,
      disableEncryption,
    }),
    [
      cryptoKey,
      isEncryptionEnabled,
      isLocked,
      isSettingUp,
      unlock,
      lock,
      setupEncryption,
      changePassphrase,
      disableEncryption,
    ],
  )

  return <EncryptionContext.Provider value={value}>{children}</EncryptionContext.Provider>
}

export default EncryptionContext
