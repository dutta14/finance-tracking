import { useCallback, useRef } from 'react'

import { syncFileToGitHub } from './useGitHubSyncApi'
import type { GitHubSyncConfig, SyncDomain, SyncStatus } from './githubSyncTypes'

export interface SyncHookParams {
  activeToken: string
  config: GitHubSyncConfig
  isConfigured: boolean
  dataFilePath: string
  toolsFilePath: string
  allocationFilePath: string
  taxesFilePath: string
  getFileShaForPath: (path: string) => Promise<string | null>
  clearDirty: (domain: SyncDomain) => void
  setSyncStatus: (s: SyncStatus) => void
  setLastSyncAt: (s: string | null) => void
  setLastError: (s: string | null) => void
}

export const useGitHubSyncUpload = (params: SyncHookParams) => {
  const {
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
  } = params

  const lastSyncedGoalsJsonRef = useRef<string | null>(null)
  const lastSyncedDataJsonRef = useRef<string | null>(null)
  const pendingDataRef = useRef<object | null>(null)
  const pendingDataFileRef = useRef<object | null>(null)

  const syncGoalsNow = useCallback(
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
        lastSyncedGoalsJsonRef.current = (() => {
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
    [activeToken, config.owner, config.repo, config.filePath, getFileShaForPath, isConfigured, clearDirty, setSyncStatus, setLastSyncAt, setLastError],
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

  return {
    syncGoalsNow,
    syncDataNow,
    syncToolsNow,
    syncAllocationNow,
    syncTaxesNow,
    lastSyncedGoalsJsonRef,
    lastSyncedDataJsonRef,
    pendingDataRef,
    pendingDataFileRef,
  }
}
