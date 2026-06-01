import { useState, useEffect, useRef, useCallback } from 'react'

import { setStorageItem } from '../utils/storage'
import { toBase64, fromBase64 } from './base64Utils'
import { encryptToken, decryptToken } from './tokenCrypto'
import { getFileShaForPathApi } from './useGitHubSyncApi'
import { CONFIG_KEY, DEBOUNCE_MS, loadConfig } from './githubSyncConfig'
import { useGitHubSyncUpload } from './useGitHubSyncUpload'
import { useGitHubSyncRestore } from './useGitHubSyncRestore'
export { toBase64, fromBase64 }
export { loadConfig }
export type {
  GitHubSyncConfig,
  CommitEntry,
  ConnectionTestResult,
  RestoreResult,
  SyncStatus,
  SyncDomain,
  SyncProgress,
} from './githubSyncTypes'
import type {
  GitHubSyncConfig,
  CommitEntry,
  SyncStatus,
  SyncDomain,
  SyncProgress,
} from './githubSyncTypes'

export const useGitHubSync = () => {
  const [config, setConfigState] = useState<GitHubSyncConfig>(loadConfig)
  const [sessionToken, setSessionToken] = useState('')
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const [history, setHistory] = useState<CommitEntry[]>([])
  const [dirtyFlags, setDirtyFlags] = useState<Record<SyncDomain, boolean>>({
    goals: false,
    data: false,
    tools: false,
    allocation: false,
    taxes: false,
    budget: false,
  })
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)

  // Gate dirty tracking — suppress during initial mount so init/migration/restore
  // code doesn't spuriously mark domains dirty
  const dirtyReadyRef = useRef(false)
  useEffect(() => {
    const timer = setTimeout(() => {
      dirtyReadyRef.current = true
    }, 3000)
    return () => clearTimeout(timer)
  }, [])

  const hasPendingChanges = Object.values(dirtyFlags).some(Boolean)

  const markDirty = useCallback((domain: SyncDomain) => {
    if (!dirtyReadyRef.current) return
    setDirtyFlags(prev => ({ ...prev, [domain]: true }))
  }, [])

  const clearDirty = useCallback((domain: SyncDomain) => {
    setDirtyFlags(prev => ({ ...prev, [domain]: false }))
  }, [])

  const clearAllDirty = useCallback(() => {
    setDirtyFlags({ goals: false, data: false, tools: false, allocation: false, taxes: false, budget: false })
  }, [])

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dataDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hasStoredToken = !!config.encryptedToken
  const tokenUnlocked = !!sessionToken
  const activeToken = sessionToken || ''
  const isConfigured = !!(activeToken && config.owner && config.repo && config.filePath)

  const updateConfig = useCallback((updates: Partial<GitHubSyncConfig>) => {
    setConfigState(prev => {
      const next = { ...prev, ...updates }
      try {
        setStorageItem('github-sync-config', next)
        const verify = localStorage.getItem(CONFIG_KEY)
        if (!verify) console.warn('Failed to persist GitHub config to localStorage')
      } catch (e) {
        console.error('Error saving GitHub config:', e)
      }
      return next
    })
  }, [])

  const lockToken = useCallback(() => {
    setSessionToken('')
  }, [])

  const saveEncryptedToken = useCallback(
    async (token: string, passphrase: string): Promise<{ ok: boolean; message: string }> => {
      if (!token.trim()) return { ok: false, message: 'Token is required.' }
      if (!passphrase.trim() || passphrase.length < 8) {
        return { ok: false, message: 'Passphrase must be at least 8 characters.' }
      }
      try {
        const encrypted = await encryptToken(token.trim(), passphrase)
        setConfigState(prev => {
          const next: GitHubSyncConfig = { ...prev, ...encrypted }
          setStorageItem('github-sync-config', next)
          return next
        })
        setSessionToken(token.trim())
        return { ok: true, message: 'Token encrypted and saved.' }
      } catch {
        return { ok: false, message: 'Could not encrypt token on this browser.' }
      }
    },
    [],
  )

  const unlockToken = useCallback(
    async (passphrase: string): Promise<{ ok: boolean; message: string }> => {
      if (!config.encryptedToken || !config.tokenSalt || !config.tokenIv) {
        return { ok: false, message: 'No encrypted token is stored yet.' }
      }
      try {
        const plain = await decryptToken(config.encryptedToken, passphrase, config.tokenSalt, config.tokenIv)
        setSessionToken(plain)
        return { ok: true, message: 'Token unlocked for this session.' }
      } catch {
        return { ok: false, message: 'Passphrase is incorrect.' }
      }
    },
    [config],
  )

  const dataFilePath = config.filePath.replace(/\.json$/, '-data.json')
  const toolsFilePath = config.filePath.replace(/\.json$/, '-tools.json')
  const allocationFilePath = config.filePath.replace(/\.json$/, '-allocation.json')
  const taxesFilePath = config.filePath.replace(/\.json$/, '-taxes.json')

  const getFileShaForPath = useCallback(
    (path: string) => getFileShaForPathApi(activeToken, config.owner, config.repo, path),
    [activeToken, config.owner, config.repo],
  )

  const {
    syncGoalsNow,
    syncDataNow,
    syncToolsNow,
    syncAllocationNow,
    syncTaxesNow,
    lastSyncedGoalsJsonRef,
    lastSyncedDataJsonRef,
    pendingDataRef,
    pendingDataFileRef,
  } = useGitHubSyncUpload({
    activeToken,
    config,
    isConfigured,
    dataFilePath,
    toolsFilePath,
    allocationFilePath,
    taxesFilePath,
    getFileShaForPath,
    clearDirty,
    setSyncStatus,
    setLastSyncAt,
    setLastError,
  })

  const {
    restoreGoalsLatest,
    restoreDataLatest,
    restoreToolsLatest,
    restoreAllocationLatest,
    restoreTaxesLatest,
    restoreFromCommit,
    markRestored: markRestoredRaw,
    fetchHistory,
    testConnection,
  } = useGitHubSyncRestore({
    activeToken,
    config,
    isConfigured,
    dataFilePath,
    toolsFilePath,
    allocationFilePath,
    taxesFilePath,
    setHistory,
    setSyncStatus,
    setLastSyncAt,
    setLastError,
  })

  const markRestored = useCallback(() => {
    markRestoredRaw(clearAllDirty)
  }, [markRestoredRaw, clearAllDirty])

  const updateGoals = useCallback(
    (data: object) => {
      const { exportedAt: _, ...rest } = data as Record<string, unknown>
      const json = JSON.stringify(rest)
      if (json === lastSyncedGoalsJsonRef.current) return
      markDirty('goals')
      if (!config.autoSync || !isConfigured) return
      pendingDataRef.current = data
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => {
        if (pendingDataRef.current) syncGoalsNow(pendingDataRef.current).catch(() => {})
      }, DEBOUNCE_MS)
    },
    [config.autoSync, isConfigured, syncGoalsNow, markDirty, lastSyncedGoalsJsonRef, pendingDataRef],
  )

  const updateData = useCallback(
    (data: object) => {
      const { exportedAt: _, ...rest } = data as Record<string, unknown>
      const json = JSON.stringify(rest)
      if (json === lastSyncedDataJsonRef.current) return
      markDirty('data')
      if (!config.autoSync || !isConfigured) return
      pendingDataFileRef.current = data
      if (dataDebounceTimerRef.current) clearTimeout(dataDebounceTimerRef.current)
      dataDebounceTimerRef.current = setTimeout(() => {
        if (pendingDataFileRef.current) syncDataNow(pendingDataFileRef.current).catch(() => {})
      }, DEBOUNCE_MS)
    },
    [config.autoSync, isConfigured, syncDataNow, markDirty, lastSyncedDataJsonRef, pendingDataFileRef],
  )

  useEffect(
    () => () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      if (dataDebounceTimerRef.current) clearTimeout(dataDebounceTimerRef.current)
    },
    [],
  )

  // Flush pending syncs when user hides the tab (only if autoSync is on)
  useEffect(() => {
    if (!config.autoSync || !isConfigured) return
    const handleVisChange = () => {
      if (document.visibilityState === 'hidden') {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current)
          debounceTimerRef.current = null
        }
        if (dataDebounceTimerRef.current) {
          clearTimeout(dataDebounceTimerRef.current)
          dataDebounceTimerRef.current = null
        }
        if (pendingDataRef.current) syncGoalsNow(pendingDataRef.current).catch(() => {})
        if (pendingDataFileRef.current) syncDataNow(pendingDataFileRef.current).catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', handleVisChange)
    return () => document.removeEventListener('visibilitychange', handleVisChange)
  }, [isConfigured, activeToken, config, config.autoSync, syncGoalsNow, syncDataNow, pendingDataRef, pendingDataFileRef])

  return {
    config,
    updateConfig,
    isConfigured,
    syncStatus,
    lastSyncAt,
    lastError,
    hasPendingChanges,
    dirtyFlags,
    syncProgress,
    setSyncProgress,
    setSyncStatus,
    setLastSyncAt,
    setLastError,
    markDirty,
    clearDirty,
    clearAllDirty,
    history,
    hasStoredToken,
    tokenUnlocked,
    activeToken,
    saveEncryptedToken,
    unlockToken,
    lockToken,
    syncNow: syncGoalsNow,
    fetchHistory,
    testConnection,
    restoreLatest: restoreGoalsLatest,
    restoreFromCommit,
    markRestored,
    updateData: updateGoals,
    updateDataFile: updateData,
    syncDataNow,
    syncToolsNow,
    syncAllocationNow,
    syncTaxesNow,
    restoreDataLatest,
    restoreToolsLatest,
    restoreAllocationLatest,
    restoreTaxesLatest,
  }
}
