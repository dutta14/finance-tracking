import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import {
  Account,
  AccountType,
  AccountGoalType,
  AccountNature,
  AssetAllocation,
  AccountOwner,
  ACCOUNT_TYPE_LABELS,
  GOAL_TYPE_LABELS,
  NATURE_LABELS,
  ALLOCATION_LABELS,
  getDefaultAllocation,
} from '../types'

export type SortCol = 'name' | 'goalType' | 'type' | 'nature' | 'allocation' | 'owner' | 'status'
export type SortDir = 'asc' | 'desc'

export function useColumnSort(
  accounts: Account[],
  filter: 'all' | 'active' | 'inactive',
  ownerLabels: Record<string, string>,
) {
  const [sortCol, setSortCol] = useState<SortCol | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [columnFilters, setColumnFilters] = useState<Partial<Record<SortCol, Set<string>>>>({})
  const [openFilterCol, setOpenFilterCol] = useState<SortCol | null>(null)
  const filterDropdownRef = useRef<HTMLDivElement>(null)

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) {
      if (sortDir === 'asc') setSortDir('desc')
      else {
        setSortCol(null)
        setSortDir('asc')
      }
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const toggleColumnFilter = (col: SortCol, value: string) => {
    setColumnFilters(prev => {
      const next = { ...prev }
      const set = new Set(prev[col] || [])
      if (set.has(value)) set.delete(value)
      else set.add(value)
      if (set.size === 0) delete next[col]
      else next[col] = set
      return next
    })
  }

  const clearColumnFilter = (col: SortCol) => {
    setColumnFilters(prev => {
      const next = { ...prev }
      delete next[col]
      return next
    })
  }

  // Close filter dropdown on outside click
  useEffect(() => {
    if (!openFilterCol) return
    const handler = (e: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setOpenFilterCol(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openFilterCol])

  const getColValue = useCallback((a: Account, col: SortCol): string => {
    switch (col) {
      case 'name':
        return a.name
      case 'goalType':
        return a.goalType
      case 'type':
        return a.type
      case 'nature':
        return a.nature || 'asset'
      case 'allocation':
        return a.allocation || getDefaultAllocation(a.nature || 'asset')
      case 'owner':
        return a.owner
      case 'status':
        return a.status
    }
  }, [])

  const getColLabel = useCallback(
    (col: SortCol, val: string): string => {
      switch (col) {
        case 'name':
          return val
        case 'goalType':
          return GOAL_TYPE_LABELS[val as AccountGoalType] || val
        case 'type':
          return ACCOUNT_TYPE_LABELS[val as AccountType] || val
        case 'nature':
          return NATURE_LABELS[val as AccountNature] || val
        case 'allocation':
          return ALLOCATION_LABELS[val as AssetAllocation] || val
        case 'owner':
          return ownerLabels[val as AccountOwner] || val
        case 'status':
          return val.charAt(0).toUpperCase() + val.slice(1)
      }
    },
    [ownerLabels],
  )

  const displayAccounts = useMemo(() => {
    let list = filter === 'all' ? accounts : accounts.filter(a => a.status === filter)

    // Apply column filters
    for (const [col, allowed] of Object.entries(columnFilters) as [SortCol, Set<string>][]) {
      if (allowed && allowed.size > 0) {
        list = list.filter(a => allowed.has(getColValue(a, col)))
      }
    }

    // Apply sort
    if (sortCol) {
      const dir = sortDir === 'asc' ? 1 : -1
      list = [...list].sort((a, b) => {
        const va = getColValue(a, sortCol).toLowerCase()
        const vb = getColValue(b, sortCol).toLowerCase()
        return va < vb ? -dir : va > vb ? dir : 0
      })
    }

    return list
  }, [accounts, filter, columnFilters, sortCol, sortDir, getColValue])

  // Unique values for filter dropdowns (from ALL accounts, not filtered)
  const colUniqueValues = useCallback(
    (col: SortCol): string[] => {
      const baseList = filter === 'all' ? accounts : accounts.filter(a => a.status === filter)
      const vals = new Set(baseList.map(a => getColValue(a, col)))
      return [...vals].sort((a, b) =>
        getColLabel(col, a).toLowerCase().localeCompare(getColLabel(col, b).toLowerCase()),
      )
    },
    [accounts, filter, getColValue, getColLabel],
  )

  return {
    sortCol,
    sortDir,
    columnFilters,
    openFilterCol,
    setOpenFilterCol,
    filterDropdownRef,
    toggleSort,
    toggleColumnFilter,
    clearColumnFilter,
    getColValue,
    getColLabel,
    displayAccounts,
    colUniqueValues,
  }
}
