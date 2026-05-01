/**
 * IndexedDB storage for tax document file content (base64 data URLs).
 *
 * Metadata (file name, ext, uploadedAt) stays in localStorage via useTaxStore.
 * Only binary content lives here, giving us GB+ storage vs the 5-10 MB
 * localStorage quota.
 *
 * When a CryptoKey is provided, content is encrypted at rest using AES-256-GCM
 * via the shared crypto module. Functions gracefully handle mixed state (some
 * records encrypted, some plaintext) during migration.
 */

import { encryptString, decryptString, isEncryptedEnvelope } from './crypto'
import type { EncryptedEnvelope } from './crypto'

const DB_NAME = 'finance-tracking-files'
const STORE_NAME = 'tax-files'
export const DB_VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Read all records from IDB without decryption (internal helper) */
async function getAllRawRecords(): Promise<{ id: string; content: string }[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => {
      db.close()
      resolve(req.result as { id: string; content: string }[])
    }
    req.onerror = () => {
      db.close()
      reject(req.error)
    }
  })
}

/** Batch-write records to IDB (internal helper) */
async function putManyRecords(records: { id: string; content: string }[]): Promise<void> {
  if (records.length === 0) return
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    for (const record of records) store.put(record)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

/** Store base64 content by file ID. Encrypts if `cryptoKey` is provided. */
export async function saveFileContent(id: string, content: string, cryptoKey?: CryptoKey | null): Promise<void> {
  let stored = content
  if (cryptoKey) {
    const envelope = await encryptString(content, cryptoKey)
    stored = JSON.stringify(envelope)
  }
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put({ id, content: stored })
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

/** Retrieve base64 content by file ID. Decrypts automatically if the stored value is an encrypted envelope. */
export async function getFileContent(id: string, cryptoKey?: CryptoKey | null): Promise<string | null> {
  const db = await openDB()
  const raw = await new Promise<string | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(id)
    req.onsuccess = () => {
      db.close()
      resolve(req.result ? (req.result as { id: string; content: string }).content : null)
    }
    req.onerror = () => {
      db.close()
      reject(req.error)
    }
  })
  if (raw === null) return null
  if (isEncryptedEnvelope(raw)) {
    if (!cryptoKey) {
      throw new Error('Cannot read encrypted file content without a crypto key. Unlock encryption first.')
    }
    const envelope: EncryptedEnvelope = JSON.parse(raw)
    return decryptString(envelope, cryptoKey)
  }
  return raw
}

/** Remove a single file from IndexedDB */
export async function deleteFileContent(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

/** Batch-delete multiple files */
export async function deleteMultipleFiles(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    for (const id of ids) store.delete(id)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

/** Get all stored file contents, decrypting any encrypted records. */
export async function getAllFileContents(cryptoKey?: CryptoKey | null): Promise<Map<string, string>> {
  const records = await getAllRawRecords()
  const map = new Map<string, string>()
  for (const row of records) {
    if (isEncryptedEnvelope(row.content)) {
      if (!cryptoKey) {
        throw new Error('Cannot read encrypted file content without a crypto key. Unlock encryption first.')
      }
      const envelope: EncryptedEnvelope = JSON.parse(row.content)
      map.set(row.id, await decryptString(envelope, cryptoKey))
    } else {
      map.set(row.id, row.content)
    }
  }
  return map
}

/** Estimate storage usage for the UI indicator */
export async function getStorageEstimate(): Promise<{ usedMB: number; quotaMB: number }> {
  if (navigator.storage?.estimate) {
    const est = await navigator.storage.estimate()
    return {
      usedMB: Math.round(((est.usage ?? 0) / (1024 * 1024)) * 10) / 10,
      quotaMB: Math.round(((est.quota ?? 0) / (1024 * 1024)) * 10) / 10,
    }
  }
  // Fallback: sum up raw stored content sizes (works regardless of encryption state)
  const records = await getAllRawRecords()
  let bytes = 0
  for (const row of records) bytes += row.content.length
  return { usedMB: Math.round((bytes / (1024 * 1024)) * 10) / 10, quotaMB: 0 }
}

// ── Encryption lifecycle operations ──────────────────────────────

/** Migrate all plaintext IDB records to encrypted. Skips already-encrypted records. */
export async function migrateIDBToEncrypted(cryptoKey: CryptoKey): Promise<void> {
  const records = await getAllRawRecords()
  const toUpdate: { id: string; content: string }[] = []
  for (const record of records) {
    if (!isEncryptedEnvelope(record.content)) {
      const envelope = await encryptString(record.content, cryptoKey)
      toUpdate.push({ id: record.id, content: JSON.stringify(envelope) })
    }
  }
  await putManyRecords(toUpdate)
}

/** Re-encrypt all IDB records with a new key (passphrase change). */
export async function reencryptIDBContents(oldKey: CryptoKey, newKey: CryptoKey): Promise<void> {
  const records = await getAllRawRecords()
  const toUpdate: { id: string; content: string }[] = []
  for (const record of records) {
    if (isEncryptedEnvelope(record.content)) {
      const envelope: EncryptedEnvelope = JSON.parse(record.content)
      const plaintext = await decryptString(envelope, oldKey)
      const newEnvelope = await encryptString(plaintext, newKey)
      toUpdate.push({ id: record.id, content: JSON.stringify(newEnvelope) })
    }
  }
  await putManyRecords(toUpdate)
}

/** Decrypt all IDB records back to plaintext (disable encryption). */
export async function decryptIDBContents(cryptoKey: CryptoKey): Promise<void> {
  const records = await getAllRawRecords()
  const toUpdate: { id: string; content: string }[] = []
  for (const record of records) {
    if (isEncryptedEnvelope(record.content)) {
      const envelope: EncryptedEnvelope = JSON.parse(record.content)
      const plaintext = await decryptString(envelope, cryptoKey)
      toUpdate.push({ id: record.id, content: plaintext })
    }
  }
  await putManyRecords(toUpdate)
}
