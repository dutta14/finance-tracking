import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTaxStore } from './useTaxStore'

beforeEach(() => {
  localStorage.clear()
})

describe('useTaxStore', () => {
  describe('initial state', () => {
    it('starts with empty store when nothing in localStorage', () => {
      const { result } = renderHook(() => useTaxStore())
      expect(result.current.allYears).toEqual([])
      expect(result.current.store.years).toEqual({})
    })

    it('loads existing data from localStorage', () => {
      localStorage.setItem('tax-store', JSON.stringify({
        years: { 2024: { items: [{ id: '1', label: 'W-2', owner: 'primary', category: 'paystub', accountIds: [], files: [] }] } },
      }))
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
    it('adds a file to a checklist item', () => {
      const { result } = renderHook(() => useTaxStore())
      let itemId: string
      act(() => {
        const item = result.current.addItem(2025, 'W-2', 'primary', 'paystub')
        itemId = item.id
      })
      act(() => {
        result.current.addFileToItem(2025, itemId!, {
          id: 'f1', name: 'w2.pdf', content: 'base64data', ext: 'pdf', uploadedAt: '2025-01-15',
        })
      })
      const files = result.current.getYear(2025).items[0].files
      expect(files).toHaveLength(1)
      expect(files[0].name).toBe('w2.pdf')
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
          id: 'f1', name: 'w2.pdf', content: 'data', ext: 'pdf', uploadedAt: '2025-01-15',
        })
      })
      act(() => result.current.removeFileFromItem(2025, itemId!, 'f1'))
      expect(result.current.getYear(2025).items[0].files).toHaveLength(0)
    })
  })

  describe('deleteYear', () => {
    it('removes a year entirely', () => {
      const { result } = renderHook(() => useTaxStore())
      act(() => result.current.ensureYear(2025))
      act(() => result.current.deleteYear(2025))
      expect(result.current.yearExists(2025)).toBe(false)
      expect(result.current.allYears).not.toContain(2025)
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
        result.current.createYearWithDefaults(2025, [
          { label: 'New', owner: 'primary', category: 'paystub' },
        ])
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
