/**
 * AppStorage — transparent in-memory storage layer.
 *
 * All sensitive data access goes through this module. When encryption is
 * enabled, reads come from an in-memory map (populated on unlock via
 * hydrate()). Writes update memory synchronously and persist encrypted
 * values to localStorage asynchronously.
 *
 * When encryption is disabled, this module is a thin wrapper around
 * localStorage with the same API surface.
 */

import { SENSITIVE_KEYS, isSensitiveKey } from './encryptedStorage'
import { encryptString, decryptString, isEncryptedEnvelope } from './crypto'
import type { EncryptedEnvelope } from './crypto'

// ── Internal State ─────────────────────────────────────────────

type Subscriber = (value: string | null) => void

let _mode: 'disabled' | 'enabled' = localStorage.getItem('encryption-enabled') === '1' ? 'enabled' : 'disabled'
let _cryptoKey: CryptoKey | null = null
let _isReady = _mode === 'disabled' // disabled = always ready

const _memoryStore = new Map<string, string | null>()
const _subscribers = new Map<string, Set<Subscriber>>()
const _pendingPersists = new Map<string, string | null>()
let _persistScheduled = false

// ── Helpers ────────────────────────────────────────────────────

function notifySubscribers(key: string, value: string | null): void {
  const subs = _subscribers.get(key)
  if (subs) {
    for (const cb of subs) {
      try {
        cb(value)
      } catch (e) {
        console.error('appStorage subscriber error:', e)
      }
    }
  }
}

function schedulePersist(): void {
  if (_persistScheduled) return
  _persistScheduled = true
  queueMicrotask(flushPersists)
}

async function flushPersists(): Promise<void> {
  _persistScheduled = false
  const entries = [..._pendingPersists.entries()]
  _pendingPersists.clear()

  for (const [key, value] of entries) {
    try {
      if (value === null) {
        localStorage.removeItem(key)
      } else if (isSensitiveKey(key) && _mode === 'enabled' && _cryptoKey) {
        const envelope = await encryptString(value, _cryptoKey)
        localStorage.setItem(key, JSON.stringify(envelope))
      } else {
        localStorage.setItem(key, value)
      }
    } catch (e) {
      console.error(`appStorage: failed to persist key "${key}":`, e)
    }
  }
}

// ── Cross-tab sync ─────────────────────────────────────────────

if (typeof window !== 'undefined') {
  window.addEventListener('storage', async (e: StorageEvent) => {
    if (!e.key) return // storage.clear() — ignore

    // Lock signal from another tab
    if (e.key === '_encryption-lock-signal') {
      window.dispatchEvent(new CustomEvent('encryption-remote-lock'))
      return
    }

    // Data change from another tab
    if (isSensitiveKey(e.key)) {
      if (_mode === 'enabled' && _cryptoKey && e.newValue) {
        if (isEncryptedEnvelope(e.newValue)) {
          try {
            const envelope: EncryptedEnvelope = JSON.parse(e.newValue)
            const plaintext = await decryptString(envelope, _cryptoKey)
            _memoryStore.set(e.key, plaintext)
            notifySubscribers(e.key, plaintext)
          } catch {
            // Decryption failed (different key?) — trigger re-lock
            window.dispatchEvent(new CustomEvent('encryption-remote-lock'))
          }
        }
      } else if (_mode === 'disabled') {
        _memoryStore.set(e.key, e.newValue)
        notifySubscribers(e.key, e.newValue)
      }
    } else {
      // Non-sensitive key changed in another tab
      notifySubscribers(e.key, e.newValue)
    }
  })

  // Flush pending persists when tab becomes hidden (prevents data loss on tab switch)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && _pendingPersists.size > 0) {
      flushPersists()
    }
  })
}

// ── Public API ─────────────────────────────────────────────────

function getString(key: string): string | null {
  if (isSensitiveKey(key)) {
    if (_mode === 'disabled') {
      return localStorage.getItem(key)
    }
    // mode === 'enabled': read from memory
    return _memoryStore.get(key) ?? null
  }
  // Non-sensitive: always direct LS read
  return localStorage.getItem(key)
}

