/**
 * Encrypted localStorage wrapper.
 *
 * Provides transparent AES-256-GCM encryption for the 13 sensitive
 * data keys while passing non-sensitive keys through as plain JSON.
 *
 * When encryption is NOT enabled (no CryptoKey), all operations fall
 * through to plain JSON localStorage — fully backward compatible.
 */

import type { EncryptedEnvelope } from './crypto'
import { encryptString, decryptString, isEncryptedEnvelope } from './crypto'

// ── Sensitive keys ─────────────────────────────────────────────

export const SENSITIVE_KEYS: readonly string[] = [
  'user-profile',
  'data-accounts',
  'data-balances',
  'budget-store',
  'budget-summary',
  'budget-config',
  'tax-store',
  'tax-templates',
  'financialGoals',
  'gw-goals',
  'fi-simulations',
  'allocation-custom-ratios',
  'sgt-overrides',
] as const

const sensitiveSet = new Set<string>(SENSITIVE_KEYS)

/** Check whether a localStorage key holds sensitive data that should be encrypted. */
export function isSensitiveKey(key: string): boolean {
  return sensitiveSet.has(key)
}

// ── Single-value operations ────────────────────────────────────

/**
 * Read a value from localStorage, decrypting if needed.
 *
 * - `cryptoKey` null + sensitive key → returns `null` (encrypted data unreadable)
 * - `cryptoKey` null + non-sensitive key → reads plaintext normally
 * - `cryptoKey` provided + sensitive key → decrypts and parses JSON
 * - `cryptoKey` provided + non-sensitive key → reads plaintext normally
 */
export async function get<T>(key: string, cryptoKey: CryptoKey | null): Promise<T | null> {
  const raw = localStorage.getItem(key)
  if (raw === null) return null

  if (isSensitiveKey(key)) {
    if (cryptoKey === null) return null
    if (isEncryptedEnvelope(raw)) {
      const envelope: EncryptedEnvelope = JSON.parse(raw)
      const plaintext = await decryptString(envelope, cryptoKey)
      return JSON.parse(plaintext) as T
    }
    // Not encrypted yet — return plain value (migration path)
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/**
 * Write a value to localStorage, encrypting if needed.
 *
 * - Sensitive key without `cryptoKey` → throws (caller must provide a key or skip)
 * - Non-sensitive key → plain JSON write regardless of `cryptoKey`
 */
export async function set<T>(key: string, value: T, cryptoKey: CryptoKey | null): Promise<void> {
  if (isSensitiveKey(key)) {
    if (cryptoKey === null) {
      throw new Error(`Cannot write sensitive key "${key}" without a CryptoKey`)
    }
    const json = JSON.stringify(value)
    const envelope = await encryptString(json, cryptoKey)
    localStorage.setItem(key, JSON.stringify(envelope))
    return
  }

  localStorage.setItem(key, JSON.stringify(value))
}

// ── Batch operations ───────────────────────────────────────────

/** Read multiple keys in parallel. Missing or unreadable values are omitted from the result. */
export async function getMany(keys: string[], cryptoKey: CryptoKey | null): Promise<Map<string, unknown>> {
  const results = await Promise.all(keys.map(async k => [k, await get(k, cryptoKey)] as const))
  const map = new Map<string, unknown>()
  for (const [k, v] of results) {
    if (v !== null) map.set(k, v)
  }
  return map
}

/** Write multiple key-value pairs. All sensitive keys require a `cryptoKey`. */
export async function setMany(entries: Array<[string, unknown]>, cryptoKey: CryptoKey | null): Promise<void> {
  await Promise.all(entries.map(([k, v]) => set(k, v, cryptoKey)))
}

// ── Raw / unencrypted passthrough ──────────────────────────────

/** Raw read — no decryption, no JSON parse. For backup, migration, etc. */
export function rawRead(key: string): string | null {
  return localStorage.getItem(key)
}

/** Raw write — no encryption, no JSON stringify. */
export function rawWrite(key: string, value: string): void {
  localStorage.setItem(key, value)
}

/** Remove a key from localStorage. */
export function remove(key: string): void {
  localStorage.removeItem(key)
}
