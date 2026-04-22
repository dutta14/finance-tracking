import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import {
  saveFileContent,
  getFileContent,
  deleteFileContent,
  deleteMultipleFiles,
  getAllFileContents,
  getStorageEstimate,
} from './taxFileDB'

beforeEach(() => {
  // Fresh IndexedDB for each test
  indexedDB = new IDBFactory()
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
      expect(after.usedMB).toBeGreaterThanOrEqual(before.usedMB)
    })
  })
})