function getJSON<T>(key: string, fallback: T): T {
  const raw = getString(key)
  if (raw === null) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function setString(key: string, value: string): void {
  if (isSensitiveKey(key) && _mode === 'enabled') {
    _memoryStore.set(key, value)
    notifySubscribers(key, value)
    _pendingPersists.set(key, value)
    schedulePersist()
  } else {
    // Non-sensitive or disabled: write directly
    localStorage.setItem(key, value)
    if (isSensitiveKey(key)) {
      _memoryStore.set(key, value)
    }
    notifySubscribers(key, value)
  }
}

function setJSON<T>(key: string, value: T): void {
  const serialized = JSON.stringify(value)
  if (serialized === undefined) {
    console.error(`appStorage.setJSON: value for "${key}" is not serializable`)
    return
  }
  setString(key, serialized)
}

function remove(key: string): void {
  if (isSensitiveKey(key) && _mode === 'enabled') {
    _memoryStore.set(key, null)
    notifySubscribers(key, null)
    _pendingPersists.set(key, null)
    schedulePersist()
  } else {
    localStorage.removeItem(key)
    if (isSensitiveKey(key)) {
      _memoryStore.set(key, null)
    }
    notifySubscribers(key, null)
  }
}

function subscribe(key: string, listener: Subscriber): () => void {
  if (!_subscribers.has(key)) {
    _subscribers.set(key, new Set())
  }
  _subscribers.get(key)!.add(listener)
  return () => {
    _subscribers.get(key)?.delete(listener)
  }
}

async function hydrate(cryptoKey: CryptoKey): Promise<void> {
  _cryptoKey = cryptoKey
  _mode = 'enabled'

  for (const key of SENSITIVE_KEYS) {
    const raw = localStorage.getItem(key)
    if (raw === null) {
      _memoryStore.set(key, null)
      continue
    }
    if (isEncryptedEnvelope(raw)) {
      try {
        const envelope: EncryptedEnvelope = JSON.parse(raw)
        const plaintext = await decryptString(envelope, cryptoKey)
        _memoryStore.set(key, plaintext)
      } catch {
        // Corrupted envelope — treat as null
        console.error(`appStorage.hydrate: failed to decrypt key "${key}"`)
        _memoryStore.set(key, null)
      }
    } else {
      // Plaintext value (pre-encryption or migration in progress)
      _memoryStore.set(key, raw)
    }
  }

  _isReady = true
}

function lock(): void {
  // Signal other tabs
  localStorage.setItem('_encryption-lock-signal', String(Date.now()))

  // Clear sensitive data from memory
  for (const key of SENSITIVE_KEYS) {
    _memoryStore.delete(key)
    notifySubscribers(key, null)
  }
  _cryptoKey = null
  _isReady = false
  _pendingPersists.clear()
}

function setMode(mode: 'disabled' | 'enabled'): void {
  _mode = mode
  if (mode === 'disabled') {
    _isReady = true
    _cryptoKey = null
    // In disabled mode, clear memory store (reads go direct to LS)
    for (const key of SENSITIVE_KEYS) {
      _memoryStore.delete(key)
    }
  }
}

function setCryptoKey(key: CryptoKey | null): void {
  _cryptoKey = key
}

function isReady(): boolean {
  return _isReady
}

function getMode(): 'disabled' | 'enabled' {
  return _mode
}

// ── Export singleton ───────────────────────────────────────────

export const appStorage = {
  getString,
  getJSON,
  setString,
  setJSON,
  remove,
  subscribe,
  hydrate,
  lock,
  isReady,
  setMode,
  setCryptoKey,
  getMode,
  /** Reset internal shared state — for test isolation only */
  _reset(): void {
    _subscribers.clear()
    _pendingPersists.clear()
    _persistScheduled = false
    _memoryStore.clear()
  },
} as const
