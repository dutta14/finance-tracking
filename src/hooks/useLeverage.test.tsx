import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useLeverage, useLeverageSettings, EMPTY_LEVERAGE_SETTINGS, LEVERAGE_PATH } from './useLeverage'
import { makeAccount, makeBalanceEntry } from '../test/factories'
import type { Account, BalanceEntry } from '../pages/data/types'
import type { LeverageSettings } from './useLeverage'

let mockAccounts: Account[] = []
let mockBalances: BalanceEntry[] = []
let mockAllMonths: string[] = []
const mockReadJSON = vi.fn()
const mockWriteJSON = vi.fn()
const unsubscribeSpy = vi.fn()
const mockSubscribe = vi.fn(() => unsubscribeSpy)

vi.mock('../contexts/DataContext', () => ({
  useData: () => ({
    accounts: mockAccounts,
    balances: mockBalances,
    allMonths: mockAllMonths,
  }),
}))

vi.mock('../contexts/FileStoreContext', () => ({
  useFileStore: () => ({
    fileStore: {
      readJSON: mockReadJSON,
      writeJSON: mockWriteJSON,
      subscribe: mockSubscribe,
    },
  }),
}))

describe('useLeverage', () => {
  beforeEach(() => {
    mockAccounts = []
    mockBalances = []
    mockAllMonths = []
    mockReadJSON.mockReset()
    mockWriteJSON.mockReset()
    mockSubscribe.mockReset()
    mockSubscribe.mockReturnValue(unsubscribeSpy)
    unsubscribeSpy.mockReset()
  })

  it('computes latest asset, liability, net worth, and ratio totals', () => {
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
    expect(result.current.totalLiabilities).toBe(87000)
    expect(result.current.netWorth).toBe(138000)
    expect(result.current.currentRatio).toBeCloseTo(225000 / 87000)
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
      { month: '2026-01', label: 'Jan 2026', ratio: 2, assets: 100000, liabilities: 50000 },
      { month: '2026-02', label: 'Feb 2026', ratio: null, assets: 110000, liabilities: 0 },
      { month: '2026-03', label: 'Mar 2026', ratio: 2, assets: 120000, liabilities: 60000 },
    ])
  })

  it('builds asset and liability breakdowns and linked real-estate property equity', () => {
    mockAccounts = [
      makeAccount({ id: 1, name: 'Cash', nature: 'asset', allocation: 'cash' }),
      makeAccount({ id: 2, name: 'Primary Home', nature: 'asset', allocation: 'real-estate' }),
      makeAccount({ id: 3, name: 'Primary Mortgage', nature: 'liability', allocation: 'debt', linkedAccountId: 2 }),
      makeAccount({ id: 4, name: 'Brokerage Margin', nature: 'liability', allocation: 'debt' }),
      makeAccount({ id: 5, name: 'Vacation Home Loan', nature: 'liability', allocation: 'debt' }),
    ]
    mockBalances = [
      makeBalanceEntry({ id: 1, accountId: 1, month: '2026-04', balance: 25000 }),
      makeBalanceEntry({ id: 2, accountId: 2, month: '2026-04', balance: 300000 }),
      makeBalanceEntry({ id: 3, accountId: 3, month: '2026-04', balance: -180000 }),
      makeBalanceEntry({ id: 4, accountId: 4, month: '2026-04', balance: -15000 }),
      makeBalanceEntry({ id: 5, accountId: 5, month: '2026-04', balance: -50000 }),
    ]
    mockAllMonths = ['2026-04']

    const { result } = renderHook(() => useLeverage())

    expect(result.current.assetBreakdown.cash).toBe(25000)
    expect(result.current.assetBreakdown['real-estate']).toBe(300000)
    expect(result.current.liabilityBreakdown['real-estate']).toBe(230000)
    expect(result.current.liabilityBreakdown.debt).toBe(15000)
    expect(result.current.realEstateProperties).toEqual([
      {
        accountId: 2,
        name: 'Primary Home',
        value: 300000,
        mortgage: 180000,
        equity: 120000,
      },
    ])
  })

  it('returns null for invalid acquisition requests and supports filtered ratio history', () => {
    mockAccounts = [
      makeAccount({ id: 1, name: 'Brokerage', nature: 'asset' }),
      makeAccount({ id: 2, name: 'Mortgage', nature: 'liability' }),
    ]
    mockBalances = [
      makeBalanceEntry({ id: 1, accountId: 1, month: '2026-01', balance: 100000 }),
      makeBalanceEntry({ id: 2, accountId: 2, month: '2026-01', balance: -50000 }),
      makeBalanceEntry({ id: 3, accountId: 1, month: '2026-02', balance: 120000 }),
      makeBalanceEntry({ id: 4, accountId: 2, month: '2026-02', balance: -60000 }),
      makeBalanceEntry({ id: 5, accountId: 1, month: '2026-03', balance: 140000 }),
      makeBalanceEntry({ id: 6, accountId: 2, month: '2026-03', balance: -70000 }),
    ]
    mockAllMonths = ['2026-01', '2026-02', '2026-03']

    const { result } = renderHook(() => useLeverage())

    expect(result.current.computeAcquisition(3, 0.2)).toBeNull()
    expect(result.current.computeAcquisition(1, 0.2)).toBeNull()
    expect(result.current.computeAcquisition(2, -0.1)).toBeNull()
    expect(result.current.computeAcquisition(2, 1)).toBeNull()
    expect(result.current.getRatioHistory('2026-02').map(point => point.month)).toEqual(['2026-02', '2026-03'])
  })
})

