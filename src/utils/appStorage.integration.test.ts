import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { appStorage } from './appStorage'
import { SENSITIVE_KEYS } from './encryptedStorage'
import * as crypto from './crypto'

// Use real-ish mocks for integration testing
vi.mock('./crypto', async () => {
  const actual = await vi.importActual<typeof import('./crypto')>('./crypto')
  return {
    ...actual,
    encryptString: vi.fn(async (plaintext: string) => ({
      v: 1 as const,
      iv: 'int-test-iv',
      ct: btoa(plaintext),
    })),
    decryptString: vi.fn(async (envelope: { ct: string }) => atob(envelope.ct)),
    isEncryptedEnvelope: actual.isEncryptedEnvelope,
  }
})

describe('appStorage integration', () => {
  const mockCryptoKey = {} as CryptoKey

  beforeEach(() => {
    localStorage.clear()
    appStorage.setMode('disabled')
    appStorage.setCryptoKey(null)
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('full lifecycle: enable → write → lock → unlock → read', async () => {
    // 1. Start in disabled mode, write some data
    appStorage.setJSON('user-profile', { name: 'Alice', avatarDataUrl: '', birthday: '1990-01' })
    appStorage.setJSON('data-accounts', [{ id: 1, name: 'Checking' }])
    expect(appStorage.getJSON('user-profile', {})).toEqual({
      name: 'Alice',
      avatarDataUrl: '',
      birthday: '1990-01',
    })

    // 2. Simulate enabling encryption — hydrate loads plaintext values into memory
    appStorage.setMode('enabled')
    appStorage.setCryptoKey(mockCryptoKey)
    await appStorage.hydrate(mockCryptoKey)

    // 3. Read from memory store (should work)
    expect(appStorage.getJSON('user-profile', {})).toEqual({
      name: 'Alice',
      avatarDataUrl: '',
      birthday: '1990-01',
    })
    expect(appStorage.getJSON('data-accounts', [])).toEqual([{ id: 1, name: 'Checking' }])

    // 4. Write while encrypted — updates memory synchronously
    appStorage.setJSON('user-profile', { name: 'Bob', avatarDataUrl: '', birthday: '1985-06' })
    expect(appStorage.getJSON('user-profile', {})).toEqual({
      name: 'Bob',
      avatarDataUrl: '',
      birthday: '1985-06',
    })

    // 5. Flush persists
    await new Promise<void>(resolve => queueMicrotask(() => resolve()))
    await new Promise(resolve => setTimeout(resolve, 0))

    // Verify encrypted envelope was written to localStorage
    const raw = localStorage.getItem('user-profile')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed.v).toBe(1)
    expect(parsed.iv).toBe('int-test-iv')

    // 6. Lock — clears memory
    appStorage.lock()
    appStorage.setMode('enabled') // Stay in enabled mode
    expect(appStorage.getString('user-profile')).toBeNull()
    expect(appStorage.getJSON('data-accounts', [])).toEqual([])

    // 7. Unlock — re-hydrate from encrypted localStorage
    await appStorage.hydrate(mockCryptoKey)
    expect(appStorage.getJSON('user-profile', {})).toEqual({
      name: 'Bob',
      avatarDataUrl: '',
      birthday: '1985-06',
    })
    expect(appStorage.getJSON('data-accounts', [])).toEqual([{ id: 1, name: 'Checking' }])
  })

  it('disable encryption restores plaintext reads', async () => {
    // Start with encrypted data
    const envelope = { v: 1, iv: 'test', ct: btoa(JSON.stringify({ name: 'Encrypted' })) }
    localStorage.setItem('user-profile', JSON.stringify(envelope))

    appStorage.setMode('enabled')
    appStorage.setCryptoKey(mockCryptoKey)
    await appStorage.hydrate(mockCryptoKey)
    expect(appStorage.getJSON('user-profile', {})).toEqual({ name: 'Encrypted' })

    // Simulate disabling encryption — data is decrypted back to plaintext in LS
    localStorage.setItem('user-profile', JSON.stringify({ name: 'Plaintext' }))
    appStorage.setMode('disabled')
    appStorage.setCryptoKey(null)
    appStorage.lock()

    // In disabled mode, reads directly from localStorage
    expect(appStorage.getJSON('user-profile', {})).toEqual({ name: 'Plaintext' })
  })

  it('non-sensitive keys work in all modes', async () => {
    // Disabled mode
    appStorage.setString('darkMode', '1')
    expect(appStorage.getString('darkMode')).toBe('1')

    // Enabled mode
    appStorage.setMode('enabled')
    appStorage.setCryptoKey(mockCryptoKey)
    await appStorage.hydrate(mockCryptoKey)

    appStorage.setString('darkMode', '0')
    expect(appStorage.getString('darkMode')).toBe('0')
    // Non-sensitive keys are written directly to localStorage
    expect(localStorage.getItem('darkMode')).toBe('0')
  })

  it('subscribe works across write and lock cycles', async () => {
    const listener = vi.fn()
    const unsub = appStorage.subscribe('user-profile', listener)

    // Write in disabled mode
    appStorage.setJSON('user-profile', { name: 'Test' })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(JSON.stringify({ name: 'Test' }))

    // Enable + hydrate
    appStorage.setMode('enabled')
    appStorage.setCryptoKey(mockCryptoKey)
    await appStorage.hydrate(mockCryptoKey)

    // Write in enabled mode
    listener.mockClear()
    appStorage.setJSON('user-profile', { name: 'Updated' })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(JSON.stringify({ name: 'Updated' }))

    // Lock fires null
    listener.mockClear()
    appStorage.lock()
    expect(listener).toHaveBeenCalledWith(null)

    unsub()
  })

  it('all 13 sensitive keys are handled by hydrate', async () => {
    // Seed all sensitive keys
    for (const key of SENSITIVE_KEYS) {
      localStorage.setItem(key, JSON.stringify({ key }))
    }

    appStorage.setMode('enabled')
    appStorage.setCryptoKey(mockCryptoKey)
    await appStorage.hydrate(mockCryptoKey)

    // All should be readable
    for (const key of SENSITIVE_KEYS) {
      expect(appStorage.getJSON(key, null)).toEqual({ key })
    }

    // Lock clears all
    appStorage.lock()
    appStorage.setMode('enabled')
    for (const key of SENSITIVE_KEYS) {
      expect(appStorage.getString(key)).toBeNull()
    }
  })

  it('multiple writes to different keys coalesce in one microtask', async () => {
    appStorage.setMode('enabled')
    appStorage.setCryptoKey(mockCryptoKey)
    await appStorage.hydrate(mockCryptoKey)

    vi.mocked(crypto.encryptString).mockClear()

    // Write to multiple keys in same tick
    appStorage.setJSON('user-profile', { name: 'A' })
    appStorage.setJSON('data-accounts', [1, 2, 3])
    appStorage.setJSON('budget-store', { csvs: {} })

    // Flush
    await new Promise<void>(resolve => queueMicrotask(() => resolve()))
    await new Promise(resolve => setTimeout(resolve, 0))

    // Each key should have been encrypted once
    expect(crypto.encryptString).toHaveBeenCalledTimes(3)
  })
})
