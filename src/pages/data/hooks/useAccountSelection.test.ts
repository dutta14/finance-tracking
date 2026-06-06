import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAccountSelection } from './useAccountSelection'

const mockFiltered = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]

describe('useAccountSelection', () => {
  describe('initial state', () => {
    it('starts with an empty selectedIds set', () => {
      const { result } = renderHook(() => useAccountSelection(mockFiltered))
      expect(result.current.selectedIds.size).toBe(0)
    })

    it('starts with selectedCount of 0', () => {
      const { result } = renderHook(() => useAccountSelection(mockFiltered))
      expect(result.current.selectedCount).toBe(0)
    })

    it('starts with showMultiSelect as false', () => {
      const { result } = renderHook(() => useAccountSelection(mockFiltered))
      expect(result.current.showMultiSelect).toBe(false)
    })

    it('starts with allFilteredSelected as false', () => {
      const { result } = renderHook(() => useAccountSelection(mockFiltered))
      expect(result.current.allFilteredSelected).toBe(false)
    })
  })

  describe('toggleSelect', () => {
    it('adds an id to the selection', () => {
      const { result } = renderHook(() => useAccountSelection(mockFiltered))
      act(() => result.current.toggleSelect(2))
      expect(result.current.selectedIds.has(2)).toBe(true)
      expect(result.current.selectedCount).toBe(1)
    })

    it('removes an id from the selection on second toggle', () => {
      const { result } = renderHook(() => useAccountSelection(mockFiltered))
      act(() => result.current.toggleSelect(2))
      act(() => result.current.toggleSelect(2))
      expect(result.current.selectedIds.has(2)).toBe(false)
      expect(result.current.selectedCount).toBe(0)
    })

    it('sets showMultiSelect to true when at least one item is selected', () => {
      const { result } = renderHook(() => useAccountSelection(mockFiltered))
      act(() => result.current.toggleSelect(1))
      expect(result.current.showMultiSelect).toBe(true)
    })
  })

  describe('toggleSelectAll', () => {
    it('selects all filtered accounts when not all are selected', () => {
      const { result } = renderHook(() => useAccountSelection(mockFiltered))
      act(() => result.current.toggleSelectAll())
      expect(result.current.selectedCount).toBe(5)
      expect(result.current.allFilteredSelected).toBe(true)
    })

    it('deselects all filtered accounts when all are already selected', () => {
      const { result } = renderHook(() => useAccountSelection(mockFiltered))
      act(() => result.current.toggleSelectAll())
      act(() => result.current.toggleSelectAll())
      expect(result.current.selectedCount).toBe(0)
      expect(result.current.allFilteredSelected).toBe(false)
    })

    it('selects remaining unselected accounts when partially selected', () => {
      const { result } = renderHook(() => useAccountSelection(mockFiltered))
      act(() => result.current.toggleSelect(1))
      act(() => result.current.toggleSelect(3))
      act(() => result.current.toggleSelectAll())
      expect(result.current.selectedCount).toBe(5)
    })
  })

  describe('rangeSelect', () => {
    it('selects range between last selected and target id', () => {
      const { result } = renderHook(() => useAccountSelection(mockFiltered))
      act(() => result.current.toggleSelect(2))
      act(() => result.current.rangeSelect(5))
      expect(result.current.selectedIds.has(2)).toBe(true)
      expect(result.current.selectedIds.has(3)).toBe(true)
      expect(result.current.selectedIds.has(4)).toBe(true)
      expect(result.current.selectedIds.has(5)).toBe(true)
      expect(result.current.selectedCount).toBe(4)
    })

    it('selects range in reverse direction', () => {
      const { result } = renderHook(() => useAccountSelection(mockFiltered))
      act(() => result.current.toggleSelect(4))
      act(() => result.current.rangeSelect(1))
      expect(result.current.selectedIds.has(1)).toBe(true)
      expect(result.current.selectedIds.has(2)).toBe(true)
      expect(result.current.selectedIds.has(3)).toBe(true)
      expect(result.current.selectedIds.has(4)).toBe(true)
      expect(result.current.selectedCount).toBe(4)
    })

    it('falls back to toggleSelect when no previous selection exists', () => {
      const { result } = renderHook(() => useAccountSelection(mockFiltered))
      act(() => result.current.rangeSelect(3))
      expect(result.current.selectedIds.has(3)).toBe(true)
      expect(result.current.selectedCount).toBe(1)
    })
  })

  describe('handleRowClick', () => {
    const createMouseEvent = (opts: Partial<React.MouseEvent> = {}): React.MouseEvent =>
      ({
        shiftKey: false,
        metaKey: false,
        ctrlKey: false,
        preventDefault: () => {},
        ...opts,
      }) as unknown as React.MouseEvent

    it('does not select on plain click without modifiers', () => {
      const { result } = renderHook(() => useAccountSelection(mockFiltered))
      act(() => result.current.handleRowClick(2, createMouseEvent()))
      expect(result.current.selectedCount).toBe(0)
    })

    it('toggles selection on ctrl+click', () => {
      const { result } = renderHook(() => useAccountSelection(mockFiltered))
      act(() => result.current.handleRowClick(2, createMouseEvent({ ctrlKey: true })))
      expect(result.current.selectedIds.has(2)).toBe(true)
      act(() => result.current.handleRowClick(2, createMouseEvent({ ctrlKey: true })))
      expect(result.current.selectedIds.has(2)).toBe(false)
    })

    it('toggles selection on meta+click', () => {
      const { result } = renderHook(() => useAccountSelection(mockFiltered))
      act(() => result.current.handleRowClick(3, createMouseEvent({ metaKey: true })))
      expect(result.current.selectedIds.has(3)).toBe(true)
    })

    it('performs range select on shift+click when items are already selected', () => {
      const { result } = renderHook(() => useAccountSelection(mockFiltered))
      act(() => result.current.toggleSelect(1))
      act(() => result.current.handleRowClick(4, createMouseEvent({ shiftKey: true })))
      expect(result.current.selectedIds.has(1)).toBe(true)
      expect(result.current.selectedIds.has(2)).toBe(true)
      expect(result.current.selectedIds.has(3)).toBe(true)
      expect(result.current.selectedIds.has(4)).toBe(true)
    })

    it('does not range select on shift+click when nothing is selected', () => {
      const { result } = renderHook(() => useAccountSelection(mockFiltered))
      act(() => result.current.handleRowClick(3, createMouseEvent({ shiftKey: true })))
      expect(result.current.selectedCount).toBe(0)
    })
  })

  describe('allFilteredSelected', () => {
    it('returns true when all filtered accounts are selected', () => {
      const { result } = renderHook(() => useAccountSelection(mockFiltered))
      act(() => result.current.toggleSelectAll())
      expect(result.current.allFilteredSelected).toBe(true)
    })

    it('returns false when only some filtered accounts are selected', () => {
      const { result } = renderHook(() => useAccountSelection(mockFiltered))
      act(() => result.current.toggleSelect(1))
      act(() => result.current.toggleSelect(2))
      expect(result.current.allFilteredSelected).toBe(false)
    })

    it('returns false for an empty filtered list', () => {
      const { result } = renderHook(() => useAccountSelection([]))
      expect(result.current.allFilteredSelected).toBe(false)
    })
  })

  describe('clearSelection', () => {
    it('clears all selected ids', () => {
      const { result } = renderHook(() => useAccountSelection(mockFiltered))
      act(() => result.current.toggleSelectAll())
      expect(result.current.selectedCount).toBe(5)
      act(() => result.current.clearSelection())
      expect(result.current.selectedCount).toBe(0)
      expect(result.current.selectedIds.size).toBe(0)
    })
  })
})
