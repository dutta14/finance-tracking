import { createContext, useContext, useEffect, useCallback, useMemo, FC, ReactNode } from 'react'
import { useGitHubSync } from '../hooks/useGitHubSync'
import type {
  GitHubSyncConfig,
  SyncStatus,
  SyncDomain,
  SyncProgress,
  CommitEntry,
  ConnectionTestResult,
  RestoreResult,
} from '../hooks/useGitHubSync'
import { useSettings } from './SettingsContext'
import { useGoals } from './GoalsContext'
import type { GwGoal } from '../types'
import type { Account, BalanceEntry } from '../pages/data/types'
import { appStorage } from '../utils/appStorage'
import { getStorageItem, setStorageItem } from '../utils/storage'
import { validateImportPayload } from '../utils/importValidator'

export interface GitHubSyncContextValue {
  config: GitHubSyncConfig
  updateConfig: (updates: Partial<GitHubSyncConfig>) => void
  isConfigured: boolean
  syncStatus: SyncStatus
  activeToken: string | null
  lastSyncAt: string | null
  lastError: string | null
  hasPendingChanges: boolean
  dirtyFlags: Record<SyncDomain, boolean>
  syncProgress: SyncProgress | null
  history: CommitEntry[]
  hasStoredToken: boolean
  tokenUnlocked: boolean
  saveEncryptedToken: (token: string, passphrase: string) => Promise<{ ok: boolean; message: string }>
  unlockToken: (passphrase: string) => Promise<{ ok: boolean; message: string }>
  lockToken: () => void
  fetchHistory: () => Promise<void>
  testConnection: () => Promise<ConnectionTestResult>
  restoreLatest: () => Promise<RestoreResult>
  restoreFromCommit: (commitSha: string) => Promise<RestoreResult>
  handleSyncNow: (data: object, message?: string, forceFull?: boolean) => Promise<void>
  handleDataChange: (accounts: Account[], balances: BalanceEntry[]) => void
  applyRestoredSnapshot: (data: unknown) => Promise<void>
  ghDataToSync: object
  markDirty: (domain: SyncDomain) => void
  clearDirty: (domain: SyncDomain) => void
  syncTaxesNow: (data: object, message?: string) => Promise<void>
  restoreTaxesLatest: () => Promise<RestoreResult>
}

const GitHubSyncContext = createContext<GitHubSyncContextValue | null>(null)

export const useGitHubSyncContext = (): GitHubSyncContextValue => {
  const ctx = useContext(GitHubSyncContext)
  if (!ctx) {
    throw new Error(
      'useGitHubSyncContext must be used within a <GitHubSyncProvider>. Wrap a parent component in <GitHubSyncProvider> before calling useGitHubSyncContext().',
    )
  }
  return ctx
}

const DOMAIN_LABELS: Record<string, string> = {
  goals: 'Goals',
  data: 'Balances',
  tools: 'Tools',
  allocation: 'Allocation',
}

const getDataSnapshot = (): { accounts: Account[]; balances: BalanceEntry[] } => {
  return {
    accounts: appStorage.getJSON<Account[]>('data-accounts', []),
    balances: appStorage.getJSON<BalanceEntry[]>('data-balances', []),
  }
}

