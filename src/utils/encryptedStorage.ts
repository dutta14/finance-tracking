/**
 * Encrypted storage utilities.
 *
 * This module provides the SENSITIVE_KEYS list and helper functions used by
 * appStorage.ts, migratePlaintext.ts, and the ESLint rule.
 *
 * The v1 async get/set/getMany/setMany functions have been replaced by
 * appStorage's synchronous memory-backed API.
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

// Re-export crypto utilities needed by migratePlaintext
export { encryptString, decryptString, isEncryptedEnvelope }
export type { EncryptedEnvelope }
