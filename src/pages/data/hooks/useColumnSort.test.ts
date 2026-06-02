import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useColumnSort } from './useColumnSort'
import { Account } from '../types'

const mockAccounts: Account[] = [
  { id: 1, name: 'Checking', goalType: 'fi', type: 'retirement', nature: 'asset', allocation: 'cash', owner: 'primary', status: 'active', group: 'Banking' },
  { id: 2, name: '401k', goalType: 'fi', type: 'non-retirement', nature: 'asset', allocation: 'us-stock', owner: 'primary', status: 'active', group: 'Retirement' },
  { id: 3, name: 'Old Savings', goalType: 'gw', type: 'liquid', nature: 'asset', allocation: 'cash', owner: 'joint', status: 'inactive' },
  { id: 4, name: 'Mortgage', goalType: 'gw', type: 'illiquid', nature: 'liability', allocation: 'debt', owner: 'partner', status: 'active' },
]

const ownerLabels: Record<string, string> = {
  primary: 'Anindya',
  partner: 'Partner',
  joint: 'Joint',
}

describe('useColumnSort', () => {
  describe('initial state', () => {
    it('starts with sortCol as null', () => {
      const { result } = renderHook(() => useColumnSort(mockAccounts, 'all', ownerLabels))
      expect(result.current.sortCol).toBeNull()
    })

    it('starts with sortDir as asc', () => {
      const { result } = renderHook(() => useColumnSort(mockAccounts, 'all', ownerLabels))
      expect(result.current.sortDir).toBe('asc')
    })

    it('starts with empty columnFilters', () => {
      const { result } = renderHook(() => useColumnSort(mockAccounts, 'all', ownerLabels))
      expect(result.current.columnFilters).toEqual({})
    })

    it('starts with openFilterCol as null', () => {
      const { result } = renderHook(() => useColumnSort(mockAccounts, 'all', ownerLabels))
      expect(result.current.openFilterCol).toBeNull()
    })
  })

  describe('toggleSort', () => {
    it('sets the column and asc direction on first click', () => {
      const { result } = renderHook(() => useColumnSort(mockAccounts, 'all', ownerLabels))
      act(() => result.current.toggleSort('name'))
      expect(result.current.sortCol).toBe('name')
      expect(result.current.sortDir).toBe('asc')
    })

    it('changes direction to desc on second click of the same column', () => {
      const { result } = renderHook(() => useColumnSort(mockAccounts, 'all', ownerLabels))
      act(() => result.current.toggleSort('name'))
      act(() => result.current.toggleSort('name'))
      expect(result.current.sortCol).toBe('name')
      expect(result.current.sortDir).toBe('desc')
    })

    it('clears sort on third click of the same column', () => {
      const { result } = renderHook(() => useColumnSort(mockAccounts, 'all', ownerLabels))
      act(() => result.current.toggleSort('name'))
      act(() => result.current.toggleSort('name'))
      act(() => result.current.toggleSort('name'))
      expect(result.current.sortCol).toBeNull()
      expect(result.current.sortDir).toBe('asc')
    })

    it('resets to asc when switching to a different column', () => {
      const { result } = renderHook(() => useColumnSort(mockAccounts, 'all', ownerLabels))
      act(() => result.current.toggleSort('name'))
      act(() => result.current.toggleSort('name'))
      expect(result.current.sortDir).toBe('desc')
      act(() => result.current.toggleSort('owner'))
      expect(result.current.sortCol).toBe('owner')
      expect(result.current.sortDir).toBe('asc')
    })
  })

  describe('toggleColumnFilter', () => {
    it('adds a value to the column filter set', () => {
      const { result } = renderHook(() => useColumnSort(mockAccounts, 'all', ownerLabels))
      act(() => result.current.toggleColumnFilter('owner', 'primary'))
      expect(result.current.columnFilters.owner).toBeDefined()
      expect(result.current.columnFilters.owner!.has('primary')).toBe(true)
    })

    it('removes a value from the column filter set on second toggle', () => {
      const { result } = renderHook(() => useColumnSort(mockAccounts, 'all', ownerLabels))
      act(() => result.current.toggleColumnFilter('owner', 'primary'))
      act(() => result.current.toggleColumnFilter('owner', 'primary'))
      expect(result.current.columnFilters.owner).toBeUndefined()
    })

    it('removes the column key when the set becomes empty', () => {
      const { result } = renderHook(() => useColumnSort(mockAccounts, 'all', ownerLabels))
      act(() => result.current.toggleColumnFilter('owner', 'primary'))
      act(() => result.current.toggleColumnFilter('owner', 'joint'))
      act(() => result.current.toggleColumnFilter('owner', 'primary'))
      expect(result.current.columnFilters.owner!.has('joint')).toBe(true)
      act(() => result.current.toggleColumnFilter('owner', 'joint'))
      expect(result.current.columnFilters.owner).toBeUndefined()
    })
  })

  describe('clearColumnFilter', () => {
    it('removes the entire column filter entry', () => {
      const { result } = renderHook(() => useColumnSort(mockAccounts, 'all', ownerLabels))
      act(() => result.current.toggleColumnFilter('owner', 'primary'))
      act(() => result.current.toggleColumnFilter('owner', 'joint'))
      act(() => result.current.clearColumnFilter('owner'))
      expect(result.current.columnFilters.owner).toBeUndefined()
    })
  })

  describe('displayAccounts', () => {
    it('returns all accounts when filter is all and no sort or column filters', () => {
      const { result } = renderHook(() => useColumnSort(mockAccounts, 'all', ownerLabels))
      expect(result.current.displayAccounts).toHaveLength(4)
    })

    it('filters to active accounts only when filter is active', () => {
      const { result } = renderHook(() => useColumnSort(mockAccounts, 'active', ownerLabels))
      expect(result.current.displayAccounts).toHaveLength(3)
      expect(result.current.displayAccounts.every(a => a.status === 'active')).toBe(true)
    })

    it('filters to inactive accounts only when filter is inactive', () => {
      const { result } = renderHook(() => useColumnSort(mockAccounts, 'inactive', ownerLabels))
      expect(result.current.displayAccounts).toHaveLength(1)
      expect(result.current.displayAccounts[0].name).toBe('Old Savings')
    })

    it('applies column filters to narrow results', () => {
      const { result } = renderHook(() => useColumnSort(mockAccounts, 'all', ownerLabels))
      act(() => result.current.toggleColumnFilter('owner', 'primary'))
      expect(result.current.displayAccounts).toHaveLength(2)
      expect(result.current.displayAccounts.every(a => a.owner === 'primary')).toBe(true)
    })

    it('sorts accounts ascending by name', () => {
      const { result } = renderHook(() => useColumnSort(mockAccounts, 'all', ownerLabels))
      act(() => result.current.toggleSort('name'))
      const names = result.current.displayAccounts.map(a => a.name)
      expect(names).toEqual(['401k', 'Checking', 'Mortgage', 'Old Savings'])
    })

    it('sorts accounts descending by name', () => {
      const { result } = renderHook(() => useColumnSort(mockAccounts, 'all', ownerLabels))
      act(() => result.current.toggleSort('name'))
      act(() => result.current.toggleSort('name'))
      const names = result.current.displayAccounts.map(a => a.name)
      expect(names).toEqual(['Old Savings', 'Mortgage', 'Checking', '401k'])
    })

    it('combines status filter, column filter, and sort', () => {
      const { result } = renderHook(() => useColumnSort(mockAccounts, 'active', ownerLabels))
      act(() => result.current.toggleColumnFilter('owner', 'primary'))
      act(() => result.current.toggleSort('name'))
      const names = result.current.displayAccounts.map(a => a.name)
      expect(names).toEqual(['401k', 'Checking'])
    })
  })

  describe('colUniqueValues', () => {
    it('returns sorted unique values for the owner column sorted by label', () => {
      const { result } = renderHook(() => useColumnSort(mockAccounts, 'all', ownerLabels))
      const values = result.current.colUniqueValues('owner')
      // Sorted by label: Anindya (primary), Joint, Partner
      expect(values).toEqual(['primary', 'joint', 'partner'])
    })

    it('respects the status filter when computing unique values', () => {
      const { result } = renderHook(() => useColumnSort(mockAccounts, 'active', ownerLabels))
      const values = result.current.colUniqueValues('owner')
      // Sorted by label: Anindya (primary), Partner
      expect(values).toEqual(['primary', 'partner'])
    })

    it('returns sorted unique goal types', () => {
      const { result } = renderHook(() => useColumnSort(mockAccounts, 'all', ownerLabels))
      const values = result.current.colUniqueValues('goalType')
      expect(values).toEqual(['fi', 'gw'])
    })
  })

  describe('getColLabel', () => {
    it('returns the raw value for name column', () => {
      const { result } = renderHook(() => useColumnSort(mockAccounts, 'all', ownerLabels))
      expect(result.current.getColLabel('name', 'Checking')).toBe('Checking')
    })

    it('returns the mapped label for goalType', () => {
      const { result } = renderHook(() => useColumnSort(mockAccounts, 'all', ownerLabels))
      expect(result.current.getColLabel('goalType', 'fi')).toBe('FI')
      expect(result.current.getColLabel('goalType', 'gw')).toBe('GW')
    })

    it('returns the mapped label for type', () => {
      const { result } = renderHook(() => useColumnSort(mockAccounts, 'all', ownerLabels))
      expect(result.current.getColLabel('type', 'retirement')).toBe('Retirement')
      expect(result.current.getColLabel('type', 'non-retirement')).toBe('Non-Retirement')
    })

    it('returns the mapped label for nature', () => {
      const { result } = renderHook(() => useColumnSort(mockAccounts, 'all', ownerLabels))
      expect(result.current.getColLabel('nature', 'asset')).toBe('Asset')
      expect(result.current.getColLabel('nature', 'liability')).toBe('Liability')
    })

    it('returns the mapped label for allocation', () => {
      const { result } = renderHook(() => useColumnSort(mockAccounts, 'all', ownerLabels))
      expect(result.current.getColLabel('allocation', 'us-stock')).toBe('US Stock')
      expect(result.current.getColLabel('allocation', 'cash')).toBe('Cash')
    })

    it('returns the owner label from the provided ownerLabels map', () => {
      const { result } = renderHook(() => useColumnSort(mockAccounts, 'all', ownerLabels))
      expect(result.current.getColLabel('owner', 'primary')).toBe('Anindya')
      expect(result.current.getColLabel('owner', 'joint')).toBe('Joint')
    })

    it('returns capitalized value for status column', () => {
      const { result } = renderHook(() => useColumnSort(mockAccounts, 'all', ownerLabels))
      expect(result.current.getColLabel('status', 'active')).toBe('Active')
      expect(result.current.getColLabel('status', 'inactive')).toBe('Inactive')
    })
  })
})