describe('useLeverageSettings', () => {
  beforeEach(() => {
    mockReadJSON.mockReset()
    mockWriteJSON.mockReset()
    mockSubscribe.mockReset()
    unsubscribeSpy.mockReset()
    mockReadJSON.mockResolvedValue(EMPTY_LEVERAGE_SETTINGS)
    mockWriteJSON.mockResolvedValue(undefined)
    mockSubscribe.mockReturnValue(unsubscribeSpy)
  })

  it('loads saved leverage settings and subscribes for refreshes', async () => {
    const savedSettings: Partial<LeverageSettings> = {
      chartStart: '2026-01',
      currentScenarioName: 'Aggressive',
      scenarios: [{ id: 'scenario-1', name: 'Aggressive', target: '2.5', allocations: [] }],
    }
    mockReadJSON.mockResolvedValue(savedSettings)

    const { result } = renderHook(() => useLeverageSettings())

    await waitFor(() => expect(result.current.loaded).toBe(true))

    expect(result.current.settings).toEqual({ ...EMPTY_LEVERAGE_SETTINGS, ...savedSettings })
    expect(mockReadJSON).toHaveBeenCalledWith(LEVERAGE_PATH, EMPTY_LEVERAGE_SETTINGS)
    expect(mockSubscribe).toHaveBeenCalledWith(LEVERAGE_PATH, expect.any(Function))
  })

  it('falls back to defaults when reading settings fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockReadJSON.mockRejectedValue(new Error('broken'))

    const { result } = renderHook(() => useLeverageSettings())

    await waitFor(() => expect(result.current.loaded).toBe(true))

    expect(result.current.settings).toEqual(EMPTY_LEVERAGE_SETTINGS)
    expect(consoleErrorSpy).toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('writes updated settings and dispatches a tools-changed event', async () => {
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent')
    const { result } = renderHook(() => useLeverageSettings())

    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => {
      result.current.setSettings(prev => ({ ...prev, chartStart: '2026-03' }))
    })

    await waitFor(() => {
      expect(result.current.settings.chartStart).toBe('2026-03')
    })

    expect(mockWriteJSON).toHaveBeenCalledWith(LEVERAGE_PATH, expect.objectContaining({ chartStart: '2026-03' }))
    expect(dispatchEventSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'tools-changed' }))
    dispatchEventSpy.mockRestore()
  })

  it('unsubscribes on unmount', async () => {
    const { unmount } = renderHook(() => useLeverageSettings())

    await waitFor(() => expect(mockSubscribe).toHaveBeenCalled())
    unmount()

    expect(unsubscribeSpy.mock.calls.length).toBeGreaterThanOrEqual(1)
  })
})
