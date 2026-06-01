import { useState, useEffect, useRef, useCallback } from 'react'

import { setStorageItem } from '../utils/storage'
import { toBase64, fromBase64 } from './base64Utils'
import { encryptToken, decryptToken } from './tokenCrypto'
import {
  syncFileToGitHub,
  restoreFileFromGitHub,
  getFileShaForPathApi,
  testConnectionApi,
  fetchCommitHistory,
} from './useGitHubSyncApi'
import { CONFIG_KEY, DEBOUNCE_MS, loadConfig } from './githubSyncConfig'
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
  RestoreResult,
  ConnectionTestResult,
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

  const pendingDataRef = useRef<object | null>(null)
  const pendingDataFileRef = useRef<object | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dataDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSyncedJsonRef = useRef<string | null>(null)
  const lastSyncedDataJsonRef = useRef<string | null>(null)

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

  const syncNow = useCallback(
    async (data: object, message?: string): Promise<void> => {
      if (!isConfigured) return
      setSyncStatus('syncing')
      setLastError(null)
      const result = await syncFileToGitHub({
        token: activeToken,
        owner: config.owner,
        repo: config.repo,
        filePath: config.filePath,
        data,
        message,
        messagePrefix: 'Auto-save',
        getFileSha: () => getFileShaForPath(config.filePath),
      })
      if (result.ok) {
        lastSyncedJsonRef.current = (() => {
          const { exportedAt: _, ...rest } = data as Record<string, unknown>
          return JSON.stringify(rest)
        })()
        setSyncStatus('success')
        setLastSyncAt(new Date().toISOString())
        clearDirty('goals')
      } else {
        setSyncStatus('error')
        setLastError(result.error || 'Sync failed')
        throw new Error(result.error || 'Sync failed')
      }
    },
    [activeToken, config.owner, config.repo, config.filePath, getFileShaForPath, isConfigured, clearDirty],
  )

  const syncDataNow = useCallback(
    async (data: object, message?: string): Promise<void> => {
      if (!isConfigured) return
      const result = await syncFileToGitHub({
        token: activeToken,
        owner: config.owner,
        repo: config.repo,
        filePath: dataFilePath,
        data,
        message,
        messagePrefix: 'Data sync',
        getFileSha: () => getFileShaForPath(dataFilePath),
      })
      if (result.ok) {
        lastSyncedDataJsonRef.current = (() => {
          const { exportedAt: _, ...rest } = data as Record<string, unknown>
          return JSON.stringify(rest)
        })()
        pendingDataFileRef.current = null
        clearDirty('data')
      } else {
        console.error('Data file sync error:', result.error)
        throw new Error(result.error || 'Data sync failed')
      }
    },
    [activeToken, config.owner, config.repo, dataFilePath, getFileShaForPath, isConfigured, clearDirty],
  )

  const syncToolsNow = useCallback(
    async (data: object, message?: string): Promise<void> => {
      if (!isConfigured) return
      const result = await syncFileToGitHub({
        token: activeToken,
        owner: config.owner,
        repo: config.repo,
        filePath: toolsFilePath,
        data,
        message,
        messagePrefix: 'Tools sync',
        getFileSha: () => getFileShaForPath(toolsFilePath),
      })
      if (result.ok) {
        clearDirty('tools')
      } else {
        console.error('Tools file sync error:', result.error)
        throw new Error(result.error || 'Tools sync failed')
      }
    },
    [activeToken, config.owner, config.repo, toolsFilePath, getFileShaForPath, isConfigured, clearDirty],
  )

  const restoreToolsLatest = useCallback(async (): Promise<{ ok: boolean; data?: unknown }> => {
    if (!isConfigured) return { ok: false }
    try {
      const result = await restoreFileFromGitHub({
        token: activeToken,
        owner: config.owner,
        repo: config.repo,
        filePath: toolsFilePath,
      })
      return result.ok ? { ok: true, data: result.data } : { ok: false }
    } catch {
      return { ok: false }
    }
  }, [activeToken, config.owner, config.repo, toolsFilePath, isConfigured])

  const syncAllocationNow = useCallback(
    async (data: object, message?: string): Promise<void> => {
      if (!isConfigured) return
      const result = await syncFileToGitHub({
        token: activeToken,
        owner: config.owner,
        repo: config.repo,
        filePath: allocationFilePath,
        data,
        message,
        messagePrefix: 'Allocation sync',
        getFileSha: () => getFileShaForPath(allocationFilePath),
      })
      if (result.ok) {
        clearDirty('allocation')
      } else {
        console.error('Allocation file sync error:', result.error)
        throw new Error(result.error || 'Allocation sync failed')
      }
    },
    [activeToken, config.owner, config.repo, allocationFilePath, getFileShaForPath, isConfigured, clearDirty],
  )

  const restoreAllocationLatest = useCallback(async (): Promise<{ ok: boolean; data?: unknown }> => {
    if (!isConfigured) return { ok: false }
    try {
      const result = await restoreFileFromGitHub({
        token: activeToken,
        owner: config.owner,
        repo: config.repo,
        filePath: allocationFilePath,
      })
      return result.ok ? { ok: true, data: result.data } : { ok: false }
    } catch {
      return { ok: false }
    }
  }, [activeToken, config.owner, config.repo, allocationFilePath, isConfigured])

  const syncTaxesNow = useCallback(
    async (data: object, message?: string): Promise<void> => {
      if (!isConfigured) return
      const result = await syncFileToGitHub({
        token: activeToken,
        owner: config.owner,
        repo: config.repo,
        filePath: taxesFilePath,
        data,
        message,
        messagePrefix: 'Taxes sync',
        getFileSha: () => getFileShaForPath(taxesFilePath),
      })
      if (result.ok) {
        clearDirty('taxes')
      } else {
        console.error('Taxes file sync error:', result.error)
        throw new Error(result.error || 'Taxes sync failed')
      }
    },
    [activeToken, config.owner, config.repo, taxesFilePath, getFileShaForPath, isConfigured, clearDirty],
  )

  const restoreTaxesLatest = useCallback(async (): Promise<RestoreResult> => {
    if (!isConfigured) return { ok: false, message: '' }
    try {
      const result = await restoreFileFromGitHub({
        token: activeToken,
        owner: config.owner,
        repo: config.repo,
        filePath: taxesFilePath,
      })
      return result.ok ? { ok: true, message: '', data: result.data } : { ok: false, message: '' }
    } catch {
      return { ok: false, message: '' }
    }
  }, [activeToken, config.owner, config.repo, taxesFilePath, isConfigured])

  const fetchHistory = useCallback(async (): Promise<void> => {
    if (!isConfigured) return
    const commits = await fetchCommitHistory(activeToken, config.owner, config.repo, config.filePath)
    setHistory(commits)
  }, [activeToken, config.filePath, config.owner, config.repo, isConfigured])

  const testConnection = useCallback(async (): Promise<ConnectionTestResult> => {
    if (!activeToken || !config.owner || !config.repo) {
      return { ok: false, message: 'Fill in token, owner, and repository first.', warnings: [] }
    }
    return testConnectionApi(activeToken, config.owner, config.repo)
  }, [activeToken, config.owner, config.repo])

  const restoreFromCommit = useCallback(
    async (commitSha: string): Promise<RestoreResult> => {
      if (!isConfigured) return { ok: false, message: 'Connect and unlock token first.' }
      try {
        const result = await restoreFileFromGitHub({
          token: activeToken,
          owner: config.owner,
          repo: config.repo,
          filePath: config.filePath,
          ref: commitSha,
          checkEncoding: true,
        })
        if (!result.ok) {
          if (result.status === 404) return { ok: false, message: 'Backup file not found in this commit.' }
          if (result.status) return { ok: false, message: `GitHub API error: ${result.status}` }
          return { ok: false, message: 'Backup file format is not supported.' }
        }
        return { ok: true, message: `Restored from commit ${commitSha.slice(0, 7)}.`, data: result.data }
      } catch {
        return { ok: false, message: 'Could not restore backup from GitHub.' }
      }
    },
    [activeToken, config.filePath, config.owner, config.repo, isConfigured],
  )

  const restoreLatest = useCallback(async (): Promise<RestoreResult> => {
    if (!isConfigured) return { ok: false, message: 'Connect and unlock token first.' }
    try {
      const result = await restoreFileFromGitHub({
        token: activeToken,
        owner: config.owner,
        repo: config.repo,
        filePath: config.filePath,
      })
      if (!result.ok) {
        if (result.status === 404) return { ok: false, message: 'Backup file not found in repository.' }
        if (result.status) return { ok: false, message: `GitHub API error: ${result.status}` }
        return { ok: false, message: 'Backup file format is not supported.' }
      }
      return { ok: true, message: 'Latest backup restored from GitHub.', data: result.data }
    } catch {
      return { ok: false, message: 'Could not restore backup from GitHub.' }
    }
  }, [activeToken, config.owner, config.repo, config.filePath, isConfigured])

  const restoreDataLatest = useCallback(async (): Promise<RestoreResult> => {
    if (!isConfigured) return { ok: false, message: 'Connect and unlock token first.' }
    try {
      const result = await restoreFileFromGitHub({
        token: activeToken,
        owner: config.owner,
        repo: config.repo,
        filePath: dataFilePath,
      })
      if (!result.ok) {
        if (result.status === 404) return { ok: true, message: 'No data file found.', data: null }
        if (result.status) return { ok: false, message: `GitHub API error: ${result.status}` }
        return { ok: false, message: 'Data file format is not supported.' }
      }
      return { ok: true, message: 'Data file restored.', data: result.data }
    } catch {
      return { ok: false, message: 'Could not restore data file from GitHub.' }
    }
  }, [activeToken, config.owner, config.repo, dataFilePath, isConfigured])

  const updateData = useCallback(
    (data: object) => {
      const { exportedAt: _, ...rest } = data as Record<string, unknown>
      const json = JSON.stringify(rest)
      if (json === lastSyncedJsonRef.current) return
      markDirty('goals')
      if (!config.autoSync || !isConfigured) return
      pendingDataRef.current = data
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => {
        if (pendingDataRef.current) syncNow(pendingDataRef.current).catch(() => {})
      }, DEBOUNCE_MS)
    },
    [config.autoSync, isConfigured, syncNow, markDirty],
  )

  const updateDataFile = useCallback(
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
    [config.autoSync, isConfigured, syncDataNow, markDirty],
  )

  const markRestored = useCallback(() => {
    setLastSyncAt(new Date().toISOString())
    setSyncStatus('success')
    clearAllDirty()
    setLastError(null)
  }, [clearAllDirty])

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
        if (pendingDataRef.current) syncNow(pendingDataRef.current).catch(() => {})
        if (pendingDataFileRef.current) syncDataNow(pendingDataFileRef.current).catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', handleVisChange)
    return () => document.removeEventListener('visibilitychange', handleVisChange)
  }, [isConfigured, activeToken, config, config.autoSync, syncNow, syncDataNow])

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
    syncNow,
    fetchHistory,
    testConnection,
    restoreLatest,
    restoreFromCommit,
    markRestored,
    updateData,
    updateDataFile,
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
