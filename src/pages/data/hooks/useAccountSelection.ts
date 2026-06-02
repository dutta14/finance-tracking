import { useState, useRef } from 'react'

interface AccountLike {
  id: number
}

export function useAccountSelection(filteredAccounts: AccountLike[]) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const lastSelectedRef = useRef<number | null>(null)

  const allFilteredSelected = filteredAccounts.length > 0 && filteredAccounts.every(a => selectedIds.has(a.id))

  const selectedCount = filteredAccounts.filter(a => selectedIds.has(a.id)).length

  const showMultiSelect = selectedCount >= 1

  const toggleSelect = (id: number) => {
    lastSelectedRef.current = id
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const rangeSelect = (id: number) => {
    const lastId = lastSelectedRef.current
    if (lastId == null) {
      toggleSelect(id)
      return
    }
    const ids = filteredAccounts.map(a => a.id)
    const from = ids.indexOf(lastId)
    const to = ids.indexOf(id)
    if (from === -1 || to === -1) {
      toggleSelect(id)
      return
    }
    const start = Math.min(from, to)
    const end = Math.max(from, to)
    setSelectedIds(prev => {
      const next = new Set(prev)
      for (let i = start; i <= end; i++) next.add(ids[i])
      return next
    })
    lastSelectedRef.current = id
  }

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        for (const a of filteredAccounts) next.delete(a.id)
        return next
      })
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        for (const a of filteredAccounts) next.add(a.id)
        return next
      })
    }
  }

  const handleRowClick = (id: number, e: React.MouseEvent) => {
    if (e.shiftKey && selectedIds.size > 0) {
      e.preventDefault()
      rangeSelect(id)
    } else if (e.metaKey || e.ctrlKey) {
      e.preventDefault()
      toggleSelect(id)
    }
  }

  return {
    selectedIds,
    selectedCount,
    allFilteredSelected,
    showMultiSelect,
    toggleSelect,
    rangeSelect,
    toggleSelectAll,
    handleRowClick,
    clearSelection: () => setSelectedIds(new Set()),
  }
}
