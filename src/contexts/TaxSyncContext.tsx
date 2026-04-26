import { createContext, useContext, useCallback, useEffect, useRef, useMemo, FC, ReactNode } from 'react'
import { useGitHubSyncContext } from './GitHubSyncContext'
import { syncAllTaxFiles } from '../pages/taxes/taxGitHubSync'

export interface TaxSyncContextValue {
  syncTaxNow: (message?: string) => Promise<void>
  restoreTaxFromGitHub: () => Promise<void>
}

const TaxSyncContext = createContext<TaxSyncContextValue | null>(null)

export const useTaxSync = (): TaxSyncContextValue => {
  const ctx = useContext(TaxSyncContext)
  if (!ctx) {
    throw new Error(
      'useTaxSync must be used within a <TaxSyncProvider>. Wrap a parent component in <TaxSyncProvider> before calling useTaxSync().',
    )
  }
  return ctx
}

export const TaxSyncProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { config, activeToken, isConfigured, markDirty, clearDirty, syncTaxesNow, restoreTaxesLatest } =
    useGitHubSyncContext()

  // Refs to avoid stale closures in the debounced auto-sync setTimeout (Bug 2 fix)
  const configRef = useRef(config)
  const tokenRef = useRef(activeToken)
  const isConfiguredRef = useRef(isConfigured)
  useEffect(() => {
    configRef.current = config
  }, [config])
  useEffect(() => {
    tokenRef.current = activeToken
  }, [activeToken])
  useEffect(() => {
    isConfiguredRef.current = isConfigured
  }, [isConfigured])

  // Auto-sync taxes when tax-store changes (60s debounce)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const handler = () => {
      markDirty('taxes')
      if (timer) clearTimeout(timer)
      timer = setTimeout(async () => {
        const taxStore = JSON.parse(localStorage.getItem('tax-store') || '{}')
        const taxesPayload = {
          version: 1,
          exportedAt: new Date().toISOString(),
          taxStore,
          taxTemplates: JSON.parse(localStorage.getItem('tax-templates') || '[]'),
        }
        await syncTaxesNow(taxesPayload)
        if (isConfiguredRef.current && tokenRef.current) {
          await syncAllTaxFiles(configRef.current, tokenRef.current, taxStore).catch(e =>
            console.error('Tax file auto-sync error:', e),
          )
        }
      }, 60_000)
    }
    window.addEventListener('tax-store-changed', handler)
    return () => {
      window.removeEventListener('tax-store-changed', handler)
      if (timer) clearTimeout(timer)
    }
  }, [syncTaxesNow, markDirty])

  const syncTaxNow = useCallback(
    async (message?: string): Promise<void> => {
      const taxesPayload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        taxStore: JSON.parse(localStorage.getItem('tax-store') || '{}'),
        taxTemplates: JSON.parse(localStorage.getItem('tax-templates') || '[]'),
      }
      await syncTaxesNow(taxesPayload, message ? `Taxes: ${message}` : undefined)
      if (isConfiguredRef.current && tokenRef.current) {
        const taxStore = JSON.parse(localStorage.getItem('tax-store') || '{}')
        await syncAllTaxFiles(configRef.current, tokenRef.current, taxStore).catch(e =>
          console.error('Tax file sync error:', e),
        )
      }
      clearDirty('taxes')
    },
    [syncTaxesNow, clearDirty],
  )

  const restoreTaxFromGitHub = useCallback(async (): Promise<void> => {
    const taxResult = await restoreTaxesLatest()
    if (taxResult.ok && taxResult.data) {
      const t = taxResult.data as { taxStore?: unknown; taxTemplates?: unknown }
      if (t.taxStore && typeof t.taxStore === 'object') localStorage.setItem('tax-store', JSON.stringify(t.taxStore))
      if (Array.isArray(t.taxTemplates)) localStorage.setItem('tax-templates', JSON.stringify(t.taxTemplates))
    }
  }, [restoreTaxesLatest])

  const value = useMemo<TaxSyncContextValue>(
    () => ({
      syncTaxNow,
      restoreTaxFromGitHub,
    }),
    [syncTaxNow, restoreTaxFromGitHub],
  )

  return <TaxSyncContext.Provider value={value}>{children}</TaxSyncContext.Provider>
}

export default TaxSyncContext
