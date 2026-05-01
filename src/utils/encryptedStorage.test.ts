import { describe, it, expect, beforeEach } from 'vitest'
import { deriveKey } from './crypto'
import {
  SENSITIVE_KEYS,
  isSensitiveKey,
  get,
  set,
  getMany,
  setMany,
  rawRead,
  rawWrite,
  remove,
} from './encryptedStorage'

// Create a real CryptoKey for testing
const TEST_SALT = crypto.getRandomValues(new Uint8Array(16))
let testKey: CryptoKey

beforeEach(async () => {
  localStorage.clear()
  testKey = await deriveKey('test-passphrase', TEST_SALT)
})

// ── isSensitiveKey ─────────────────────────────────────────────

describe('isSensitiveKey', () => {
  it('returns true for all 13 sensitive keys', () => {
    for (const key of SENSITIVE_KEYS) {
      expect(isSensitiveKey(key)).toBe(true)
    }
    expect(SENSITIVE_KEYS).toHaveLength(13)
  })

  it('returns false for non-sensitive keys', () => {
    expect(isSensitiveKey('darkMode')).toBe(false)
    expect(isSensitiveKey('accentTheme')).toBe(false)
    expect(isSensitiveKey('github-sync-config')).toBe(false)
    expect(isSensitiveKey('random-key')).toBe(false)
  })
})

// ── get / set without encryption ───────────────────────────────

describe('get/set without encryption (non-sensitive key)', () => {
  it('round-trips plain JSON', async () => {
    await set('darkMode', true, null)
    expect(await get<boolean>('darkMode', null)).toBe(true)
  })

  it('returns null for missing key', async () => {
    expect(await get('nonexistent', null)).toBeNull()
  })

  it('stores value as plain JSON in localStorage', async () => {
    await set('some-setting', { a: 1 }, null)
    expect(JSON.parse(localStorage.getItem('some-setting')!)).toEqual({ a: 1 })
  })
})

// ── get / set with encryption ──────────────────────────────────

describe('get/set with encryption (sensitive key)', () => {
  it('round-trips an encrypted value', async () => {
    const data = { name: 'Alice', balance: 42_000 }
    await set('user-profile', data, testKey)
    expect(await get('user-profile', testKey)).toEqual(data)
  })

  it('stores an encrypted envelope in localStorage', async () => {
    await set('data-accounts', [{ id: 1 }], testKey)
    const raw = localStorage.getItem('data-accounts')!
    const parsed = JSON.parse(raw)
    expect(parsed).toHaveProperty('v', 1)
    expect(parsed).toHaveProperty('iv')
    expect(parsed).toHaveProperty('ct')
  })

  it('returns null for sensitive key when cryptoKey is null', async () => {
    await set('data-accounts', [{ id: 1 }], testKey)
    expect(await get('data-accounts', null)).toBeNull()
  })

  it('throws when writing sensitive key without cryptoKey', async () => {
    await expect(set('data-accounts', [{ id: 1 }], null)).rejects.toThrow(/CryptoKey/)
  })

  it('reads plain (unencrypted) sensitive value as migration path', async () => {
    localStorage.setItem('user-profile', JSON.stringify({ name: 'Legacy' }))
    expect(await get('user-profile', testKey)).toEqual({ name: 'Legacy' })
  })
})

// ── Batch operations ───────────────────────────────────────────

describe('getMany / setMany', () => {
  it('batch-writes and batch-reads multiple keys', async () => {
    await setMany(
      [
        ['darkMode', true],
        ['user-profile', { name: 'Bob' }],
      ],
      testKey,
    )

    const result = await getMany(['darkMode', 'user-profile', 'missing-key'], testKey)
    expect(result.get('darkMode')).toBe(true)
    expect(result.get('user-profile')).toEqual({ name: 'Bob' })
    expect(result.has('missing-key')).toBe(false)
  })
})

// ── rawRead / rawWrite ─────────────────────────────────────────

describe('rawRead / rawWrite', () => {
  it('bypasses encryption completely', () => {
    rawWrite('data-accounts', 'raw-string-value')
    expect(rawRead('data-accounts')).toBe('raw-string-value')
  })

  it('returns null for missing key', () => {
    expect(rawRead('nope')).toBeNull()
  })
})

// ── remove ─────────────────────────────────────────────────────

describe('remove', () => {
  it('removes a key from localStorage', async () => {
    await set('darkMode', true, null)
    remove('darkMode')
    expect(await get('darkMode', null)).toBeNull()
  })
})
