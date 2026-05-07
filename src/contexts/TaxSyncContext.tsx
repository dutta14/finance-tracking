import { createContext, useContext, useCallback, useEffect, useRef, useMemo, FC, ReactNode } from 'react'
import { useGitHubSyncContext } from './GitHubSyncContext'
import { useEncryption } from './EncryptionContext'
import { syncAllTaxFiles } from '../pages/taxes/taxGitHubSync'
import { appStorage } from '../utils/appStorage'

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
  const { cryptoKey } = useEncryption()

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
  const cryptoKeyRef = useRef(cryptoKey)
  useEffect(() => {
    cryptoKeyRef.current = cryptoKey
  }, [cryptoKey])

  // Auto-sync taxes when tax-store changes (60s debounce)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const handler = () => {
      markDirty('taxes')
      if (timer) clearTimeout(timer)
      timer = setTimeout(async () => {
        const taxStore = appStorage.getJSON('tax-store', {})
        const taxesPayload = {
          version: 1,
          exportedAt: new Date().toISOString(),
          taxStore,
          taxTemplates: appStorage.getJSON('tax-templates', []),
        }
        await syncTaxesNow(taxesPayload)
        if (isConfiguredRef.current && tokenRef.current) {
          await syncAllTaxFiles(configRef.current, tokenRef.current, taxStore, cryptoKeyRef.current).catch(e =>
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
        taxStore: appStorage.getJSON('tax-store', {}),
        taxTemplates: appStorage.getJSON('tax-templates', []),
      }
      await syncTaxesNow(taxesPayload, message ? `Taxes: ${message}` : undefined)
      if (isConfiguredRef.current && tokenRef.current) {
        const taxStore = appStorage.getJSON('tax-store', {})
        await syncAllTaxFiles(configRef.current, tokenRef.current, taxStore, cryptoKey).catch(e =>
          console.error('Tax file sync error:', e),
        )
      }
      clearDirty('taxes')
    },
    [syncTaxesNow, clearDirty, cryptoKey],
  )

  const restoreTaxFromGitHub = useCallback(async (): Promise<void> => {
    const taxResult = await restoreTaxesLatest()
    if (taxResult.ok && taxResult.data) {
      const t = taxResult.data as { taxStore?: unknown; taxTemplates?: unknown }
      if (t.taxStore && typeof t.taxStore === 'object') appStorage.setJSON('tax-store', t.taxStore)
      if (Array.isArray(t.taxTemplates)) appStorage.setJSON('tax-templates', t.taxTemplates)
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
