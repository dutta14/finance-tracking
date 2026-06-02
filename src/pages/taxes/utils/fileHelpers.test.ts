import { describe, it, expect } from 'vitest'
import { nextFileId, fileToBase64 } from './fileHelpers'

describe('fileHelpers', () => {
  describe('nextFileId', () => {
    it('returns a string starting with f', () => {
      const id = nextFileId()
      expect(id).toMatch(/^f\d+-.{5}$/)
    })

    it('returns unique values on successive calls', () => {
      const ids = new Set(Array.from({ length: 100 }, () => nextFileId()))
      expect(ids.size).toBe(100)
    })
  })

  describe('fileToBase64', () => {
    it('reads a file and returns data URL string', async () => {
      const content = 'hello world'
      const file = new File([content], 'test.txt', { type: 'text/plain' })
      const result = await fileToBase64(file)
      expect(result).toContain('data:text/plain;base64,')
    })

    it('rejects on reader error', async () => {
      const file = new File([], 'empty.txt', { type: 'text/plain' })
      const OriginalFileReader = globalThis.FileReader

      class MockFileReader {
        onerror: ((ev: unknown) => void) | null = null
        onload: (() => void) | null = null
        result: string | null = null
        readAsDataURL() {
          setTimeout(() => {
            if (this.onerror) this.onerror(new ProgressEvent('error'))
          }, 0)
        }
      }

      globalThis.FileReader = MockFileReader as unknown as typeof FileReader
      const promise = fileToBase64(file)
      await expect(promise).rejects.toBeInstanceOf(ProgressEvent)
      globalThis.FileReader = OriginalFileReader
    })
  })
})
