import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { appStorage } from './appStorage'
import { SENSITIVE_KEYS } from './encryptedStorage'
import * as crypto from './crypto'

// Mock crypto module
vi.mock('./crypto', async () => {
  const actual = await vi.importActual<typeof import('./crypto')>('./crypto')
  return {
    ...actual,
    encryptString: vi.fn(async (plaintext: string) => ({
      v: 1 as const,
      iv: 'mock-iv',
      ct: btoa(plaintext),
    })),
    decryptString: vi.fn(async (envelope: { ct: string }) => atob(envelope.ct)),
    isEncryptedEnvelope: actual.isEncryptedEnvelope,
  }
})

describe('appStorage', () => {
  const mockCryptoKey = {} as CryptoKey

  beforeEach(() => {
    localStorage.clear()
    // Reset appStorage state between tests
    appStorage.setMode('disabled')
    appStorage.setCryptoKey(null)
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  // ── Basic operations ──────────────────────────────────────────

  it('getString returns null for missing key', () => {
    expect(appStorage.getString('user-profile')).toBeNull()
  })

  it('getJSON returns fallback for missing key', () => {
    expect(appStorage.getJSON('user-profile', { name: 'default' })).toEqual({ name: 'default' })
  })

  it('setJSON + getJSON roundtrip', () => {
    const data = { name: 'Alice', age: 30 }
    appStorage.setJSON('user-profile', data)
    expect(appStorage.getJSON('user-profile', {})).toEqual(data)
  })

  it('setString + getString roundtrip', () => {
    appStorage.setString('user-profile', 'hello')
    expect(appStorage.getString('user-profile')).toBe('hello')
  })

  it('remove clears value', () => {
    appStorage.setString('user-profile', 'test')
    appStorage.remove('user-profile')
    expect(appStorage.getString('user-profile')).toBeNull()
  })

  // ── Subscriptions ─────────────────────────────────────────────

  it('subscribe fires on set', () => {
    const listener = vi.fn()
    appStorage.subscribe('user-profile', listener)
    appStorage.setString('user-profile', 'new-value')
    expect(listener).toHaveBeenCalledWith('new-value')
  })

  it('subscribe fires on remove', () => {
    appStorage.setString('user-profile', 'test')
    const listener = vi.fn()
    appStorage.subscribe('user-profile', listener)
    appStorage.remove('user-profile')
    expect(listener).toHaveBeenCalledWith(null)
  })

  it('unsubscribe stops notifications', () => {
    const listener = vi.fn()
    const unsub = appStorage.subscribe('user-profile', listener)
    unsub()
    appStorage.setString('user-profile', 'ignored')
    expect(listener).not.toHaveBeenCalled()
  })

  // ── Mode behavior ─────────────────────────────────────────────

  it('mode=disabled reads from localStorage directly', () => {
    appStorage.setMode('disabled')
    localStorage.setItem('user-profile', JSON.stringify({ name: 'Direct' }))
    expect(appStorage.getJSON('user-profile', {})).toEqual({ name: 'Direct' })
  })

  it('mode=enabled reads from memoryStore', async () => {
    localStorage.setItem('user-profile', JSON.stringify({ name: 'Memory' }))
    appStorage.setMode('enabled')
    appStorage.setCryptoKey(mockCryptoKey)
    await appStorage.hydrate(mockCryptoKey)
    expect(appStorage.getJSON('user-profile', {})).toEqual({ name: 'Memory' })
  })

  it('mode=enabled returns null before hydrate', () => {
    appStorage.setMode('enabled')
    localStorage.setItem('user-profile', JSON.stringify({ name: 'Test' }))
    expect(appStorage.getString('user-profile')).toBeNull()
  })

  // ── Hydration ─────────────────────────────────────────────────

  it('hydrate decrypts encrypted envelopes', async () => {
    const envelope = { v: 1, iv: 'test-iv', ct: btoa('{"name":"Encrypted"}') }
    localStorage.setItem('user-profile', JSON.stringify(envelope))
    await appStorage.hydrate(mockCryptoKey)
    expect(appStorage.getString('user-profile')).toBe('{"name":"Encrypted"}')
  })

  it('hydrate handles plaintext values', async () => {
    localStorage.setItem('user-profile', JSON.stringify({ name: 'Plain' }))
    await appStorage.hydrate(mockCryptoKey)
    expect(appStorage.getJSON('user-profile', {})).toEqual({ name: 'Plain' })
  })

  it('hydrate handles null values', async () => {
    // user-profile not in localStorage
    await appStorage.hydrate(mockCryptoKey)
    expect(appStorage.getString('user-profile')).toBeNull()
  })

  it('hydrate handles corrupted envelopes gracefully', async () => {
    const badEnvelope = { v: 1, iv: 'bad', ct: 'corrupted' }
    localStorage.setItem('user-profile', JSON.stringify(badEnvelope))
    vi.mocked(crypto.decryptString).mockRejectedValueOnce(new Error('decrypt failed'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await appStorage.hydrate(mockCryptoKey)
    expect(appStorage.getString('user-profile')).toBeNull()
    consoleSpy.mockRestore()
  })

  // ── Lock ──────────────────────────────────────────────────────

  it('lock clears sensitive keys from memory', async () => {
    localStorage.setItem('user-profile', JSON.stringify({ name: 'Test' }))
    await appStorage.hydrate(mockCryptoKey)
    expect(appStorage.getString('user-profile')).not.toBeNull()
    appStorage.lock()
    appStorage.setMode('enabled') // Ensure we stay in enabled mode to check memory
    expect(appStorage.getString('user-profile')).toBeNull()
  })

  it('lock fires subscribers with null', async () => {
    localStorage.setItem('user-profile', JSON.stringify({ name: 'Test' }))
    await appStorage.hydrate(mockCryptoKey)
    const listener = vi.fn()
    appStorage.subscribe('user-profile', listener)
    appStorage.lock()
    expect(listener).toHaveBeenCalledWith(null)
  })

  // ── Encrypted writes ──────────────────────────────────────────

  it('setJSON in enabled mode persists encrypted', async () => {
    appStorage.setMode('enabled')
    appStorage.setCryptoKey(mockCryptoKey)
    await appStorage.hydrate(mockCryptoKey)
    appStorage.setJSON('user-profile', { name: 'Secret' })

    // Flush the microtask queue
    await new Promise(resolve => queueMicrotask(resolve))
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(crypto.encryptString).toHaveBeenCalled()
    const stored = localStorage.getItem('user-profile')
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.v).toBe(1)
    expect(parsed.iv).toBe('mock-iv')
  })

  it('multiple rapid writes coalesce', async () => {
    appStorage.setMode('enabled')
    appStorage.setCryptoKey(mockCryptoKey)
    await appStorage.hydrate(mockCryptoKey)

    // Write multiple times synchronously
    appStorage.setJSON('user-profile', { name: 'A' })
    appStorage.setJSON('user-profile', { name: 'B' })
    appStorage.setJSON('user-profile', { name: 'C' })

    // Flush microtask
    await new Promise(resolve => queueMicrotask(resolve))
    await new Promise(resolve => setTimeout(resolve, 0))

    // encryptString should only be called once (last value wins)
    expect(crypto.encryptString).toHaveBeenCalledTimes(1)
    expect(crypto.encryptString).toHaveBeenCalledWith(JSON.stringify({ name: 'C' }), mockCryptoKey)
  })

  // ── Non-sensitive passthrough ─────────────────────────────────

  it('non-sensitive keys bypass encryption', () => {
    appStorage.setMode('enabled')
    appStorage.setCryptoKey(mockCryptoKey)
    // 'darkMode' is not in SENSITIVE_KEYS
    appStorage.setString('darkMode', '1')
    expect(localStorage.getItem('darkMode')).toBe('1')
    expect(appStorage.getString('darkMode')).toBe('1')
  })

  // ── Cross-tab ─────────────────────────────────────────────────

  it('cross-tab StorageEvent updates memoryStore (disabled mode)', () => {
    appStorage.setMode('disabled')
    const event = new StorageEvent('storage', {
      key: 'user-profile',
      newValue: JSON.stringify({ name: 'FromOtherTab' }),
    })
    window.dispatchEvent(event)
    // In disabled mode, the memoryStore is updated via the event handler
    // but getString reads from localStorage directly in disabled mode
    // The subscriber should fire
    const listener = vi.fn()
    appStorage.subscribe('user-profile', listener)
    const event2 = new StorageEvent('storage', {
      key: 'user-profile',
      newValue: JSON.stringify({ name: 'Tab2' }),
    })
    window.dispatchEvent(event2)
    expect(listener).toHaveBeenCalledWith(JSON.stringify({ name: 'Tab2' }))
  })

  it('cross-tab lock signal fires remote-lock event', () => {
    const handler = vi.fn()
    window.addEventListener('encryption-remote-lock', handler)
    const event = new StorageEvent('storage', {
      key: '_encryption-lock-signal',
      newValue: String(Date.now()),
    })
    window.dispatchEvent(event)
    expect(handler).toHaveBeenCalled()
    window.removeEventListener('encryption-remote-lock', handler)
  })

  // ── isReady / getMode ─────────────────────────────────────────

  it('isReady returns true when disabled', () => {
    appStorage.setMode('disabled')
    expect(appStorage.isReady()).toBe(true)
  })

  it('isReady returns false when enabled but not hydrated', () => {
    appStorage.setMode('enabled')
    // After setMode('enabled'), _isReady is not automatically set to false
    // unless lock() was called. Let's simulate via lock()
    appStorage.lock()
    appStorage.setMode('enabled')
    expect(appStorage.isReady()).toBe(false)
  })

  it('isReady returns true after hydrate', async () => {
    appStorage.lock()
    appStorage.setMode('enabled')
    await appStorage.hydrate(mockCryptoKey)
    expect(appStorage.isReady()).toBe(true)
  })

  it('getMode returns current mode', () => {
    appStorage.setMode('disabled')
    expect(appStorage.getMode()).toBe('disabled')
    appStorage.setMode('enabled')
    expect(appStorage.getMode()).toBe('enabled')
  })

  // ── Edge cases ────────────────────────────────────────────────

  it('getJSON returns fallback for invalid JSON', () => {
    appStorage.setMode('disabled')
    localStorage.setItem('user-profile', 'not-valid-json{{{')
    expect(appStorage.getJSON('user-profile', { fallback: true })).toEqual({ fallback: true })
  })

  it('sensitive keys list is correct length', () => {
    expect(SENSITIVE_KEYS.length).toBe(13)
  })
})
