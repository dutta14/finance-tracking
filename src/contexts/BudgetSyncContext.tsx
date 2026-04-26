import { createContext, useContext, useEffect, useCallback, useMemo, FC, ReactNode } from 'react'
import { useGitHubSyncContext } from './GitHubSyncContext'
import { loadBudgetStore, getBudgetConfigData, saveBudgetStore } from '../pages/budget/utils/budgetStorage'
import {
  syncAllBudgetCSVs,
  uploadBudgetConfig,
  downloadAllBudgetCSVs,
  downloadBudgetConfig,
} from '../pages/budget/utils/budgetGitHubSync'

export interface BudgetSyncContextValue {
  syncBudgetNow: () => Promise<void>
  restoreBudgetFromGitHub: () => Promise<void>
}

const BudgetSyncContext = createContext<BudgetSyncContextValue | null>(null)

export const useBudgetSync = (): BudgetSyncContextValue => {
  const ctx = useContext(BudgetSyncContext)
  if (!ctx) {
    throw new Error(
      'useBudgetSync must be used within a <BudgetSyncProvider>. Wrap a parent component in <BudgetSyncProvider> before calling useBudgetSync().',
    )
  }
  return ctx
}

export const BudgetSyncProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { config, activeToken, isConfigured, markDirty, clearDirty } = useGitHubSyncContext()

  useEffect(() => {
    const onBudget = () => markDirty('budget')
    window.addEventListener('budget-changed', onBudget)
    return () => window.removeEventListener('budget-changed', onBudget)
  }, [markDirty])

  const syncBudgetNow = useCallback(async (): Promise<void> => {
    if (isConfigured && activeToken) {
      const budgetStore = loadBudgetStore()
      await uploadBudgetConfig(config, activeToken, getBudgetConfigData(budgetStore))
      await syncAllBudgetCSVs(config, activeToken, budgetStore.csvs)
    }
    clearDirty('budget')
  }, [config, activeToken, isConfigured, clearDirty])

  const restoreBudgetFromGitHub = useCallback(async (): Promise<void> => {
    if (isConfigured && activeToken) {
      const [csvResult, configResult] = await Promise.all([
        downloadAllBudgetCSVs(config, activeToken).catch(() => ({ ok: false as const })),
        downloadBudgetConfig(config, activeToken).catch(() => ({ ok: false as const })),
      ])
      const budgetStore = loadBudgetStore()
      if (csvResult.ok && 'csvs' in csvResult && csvResult.csvs) {
        Object.entries(csvResult.csvs).forEach(([monthKey, csv]) => {
          budgetStore.csvs[monthKey] = { month: monthKey, csv, uploadedAt: new Date().toISOString() }
        })
      }
      if (configResult.ok && 'data' in configResult && configResult.data) {
        budgetStore.years = configResult.data.years || budgetStore.years
        budgetStore.categoryGroups = configResult.data.categoryGroups || budgetStore.categoryGroups
      }
      saveBudgetStore(budgetStore)
    }
  }, [config, activeToken, isConfigured])

  const value = useMemo<BudgetSyncContextValue>(
    () => ({
      syncBudgetNow,
      restoreBudgetFromGitHub,
    }),
    [syncBudgetNow, restoreBudgetFromGitHub],
  )

  return <BudgetSyncContext.Provider value={value}>{children}</BudgetSyncContext.Provider>
}

export default BudgetSyncContext
