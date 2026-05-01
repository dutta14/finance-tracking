/**
 * One-time plaintext-to-encrypted migration.
 *
 * Called once during setupEncryption() when a user first enables encryption.
 * All 13 SENSITIVE_KEYS may hold plaintext JSON in localStorage — this module
 * migrates them to encrypted envelopes atomically.
 *
 * Strategy:
 * 1. Set `encryption-migration-in-progress` sentinel
 * 2. For each sensitive key: read plaintext, encrypt, write to `_enc_<key>`
 * 3. Verify: decrypt each temp key, compare to original plaintext
 * 4. Swap: delete originals, rename temp keys to originals
 * 5. Remove `encryption-migration-in-progress` sentinel
 *
 * If the app starts and finds `encryption-migration-in-progress` without
 * `encryption-enabled`, the migration was interrupted — clean up and let
 * the user retry from Settings.
 */

import { encryptString, decryptString, isEncryptedEnvelope } from './crypto'
import type { EncryptedEnvelope } from './crypto'
import { SENSITIVE_KEYS } from './encryptedStorage'
import { migrateIDBToEncrypted } from './taxFileDB'

const LS_MIGRATION = 'encryption-migration-in-progress'
const LS_ENABLED = 'encryption-enabled'
const TEMP_PREFIX = '_enc_'

function tempKey(key: string): string {
  return `${TEMP_PREFIX}${key}`
}

/** Remove all `_enc_*` temp keys for our sensitive keys. */
function cleanupTempKeys(): void {
  for (const key of SENSITIVE_KEYS) {
    localStorage.removeItem(tempKey(key))
  }
}

/**
 * Migrates all plaintext sensitive keys to encrypted envelopes.
 *
 * Idempotent: skips keys that are already encrypted or don't exist.
 * Atomic: writes to temp keys first, verifies all, then swaps.
 */
export async function migratePlaintextToEncrypted(cryptoKey: CryptoKey): Promise<void> {
  // 1. Set migration sentinel
  localStorage.setItem(LS_MIGRATION, '1')

  // Track which keys we actually migrated (have temp keys for)
  const migratedKeys: string[] = []

  try {
    // 2. For each sensitive key: read, encrypt to temp key
    for (const key of SENSITIVE_KEYS) {
      const raw = localStorage.getItem(key)

      // Skip missing keys (no data yet)
      if (raw === null) continue

      // Skip already-encrypted keys (idempotent)
      if (isEncryptedEnvelope(raw)) continue

      // Value is plaintext — encrypt and write to temp key
      const envelope = await encryptString(raw, cryptoKey)
      localStorage.setItem(tempKey(key), JSON.stringify(envelope))
      migratedKeys.push(key)
    }

    // 3. Verify: decrypt each temp key and compare to original plaintext
    for (const key of migratedKeys) {
      const original = localStorage.getItem(key)!
      const tempRaw = localStorage.getItem(tempKey(key))!
      const envelope: EncryptedEnvelope = JSON.parse(tempRaw)
      const decrypted = await decryptString(envelope, cryptoKey)

      if (decrypted !== original) {
        throw new Error(`Verification failed for key "${key}": decrypted value does not match original`)
      }
    }

    // 4. Swap: delete originals, rename temp keys to originals
    for (const key of migratedKeys) {
      const encryptedValue = localStorage.getItem(tempKey(key))!
      localStorage.removeItem(key)
      localStorage.setItem(key, encryptedValue)
      localStorage.removeItem(tempKey(key))
    }
  } catch (error) {
    // Abort: clean up all temp keys, remove sentinel
    cleanupTempKeys()
    localStorage.removeItem(LS_MIGRATION)
    throw error
  }

  // 5. Encrypt any plaintext IndexedDB records (tax file content)
  await migrateIDBToEncrypted(cryptoKey)

  // 6. Remove migration sentinel (caller sets encryption-enabled)
  localStorage.removeItem(LS_MIGRATION)
}

/**
 * Checks if a partial migration needs recovery.
 * Called on app start from EncryptionContext.
 */
export function isMigrationIncomplete(): boolean {
  return localStorage.getItem(LS_MIGRATION) === '1'
}

/**
 * Recovers from an interrupted migration.
 *
 * - If `encryption-enabled` is set → migration actually completed; just clean sentinel.
 * - Otherwise → migration was interrupted; clean up temp keys and sentinel.
 */
export function recoverMigration(): void {
  if (!isMigrationIncomplete()) return

  if (localStorage.getItem(LS_ENABLED) === '1') {
    // Migration completed successfully — just clean up sentinel
    localStorage.removeItem(LS_MIGRATION)
    return
  }

  // Migration was interrupted — clean up temp keys and sentinel
  cleanupTempKeys()
  localStorage.removeItem(LS_MIGRATION)
}
