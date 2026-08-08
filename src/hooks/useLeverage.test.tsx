import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useLeverage } from './useLeverage'
import { makeAccount, makeBalanceEntry } from '../test/factories'
import type { Account, BalanceEntry } from '../pages/data/types'

let mockAccounts: Account[] = []
let mockBalances: BalanceEntry[] = []
let mockAllMonths: string[] = []

vi.mock('../contexts/DataContext', () => ({
  useData: () => ({
    accounts: mockAccounts,
    balances: mockBalances,
    allMonths: mockAllMonths,
  }),
}))

describe('useLeverage', () => {
  beforeEach(() => {
    mockAccounts = []
    mockBalances = []
    mockAllMonths = []
  })

  it('computes latest active asset, liability, net worth, and ratio totals', () => {
    mockAccounts = [
      makeAccount({ id: 1, name: 'Brokerage', nature: 'asset' }),
      makeAccount({ id: 2, name: 'Home', nature: 'asset', type: 'illiquid' }),
      makeAccount({ id: 3, name: 'Mortgage', nature: 'liability' }),
      makeAccount({ id: 4, name: 'Closed Card', nature: 'liability', status: 'inactive' }),
    ]
    mockBalances = [
      makeBalanceEntry({ id: 1, accountId: 1, month: '2026-01', balance: 120000 }),
      makeBalanceEntry({ id: 2, accountId: 2, month: '2026-01', balance: 90000 }),
      makeBalanceEntry({ id: 3, accountId: 3, month: '2026-01', balance: -70000 }),
      makeBalanceEntry({ id: 4, accountId: 4, month: '2026-01', balance: -10000 }),
      makeBalanceEntry({ id: 5, accountId: 1, month: '2026-02', balance: 130000 }),
      makeBalanceEntry({ id: 6, accountId: 2, month: '2026-02', balance: 95000 }),
      makeBalanceEntry({ id: 7, accountId: 3, month: '2026-02', balance: -75000 }),
      makeBalanceEntry({ id: 8, accountId: 4, month: '2026-02', balance: -12000 }),
    ]
    mockAllMonths = ['2026-01', '2026-02']

    const { result } = renderHook(() => useLeverage())

    expect(result.current.totalAssets).toBe(225000)
    expect(result.current.totalLiabilities).toBe(75000)
    expect(result.current.netWorth).toBe(150000)
    expect(result.current.currentRatio).toBeCloseTo(3)
  })

  it('computes acquisition results including down payment and unchanged net worth', () => {
    mockAccounts = [
      makeAccount({ id: 1, name: 'Brokerage', nature: 'asset' }),
      makeAccount({ id: 2, name: 'Mortgage', nature: 'liability' }),
    ]
    mockBalances = [
      makeBalanceEntry({ id: 1, accountId: 1, month: '2026-02', balance: 210000 }),
      makeBalanceEntry({ id: 2, accountId: 2, month: '2026-02', balance: -70000 }),
    ]
    mockAllMonths = ['2026-02']

    const { result } = renderHook(() => useLeverage())
    const acquisition = result.current.computeAcquisition(2, 0.2)

    expect(acquisition).not.toBeNull()
    expect(acquisition?.acquisitionAmount).toBeCloseTo(70000)
    expect(acquisition?.purchasePrice).toBeCloseTo(87500)
    expect(acquisition?.downPayment).toBeCloseTo(17500)
    expect(acquisition?.newAssets).toBeCloseTo(280000)
    expect(acquisition?.newLiabilities).toBeCloseTo(140000)
    expect(acquisition?.newRatio).toBeCloseTo(2)
    expect(acquisition?.netWorth).toBeCloseTo(140000)
  })

  it('returns ratio history with formatted labels and null gaps when liabilities are missing', () => {
    mockAccounts = [
      makeAccount({ id: 1, name: 'Brokerage', nature: 'asset' }),
      makeAccount({ id: 2, name: 'Mortgage', nature: 'liability' }),
    ]
    mockBalances = [
      makeBalanceEntry({ id: 1, accountId: 1, month: '2026-01', balance: 100000 }),
      makeBalanceEntry({ id: 2, accountId: 2, month: '2026-01', balance: -50000 }),
      makeBalanceEntry({ id: 3, accountId: 1, month: '2026-02', balance: 110000 }),
      makeBalanceEntry({ id: 4, accountId: 1, month: '2026-03', balance: 120000 }),
      makeBalanceEntry({ id: 5, accountId: 2, month: '2026-03', balance: -60000 }),
    ]
    mockAllMonths = ['2026-01', '2026-02', '2026-03']

    const { result } = renderHook(() => useLeverage())
    const history = result.current.getRatioHistory()

    expect(history).toEqual([
      { month: '2026-01', label: 'Jan 2026', ratio: 2 },
      { month: '2026-02', label: 'Feb 2026', ratio: null },
      { month: '2026-03', label: 'Mar 2026', ratio: 2 },
    ])
  })
})
