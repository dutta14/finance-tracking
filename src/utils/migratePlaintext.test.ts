import { describe, it, expect, beforeEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { deriveKey, encryptString, isEncryptedEnvelope } from './crypto'
import { SENSITIVE_KEYS } from './encryptedStorage'
import { migratePlaintextToEncrypted, isMigrationIncomplete, recoverMigration } from './migratePlaintext'

// ── helpers ────────────────────────────────────────────────────────

const TEST_SALT = crypto.getRandomValues(new Uint8Array(16))
let testKey: CryptoKey

const TEMP_PREFIX = '_enc_'
function tempKey(key: string): string {
  return `${TEMP_PREFIX}${key}`
}

/** Seed all 13 sensitive keys with sample plaintext JSON. */
function seedAllPlaintext(): void {
  const samples: Record<string, unknown> = {
    'user-profile': { name: 'Alice' },
    'data-accounts': [{ id: 1, name: 'Checking' }],
    'data-balances': [{ id: 1, accountId: 1, month: '2024-01', balance: 5000 }],
    'budget-store': { csvs: {}, configs: {}, years: [] },
    'budget-summary': { total: 1200 },
    'budget-config': { version: 1, years: [2024] },
    'tax-store': { years: {} },
    'tax-templates': [{ id: 'tpl-1', name: 'Standard' }],
    financialGoals: [{ id: 1, goalName: 'Retire Early' }],
    'gw-goals': [{ id: 101 }],
    'fi-simulations': [{ name: 'Base' }],
    'allocation-custom-ratios': [{ id: 'r1' }],
    'sgt-overrides': {},
  }
  for (const key of SENSITIVE_KEYS) {
    localStorage.setItem(key, JSON.stringify(samples[key]))
  }
}

// ── setup ──────────────────────────────────────────────────────────

beforeEach(async () => {
  localStorage.clear()
  indexedDB = new IDBFactory()
  testKey = await deriveKey('test-passphrase', TEST_SALT)
})

// ── tests ──────────────────────────────────────────────────────────

describe('migratePlaintextToEncrypted', () => {
  it('migrates all 13 keys from plaintext to encrypted envelopes', async () => {
    seedAllPlaintext()

    await migratePlaintextToEncrypted(testKey)

    for (const key of SENSITIVE_KEYS) {
      const raw = localStorage.getItem(key)!
      expect(isEncryptedEnvelope(raw), `${key} should be an encrypted envelope`).toBe(true)
    }

    // Sentinel should be cleaned up
    expect(localStorage.getItem('encryption-migration-in-progress')).toBeNull()
  })

  it('preserves data integrity: decrypted values match originals', async () => {
    seedAllPlaintext()
    const originals = new Map<string, string>()
    for (const key of SENSITIVE_KEYS) {
      originals.set(key, localStorage.getItem(key)!)
    }

    await migratePlaintextToEncrypted(testKey)

    for (const key of SENSITIVE_KEYS) {
      const raw = localStorage.getItem(key)!
      const envelope = JSON.parse(raw)
      const { decryptString } = await import('./crypto')
      const decrypted = await decryptString(envelope, testKey)
      expect(decrypted).toBe(originals.get(key))
    }
  })

  it('skips keys that do not exist in localStorage', async () => {
    // Only seed a few keys
    localStorage.setItem('user-profile', JSON.stringify({ name: 'Bob' }))
    localStorage.setItem('budget-store', JSON.stringify({ csvs: {} }))

    await migratePlaintextToEncrypted(testKey)

    // Seeded keys should be encrypted
    expect(isEncryptedEnvelope(localStorage.getItem('user-profile')!)).toBe(true)
    expect(isEncryptedEnvelope(localStorage.getItem('budget-store')!)).toBe(true)

    // Missing keys should still not exist
    expect(localStorage.getItem('data-accounts')).toBeNull()
    expect(localStorage.getItem('tax-store')).toBeNull()
  })

  it('skips keys that are already encrypted (idempotent)', async () => {
    // Pre-encrypt one key
    const envelope = await encryptString(JSON.stringify({ name: 'Alice' }), testKey)
    const envelopeStr = JSON.stringify(envelope)
    localStorage.setItem('user-profile', envelopeStr)

    // Seed remaining as plaintext
    localStorage.setItem('data-accounts', JSON.stringify([{ id: 1 }]))

    await migratePlaintextToEncrypted(testKey)

    // The already-encrypted key should be untouched (same envelope)
    expect(localStorage.getItem('user-profile')).toBe(envelopeStr)

    // The plaintext key should now be encrypted
    expect(isEncryptedEnvelope(localStorage.getItem('data-accounts')!)).toBe(true)
  })

  it('aborts and cleans up temp keys on verification failure', async () => {
    seedAllPlaintext()

    // Spy on decryptString to force a verification failure on the 2nd key
    const cryptoModule = await import('./crypto')
    let callCount = 0
    const originalDecryptString = cryptoModule.decryptString
    const spy = vi.spyOn(cryptoModule, 'decryptString').mockImplementation(async (envelope, key) => {
      callCount++
      if (callCount === 2) {
        return 'corrupted-data-that-does-not-match'
      }
      return originalDecryptString(envelope, key)
    })

    await expect(migratePlaintextToEncrypted(testKey)).rejects.toThrow('Verification failed')

    // All temp keys should be cleaned up
    for (const key of SENSITIVE_KEYS) {
      expect(localStorage.getItem(tempKey(key))).toBeNull()
    }

    // Originals should be untouched (still plaintext)
    for (const key of SENSITIVE_KEYS) {
      const raw = localStorage.getItem(key)
      if (raw !== null) {
        expect(isEncryptedEnvelope(raw)).toBe(false)
      }
    }

    // Sentinel should be removed
    expect(localStorage.getItem('encryption-migration-in-progress')).toBeNull()

    spy.mockRestore()
  })

  it('completes without error for empty localStorage (new user)', async () => {
    // localStorage is already clear from beforeEach
    await migratePlaintextToEncrypted(testKey)

    // No keys should have been created
    for (const key of SENSITIVE_KEYS) {
      expect(localStorage.getItem(key)).toBeNull()
    }
    expect(localStorage.getItem('encryption-migration-in-progress')).toBeNull()
  })

  it('does not leave temp keys after successful migration', async () => {
    seedAllPlaintext()

    await migratePlaintextToEncrypted(testKey)

    for (const key of SENSITIVE_KEYS) {
      expect(localStorage.getItem(tempKey(key))).toBeNull()
    }
  })
})

describe('isMigrationIncomplete', () => {
  it('returns false when no migration sentinel exists', () => {
    expect(isMigrationIncomplete()).toBe(false)
  })

  it('returns true when migration sentinel exists', () => {
    localStorage.setItem('encryption-migration-in-progress', '1')
    expect(isMigrationIncomplete()).toBe(true)
  })
})

describe('recoverMigration', () => {
  it('cleans up sentinel when encryption-enabled is set (completed migration)', () => {
    localStorage.setItem('encryption-migration-in-progress', '1')
    localStorage.setItem('encryption-enabled', '1')

    recoverMigration()

    expect(localStorage.getItem('encryption-migration-in-progress')).toBeNull()
    expect(localStorage.getItem('encryption-enabled')).toBe('1')
  })

  it('cleans up temp keys and sentinel for interrupted migration', () => {
    localStorage.setItem('encryption-migration-in-progress', '1')
    // Simulate partial temp keys
    localStorage.setItem(tempKey('user-profile'), 'some-encrypted-data')
    localStorage.setItem(tempKey('data-accounts'), 'some-encrypted-data')
    // Original plaintext should remain
    localStorage.setItem('user-profile', JSON.stringify({ name: 'Alice' }))

    recoverMigration()

    expect(localStorage.getItem('encryption-migration-in-progress')).toBeNull()
    expect(localStorage.getItem(tempKey('user-profile'))).toBeNull()
    expect(localStorage.getItem(tempKey('data-accounts'))).toBeNull()
    // Original data preserved
    expect(localStorage.getItem('user-profile')).toBe(JSON.stringify({ name: 'Alice' }))
  })

  it('is a no-op when no migration is in progress', () => {
    localStorage.setItem('user-profile', JSON.stringify({ name: 'Alice' }))

    recoverMigration()

    expect(localStorage.getItem('user-profile')).toBe(JSON.stringify({ name: 'Alice' }))
  })
})
