import { useCallback, useMemo } from 'react'
import { useData } from '../contexts/DataContext'
import type { AssetAllocation } from '../pages/data/types'

export type AssetBreakdown = Record<AssetAllocation, number>

export interface LeverageData {
  totalAssets: number
  totalLiabilities: number
  netWorth: number
  currentRatio: number | null
}

export interface AcquisitionResult {
  acquisitionAmount: number
  purchasePrice: number
  downPayment: number
  newAssets: number
  newLiabilities: number
  newRatio: number
  netWorth: number
}

export interface RatioDataPoint {
  month: string
  label: string
  ratio: number | null
  assets: number
  liabilities: number
}

interface MonthlyTotals {
  assets: number
  liabilities: number
}

const EMPTY_TOTALS: MonthlyTotals = { assets: 0, liabilities: 0 }

const formatMonthLabel = (month: string) => {
  const [year, mon] = month.split('-').map(Number)
  return new Date(year, mon - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export function useLeverage() {
  const { accounts, balances, allMonths } = useData()

  const natureById = useMemo(() => {
    const map = new Map<number, 'asset' | 'liability'>()
    for (const account of accounts) {
      map.set(account.id, account.nature || 'asset')
    }
    return map
  }, [accounts])

  const totalsByMonth = useMemo(() => {
    const map = new Map<string, MonthlyTotals>()

    for (const month of allMonths) {
      map.set(month, { assets: 0, liabilities: 0 })
    }

    for (const entry of balances) {
      const nature = natureById.get(entry.accountId)
      if (!nature) continue

      const totals = map.get(entry.month) ?? { assets: 0, liabilities: 0 }
      if (!map.has(entry.month)) map.set(entry.month, totals)

      if (nature === 'asset') totals.assets += entry.balance
      else totals.liabilities += Math.abs(entry.balance)
    }

    return map
  }, [natureById, allMonths, balances])

  const leverageData = useMemo<LeverageData>(() => {
    const latestMonth = allMonths[allMonths.length - 1]
    const latestTotals = (latestMonth && totalsByMonth.get(latestMonth)) || EMPTY_TOTALS
    const totalAssets = latestTotals.assets
    const totalLiabilities = latestTotals.liabilities

    return {
      totalAssets,
      totalLiabilities,
      netWorth: totalAssets - totalLiabilities,
      currentRatio: totalLiabilities > 0 ? totalAssets / totalLiabilities : null,
    }
  }, [allMonths, totalsByMonth])

  const assetBreakdown = useMemo<AssetBreakdown>(() => {
    const breakdown: AssetBreakdown = {
      cash: 0, 'us-stock': 0, 'intl-stock': 0, bonds: 0, 'real-estate': 0, others: 0, debt: 0,
    }
    const latestMonth = allMonths[allMonths.length - 1]
    if (!latestMonth) return breakdown

    for (const entry of balances) {
      if (entry.month !== latestMonth) continue
      const account = accounts.find(a => a.id === entry.accountId)
      if (!account || account.nature !== 'asset') continue
      const category = account.allocation || 'others'
      breakdown[category] = (breakdown[category] || 0) + entry.balance
    }
    return breakdown
  }, [accounts, allMonths, balances])

  const liabilityBreakdown = useMemo<AssetBreakdown>(() => {
    const breakdown: AssetBreakdown = {
      cash: 0, 'us-stock': 0, 'intl-stock': 0, bonds: 0, 'real-estate': 0, others: 0, debt: 0,
    }
    const latestMonth = allMonths[allMonths.length - 1]
    if (!latestMonth) return breakdown

    // Build a set of real-estate asset IDs for linkedAccountId lookup
    const reAssetIds = new Set(
      accounts.filter(a => a.nature === 'asset' && a.allocation === 'real-estate').map(a => a.id),
    )

    for (const entry of balances) {
      if (entry.month !== latestMonth) continue
      const account = accounts.find(a => a.id === entry.accountId)
      if (!account || account.nature !== 'liability') continue

      // Categorize: if explicitly tagged RE, use that; if linked to a RE asset, count as RE;
      // also check name for mortgage-related keywords
      let category = account.allocation || 'debt'
      if (category === 'debt') {
        if (account.linkedAccountId && reAssetIds.has(account.linkedAccountId)) {
          category = 'real-estate'
        } else if (/mortgage|home\s*loan/i.test(account.name)) {
          category = 'real-estate'
        }
      }
      breakdown[category] = (breakdown[category] || 0) + Math.abs(entry.balance)
    }
    return breakdown
  }, [accounts, allMonths, balances])

  const computeAcquisition = useCallback(
    (targetRatio: number, downPaymentPct: number): AcquisitionResult | null => {
      const { totalAssets, totalLiabilities, netWorth, currentRatio } = leverageData

      if (currentRatio === null || targetRatio <= 1 || targetRatio >= currentRatio) return null
      if (downPaymentPct < 0 || downPaymentPct >= 1) return null

      const acquisitionAmount = (totalAssets - targetRatio * totalLiabilities) / (targetRatio - 1)
      if (!Number.isFinite(acquisitionAmount) || acquisitionAmount <= 0) return null

      const purchasePrice = acquisitionAmount / (1 - downPaymentPct)
      const downPayment = purchasePrice * downPaymentPct
      const newAssets = totalAssets + acquisitionAmount
      const newLiabilities = totalLiabilities + acquisitionAmount
      const newRatio = newAssets / newLiabilities

      return {
        acquisitionAmount,
        purchasePrice,
        downPayment,
        newAssets,
        newLiabilities,
        newRatio,
        netWorth,
      }
    },
    [leverageData],
  )

  const getRatioHistory = useCallback(
    (startMonth?: string): RatioDataPoint[] => {
      const months = startMonth ? allMonths.filter(m => m >= startMonth) : allMonths
      return months.map(month => {
        const totals = totalsByMonth.get(month) || EMPTY_TOTALS
        return {
          month,
          label: formatMonthLabel(month),
          ratio: totals.liabilities > 0 ? totals.assets / totals.liabilities : null,
          assets: totals.assets,
          liabilities: totals.liabilities,
        }
      })
    },
    [allMonths, totalsByMonth],
  )

  return {
    ...leverageData,
    assetBreakdown,
    liabilityBreakdown,
    computeAcquisition,
    getRatioHistory,
  }
}

export default useLeverage
