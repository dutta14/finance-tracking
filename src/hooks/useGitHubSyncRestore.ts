import { useCallback } from 'react'

import {
  restoreFileFromGitHub,
  testConnectionApi,
  fetchCommitHistory,
} from './useGitHubSyncApi'
import type {
  GitHubSyncConfig,
  CommitEntry,
  ConnectionTestResult,
  RestoreResult,
  SyncStatus,
} from './githubSyncTypes'

export interface RestoreHookParams {
  activeToken: string
  config: GitHubSyncConfig
  isConfigured: boolean
  dataFilePath: string
  toolsFilePath: string
  allocationFilePath: string
  taxesFilePath: string
  setHistory: (h: CommitEntry[]) => void
  setSyncStatus: (s: SyncStatus) => void
  setLastSyncAt: (s: string | null) => void
  setLastError: (s: string | null) => void
}

export const useGitHubSyncRestore = (params: RestoreHookParams) => {
  const {
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
  } = params

  const restoreGoalsLatest = useCallback(async (): Promise<RestoreResult> => {
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

  const markRestored = useCallback(
    (clearAllDirty: () => void) => {
      setLastSyncAt(new Date().toISOString())
      setSyncStatus('success')
      clearAllDirty()
      setLastError(null)
    },
    [setSyncStatus, setLastSyncAt, setLastError],
  )

  const fetchHistory = useCallback(async (): Promise<void> => {
    if (!isConfigured) return
    const commits = await fetchCommitHistory(activeToken, config.owner, config.repo, config.filePath)
    setHistory(commits)
  }, [activeToken, config.filePath, config.owner, config.repo, isConfigured, setHistory])

  const testConnection = useCallback(async (): Promise<ConnectionTestResult> => {
    if (!activeToken || !config.owner || !config.repo) {
      return { ok: false, message: 'Fill in token, owner, and repository first.', warnings: [] }
    }
    return testConnectionApi(activeToken, config.owner, config.repo)
  }, [activeToken, config.owner, config.repo])

  return {
    restoreGoalsLatest,
    restoreDataLatest,
    restoreToolsLatest,
    restoreAllocationLatest,
    restoreTaxesLatest,
    restoreFromCommit,
    markRestored,
    fetchHistory,
    testConnection,
  }
}
