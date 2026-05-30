/**
 * AES-256-GCM crypto utilities.
 *
 * Extracted from useGitHubSync so they can be reused by the
 * encrypted-storage layer and any future encryption consumers.
 */

// ── Types ──────────────────────────────────────────────────────

/** Ciphertext envelope persisted in localStorage. */
export interface EncryptedEnvelope {
  /** Schema version for future-proofing. */
  v: 1
  /** Base64-encoded 12-byte IV. */
  iv: string
  /** Base64-encoded ciphertext (AES-256-GCM output). */
  ct: string
}

// ── Base64 helpers ─────────────────────────────────────────────

export const bytesToB64 = (bytes: Uint8Array): string => {
  // Process in 32 KB chunks to avoid "Maximum call stack size exceeded"
  // when spreading large arrays into String.fromCharCode().
  const CHUNK = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

export const b64ToBytes = (b64: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(b64), c => c.charCodeAt(0))

// ── Key derivation ─────────────────────────────────────────────

/** Derive an AES-256-GCM CryptoKey from a passphrase + salt (PBKDF2, 310 000 iterations, SHA-256). */
export async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 310_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

// ── Encrypt / Decrypt ──────────────────────────────────────────

/** Encrypt an arbitrary string into an {@link EncryptedEnvelope}. A fresh 12-byte IV is generated per call. */
export async function encryptString(plaintext: string, key: CryptoKey): Promise<EncryptedEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext))
  return { v: 1, iv: bytesToB64(iv), ct: bytesToB64(new Uint8Array(ciphertext)) }
}

/** Decrypt an {@link EncryptedEnvelope} back to a plaintext string. */
export async function decryptString(envelope: EncryptedEnvelope, key: CryptoKey): Promise<string> {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(envelope.iv) },
    key,
    b64ToBytes(envelope.ct),
  )
  return new TextDecoder().decode(plaintext)
}

// ── JSON convenience wrappers ──────────────────────────────────

/** Encrypt a JSON-serializable value. */
export async function encryptObject<T>(obj: T, key: CryptoKey): Promise<EncryptedEnvelope> {
  return encryptString(JSON.stringify(obj), key)
}

/** Decrypt an envelope and parse the result as `T`. */
export async function decryptObject<T>(envelope: EncryptedEnvelope, key: CryptoKey): Promise<T> {
  const json = await decryptString(envelope, key)
  return JSON.parse(json) as T
}

// ── Envelope detection ─────────────────────────────────────────

/** Return `true` if `value` looks like a serialized {@link EncryptedEnvelope}. */
export function isEncryptedEnvelope(value: string): boolean {
  try {
    const parsed: unknown = JSON.parse(value)
    if (typeof parsed !== 'object' || parsed === null) return false
    const obj = parsed as Record<string, unknown>
    return obj.v === 1 && typeof obj.iv === 'string' && typeof obj.ct === 'string'
  } catch {
    return false
  }
}
