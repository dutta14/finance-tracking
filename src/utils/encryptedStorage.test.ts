import { describe, it, expect, beforeEach } from 'vitest'
import { SENSITIVE_KEYS, isSensitiveKey, rawRead, rawWrite, remove } from './encryptedStorage'

beforeEach(() => {
  localStorage.clear()
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
  it('removes a key from localStorage', () => {
    rawWrite('darkMode', 'true')
    remove('darkMode')
    expect(rawRead('darkMode')).toBeNull()
  })
})
