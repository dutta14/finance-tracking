import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { Account, BalanceEntry } from '../../data/types'

const mockData: { accounts: Account[]; balances: BalanceEntry[] } = {
  accounts: [],
  balances: [],
}

vi.mock('../../../contexts/DataContext', () => ({
  useData: () => mockData,
}))

import { useAllocationData } from './useAllocationData'

function makeAccount(overrides: Partial<Account> & { id: number }): Account {
  return {
    name: `Account ${overrides.id}`,
    type: 'non-retirement',
    owner: 'primary',
    status: 'active',
    goalType: 'fi',
    nature: 'asset',
    allocation: 'us-stock',
    ...overrides,
  }
}

function makeBalance(accountId: number, balance: number, month = '2024-06'): BalanceEntry {
  return { id: accountId * 100, accountId, month, balance }
}

beforeEach(() => {
  mockData.accounts = []
  mockData.balances = []
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useAllocationData', () => {
  describe('allocMap', () => {
    it('returns empty map when no balances exist', () => {
      const { result } = renderHook(() => useAllocationData())
      expect(result.current.allocMap.size).toBe(0)
    })

    it('groups asset balances by allocation type for total scope', () => {
      mockData.accounts = [
        makeAccount({ id: 1, allocation: 'us-stock' }),
        makeAccount({ id: 2, allocation: 'us-stock' }),
        makeAccount({ id: 3, allocation: 'bonds' }),
      ]
      mockData.balances = [makeBalance(1, 100000), makeBalance(2, 50000), makeBalance(3, 30000)]

      const { result } = renderHook(() => useAllocationData())
      const total = result.current.allocMap.get('total')!
      expect(total.get('us-stock')).toBe(150000)
      expect(total.get('bonds')).toBe(30000)
    })

    it('filters accounts by goalType for fi scope', () => {
      mockData.accounts = [
        makeAccount({ id: 1, goalType: 'fi', allocation: 'us-stock' }),
        makeAccount({ id: 2, goalType: 'gw', allocation: 'bonds' }),
      ]
      mockData.balances = [makeBalance(1, 100000), makeBalance(2, 50000)]

      const { result } = renderHook(() => useAllocationData())
      const fi = result.current.allocMap.get('fi')!
      expect(fi.get('us-stock')).toBe(100000)
      expect(fi.has('bonds')).toBe(false)
    })

    it('filters accounts by goalType for gw scope', () => {
      mockData.accounts = [
        makeAccount({ id: 1, goalType: 'fi', allocation: 'us-stock' }),
        makeAccount({ id: 2, goalType: 'gw', allocation: 'bonds' }),
      ]
      mockData.balances = [makeBalance(1, 100000), makeBalance(2, 50000)]

      const { result } = renderHook(() => useAllocationData())
      const gw = result.current.allocMap.get('gw')!
      expect(gw.get('bonds')).toBe(50000)
      expect(gw.has('us-stock')).toBe(false)
    })

    it('includes all accounts in total scope regardless of goalType', () => {
      mockData.accounts = [
        makeAccount({ id: 1, goalType: 'fi', allocation: 'us-stock' }),
        makeAccount({ id: 2, goalType: 'gw', allocation: 'us-stock' }),
      ]
      mockData.balances = [makeBalance(1, 100000), makeBalance(2, 50000)]

      const { result } = renderHook(() => useAllocationData())
      const total = result.current.allocMap.get('total')!
      expect(total.get('us-stock')).toBe(150000)
    })

    it('skips inactive accounts', () => {
      mockData.accounts = [
        makeAccount({ id: 1, status: 'active', allocation: 'us-stock' }),
        makeAccount({ id: 2, status: 'inactive', allocation: 'bonds' }),
      ]
      mockData.balances = [makeBalance(1, 100000), makeBalance(2, 50000)]

      const { result } = renderHook(() => useAllocationData())
      const total = result.current.allocMap.get('total')!
      expect(total.get('us-stock')).toBe(100000)
      expect(total.has('bonds')).toBe(false)
    })

    it('skips accounts with zero balance', () => {
      mockData.accounts = [makeAccount({ id: 1, allocation: 'us-stock' }), makeAccount({ id: 2, allocation: 'bonds' })]
      mockData.balances = [makeBalance(1, 100000), makeBalance(2, 0)]

      const { result } = renderHook(() => useAllocationData())
      const total = result.current.allocMap.get('total')!
      expect(total.get('us-stock')).toBe(100000)
      expect(total.has('bonds')).toBe(false)
    })

    it('skips accounts with no balance entry', () => {
      mockData.accounts = [makeAccount({ id: 1, allocation: 'us-stock' }), makeAccount({ id: 2, allocation: 'bonds' })]
      mockData.balances = [makeBalance(1, 100000)]

      const { result } = renderHook(() => useAllocationData())
      const total = result.current.allocMap.get('total')!
      expect(total.has('bonds')).toBe(false)
    })

    it('uses the latest month when multiple months exist', () => {
      mockData.accounts = [makeAccount({ id: 1, allocation: 'us-stock' })]
      mockData.balances = [makeBalance(1, 50000, '2024-01'), makeBalance(1, 100000, '2024-06')]

      const { result } = renderHook(() => useAllocationData())
      const total = result.current.allocMap.get('total')!
      expect(total.get('us-stock')).toBe(100000)
    })

    it('uses default allocation when account has none', () => {
      mockData.accounts = [makeAccount({ id: 1, allocation: undefined as unknown as Account['allocation'] })]
      mockData.balances = [makeBalance(1, 100000)]

      const { result } = renderHook(() => useAllocationData())
      const total = result.current.allocMap.get('total')!
      // getDefaultAllocation('asset') returns 'cash'
      expect(total.get('cash')).toBe(100000)
    })

    it('handles linked liabilities by subtracting from linked asset allocation', () => {
      mockData.accounts = [
        makeAccount({ id: 1, nature: 'asset', allocation: 'real-estate' }),
        makeAccount({ id: 2, nature: 'liability', allocation: 'debt', linkedAccountId: 1 }),
      ]
      mockData.balances = [makeBalance(1, 500000), makeBalance(2, -200000)]

      const { result } = renderHook(() => useAllocationData())
      const total = result.current.allocMap.get('total')!
      // asset: 500000 in real-estate, liability: -abs(-200000) = subtract 200000 from linked asset's allocation (real-estate)
      expect(total.get('real-estate')).toBe(300000)
    })

    it('handles unlinked liabilities using their own allocation', () => {
      mockData.accounts = [
        makeAccount({ id: 1, nature: 'asset', allocation: 'us-stock' }),
        makeAccount({ id: 2, nature: 'liability', allocation: 'debt' }),
      ]
      mockData.balances = [makeBalance(1, 100000), makeBalance(2, -50000)]

      const { result } = renderHook(() => useAllocationData())
      const total = result.current.allocMap.get('total')!
      expect(total.get('us-stock')).toBe(100000)
      // Unlinked liability: abs(-50000) = 50000 added to 'debt'
      expect(total.get('debt')).toBe(50000)
    })

    it('handles linked liability when linked account is not found', () => {
      mockData.accounts = [makeAccount({ id: 2, nature: 'liability', allocation: 'debt', linkedAccountId: 999 })]
      mockData.balances = [makeBalance(2, -50000)]

      const { result } = renderHook(() => useAllocationData())
      const total = result.current.allocMap.get('total')!
      // Linked account not found, falls back to own allocation
      expect(total.get('debt')).toBe(50000)
    })
  })

  describe('getSlices', () => {
    it('returns empty array for nonexistent scope', () => {
      const { result } = renderHook(() => useAllocationData())
      expect(result.current.getSlices('total')).toEqual([])
    })

    it('returns sorted slices with positive values only', () => {
      mockData.accounts = [makeAccount({ id: 1, allocation: 'us-stock' }), makeAccount({ id: 2, allocation: 'bonds' })]
      mockData.balances = [makeBalance(1, 50000), makeBalance(2, 100000)]

      const { result } = renderHook(() => useAllocationData())
      const slices = result.current.getSlices('total')
      expect(slices).toHaveLength(2)
      // Sorted descending by value
      expect(slices[0].key).toBe('bonds')
      expect(slices[0].value).toBe(100000)
      expect(slices[0].name).toBe('Bonds')
      expect(slices[1].key).toBe('us-stock')
      expect(slices[1].value).toBe(50000)
    })

    it('filters out zero and negative value slices', () => {
      mockData.accounts = [
        makeAccount({ id: 1, nature: 'asset', allocation: 'real-estate' }),
        makeAccount({ id: 2, nature: 'liability', allocation: 'debt', linkedAccountId: 1 }),
      ]
      // Liability exceeds asset, resulting in negative allocation
      mockData.balances = [makeBalance(1, 100000), makeBalance(2, -200000)]

      const { result } = renderHook(() => useAllocationData())
      const slices = result.current.getSlices('total')
      // real-estate: 100000 - 200000 = -100000 (filtered out)
      expect(slices.every(s => s.value > 0)).toBe(true)
    })

    it('includes correct colors from ALLOC_COLORS', () => {
      mockData.accounts = [makeAccount({ id: 1, allocation: 'us-stock' })]
      mockData.balances = [makeBalance(1, 100000)]

      const { result } = renderHook(() => useAllocationData())
      const slices = result.current.getSlices('total')
      expect(slices[0].color).toBe('#6366f1')
    })
  })

  describe('computeRatio', () => {
    it('returns empty array for nonexistent scope', () => {
      const { result } = renderHook(() => useAllocationData())
      expect(result.current.computeRatio([], 'total')).toEqual([])
    })

    it('computes group totals from allocation classes', () => {
      mockData.accounts = [
        makeAccount({ id: 1, allocation: 'us-stock' }),
        makeAccount({ id: 2, allocation: 'intl-stock' }),
        makeAccount({ id: 3, allocation: 'bonds' }),
      ]
      mockData.balances = [makeBalance(1, 100000), makeBalance(2, 50000), makeBalance(3, 30000)]

      const groups = [
        { label: 'Stocks', classes: ['us-stock' as const, 'intl-stock' as const] },
        { label: 'Bonds', classes: ['bonds' as const] },
      ]
      const { result } = renderHook(() => useAllocationData())
      const ratio = result.current.computeRatio(groups, 'total')
      expect(ratio).toHaveLength(2)
      expect(ratio[0].name).toBe('Stocks')
      expect(ratio[0].value).toBe(150000)
      expect(ratio[1].name).toBe('Bonds')
      expect(ratio[1].value).toBe(30000)
    })

    it('filters out groups with zero value', () => {
      mockData.accounts = [makeAccount({ id: 1, allocation: 'us-stock' })]
      mockData.balances = [makeBalance(1, 100000)]

      const groups = [
        { label: 'Stocks', classes: ['us-stock' as const] },
        { label: 'Bonds', classes: ['bonds' as const] },
      ]
      const { result } = renderHook(() => useAllocationData())
      const ratio = result.current.computeRatio(groups, 'total')
      expect(ratio).toHaveLength(1)
      expect(ratio[0].name).toBe('Stocks')
    })

    it('clamps negative group values to zero', () => {
      mockData.accounts = [
        makeAccount({ id: 1, nature: 'asset', allocation: 'real-estate' }),
        makeAccount({ id: 2, nature: 'liability', allocation: 'debt', linkedAccountId: 1 }),
      ]
      mockData.balances = [makeBalance(1, 100000), makeBalance(2, -200000)]

      const groups = [{ label: 'RE', classes: ['real-estate' as const] }]
      const { result } = renderHook(() => useAllocationData())
      const ratio = result.current.computeRatio(groups, 'total')
      // -100000 clamped to 0, then filtered out
      expect(ratio).toHaveLength(0)
    })

    it('assigns colors from GROUP_COLORS by index', () => {
      mockData.accounts = [makeAccount({ id: 1, allocation: 'us-stock' }), makeAccount({ id: 2, allocation: 'bonds' })]
      mockData.balances = [makeBalance(1, 100000), makeBalance(2, 50000)]

      const groups = [
        { label: 'A', classes: ['us-stock' as const] },
        { label: 'B', classes: ['bonds' as const] },
      ]
      const { result } = renderHook(() => useAllocationData())
      const ratio = result.current.computeRatio(groups, 'total')
      expect(ratio[0].color).toBe('#6366f1')
      expect(ratio[1].color).toBe('#0ea5e9')
    })
  })

  describe('liability accounts', () => {
    it('includes liability accounts with non-zero balance in allocation map', () => {
      mockData.accounts = [
        makeAccount({ id: 1, nature: 'asset', allocation: 'us-stock' }),
        makeAccount({ id: 2, nature: 'liability', allocation: 'bonds' }),
      ]
      mockData.balances = [makeBalance(1, 100000), makeBalance(2, -50000)]

      const { result } = renderHook(() => useAllocationData())
      const allocMap = result.current.allocMap
      const total = allocMap.get('total')
      expect(total).toBeDefined()
      expect(total!.get('bonds')).toBe(50000)
    })

    it('subtracts linked liability from linked asset allocation', () => {
      mockData.accounts = [
        makeAccount({ id: 1, nature: 'asset', allocation: 'real-estate' }),
        makeAccount({ id: 2, nature: 'liability', allocation: 'bonds', linkedAccountId: 1 }),
      ]
      mockData.balances = [makeBalance(1, 500000), makeBalance(2, -200000)]

      const { result } = renderHook(() => useAllocationData())
      const total = result.current.allocMap.get('total')
      expect(total!.get('real-estate')).toBe(300000)
    })

    it('skips inactive accounts from allocation', () => {
      mockData.accounts = [
        makeAccount({ id: 1, nature: 'asset', status: 'inactive', allocation: 'us-stock' }),
        makeAccount({ id: 2, nature: 'asset', allocation: 'bonds' }),
      ]
      mockData.balances = [makeBalance(1, 100000), makeBalance(2, 50000)]

      const { result } = renderHook(() => useAllocationData())
      const total = result.current.allocMap.get('total')
      expect(total!.has('us-stock')).toBe(false)
      expect(total!.get('bonds')).toBe(50000)
    })

    it('skips accounts with zero balance', () => {
      mockData.accounts = [
        makeAccount({ id: 1, nature: 'asset', allocation: 'us-stock' }),
        makeAccount({ id: 2, nature: 'liability', allocation: 'bonds' }),
      ]
      mockData.balances = [makeBalance(1, 100000), makeBalance(2, 0)]

      const { result } = renderHook(() => useAllocationData())
      const total = result.current.allocMap.get('total')
      expect(total!.has('bonds')).toBe(false)
    })

    it('filters liability accounts by goalType in fi/gw maps', () => {
      mockData.accounts = [
        makeAccount({ id: 1, nature: 'asset', allocation: 'us-stock', goalType: 'fi' }),
        makeAccount({ id: 2, nature: 'liability', allocation: 'bonds', goalType: 'gw' }),
      ]
      mockData.balances = [makeBalance(1, 100000), makeBalance(2, -30000)]

      const { result } = renderHook(() => useAllocationData())
      const fi = result.current.allocMap.get('fi')
      const gw = result.current.allocMap.get('gw')
      expect(fi!.has('bonds')).toBe(false)
      expect(gw!.get('bonds')).toBe(30000)
    })
  })
})
