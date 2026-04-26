import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import 'fake-indexeddb/auto'
import { useTaxStore } from './useTaxStore'
import { getFileContent } from '../../utils/taxFileDB'

beforeEach(() => {
  localStorage.clear()
  // Reset IndexedDB between tests
  indexedDB = new IDBFactory()
})

describe('useTaxStore', () => {
  describe('initial state', () => {
    it('starts with empty store when nothing in localStorage', () => {
      const { result } = renderHook(() => useTaxStore())
      expect(result.current.allYears).toEqual([])
      expect(result.current.store.years).toEqual({})
    })

    it('loads existing data from localStorage', () => {
      localStorage.setItem(
        'tax-store',
        JSON.stringify({
          years: {
            2024: {
              items: [{ id: '1', label: 'W-2', owner: 'primary', category: 'paystub', accountIds: [], files: [] }],
            },
          },
        }),
      )
      const { result } = renderHook(() => useTaxStore())
      expect(result.current.allYears).toEqual([2024])
      expect(result.current.getYear(2024).items).toHaveLength(1)
    })
  })

  describe('getYear', () => {
    it('returns empty year for non-existent year', () => {
      const { result } = renderHook(() => useTaxStore())
      expect(result.current.getYear(2099)).toEqual({ items: [] })
    })
  })

  describe('yearExists', () => {
    it('returns false for unknown year', () => {
      const { result } = renderHook(() => useTaxStore())
      expect(result.current.yearExists(2099)).toBe(false)
    })

    it('returns true after ensuring a year', () => {
      const { result } = renderHook(() => useTaxStore())
      act(() => result.current.ensureYear(2025))
      expect(result.current.yearExists(2025)).toBe(true)
    })
  })

  describe('ensureYear', () => {
    it('creates an empty year', () => {
      const { result } = renderHook(() => useTaxStore())
      act(() => result.current.ensureYear(2025))
      expect(result.current.getYear(2025)).toEqual({ items: [] })
      // Should persist to localStorage
      const stored = JSON.parse(localStorage.getItem('tax-store')!)
      expect(stored.years['2025']).toBeTruthy()
    })

    it('does not overwrite existing year', () => {
      const { result } = renderHook(() => useTaxStore())
      act(() => result.current.addItem(2025, 'W-2', 'primary', 'paystub'))
      act(() => result.current.ensureYear(2025))
      expect(result.current.getYear(2025).items).toHaveLength(1)
    })
  })

  describe('addItem / removeItem', () => {
    it('adds an item to a year', () => {
      const { result } = renderHook(() => useTaxStore())
      act(() => result.current.addItem(2025, 'W-2', 'primary', 'paystub'))
      const items = result.current.getYear(2025).items
      expect(items).toHaveLength(1)
      expect(items[0].label).toBe('W-2')
      expect(items[0].owner).toBe('primary')
      expect(items[0].category).toBe('paystub')
    })

    it('removes an item by id', () => {
      const { result } = renderHook(() => useTaxStore())
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
    it('updates item fields', () => {
      const { result } = renderHook(() => useTaxStore())
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

  describe('addFileToItem / removeFileFromItem', () => {
    it('adds a file to a checklist item and strips content from localStorage', () => {
      const { result } = renderHook(() => useTaxStore())
      let itemId: string
      act(() => {
        const item = result.current.addItem(2025, 'W-2', 'primary', 'paystub')
        itemId = item.id
      })
      act(() => {
        result.current.addFileToItem(2025, itemId!, {
          id: 'f1',
          name: 'w2.pdf',
          content: 'base64data',
          ext: 'pdf',
          uploadedAt: '2025-01-15',
        })
      })
      const files = result.current.getYear(2025).items[0].files
      expect(files).toHaveLength(1)
      expect(files[0].name).toBe('w2.pdf')
      // Content should be stripped from localStorage
      expect(files[0].content).toBeUndefined()
      const stored = JSON.parse(localStorage.getItem('tax-store')!)
      expect(stored.years['2025'].items[0].files[0].content).toBeUndefined()
    })

    it('removes a file from a checklist item', () => {
      const { result } = renderHook(() => useTaxStore())
      let itemId: string
      act(() => {
        const item = result.current.addItem(2025, 'W-2', 'primary', 'paystub')
        itemId = item.id
      })
      act(() => {
        result.current.addFileToItem(2025, itemId!, {
          id: 'f1',
          name: 'w2.pdf',
          content: 'data',
          ext: 'pdf',
          uploadedAt: '2025-01-15',
        })
      })
      act(() => result.current.removeFileFromItem(2025, itemId!, 'f1'))
      expect(result.current.getYear(2025).items[0].files).toHaveLength(0)
    })
  })

  describe('addFileToItemAsync', () => {
    it('saves content to IndexedDB and strips it from localStorage', async () => {
      const { result } = renderHook(() => useTaxStore())
      let itemId: string
      act(() => {
        const item = result.current.addItem(2025, 'W-2', 'primary', 'paystub')
        itemId = item.id
      })
      await act(async () => {
        await result.current.addFileToItemAsync(2025, itemId!, {
          id: 'f-async',
          name: 'w2.pdf',
          content: 'base64-async-data',
          ext: 'pdf',
          uploadedAt: '2025-01-15',
        })
      })
      const files = result.current.getYear(2025).items[0].files
      expect(files).toHaveLength(1)
      expect(files[0].content).toBeUndefined()
      // Content should be in IndexedDB
      const idbContent = await getFileContent('f-async')
      expect(idbContent).toBe('base64-async-data')
    })

    it('handles file with undefined content gracefully', async () => {
      const { result } = renderHook(() => useTaxStore())
      let itemId: string
      act(() => {
        const item = result.current.addItem(2025, 'W-2', 'primary', 'paystub')
        itemId = item.id
      })
      await act(async () => {
        await result.current.addFileToItemAsync(2025, itemId!, {
          id: 'f-no-content',
          name: 'w2.pdf',
          content: undefined,
          ext: 'pdf',
          uploadedAt: '2025-01-15',
        })
      })
      const files = result.current.getYear(2025).items[0].files
      expect(files).toHaveLength(1)
      expect(files[0].content).toBeUndefined()
      // Nothing stored in IndexedDB
      expect(await getFileContent('f-no-content')).toBeNull()
    })

    it('stores metadata in localStorage without content', async () => {
      const { result } = renderHook(() => useTaxStore())
      let itemId: string
      act(() => {
        const item = result.current.addItem(2025, 'W-2', 'primary', 'paystub')
        itemId = item.id
      })
      await act(async () => {
        await result.current.addFileToItemAsync(2025, itemId!, {
          id: 'f-meta',
          name: 'doc.pdf',
          content: 'secret-base64',
          ext: 'pdf',
          uploadedAt: '2025-06-01',
        })
      })
      const stored = JSON.parse(localStorage.getItem('tax-store')!)
      const storedFile = stored.years['2025'].items[0].files[0]
      expect(storedFile.id).toBe('f-meta')
      expect(storedFile.name).toBe('doc.pdf')
      expect(storedFile.content).toBeUndefined()
    })
  })

  describe('migration', () => {
    it('migrates inline content to IndexedDB on load', async () => {
      // Seed localStorage with old-style data (content inline)
      localStorage.setItem(
        'tax-store',
        JSON.stringify({
          years: {
            2025: {
              items: [
                {
                  id: 'item1',
                  label: 'W-2',
                  owner: 'primary',
                  category: 'paystub',
                  accountIds: [],
                  files: [{ id: 'mf1', name: 'w2.pdf', content: 'migrate-me', ext: 'pdf', uploadedAt: '2025-01-01' }],
                },
              ],
            },
          },
        }),
      )

      renderHook(() => useTaxStore())

      // Wait for async migration
      await act(async () => {
        await new Promise(r => setTimeout(r, 100))
      })

      // localStorage should no longer have content
      const stored = JSON.parse(localStorage.getItem('tax-store')!)
      expect(stored.years['2025'].items[0].files[0].content).toBeUndefined()

      // IndexedDB should have the content
      const idbContent = await getFileContent('mf1')
      expect(idbContent).toBe('migrate-me')
    })

    it('migrates multiple files across multiple years', async () => {
      localStorage.setItem(
        'tax-store',
        JSON.stringify({
          years: {
            2024: {
              items: [
                {
                  id: 'i1',
                  label: '1099',
                  owner: 'primary',
                  category: 'account',
                  accountIds: [],
                  files: [
                    { id: 'mf-2024', name: '1099.pdf', content: 'old-2024', ext: 'pdf', uploadedAt: '2024-04-01' },
                  ],
                },
              ],
            },
            2025: {
              items: [
                {
                  id: 'i2',
                  label: 'W-2',
                  owner: 'partner',
                  category: 'paystub',
                  accountIds: [],
                  files: [
                    { id: 'mf-2025a', name: 'w2.pdf', content: 'old-2025a', ext: 'pdf', uploadedAt: '2025-01-01' },
                    { id: 'mf-2025b', name: 'k1.pdf', content: 'old-2025b', ext: 'pdf', uploadedAt: '2025-02-01' },
                  ],
                },
              ],
            },
          },
        }),
      )

      renderHook(() => useTaxStore())
      await act(async () => {
        await new Promise(r => setTimeout(r, 100))
      })

      // All three files should be in IndexedDB
      expect(await getFileContent('mf-2024')).toBe('old-2024')
      expect(await getFileContent('mf-2025a')).toBe('old-2025a')
      expect(await getFileContent('mf-2025b')).toBe('old-2025b')

      // All content should be stripped from localStorage
      const stored = JSON.parse(localStorage.getItem('tax-store')!)
      const allFiles = [...stored.years['2024'].items[0].files, ...stored.years['2025'].items[0].files]
      for (const f of allFiles) {
        expect(f.content).toBeUndefined()
      }
    })

    it('skips migration when no files have inline content', async () => {
      localStorage.setItem(
        'tax-store',
        JSON.stringify({
          years: {
            2025: {
              items: [
                {
                  id: 'i1',
                  label: 'W-2',
                  owner: 'primary',
                  category: 'paystub',
                  accountIds: [],
                  files: [{ id: 'already-migrated', name: 'w2.pdf', ext: 'pdf', uploadedAt: '2025-01-01' }],
                },
              ],
            },
          },
        }),
      )

      renderHook(() => useTaxStore())
      await act(async () => {
        await new Promise(r => setTimeout(r, 50))
      })

      // IndexedDB should not have the file (no migration ran)
      expect(await getFileContent('already-migrated')).toBeNull()
    })
  })

  describe('removeFileFromItem - IndexedDB cleanup', () => {
    it('deletes content from IndexedDB when a file is removed', async () => {
      const { result } = renderHook(() => useTaxStore())
      let itemId: string
      act(() => {
        const item = result.current.addItem(2025, 'W-2', 'primary', 'paystub')
        itemId = item.id
      })
      // Store via async path so content is in IndexedDB
      await act(async () => {
        await result.current.addFileToItemAsync(2025, itemId!, {
          id: 'idb-cleanup',
          name: 'w2.pdf',
          content: 'cleanup-data',
          ext: 'pdf',
          uploadedAt: '2025-01-15',
        })
      })
      // Verify content is in IndexedDB
      expect(await getFileContent('idb-cleanup')).toBe('cleanup-data')

      // Remove the file
      act(() => result.current.removeFileFromItem(2025, itemId!, 'idb-cleanup'))

      // Wait for fire-and-forget IndexedDB delete
      await act(async () => {
        await new Promise(r => setTimeout(r, 50))
      })

      // IndexedDB should be cleaned up
      expect(await getFileContent('idb-cleanup')).toBeNull()
    })
  })

  describe('deleteYear - IndexedDB batch cleanup', () => {
    it('removes a year entirely', () => {
      const { result } = renderHook(() => useTaxStore())
      act(() => result.current.ensureYear(2025))
      act(() => result.current.deleteYear(2025))
      expect(result.current.yearExists(2025)).toBe(false)
      expect(result.current.allYears).not.toContain(2025)
    })

    it('batch-deletes all IndexedDB files for the deleted year', async () => {
      const { result } = renderHook(() => useTaxStore())
      let itemId: string
      act(() => {
        const item = result.current.addItem(2025, 'W-2', 'primary', 'paystub')
        itemId = item.id
      })
      // Add two files via async so they land in IndexedDB
      await act(async () => {
        await result.current.addFileToItemAsync(2025, itemId!, {
          id: 'year-f1',
          name: 'w2.pdf',
          content: 'year-data-1',
          ext: 'pdf',
          uploadedAt: '2025-01-15',
        })
      })
      await act(async () => {
        await result.current.addFileToItemAsync(2025, itemId!, {
          id: 'year-f2',
          name: '1099.pdf',
          content: 'year-data-2',
          ext: 'pdf',
          uploadedAt: '2025-01-15',
        })
      })
      // Confirm both are in IndexedDB
      expect(await getFileContent('year-f1')).toBe('year-data-1')
      expect(await getFileContent('year-f2')).toBe('year-data-2')

      // Delete the year
      act(() => result.current.deleteYear(2025))

      // Wait for fire-and-forget batch delete
      await act(async () => {
        await new Promise(r => setTimeout(r, 50))
      })

      // Both files should be gone from IndexedDB
      expect(await getFileContent('year-f1')).toBeNull()
      expect(await getFileContent('year-f2')).toBeNull()
    })

    it('does not remove IndexedDB files from other years', async () => {
      const { result } = renderHook(() => useTaxStore())
      let id2025: string
      let id2024: string
      act(() => {
        id2025 = result.current.addItem(2025, 'W-2', 'primary', 'paystub').id
        id2024 = result.current.addItem(2024, '1099', 'primary', 'account').id
      })
      await act(async () => {
        await result.current.addFileToItemAsync(2025, id2025!, {
          id: 'del-year-f',
          name: 'w2.pdf',
          content: 'del-me',
          ext: 'pdf',
          uploadedAt: '2025-01-15',
        })
      })
      await act(async () => {
        await result.current.addFileToItemAsync(2024, id2024!, {
          id: 'keep-year-f',
          name: '1099.pdf',
          content: 'keep-me',
          ext: 'pdf',
          uploadedAt: '2024-01-15',
        })
      })

      act(() => result.current.deleteYear(2025))
      await act(async () => {
        await new Promise(r => setTimeout(r, 50))
      })

      // 2025 file gone, 2024 file intact
      expect(await getFileContent('del-year-f')).toBeNull()
      expect(await getFileContent('keep-year-f')).toBe('keep-me')
    })
  })

  describe('allYears', () => {
    it('returns years sorted descending', () => {
      const { result } = renderHook(() => useTaxStore())
      act(() => result.current.ensureYear(2023))
      act(() => result.current.ensureYear(2025))
      act(() => result.current.ensureYear(2024))
      expect(result.current.allYears).toEqual([2025, 2024, 2023])
    })
  })

  describe('createYearWithDefaults', () => {
    it('creates a year with default checklist items', () => {
      const { result } = renderHook(() => useTaxStore())
      act(() => {
        result.current.createYearWithDefaults(2025, [
          { label: 'W-2', owner: 'primary', category: 'paystub' },
          { label: '1099', owner: 'primary', category: 'account' },
        ])
      })
      const items = result.current.getYear(2025).items
      expect(items).toHaveLength(2)
      expect(items[0].label).toBe('W-2')
      expect(items[1].label).toBe('1099')
    })

    it('does not overwrite existing year', () => {
      const { result } = renderHook(() => useTaxStore())
      act(() => result.current.addItem(2025, 'Existing', 'primary', 'custom'))
      act(() => {
        result.current.createYearWithDefaults(2025, [{ label: 'New', owner: 'primary', category: 'paystub' }])
      })
      expect(result.current.getYear(2025).items[0].label).toBe('Existing')
    })
  })

  describe('template operations', () => {
    it('saves a year as a template', () => {
      const { result } = renderHook(() => useTaxStore())
      act(() => result.current.addItem(2025, 'W-2', 'primary', 'paystub'))
      act(() => result.current.saveAsTemplate('My Template', 2025))
      expect(result.current.templates).toHaveLength(1)
      expect(result.current.templates[0].name).toBe('My Template')
      expect(result.current.templates[0].items[0].label).toBe('W-2')
    })

    it('creates a year from a template', () => {
      const { result } = renderHook(() => useTaxStore())
      act(() => result.current.addItem(2024, 'W-2', 'primary', 'paystub'))
      act(() => result.current.saveAsTemplate('Tpl', 2024))
      act(() => result.current.createYearFromTemplate(2025, result.current.templates[0]))
      const items = result.current.getYear(2025).items
      expect(items).toHaveLength(1)
      expect(items[0].label).toBe('W-2')
    })

    it('deletes a template', () => {
      const { result } = renderHook(() => useTaxStore())
      act(() => result.current.addItem(2024, 'W-2', 'primary', 'paystub'))
      act(() => result.current.saveAsTemplate('Tpl', 2024))
      const tplId = result.current.templates[0].id
      act(() => result.current.deleteTemplate(tplId))
      expect(result.current.templates).toHaveLength(0)
    })
  })
})
