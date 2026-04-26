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
import type { FinancialGoal, GwGoal } from '../types'
import type { Account, BalanceEntry } from '../pages/data/types'

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
  usingLegacyToken: boolean
  saveEncryptedToken: (token: string, passphrase: string) => Promise<{ ok: boolean; message: string }>
  migrateLegacyToken: (passphrase: string) => Promise<{ ok: boolean; message: string }>
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
  try {
    const accounts = JSON.parse(localStorage.getItem('data-accounts') || '[]')
    const balances = JSON.parse(localStorage.getItem('data-balances') || '[]')
    return { accounts, balances }
  } catch {
    return { accounts: [], balances: [] }
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
    usingLegacyToken,
    activeToken: ghActiveToken,
    saveEncryptedToken,
    migrateLegacyToken,
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
                    goalViewMode: localStorage.getItem('goal-view-mode') || '',
                    homeCardOrder: localStorage.getItem('home-card-order') || '',
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
                  fiSimulations: JSON.parse(localStorage.getItem('fi-simulations') || '[]'),
                  sgtOverrides: JSON.parse(localStorage.getItem('sgt-overrides') || '{}'),
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
                  allocationCustomRatios: JSON.parse(localStorage.getItem('allocation-custom-ratios') || '[]'),
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
        const parsed = data as {
          version?: number
          goals?: unknown
          plans?: unknown
          profile?: unknown
          gwGoals?: unknown
          gwPlans?: unknown
          settings?: unknown
          gitHubConfig?: unknown
          dataAccounts?: unknown
          dataBalances?: unknown
        }
        const incomingGoals = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.goals)
            ? parsed.goals
            : Array.isArray(parsed?.plans)
              ? parsed.plans
              : []
        if (!Array.isArray(incomingGoals) || incomingGoals.length === 0)
          throw new Error('No valid goals data in backup')
        importGoals(incomingGoals as FinancialGoal[])
        let restoreProfile: Partial<typeof profile> = profile
        if (parsed?.profile && typeof parsed.profile === 'object') {
          restoreProfile = parsed.profile as Partial<typeof profile>
          updateProfile(restoreProfile)
        }
        let restoreGwGoals: GwGoal[] = []
        if (Array.isArray(parsed?.gwGoals || parsed?.gwPlans)) {
          restoreGwGoals = (parsed.gwGoals || parsed.gwPlans) as GwGoal[]
          importGwGoals(restoreGwGoals)
        }
        if (parsed?.settings && typeof parsed.settings === 'object') {
          const s = parsed.settings as Record<string, unknown>
          if (s.accentTheme) setAccentTheme(s.accentTheme as string)
          else if (s.fiTheme) setAccentTheme(s.fiTheme as string)
          if (s.darkMode !== undefined) setDarkMode(!!s.darkMode)
          if (s.allowCsvImport !== undefined) setAllowCsvImport(!!s.allowCsvImport)
          if (s.goalViewMode) localStorage.setItem('goal-view-mode', s.goalViewMode as string)
          if (s.homeCardOrder) localStorage.setItem('home-card-order', s.homeCardOrder as string)
        }
        let restoredGhConfig = ghConfig
        if (parsed?.gitHubConfig && typeof parsed.gitHubConfig === 'object') {
          const cfg = parsed.gitHubConfig as Record<string, unknown>
          restoredGhConfig = {
            owner: (cfg.owner as string) || '',
            repo: (cfg.repo as string) || '',
            filePath: (cfg.filePath as string) || 'finance-goals.json',
            autoSync: (cfg.autoSync as boolean) || false,
            encryptedToken: ghConfig.encryptedToken,
            tokenSalt: ghConfig.tokenSalt,
            tokenIv: ghConfig.tokenIv,
            legacyToken: ghConfig.legacyToken,
          }
          updateGhConfig(restoredGhConfig)
        }
        await new Promise(r => setTimeout(r, 300))
        localStorage.setItem('financialGoals', JSON.stringify(incomingGoals))
        localStorage.setItem('gw-goals', JSON.stringify(restoreGwGoals))
        localStorage.setItem('user-profile', JSON.stringify(restoreProfile || profile))
        localStorage.setItem('github-sync-config', JSON.stringify(restoredGhConfig))
        try {
          const dataResult = await restoreDataLatest()
          if (dataResult.ok && dataResult.data) {
            const d = dataResult.data as { accounts?: unknown; balances?: unknown }
            if (Array.isArray(d.accounts)) localStorage.setItem('data-accounts', JSON.stringify(d.accounts))
            if (Array.isArray(d.balances)) localStorage.setItem('data-balances', JSON.stringify(d.balances))
          } else {
            if (Array.isArray(parsed?.dataAccounts))
              localStorage.setItem('data-accounts', JSON.stringify(parsed.dataAccounts))
            if (Array.isArray(parsed?.dataBalances))
              localStorage.setItem('data-balances', JSON.stringify(parsed.dataBalances))
          }
          const toolsResult = await restoreToolsLatest()
          if (toolsResult.ok && toolsResult.data) {
            const t = toolsResult.data as { fiSimulations?: unknown; sgtOverrides?: unknown }
            if (Array.isArray(t.fiSimulations)) localStorage.setItem('fi-simulations', JSON.stringify(t.fiSimulations))
            if (t.sgtOverrides && typeof t.sgtOverrides === 'object')
              localStorage.setItem('sgt-overrides', JSON.stringify(t.sgtOverrides))
          }
          const allocResult = await restoreAllocationLatest()
          if (allocResult.ok && allocResult.data) {
            const a = allocResult.data as { allocationCustomRatios?: unknown }
            if (Array.isArray(a.allocationCustomRatios))
              localStorage.setItem('allocation-custom-ratios', JSON.stringify(a.allocationCustomRatios))
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
      usingLegacyToken,
      saveEncryptedToken,
      migrateLegacyToken,
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
      usingLegacyToken,
      saveEncryptedToken,
      migrateLegacyToken,
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
