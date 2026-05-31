import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../utils', async () => {
  const actual = await vi.importActual<typeof import('../utils')>('../utils')
  let counter = 0
  return {
    ...actual,
    makeId: () => `test-id-${++counter}`,
  }
})

vi.mock('../../../utils/appStorage', () => {
  const store = new Map<string, string>()
  return {
    appStorage: {
      getJSON: <T>(key: string, fallback: T): T => {
        const raw = store.get(key)
        if (raw == null) return fallback
        return JSON.parse(raw) as T
      },
      setJSON: (key: string, val: unknown) => {
        store.set(key, JSON.stringify(val))
      },
      _store: store,
    },
  }
})

import { appStorage } from '../../../utils/appStorage'
import { STORAGE_KEY } from '../constants'
import type { CustomRatio, RatioPreset } from '../types'
import type { AssetAllocation } from '../../data/types'

function getStored(): CustomRatio[] {
  return appStorage.getJSON<CustomRatio[]>(STORAGE_KEY, [])
}

function seedStorage(ratios: CustomRatio[]) {
  appStorage.setJSON(STORAGE_KEY, ratios)
}

beforeEach(() => {
  ;(appStorage as unknown as { _store: Map<string, string> })._store.clear()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// Must import AFTER mocks are set up
import { useCustomRatios } from './useCustomRatios'

describe('useCustomRatios', () => {
  describe('initial state', () => {
    it('returns empty ratios when nothing is stored', () => {
      const { result } = renderHook(() => useCustomRatios())
      expect(result.current.customRatios).toEqual([])
      expect(result.current.activeRatioId).toBeNull()
      expect(result.current.activeRatio).toBeNull()
    })

    it('loads existing ratios from storage', () => {
      const existing: CustomRatio[] = [
        {
          id: 'r1',
          name: 'My Ratio',
          scope: 'total',
          groups: [
            { label: 'A', classes: [] },
            { label: 'B', classes: [] },
          ],
        },
      ]
      seedStorage(existing)
      const { result } = renderHook(() => useCustomRatios())
      expect(result.current.customRatios).toHaveLength(1)
      expect(result.current.customRatios[0].name).toBe('My Ratio')
      expect(result.current.activeRatioId).toBe('r1')
    })
  })

  describe('createRatio', () => {
    it('creates a new ratio with default name and two groups', () => {
      const { result } = renderHook(() => useCustomRatios())
      act(() => result.current.createRatio())
      expect(result.current.customRatios).toHaveLength(1)
      const created = result.current.customRatios[0]
      expect(created.name).toBe('New Ratio')
      expect(created.scope).toBe('total')
      expect(created.groups).toHaveLength(2)
      expect(created.groups[0].label).toBe('Group A')
      expect(created.groups[1].label).toBe('Group B')
    })

    it('sets the new ratio as active', () => {
      const { result } = renderHook(() => useCustomRatios())
      act(() => result.current.createRatio())
      expect(result.current.activeRatioId).toBe(result.current.customRatios[0].id)
      expect(result.current.activeRatio).not.toBeNull()
    })

    it('persists to storage', () => {
      const { result } = renderHook(() => useCustomRatios())
      act(() => result.current.createRatio())
      const stored = getStored()
      expect(stored).toHaveLength(1)
      expect(stored[0].name).toBe('New Ratio')
    })

    it('appends to existing ratios', () => {
      seedStorage([
        {
          id: 'existing',
          name: 'Existing',
          scope: 'fi',
          groups: [
            { label: 'A', classes: [] },
            { label: 'B', classes: [] },
          ],
        },
      ])
      const { result } = renderHook(() => useCustomRatios())
      act(() => result.current.createRatio())
      expect(result.current.customRatios).toHaveLength(2)
      expect(result.current.customRatios[0].name).toBe('Existing')
      expect(result.current.customRatios[1].name).toBe('New Ratio')
    })
  })

  describe('createFromPreset', () => {
    const preset: RatioPreset = {
      id: 'stock-bond',
      name: 'Stock vs Bond',
      scope: 'fi',
      groups: [
        { label: 'Stocks', classes: ['us-stock', 'intl-stock'], color: '#6366f1' },
        { label: 'Bonds', classes: ['bonds'], color: '#0ea5e9' },
      ],
    }

    it('creates a ratio with preset values', () => {
      const { result } = renderHook(() => useCustomRatios())
      act(() => result.current.createFromPreset(preset))
      expect(result.current.customRatios).toHaveLength(1)
      const created = result.current.customRatios[0]
      expect(created.name).toBe('Stock vs Bond')
      expect(created.scope).toBe('fi')
      expect(created.groups).toHaveLength(2)
      expect(created.groups[0].classes).toEqual(['us-stock', 'intl-stock'])
    })

    it('sets the new ratio as active and closes the menu', () => {
      const { result } = renderHook(() => useCustomRatios())
      act(() => result.current.setCreateMenuOpen(true))
      act(() => result.current.createFromPreset(preset))
      expect(result.current.activeRatioId).toBe(result.current.customRatios[0].id)
      expect(result.current.createMenuOpen).toBe(false)
    })
  })

  describe('requestDeleteRatio', () => {
    it('deletes a ratio without goals immediately', () => {
      seedStorage([
        {
          id: 'r1',
          name: 'A',
          scope: 'total',
          groups: [
            { label: 'A', classes: [] },
            { label: 'B', classes: [] },
          ],
        },
        {
          id: 'r2',
          name: 'B',
          scope: 'total',
          groups: [
            { label: 'A', classes: [] },
            { label: 'B', classes: [] },
          ],
        },
      ])
      const { result } = renderHook(() => useCustomRatios())
      act(() => result.current.requestDeleteRatio('r2'))
      expect(result.current.customRatios).toHaveLength(1)
      expect(result.current.customRatios[0].id).toBe('r1')
    })

    it('sets confirmDeleteId when ratio has goals', () => {
      seedStorage([
        {
          id: 'r1',
          name: 'A',
          scope: 'total',
          groups: [
            { label: 'A', classes: [] },
            { label: 'B', classes: [] },
          ],
          goals: { total: { type: 'constant', pcts: [60, 40] } },
        },
      ])
      const { result } = renderHook(() => useCustomRatios())
      act(() => result.current.requestDeleteRatio('r1'))
      expect(result.current.confirmDeleteId).toBe('r1')
      expect(result.current.customRatios).toHaveLength(1)
    })

    it('switches active ratio when deleting the active one', () => {
      seedStorage([
        {
          id: 'r1',
          name: 'A',
          scope: 'total',
          groups: [
            { label: 'A', classes: [] },
            { label: 'B', classes: [] },
          ],
        },
        {
          id: 'r2',
          name: 'B',
          scope: 'total',
          groups: [
            { label: 'A', classes: [] },
            { label: 'B', classes: [] },
          ],
        },
      ])
      const { result } = renderHook(() => useCustomRatios())
      act(() => result.current.setActiveRatioId('r1'))
      act(() => result.current.requestDeleteRatio('r1'))
      expect(result.current.activeRatioId).toBe('r2')
    })

    it('sets activeRatioId to null when deleting the last ratio', () => {
      seedStorage([
        {
          id: 'r1',
          name: 'A',
          scope: 'total',
          groups: [
            { label: 'A', classes: [] },
            { label: 'B', classes: [] },
          ],
        },
      ])
      const { result } = renderHook(() => useCustomRatios())
      act(() => result.current.requestDeleteRatio('r1'))
      expect(result.current.activeRatioId).toBeNull()
      expect(result.current.customRatios).toHaveLength(0)
    })
  })

  describe('doDeleteRatio', () => {
    it('deletes a ratio with goals when confirmed', () => {
      seedStorage([
        {
          id: 'r1',
          name: 'A',
          scope: 'total',
          groups: [
            { label: 'A', classes: [] },
            { label: 'B', classes: [] },
          ],
          goals: { total: { type: 'constant', pcts: [60, 40] } },
        },
      ])
      const { result } = renderHook(() => useCustomRatios())
      act(() => result.current.requestDeleteRatio('r1'))
      expect(result.current.confirmDeleteId).toBe('r1')
      act(() => result.current.doDeleteRatio('r1'))
      expect(result.current.customRatios).toHaveLength(0)
      expect(result.current.confirmDeleteId).toBeNull()
    })

    it('persists deletion to storage', () => {
      seedStorage([
        {
          id: 'r1',
          name: 'A',
          scope: 'total',
          groups: [
            { label: 'A', classes: [] },
            { label: 'B', classes: [] },
          ],
        },
      ])
      const { result } = renderHook(() => useCustomRatios())
      act(() => result.current.doDeleteRatio('r1'))
      expect(getStored()).toHaveLength(0)
    })
  })

  describe('updateRatioName', () => {
    it('updates the name of the active ratio', () => {
      seedStorage([
        {
          id: 'r1',
          name: 'Old Name',
          scope: 'total',
          groups: [
            { label: 'A', classes: [] },
            { label: 'B', classes: [] },
          ],
        },
      ])
      const { result } = renderHook(() => useCustomRatios())
      act(() => result.current.updateRatioName('New Name'))
      expect(result.current.activeRatio?.name).toBe('New Name')
    })

    it('does nothing when no active ratio', () => {
      const { result } = renderHook(() => useCustomRatios())
      act(() => result.current.updateRatioName('test'))
      expect(result.current.customRatios).toHaveLength(0)
    })
  })

  describe('updateRatioScope', () => {
    it('updates the scope of the active ratio', () => {
      seedStorage([
        {
          id: 'r1',
          name: 'R',
          scope: 'total',
          groups: [
            { label: 'A', classes: [] },
            { label: 'B', classes: [] },
          ],
        },
      ])
      const { result } = renderHook(() => useCustomRatios())
      act(() => result.current.updateRatioScope('fi'))
      expect(result.current.activeRatio?.scope).toBe('fi')
    })

    it('clears active preset when scope changes', () => {
      seedStorage([
        {
          id: 'r1',
          name: 'R',
          scope: 'total',
          groups: [
            { label: 'A', classes: [] },
            { label: 'B', classes: [] },
          ],
        },
      ])
      const { result } = renderHook(() => useCustomRatios())
      act(() => result.current.setActivePreset('some-preset'))
      act(() => result.current.updateRatioScope('gw'))
      expect(result.current.activePreset).toBeNull()
    })
  })

  describe('updateGroupLabel', () => {
    it('updates a group label by index', () => {
      seedStorage([
        {
          id: 'r1',
          name: 'R',
          scope: 'total',
          groups: [
            { label: 'A', classes: [] },
            { label: 'B', classes: [] },
          ],
        },
      ])
      const { result } = renderHook(() => useCustomRatios())
      act(() => result.current.updateGroupLabel(0, 'Stocks'))
      expect(result.current.activeRatio?.groups[0].label).toBe('Stocks')
      expect(result.current.activeRatio?.groups[1].label).toBe('B')
    })
  })

  describe('toggleClass', () => {
    it('adds a class to a group', () => {
      seedStorage([
        {
          id: 'r1',
          name: 'R',
          scope: 'total',
          groups: [
            { label: 'A', classes: [] },
            { label: 'B', classes: [] },
          ],
        },
      ])
      const { result } = renderHook(() => useCustomRatios())
      act(() => result.current.toggleClass(0, 'us-stock'))
      expect(result.current.activeRatio?.groups[0].classes).toContain('us-stock')
    })

    it('removes a class from a group when already present', () => {
      seedStorage([
        {
          id: 'r1',
          name: 'R',
          scope: 'total',
          groups: [
            { label: 'A', classes: ['us-stock'] },
            { label: 'B', classes: [] },
          ],
        },
      ])
      const { result } = renderHook(() => useCustomRatios())
      act(() => result.current.toggleClass(0, 'us-stock'))
      expect(result.current.activeRatio?.groups[0].classes).not.toContain('us-stock')
    })

    it('removes a class from other groups when added to one', () => {
      seedStorage([
        {
          id: 'r1',
          name: 'R',
          scope: 'total',
          groups: [
            { label: 'A', classes: [] },
            { label: 'B', classes: ['us-stock'] },
          ],
        },
      ])
      const { result } = renderHook(() => useCustomRatios())
      act(() => result.current.toggleClass(0, 'us-stock'))
      expect(result.current.activeRatio?.groups[0].classes).toContain('us-stock')
      expect(result.current.activeRatio?.groups[1].classes).not.toContain('us-stock')
    })
  })

  describe('addGroup', () => {
    it('adds a new group with a sequential label', () => {
      seedStorage([
        {
          id: 'r1',
          name: 'R',
          scope: 'total',
          groups: [
            { label: 'A', classes: [] },
            { label: 'B', classes: [] },
          ],
        },
      ])
      const { result } = renderHook(() => useCustomRatios())
      act(() => result.current.addGroup())
      expect(result.current.activeRatio?.groups).toHaveLength(3)
      expect(result.current.activeRatio?.groups[2].label).toBe('Group C')
    })

    it('does not add a group when already at 6 groups', () => {
      const groups = Array.from({ length: 6 }, (_, i) => ({ label: `G${i}`, classes: [] as AssetAllocation[] }))
      seedStorage([{ id: 'r1', name: 'R', scope: 'total', groups }])
      const { result } = renderHook(() => useCustomRatios())
      act(() => result.current.addGroup())
      expect(result.current.activeRatio?.groups).toHaveLength(6)
    })

    it('does nothing when no active ratio', () => {
      const { result } = renderHook(() => useCustomRatios())
      act(() => result.current.addGroup())
      expect(result.current.customRatios).toHaveLength(0)
    })
  })

  describe('removeGroup', () => {
    it('removes a group by index', () => {
      seedStorage([
        {
          id: 'r1',
          name: 'R',
          scope: 'total',
          groups: [
            { label: 'A', classes: [] },
            { label: 'B', classes: [] },
            { label: 'C', classes: [] },
          ],
        },
      ])
      const { result } = renderHook(() => useCustomRatios())
      act(() => result.current.removeGroup(1))
      expect(result.current.activeRatio?.groups).toHaveLength(2)
      expect(result.current.activeRatio?.groups.map(g => g.label)).toEqual(['A', 'C'])
    })

    it('does not remove a group when only 2 remain', () => {
      seedStorage([
        {
          id: 'r1',
          name: 'R',
          scope: 'total',
          groups: [
            { label: 'A', classes: [] },
            { label: 'B', classes: [] },
          ],
        },
      ])
      const { result } = renderHook(() => useCustomRatios())
      act(() => result.current.removeGroup(0))
      expect(result.current.activeRatio?.groups).toHaveLength(2)
    })
  })

  describe('applyPreset', () => {
    it('applies preset values to the active ratio', () => {
      seedStorage([
        {
          id: 'r1',
          name: 'R',
          scope: 'total',
          groups: [
            { label: 'A', classes: [] },
            { label: 'B', classes: [] },
          ],
        },
      ])
      const preset: RatioPreset = {
        id: 'equity-fixed',
        name: 'Equity vs Fixed',
        scope: 'fi',
        groups: [
          { label: 'Equity', classes: ['us-stock', 'intl-stock'], color: '#6366f1' },
          { label: 'Fixed', classes: ['bonds', 'cash'], color: '#0ea5e9' },
        ],
      }
      const { result } = renderHook(() => useCustomRatios())
      act(() => result.current.applyPreset(preset))
      expect(result.current.activeRatio?.name).toBe('Equity vs Fixed')
      expect(result.current.activeRatio?.scope).toBe('fi')
      expect(result.current.activeRatio?.groups).toHaveLength(2)
      // applyPreset sets preset id, but updateActiveRatio clears it;
      // the final state depends on React batching — assert the data mutation succeeded
      expect(result.current.activeRatio?.groups[0].classes).toEqual(['us-stock', 'intl-stock'])
    })
  })

  describe('setGoalForScope', () => {
    it('sets a constant goal for a scope', () => {
      seedStorage([
        {
          id: 'r1',
          name: 'R',
          scope: 'total',
          groups: [
            { label: 'A', classes: [] },
            { label: 'B', classes: [] },
          ],
        },
      ])
      const { result } = renderHook(() => useCustomRatios())
      act(() => result.current.setGoalForScope('total', { type: 'constant', pcts: [60, 40] }))
      expect(result.current.activeRatio?.goals?.total).toEqual({ type: 'constant', pcts: [60, 40] })
    })

    it('removes a goal when null is passed', () => {
      seedStorage([
        {
          id: 'r1',
          name: 'R',
          scope: 'total',
          groups: [
            { label: 'A', classes: [] },
            { label: 'B', classes: [] },
          ],
          goals: { total: { type: 'constant', pcts: [50, 50] } },
        },
      ])
      const { result } = renderHook(() => useCustomRatios())
      act(() => result.current.setGoalForScope('total', null))
      expect(result.current.activeRatio?.goals?.total).toBeUndefined()
    })
  })

  describe('persistence', () => {
    it('persists all mutations to storage', () => {
      const { result } = renderHook(() => useCustomRatios())
      act(() => result.current.createRatio())
      const id = result.current.customRatios[0].id
      act(() => result.current.updateRatioName('Renamed'))
      const stored = getStored()
      expect(stored).toHaveLength(1)
      expect(stored[0].name).toBe('Renamed')
      expect(stored[0].id).toBe(id)
    })
  })

  describe('guard branches', () => {
    it('addGroup does nothing when already at 6 groups', () => {
      seedStorage([
        {
          id: 'r1',
          name: 'Full',
          scope: 'total',
          groups: [
            { label: 'A', classes: [] },
            { label: 'B', classes: [] },
            { label: 'C', classes: [] },
            { label: 'D', classes: [] },
            { label: 'E', classes: [] },
            { label: 'F', classes: [] },
          ],
        },
      ])
      const { result } = renderHook(() => useCustomRatios())
      expect(result.current.activeRatio!.groups).toHaveLength(6)
      act(() => result.current.addGroup())
      expect(result.current.activeRatio!.groups).toHaveLength(6)
    })

    it('removeGroup does nothing when only 2 groups remain', () => {
      seedStorage([
        {
          id: 'r1',
          name: 'Min',
          scope: 'total',
          groups: [
            { label: 'A', classes: [] },
            { label: 'B', classes: [] },
          ],
        },
      ])
      const { result } = renderHook(() => useCustomRatios())
      expect(result.current.activeRatio!.groups).toHaveLength(2)
      act(() => result.current.removeGroup(0))
      expect(result.current.activeRatio!.groups).toHaveLength(2)
    })

    it('updateActiveRatio does nothing when no activeRatioId', () => {
      const { result } = renderHook(() => useCustomRatios())
      expect(result.current.activeRatioId).toBeNull()
      act(() => result.current.updateRatioName('Should not crash'))
      expect(result.current.customRatios).toHaveLength(0)
    })
  })
})