export const GitHubSyncProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { goals, gwGoals, profile, importGoals, importGwGoals, updateProfile } = useGoals()
  const { darkMode, accentTheme, allowCsvImport, setDarkMode, setAccentTheme, setAllowCsvImport } = useSettings()

  const {
    config: ghConfig,
    updateConfig: updateGhConfig,
    isConfigured: ghIsConfigured,
    syncStatus,
    lastSyncAt,
    lastError,
    hasPendingChanges: hasPendingGhChanges,
    history: ghHistory,
    hasStoredToken,
    tokenUnlocked,
    activeToken: ghActiveToken,
    saveEncryptedToken,
    unlockToken,
    lockToken,
    syncNow,
    fetchHistory,
    testConnection,
    restoreLatest,
    restoreFromCommit,
    markRestored,
    updateData: ghUpdateData,
    updateDataFile: ghUpdateDataFile,
    syncDataNow: ghSyncDataNow,
    restoreDataLatest,
    syncToolsNow: ghSyncToolsNow,
    restoreToolsLatest,
    syncAllocationNow: ghSyncAllocationNow,
    restoreAllocationLatest,
    syncTaxesNow: ghSyncTaxesNow,
    restoreTaxesLatest,
    dirtyFlags: ghDirtyFlags,
    syncProgress: ghSyncProgress,
    setSyncProgress: ghSetSyncProgress,
    setSyncStatus: ghSetSyncStatus,
    setLastSyncAt: ghSetLastSyncAt,
    setLastError: ghSetLastError,
    markDirty: ghMarkDirty,
    clearDirty: ghClearDirty,
  } = useGitHubSync()

  // Auto-sync whenever goals, gwGoals, profile, or themes change
  useEffect(() => {
    ghUpdateData({
      version: 2,
      exportedAt: new Date().toISOString(),
      goals,
      gwGoals,
      profile,
      settings: { accentTheme, darkMode, allowCsvImport },
    })
  }, [goals, gwGoals, profile, accentTheme, darkMode, allowCsvImport]) // eslint-disable-line react-hooks/exhaustive-deps

  // Mark dirty when tools/allocation change
  useEffect(() => {
    const onTools = () => ghMarkDirty('tools')
    const onAllocation = () => ghMarkDirty('allocation')
    window.addEventListener('tools-changed', onTools)
    window.addEventListener('allocation-changed', onAllocation)
    return () => {
      window.removeEventListener('tools-changed', onTools)
      window.removeEventListener('allocation-changed', onAllocation)
    }
  }, [ghMarkDirty])

  const handleDataChange = useCallback(
    (accounts: Account[], balances: BalanceEntry[]): void => {
      ghUpdateDataFile({ version: 1, exportedAt: new Date().toISOString(), accounts, balances })
    },
    [ghUpdateDataFile],
  )

  const handleSyncNow = useCallback(
    async (_data: object, message?: string, forceFull?: boolean): Promise<void> => {
      if (syncStatus === 'syncing') return

      const domains: Array<'goals' | 'data' | 'tools' | 'allocation'> = ['goals', 'data', 'tools', 'allocation']
      const dirtySnapshot = { ...ghDirtyFlags }
      const toSync = forceFull ? domains : domains.filter(d => dirtySnapshot[d])

      if (toSync.length === 0) {
        ghSetSyncStatus('success')
        ghSetLastSyncAt(new Date().toISOString())
        ghSetLastError(null)
        ghSetSyncProgress({ total: 0, completed: 0, current: '', errors: [], domains: [] })
        setTimeout(() => ghSetSyncProgress(null), 2000)
        return
      }

      ghSetSyncStatus('syncing')
      ghSetLastError(null)
      ghSetSyncProgress({
        total: toSync.length,
        completed: 0,
        current: DOMAIN_LABELS[toSync[0]],
        errors: [],
        domains: toSync,
      })
      const errors: string[] = []

      for (let i = 0; i < toSync.length; i++) {
        const domain = toSync[i]
        ghSetSyncProgress(prev => (prev ? { ...prev, completed: i, current: DOMAIN_LABELS[domain] } : prev))

        if (i > 0) await new Promise(r => setTimeout(r, 500))

        try {
          switch (domain) {
            case 'goals':
              await syncNow(
                {
                  version: 2,
                  exportedAt: new Date().toISOString(),
                  goals,
                  gwGoals,
                  profile,
                  settings: {
                    accentTheme,
                    darkMode,
                    allowCsvImport,
                    goalViewMode: getStorageItem('goal-view-mode', ''),
                    homeCardOrder: JSON.stringify(getStorageItem('home-card-order', [0, 1, 2, 3])),
                  },
                },
                message,
              )
              ghClearDirty('goals')
              break
            case 'data': {
              const snap = getDataSnapshot()
              await ghSyncDataNow(
                { version: 1, exportedAt: new Date().toISOString(), accounts: snap.accounts, balances: snap.balances },
                message ? `Data: ${message}` : undefined,
              )
              ghClearDirty('data')
              break
            }
            case 'tools':
              await ghSyncToolsNow(
                {
                  version: 1,
                  exportedAt: new Date().toISOString(),
                  fiSimulations: appStorage.getJSON('fi-simulations', []),
                  sgtOverrides: appStorage.getJSON('sgt-overrides', {}),
                },
                message ? `Tools: ${message}` : undefined,
              )
              ghClearDirty('tools')
              break
            case 'allocation':
              await ghSyncAllocationNow(
                {
                  version: 1,
                  exportedAt: new Date().toISOString(),
                  allocationCustomRatios: appStorage.getJSON('allocation-custom-ratios', []),
                },
                message ? `Allocation: ${message}` : undefined,
              )
              ghClearDirty('allocation')
              break
          }
        } catch (e) {
          const errMsg = `${DOMAIN_LABELS[domain]}: ${e instanceof Error ? e.message : String(e)}`
          errors.push(errMsg)
          console.error(`Sync error for ${domain}:`, e)
        }
      }

      ghSetSyncProgress({ total: toSync.length, completed: toSync.length, current: '', errors, domains: toSync })
      ghSetSyncStatus(errors.length > 0 ? 'error' : 'success')
      if (errors.length > 0) ghSetLastError(errors.join('; '))
      else ghSetLastSyncAt(new Date().toISOString())
      setTimeout(() => ghSetSyncProgress(null), 4000)
    },
    [
      syncStatus,
      ghDirtyFlags,
      goals,
      gwGoals,
      profile,
      accentTheme,
      darkMode,
      allowCsvImport,
      syncNow,
      ghSyncDataNow,
      ghSyncToolsNow,
      ghSyncAllocationNow,
      ghClearDirty,
      ghSetSyncStatus,
      ghSetLastSyncAt,
      ghSetLastError,
      ghSetSyncProgress,
    ],
  )

  const applyRestoredSnapshot = useCallback(
    async (data: unknown): Promise<void> => {
      try {
        const result = validateImportPayload(data)

        if (!result.valid || !result.sanitized) {
          console.error('Restore validation failed:', result.errors)
          throw new Error(`Invalid backup data: ${result.errors.join('; ')}`)
        }

        if (result.warnings.length > 0) {
          console.warn('[restore] Warnings:', result.warnings)
        }

        const validated = result.sanitized

        importGoals(validated.goals)

        let restoreProfile: Partial<typeof profile> = profile
        if (validated.profile) {
          restoreProfile = validated.profile
          updateProfile(restoreProfile)
        }

        let restoreGwGoals: GwGoal[] = []
        if (validated.gwGoals) {
          restoreGwGoals = validated.gwGoals
          importGwGoals(restoreGwGoals)
        }

        if (validated.settings) {
          if (validated.settings.accentTheme) setAccentTheme(validated.settings.accentTheme)
          if (validated.settings.darkMode !== undefined) setDarkMode(!!validated.settings.darkMode)
          if (validated.settings.allowCsvImport !== undefined) setAllowCsvImport(!!validated.settings.allowCsvImport)
          if (validated.settings.goalViewMode) setStorageItem('goal-view-mode', validated.settings.goalViewMode)
          if (validated.settings.homeCardOrder) {
            try {
              const order = JSON.parse(validated.settings.homeCardOrder) as number[]
              setStorageItem('home-card-order', order)
            } catch {
              localStorage.setItem('home-card-order', validated.settings.homeCardOrder)
            }
          }
        }

        let restoredGhConfig = ghConfig
        if (validated.gitHubConfig) {
          const cfg = validated.gitHubConfig
          restoredGhConfig = {
            owner: (cfg.owner as string) || '',
            repo: (cfg.repo as string) || '',
            filePath: (cfg.filePath as string) || 'finance-goals.json',
            autoSync: (cfg.autoSync as boolean) || false,
            encryptedToken: ghConfig.encryptedToken,
            tokenSalt: ghConfig.tokenSalt,
            tokenIv: ghConfig.tokenIv,
          }
          updateGhConfig(restoredGhConfig)
        }

        await new Promise(r => setTimeout(r, 300))
        appStorage.setJSON('financialGoals', validated.goals)
        appStorage.setJSON('gw-goals', restoreGwGoals)
        appStorage.setJSON('user-profile', restoreProfile || profile)
        setStorageItem('github-sync-config', restoredGhConfig)

        try {
          const dataResult = await restoreDataLatest()
          if (dataResult.ok && dataResult.data) {
            const d = dataResult.data as { accounts?: unknown; balances?: unknown }
            if (Array.isArray(d.accounts)) appStorage.setJSON('data-accounts', d.accounts)
            if (Array.isArray(d.balances)) appStorage.setJSON('data-balances', d.balances)
          } else {
            if (validated.dataAccounts) appStorage.setJSON('data-accounts', validated.dataAccounts)
            if (validated.dataBalances) appStorage.setJSON('data-balances', validated.dataBalances)
          }
          const toolsResult = await restoreToolsLatest()
          if (toolsResult.ok && toolsResult.data) {
            const t = toolsResult.data as { fiSimulations?: unknown; sgtOverrides?: unknown }
            if (Array.isArray(t.fiSimulations)) appStorage.setJSON('fi-simulations', t.fiSimulations)
            if (t.sgtOverrides && typeof t.sgtOverrides === 'object')
              appStorage.setJSON('sgt-overrides', t.sgtOverrides)
          }
          const allocResult = await restoreAllocationLatest()
          if (allocResult.ok && allocResult.data) {
            const a = allocResult.data as { allocationCustomRatios?: unknown }
            if (Array.isArray(a.allocationCustomRatios))
              appStorage.setJSON('allocation-custom-ratios', a.allocationCustomRatios)
          }
        } catch {
          markRestored()
        }

        await new Promise(r => setTimeout(r, 100))
      } catch (e) {
        console.error('Restore error:', e instanceof Error ? e.message : e)
      }
    },
    [
      profile,
      ghConfig,
      importGoals,
      importGwGoals,
      updateProfile,
      setAccentTheme,
      setDarkMode,
      setAllowCsvImport,
      updateGhConfig,
      markRestored,
      restoreDataLatest,
      restoreToolsLatest,
      restoreAllocationLatest,
    ],
  )

  const ghDataToSync = useMemo(
    () => ({
      version: 2,
      goals,
      gwGoals,
      profile,
      settings: { accentTheme, darkMode, allowCsvImport },
    }),
    [goals, gwGoals, profile, accentTheme, darkMode, allowCsvImport],
  )

  const value = useMemo<GitHubSyncContextValue>(
    () => ({
      config: ghConfig,
      updateConfig: updateGhConfig,
      isConfigured: ghIsConfigured,
      activeToken: ghActiveToken,
      syncStatus,
      lastSyncAt,
      lastError,
      hasPendingChanges: hasPendingGhChanges,
      dirtyFlags: ghDirtyFlags,
      syncProgress: ghSyncProgress,
      history: ghHistory,
      hasStoredToken,
      tokenUnlocked,
      saveEncryptedToken,
      unlockToken,
      lockToken,
      fetchHistory,
      testConnection,
      restoreLatest,
      restoreFromCommit,
      handleSyncNow,
      handleDataChange,
      applyRestoredSnapshot,
      ghDataToSync,
      markDirty: ghMarkDirty,
      clearDirty: ghClearDirty,
      syncTaxesNow: ghSyncTaxesNow,
      restoreTaxesLatest,
    }),
    [
      ghConfig,
      updateGhConfig,
      ghIsConfigured,
      ghActiveToken,
      syncStatus,
      lastSyncAt,
      lastError,
      hasPendingGhChanges,
      ghDirtyFlags,
      ghSyncProgress,
      ghHistory,
      hasStoredToken,
      tokenUnlocked,
      saveEncryptedToken,
      unlockToken,
      lockToken,
      fetchHistory,
      testConnection,
      restoreLatest,
      restoreFromCommit,
      handleSyncNow,
      handleDataChange,
      applyRestoredSnapshot,
      ghDataToSync,
      ghMarkDirty,
      ghClearDirty,
      ghSyncTaxesNow,
      restoreTaxesLatest,
    ],
  )

  return <GitHubSyncContext.Provider value={value}>{children}</GitHubSyncContext.Provider>
}

export default GitHubSyncContext
