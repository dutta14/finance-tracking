import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useTaxStore } from './useTaxStore'
import { MemoryFileStore } from '../../utils/memoryFileStore'
import { FileStoreTestProvider } from '../../test/fileStoreTestUtils'
import { taxFilePath, taxYearPath } from './types'
import type { TaxYear } from './types'
import type { ReactNode } from 'react'

function makeWrapper(store: MemoryFileStore) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <FileStoreTestProvider store={store}>{children}</FileStoreTestProvider>
  )
  Wrapper.displayName = 'Wrapper'
  return Wrapper
}

let store: MemoryFileStore

beforeEach(() => {
  store = new MemoryFileStore()
})

describe('useTaxStore', () => {
  describe('initial state', () => {
    it('starts with empty store when nothing in file store', async () => {
      const { result } = renderHook(() => useTaxStore(), { wrapper: makeWrapper(store) })
      await waitFor(() => {
        expect(result.current.allYears).toEqual([])
        expect(result.current.store.years).toEqual({})
      })
    })

    it('loads existing data from file store', async () => {
      await store.writeJSON('taxes/2024.json', {
        items: [{ id: '1', label: 'W-2', owner: 'primary', category: 'paystub', accountIds: [], files: [] }],
      })
      const { result } = renderHook(() => useTaxStore(), { wrapper: makeWrapper(store) })
      await waitFor(() => {
        expect(result.current.allYears).toEqual([2024])
        expect(result.current.getYear(2024).items).toHaveLength(1)
      })
    })

    it('normalizes missing years field to EMPTY_STORE', async () => {
      await store.writeJSON('taxes/2024.json', { items: 'bad' })
      const { result } = renderHook(() => useTaxStore(), { wrapper: makeWrapper(store) })
      // malformed year file → empty year
      await waitFor(() => {
        expect(result.current.getYear(2024).items).toEqual([])
      })
    })
  })

  describe('getYear', () => {
    it('returns empty year for non-existent year', async () => {
      const { result } = renderHook(() => useTaxStore(), { wrapper: makeWrapper(store) })
      await waitFor(() => expect(result.current.allYears).toBeDefined())
      expect(result.current.getYear(2099)).toEqual({ items: [] })
    })
  })

  describe('yearExists', () => {
    it('returns false for unknown year', async () => {
      const { result } = renderHook(() => useTaxStore(), { wrapper: makeWrapper(store) })
      await waitFor(() => expect(result.current.allYears).toBeDefined())
      expect(result.current.yearExists(2099)).toBe(false)
    })

    it('returns true after ensuring a year', async () => {
      const { result } = renderHook(() => useTaxStore(), { wrapper: makeWrapper(store) })
      await waitFor(() => expect(result.current.allYears).toBeDefined())
      act(() => result.current.ensureYear(2025))
      expect(result.current.yearExists(2025)).toBe(true)
    })
  })

  describe('ensureYear', () => {
    it('creates an empty year', async () => {
      const { result } = renderHook(() => useTaxStore(), { wrapper: makeWrapper(store) })
      await waitFor(() => expect(result.current.allYears).toBeDefined())
      act(() => result.current.ensureYear(2025))
      expect(result.current.getYear(2025)).toEqual({ items: [] })
      // Verify it was persisted to file store
      await waitFor(async () => {
        const stored = await store.readJSON(taxYearPath(2025), null)
        expect(stored).toBeTruthy()
      })
    })

    it('does not overwrite existing year', async () => {
      await store.writeJSON('taxes/2025.json', {
        items: [{ id: '1', label: 'W-2', owner: 'primary', category: 'paystub', accountIds: [], files: [] }],
      })
      const { result } = renderHook(() => useTaxStore(), { wrapper: makeWrapper(store) })
      await waitFor(() => expect(result.current.allYears).toContain(2025))
      act(() => result.current.ensureYear(2025))
      expect(result.current.getYear(2025).items).toHaveLength(1)
    })
  })

  describe('addItem / removeItem', () => {
    it('adds an item to a year', async () => {
      const { result } = renderHook(() => useTaxStore(), { wrapper: makeWrapper(store) })
      await waitFor(() => expect(result.current.allYears).toBeDefined())
      act(() => result.current.addItem(2025, 'W-2', 'primary', 'paystub'))
      const items = result.current.getYear(2025).items
      expect(items).toHaveLength(1)
      expect(items[0].label).toBe('W-2')
      expect(items[0].owner).toBe('primary')
      expect(items[0].category).toBe('paystub')
    })

    it('removes an item by id', async () => {
      const { result } = renderHook(() => useTaxStore(), { wrapper: makeWrapper(store) })
      await waitFor(() => expect(result.current.allYears).toBeDefined())
      let itemId: string
      act(() => {
        const item = result.current.addItem(2025, 'W-2', 'primary', 'paystub')
        itemId = item.id
      })
      act(() => result.current.removeItem(2025, itemId!))
      expect(result.current.getYear(2025).items).toHaveLength(0)
    })
  })

  describe('updateItem', () => {
    it('updates item fields', async () => {
      const { result } = renderHook(() => useTaxStore(), { wrapper: makeWrapper(store) })
      await waitFor(() => expect(result.current.allYears).toBeDefined())
      let itemId: string
      act(() => {
        const item = result.current.addItem(2025, 'W-2', 'primary', 'paystub')
        itemId = item.id
      })
      act(() => result.current.updateItem(2025, itemId!, { label: '1099', owner: 'partner' }))
      const item = result.current.getYear(2025).items[0]
      expect(item.label).toBe('1099')
      expect(item.owner).toBe('partner')
    })
  })

  describe('addFileToItemAsync', () => {
    it('writes binary content to taxes/{year}/files/{storedName} and strips content from metadata', async () => {
      const { result } = renderHook(() => useTaxStore(), { wrapper: makeWrapper(store) })
      await waitFor(() => expect(result.current.allYears).toBeDefined())
      let itemId: string
      await act(async () => {
        const item = result.current.addItem(2025, 'W-2', 'primary', 'paystub')
        itemId = item.id
      })
      // Ensure year 2025 is in state before attempting addFileToItemAsync
      await waitFor(() => expect(result.current.yearExists(2025)).toBe(true))

      // Use a standalone ArrayBuffer (not from TextEncoder which may use a pool)
      const bytes = new ArrayBuffer(8)
      new Uint8Array(bytes).set([112, 100, 102, 45, 98, 121, 116, 101]) // 'pdf-byte'
      await act(async () => {
        await result.current.addFileToItemAsync(
          2025,
          itemId!,
          {
            id: 'f1',
            name: 'w2.pdf',
            ext: 'pdf',
            content: undefined,
            uploadedAt: '2025-01-15',
          },
          bytes,
        )
      })

      const files = result.current.getYear(2025).items[0].files
      expect(files).toHaveLength(1)
      expect(files[0].content).toBeUndefined()
      expect(files[0].storedName).toBeTruthy()

      // Binary stored in FileStore — verify via hook API which uses same fileStore
      const storedPath = taxFilePath(2025, files[0].storedName!)
      const stored = await result.current.getFileContent(2025, files[0])
      // Also verify the file appears in the directory listing
      const listedFiles = await store.listFiles('taxes/2025/files')
      expect(listedFiles).toContain(files[0].storedName)
      expect(stored).not.toBeNull()
      expect(storedPath).toBe(`taxes/2025/files/${files[0].storedName}`)
    })

    it('handles file with no content (metadata-only link)', async () => {
      const { result } = renderHook(() => useTaxStore(), { wrapper: makeWrapper(store) })
      await waitFor(() => expect(result.current.allYears).toBeDefined())
      let itemId: string
      act(() => {
        const item = result.current.addItem(2025, 'W-2', 'primary', 'paystub')
        itemId = item.id
      })

      await act(async () => {
        await result.current.addFileToItemAsync(2025, itemId!, {
          id: 'f-no-content',
          name: 'w2.pdf',
          ext: 'pdf',
          content: undefined,
          uploadedAt: '2025-01-15',
        })
      })

      const files = result.current.getYear(2025).items[0].files
      expect(files).toHaveLength(1)
      expect(files[0].content).toBeUndefined()
    })

    it('persists year metadata to taxes/{year}.json without content', async () => {
      const { result } = renderHook(() => useTaxStore(), { wrapper: makeWrapper(store) })
      await waitFor(() => expect(result.current.allYears).toBeDefined())
      let itemId: string
      act(() => {
        const item = result.current.addItem(2025, 'W-2', 'primary', 'paystub')
        itemId = item.id
      })
      const bytes = new ArrayBuffer(8)
      await act(async () => {
        await result.current.addFileToItemAsync(
          2025,
          itemId!,
          {
            id: 'f-meta',
            name: 'doc.pdf',
            ext: 'pdf',
            content: undefined,
            uploadedAt: '2025-06-01',
          },
          bytes,
        )
      })

      await waitFor(async () => {
        const yearData = await store.readJSON<TaxYear | null>(taxYearPath(2025), null)
        const storedFile = yearData?.items?.[0]?.files?.[0]
        expect(storedFile?.name).toBe('doc.pdf')
        expect(storedFile?.content).toBeUndefined()
      })
    })
  })

  describe('removeFileFromItem', () => {
    it('removes the file from item state and deletes binary from FileStore', async () => {
      const { result } = renderHook(() => useTaxStore(), { wrapper: makeWrapper(store) })
      await waitFor(() => expect(result.current.allYears).toBeDefined())
      let itemId: string
      act(() => {
        const item = result.current.addItem(2025, 'W-2', 'primary', 'paystub')
        itemId = item.id
      })

      const bytes = new ArrayBuffer(8)
      await act(async () => {
        await result.current.addFileToItemAsync(
          2025,
          itemId!,
          {
            id: 'rm-file',
            name: 'w2.pdf',
            ext: 'pdf',
            content: undefined,
            uploadedAt: '2025-01-15',
          },
          bytes,
        )
      })

      const files = result.current.getYear(2025).items[0].files
      const storedName = files[0].storedName!
      const storedPath = taxFilePath(2025, storedName)
      expect(await store.exists(storedPath)).toBe(true)

      act(() => result.current.removeFileFromItem(2025, itemId!, 'rm-file'))
      expect(result.current.getYear(2025).items[0].files).toHaveLength(0)

      await waitFor(async () => {
        expect(await store.exists(storedPath)).toBe(false)
      })
    })
  })

  describe('deleteYear', () => {
    it('removes a year entirely from state', async () => {
      const { result } = renderHook(() => useTaxStore(), { wrapper: makeWrapper(store) })
      await waitFor(() => expect(result.current.allYears).toBeDefined())
      act(() => result.current.ensureYear(2025))
      act(() => result.current.deleteYear(2025))
      expect(result.current.yearExists(2025)).toBe(false)
      expect(result.current.allYears).not.toContain(2025)
    })

    it('deletes taxes/{year}.json and all associated binary files from FileStore', async () => {
      const { result } = renderHook(() => useTaxStore(), { wrapper: makeWrapper(store) })
      await waitFor(() => expect(result.current.allYears).toBeDefined())
      let itemId: string
      act(() => {
        const item = result.current.addItem(2025, 'W-2', 'primary', 'paystub')
        itemId = item.id
      })

      const bytes = new ArrayBuffer(8)
      await act(async () => {
        await result.current.addFileToItemAsync(
          2025,
          itemId!,
          {
            id: 'del-file',
            name: 'w2.pdf',
            ext: 'pdf',
            content: undefined,
            uploadedAt: '2025-01-15',
          },
          bytes,
        )
      })

      const files = result.current.getYear(2025).items[0].files
      const binaryPath = taxFilePath(2025, files[0].storedName!)
      expect(await store.exists(binaryPath)).toBe(true)

      act(() => result.current.deleteYear(2025))

      await waitFor(async () => {
        expect(await store.exists(taxYearPath(2025))).toBe(false)
        expect(await store.exists(binaryPath)).toBe(false)
      })
    })
  })

  describe('templates', () => {
    it('starts with empty templates', async () => {
      const { result } = renderHook(() => useTaxStore(), { wrapper: makeWrapper(store) })
      await waitFor(() => expect(result.current.templates).toEqual([]))
    })

    it('loads templates from file store', async () => {
      await store.writeJSON('taxes/templates.json', [{ id: 't1', name: 'Standard', items: [] }])
      const { result } = renderHook(() => useTaxStore(), { wrapper: makeWrapper(store) })
      await waitFor(() => expect(result.current.templates).toHaveLength(1))
      expect(result.current.templates[0].name).toBe('Standard')
    })

    it('saves a new template via saveAsTemplate', async () => {
      const { result } = renderHook(() => useTaxStore(), { wrapper: makeWrapper(store) })
      await waitFor(() => expect(result.current.templates).toEqual([]))
      act(() => {
        const item = result.current.addItem(2025, 'W-2', 'primary', 'paystub')
        void item
      })
      act(() => {
        result.current.saveAsTemplate('My Template', 2025)
      })
      expect(result.current.templates).toHaveLength(1)
      expect(result.current.templates[0].name).toBe('My Template')
    })

    it('creates a year from a template', async () => {
      await store.writeJSON('taxes/templates.json', [
        {
          id: 't1',
          name: 'Tmpl',
          items: [{ id: 'ti1', label: 'W-2', owner: 'primary', category: 'paystub', accountIds: [] }],
        },
      ])
      const { result } = renderHook(() => useTaxStore(), { wrapper: makeWrapper(store) })
      await waitFor(() => expect(result.current.templates).toHaveLength(1))
      const tmpl = result.current.templates[0]
      act(() => result.current.createYearFromTemplate(2030, tmpl))
      expect(result.current.getYear(2030).items).toHaveLength(1)
      expect(result.current.getYear(2030).items[0].label).toBe('W-2')
    })
  })
})
