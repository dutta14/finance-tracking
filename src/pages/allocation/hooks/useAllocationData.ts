import { useMemo } from 'react'
import { Account, BalanceEntry, AssetAllocation, ALLOCATION_LABELS, getDefaultAllocation } from '../../data/types'
import { useData } from '../../../contexts/DataContext'
import { Scope } from '../types'
import { ALLOC_COLORS, GROUP_COLORS } from '../constants'

export function useAllocationData() {
  const { accounts, balances } = useData()

  const allocMap = useMemo(() => {
    if (balances.length === 0) return new Map<string, Map<AssetAllocation, number>>()
    const months = [...new Set(balances.map(b => b.month))].sort()
    const latest = months[months.length - 1]
    const latestBals = balances.filter(b => b.month === latest)
    const balMap = new Map<number, number>()
    for (const b of latestBals) balMap.set(b.accountId, b.balance)

    const build = (goalFilter?: 'fi' | 'gw') => {
      const grouped = new Map<AssetAllocation, number>()
      for (const a of accounts) {
        if (a.status !== 'active' || (a.nature || 'asset') !== 'asset') continue
        if (goalFilter && a.goalType !== goalFilter) continue
        const bal = balMap.get(a.id)
        if (!bal || bal === 0) continue
        const alloc = a.allocation || getDefaultAllocation('asset')
        grouped.set(alloc, (grouped.get(alloc) ?? 0) + bal)
      }
      for (const a of accounts) {
        if (a.status !== 'active' || (a.nature || 'asset') !== 'liability') continue
        if (goalFilter && a.goalType !== goalFilter) continue
        const bal = balMap.get(a.id)
        if (!bal || bal === 0) continue
        const absBal = Math.abs(bal)
        if (a.linkedAccountId != null) {
          const linked = accounts.find(la => la.id === a.linkedAccountId)
          if (linked) {
            const linkedAlloc = linked.allocation || getDefaultAllocation(linked.nature || 'asset')
            grouped.set(linkedAlloc, (grouped.get(linkedAlloc) ?? 0) - absBal)
            continue
          }
        }
        const alloc = a.allocation || getDefaultAllocation('liability')
        grouped.set(alloc, (grouped.get(alloc) ?? 0) + absBal)
      }
      return grouped
    }

    const result = new Map<string, Map<AssetAllocation, number>>()
    result.set('total', build())
    result.set('fi', build('fi'))
    result.set('gw', build('gw'))
    return result
  }, [accounts, balances])

  const getSlices = (s: Scope) => {
    const m = allocMap.get(s)
    if (!m) return []
    return [...m.entries()]
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ key: k, name: ALLOCATION_LABELS[k], value: v, color: ALLOC_COLORS[k] }))
      .sort((a, b) => b.value - a.value)
  }

  const computeRatio = (groups: { label: string; classes: AssetAllocation[] }[], s: Scope) => {
    const m = allocMap.get(s)
    if (!m) return []
    return groups
      .map((g, i) => {
        const val = g.classes.reduce((sum, cls) => sum + (m.get(cls) ?? 0), 0)
        return { name: g.label, value: Math.max(0, val), color: GROUP_COLORS[i % GROUP_COLORS.length] }
      })
      .filter(d => d.value > 0)
  }

  return { allocMap, getSlices, computeRatio }
}
