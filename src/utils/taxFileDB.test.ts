import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { deriveKey } from './crypto'
import {
  saveFileContent,
  getFileContent,
  deleteFileContent,
  deleteMultipleFiles,
  getAllFileContents,
  getStorageEstimate,
  migrateIDBToEncrypted,
  reencryptIDBContents,
  decryptIDBContents,
} from './taxFileDB'

const TEST_SALT = crypto.getRandomValues(new Uint8Array(16))
let testKey: CryptoKey

beforeEach(async () => {
  // Fresh IndexedDB for each test
  indexedDB = new IDBFactory()
  testKey = await deriveKey('test-passphrase', TEST_SALT)
})

describe('taxFileDB', () => {
  describe('saveFileContent + getFileContent round-trip', () => {
    it('stores and retrieves base64 content by file ID', async () => {
      await saveFileContent('file-1', 'data:application/pdf;base64,abc123')
      const content = await getFileContent('file-1')
      expect(content).toBe('data:application/pdf;base64,abc123')
    })

    it('returns null for a non-existent file', async () => {
      const content = await getFileContent('does-not-exist')
      expect(content).toBeNull()
    })

    it('overwrites existing content when saving the same ID', async () => {
      await saveFileContent('file-1', 'original')
      await saveFileContent('file-1', 'updated')
      const content = await getFileContent('file-1')
      expect(content).toBe('updated')
    })

    it('stores multiple files independently', async () => {
      await saveFileContent('a', 'content-a')
      await saveFileContent('b', 'content-b')
      expect(await getFileContent('a')).toBe('content-a')
      expect(await getFileContent('b')).toBe('content-b')
    })
  })

  describe('encrypted saveFileContent + getFileContent round-trip', () => {
    it('encrypts on save and decrypts on get', async () => {
      await saveFileContent('enc-1', 'data:application/pdf;base64,secret', testKey)
      const content = await getFileContent('enc-1', testKey)
      expect(content).toBe('data:application/pdf;base64,secret')
    })

    it('stores content as an encrypted envelope in IDB', async () => {
      await saveFileContent('enc-2', 'plaintext-data', testKey)
      // Reading without key should throw — proving it's stored encrypted
      await expect(getFileContent('enc-2')).rejects.toThrow('crypto key')
    })

    it('throws when reading encrypted content without a key', async () => {
      await saveFileContent('enc-3', 'secret-data', testKey)
      await expect(getFileContent('enc-3')).rejects.toThrow('Cannot read encrypted file content without a crypto key')
    })

    it('throws when reading encrypted content with null key', async () => {
      await saveFileContent('enc-4', 'secret-data', testKey)
      await expect(getFileContent('enc-4', null)).rejects.toThrow('crypto key')
    })

    it('handles plaintext content even when cryptoKey is provided', async () => {
      // Save without encryption, read with a key — should return plaintext
      await saveFileContent('plain-1', 'not-encrypted')
      const content = await getFileContent('plain-1', testKey)
      expect(content).toBe('not-encrypted')
    })

    it('round-trips large base64 data URLs', async () => {
      const largeContent = 'data:image/png;base64,' + 'A'.repeat(100_000)
      await saveFileContent('large-enc', largeContent, testKey)
      const result = await getFileContent('large-enc', testKey)
      expect(result).toBe(largeContent)
    })

    it('does not encrypt when cryptoKey is null', async () => {
      await saveFileContent('no-enc', 'plain-data', null)
      const content = await getFileContent('no-enc')
      expect(content).toBe('plain-data')
    })

    it('does not encrypt when cryptoKey is undefined', async () => {
      await saveFileContent('no-enc-2', 'plain-data', undefined)
      const content = await getFileContent('no-enc-2')
      expect(content).toBe('plain-data')
    })
  })

  describe('deleteFileContent', () => {
    it('removes a previously stored file', async () => {
      await saveFileContent('file-1', 'data')
      await deleteFileContent('file-1')
      const content = await getFileContent('file-1')
      expect(content).toBeNull()
    })

    it('does not throw when deleting a non-existent file', async () => {
      await expect(deleteFileContent('ghost')).resolves.toBeUndefined()
    })

    it('does not affect other stored files', async () => {
      await saveFileContent('keep', 'keep-data')
      await saveFileContent('remove', 'remove-data')
      await deleteFileContent('remove')
      expect(await getFileContent('keep')).toBe('keep-data')
      expect(await getFileContent('remove')).toBeNull()
    })
  })

  describe('deleteMultipleFiles', () => {
    it('batch-deletes multiple files in one transaction', async () => {
      await saveFileContent('f1', 'data1')
      await saveFileContent('f2', 'data2')
      await saveFileContent('f3', 'data3')
      await deleteMultipleFiles(['f1', 'f3'])
      expect(await getFileContent('f1')).toBeNull()
      expect(await getFileContent('f2')).toBe('data2')
      expect(await getFileContent('f3')).toBeNull()
    })

    it('handles empty array without error', async () => {
      await expect(deleteMultipleFiles([])).resolves.toBeUndefined()
    })

    it('handles IDs that do not exist without error', async () => {
      await saveFileContent('f1', 'data1')
      await expect(deleteMultipleFiles(['nonexistent', 'also-missing'])).resolves.toBeUndefined()
      expect(await getFileContent('f1')).toBe('data1')
    })
  })

  describe('getAllFileContents', () => {
    it('returns an empty map when store is empty', async () => {
      const map = await getAllFileContents()
      expect(map.size).toBe(0)
    })

    it('returns all stored file ID → content pairs', async () => {
      await saveFileContent('f1', 'aaa')
      await saveFileContent('f2', 'bbb')
      await saveFileContent('f3', 'ccc')
      const map = await getAllFileContents()
      expect(map.size).toBe(3)
      expect(map.get('f1')).toBe('aaa')
      expect(map.get('f2')).toBe('bbb')
      expect(map.get('f3')).toBe('ccc')
    })

    it('reflects deletions', async () => {
      await saveFileContent('f1', 'data')
      await deleteFileContent('f1')
      const map = await getAllFileContents()
      expect(map.size).toBe(0)
    })

    it('decrypts all encrypted records', async () => {
      await saveFileContent('e1', 'secret-1', testKey)
      await saveFileContent('e2', 'secret-2', testKey)
      const map = await getAllFileContents(testKey)
      expect(map.size).toBe(2)
      expect(map.get('e1')).toBe('secret-1')
      expect(map.get('e2')).toBe('secret-2')
    })

    it('handles mixed state (some encrypted, some plaintext)', async () => {
      await saveFileContent('plain', 'plain-content')
      await saveFileContent('encrypted', 'encrypted-content', testKey)
      const map = await getAllFileContents(testKey)
      expect(map.size).toBe(2)
      expect(map.get('plain')).toBe('plain-content')
      expect(map.get('encrypted')).toBe('encrypted-content')
    })

    it('throws when encrypted records exist but no key provided', async () => {
      await saveFileContent('enc', 'data', testKey)
      await expect(getAllFileContents()).rejects.toThrow('crypto key')
    })
  })

  describe('getStorageEstimate', () => {
    it('returns usedMB and quotaMB as numbers', async () => {
      const est = await getStorageEstimate()
      expect(typeof est.usedMB).toBe('number')
      expect(typeof est.quotaMB).toBe('number')
      expect(est.usedMB).toBeGreaterThanOrEqual(0)
      expect(est.quotaMB).toBeGreaterThanOrEqual(0)
    })

    it('usedMB increases after storing content', async () => {
      const before = await getStorageEstimate()
      const largeContent = 'x'.repeat(1024 * 1024) // ~1 MB
      await saveFileContent('big', largeContent)
      const after = await getStorageEstimate()
      expect(after.usedMB).toBeGreaterThan(before.usedMB)
    })
  })

  describe('migrateIDBToEncrypted', () => {
    it('encrypts all plaintext records', async () => {
      await saveFileContent('m1', 'plain-1')
      await saveFileContent('m2', 'plain-2')

      await migrateIDBToEncrypted(testKey)

      // Verify data integrity via decrypted read
      expect(await getFileContent('m1', testKey)).toBe('plain-1')
      expect(await getFileContent('m2', testKey)).toBe('plain-2')

      // Verify the raw stored data is an encrypted envelope
      await expect(getFileContent('m1')).rejects.toThrow('crypto key')
    })

    it('skips already-encrypted records (idempotent)', async () => {
      await saveFileContent('pre-enc', 'pre-encrypted-data', testKey)
      await saveFileContent('plain', 'plain-data')

      await migrateIDBToEncrypted(testKey)

      expect(await getFileContent('pre-enc', testKey)).toBe('pre-encrypted-data')
      expect(await getFileContent('plain', testKey)).toBe('plain-data')
    })

    it('handles empty IDB without error', async () => {
      await expect(migrateIDBToEncrypted(testKey)).resolves.toBeUndefined()
    })

    it('handles IDB with only encrypted records', async () => {
      await saveFileContent('enc', 'data', testKey)
      await expect(migrateIDBToEncrypted(testKey)).resolves.toBeUndefined()
      expect(await getFileContent('enc', testKey)).toBe('data')
    })
  })

  describe('reencryptIDBContents', () => {
    it('re-encrypts all records with a new key', async () => {
      await saveFileContent('r1', 'data-1', testKey)
      await saveFileContent('r2', 'data-2', testKey)

      const newKey = await deriveKey('new-passphrase', crypto.getRandomValues(new Uint8Array(16)))
      await reencryptIDBContents(testKey, newKey)

      // Old key should no longer work
      await expect(getFileContent('r1', testKey)).rejects.toThrow()

      // New key should work
      expect(await getFileContent('r1', newKey)).toBe('data-1')
      expect(await getFileContent('r2', newKey)).toBe('data-2')
    })

    it('skips plaintext records', async () => {
      await saveFileContent('plain', 'plain-data')
      await saveFileContent('enc', 'enc-data', testKey)

      const newKey = await deriveKey('new-passphrase', crypto.getRandomValues(new Uint8Array(16)))
      await reencryptIDBContents(testKey, newKey)

      // Plaintext should still be readable without any key
      expect(await getFileContent('plain')).toBe('plain-data')
      // Encrypted should now use new key
      expect(await getFileContent('enc', newKey)).toBe('enc-data')
    })

    it('handles empty IDB without error', async () => {
      const newKey = await deriveKey('new', crypto.getRandomValues(new Uint8Array(16)))
      await expect(reencryptIDBContents(testKey, newKey)).resolves.toBeUndefined()
    })
  })

  describe('decryptIDBContents', () => {
    it('decrypts all encrypted records back to plaintext', async () => {
      await saveFileContent('d1', 'secret-1', testKey)
      await saveFileContent('d2', 'secret-2', testKey)

      await decryptIDBContents(testKey)

      // Should now be readable without any key
      expect(await getFileContent('d1')).toBe('secret-1')
      expect(await getFileContent('d2')).toBe('secret-2')
    })

    it('skips plaintext records', async () => {
      await saveFileContent('plain', 'plain-data')
      await saveFileContent('enc', 'enc-data', testKey)

      await decryptIDBContents(testKey)

      expect(await getFileContent('plain')).toBe('plain-data')
      expect(await getFileContent('enc')).toBe('enc-data')
    })

    it('handles empty IDB without error', async () => {
      await expect(decryptIDBContents(testKey)).resolves.toBeUndefined()
    })
  })
})
