import { useState, useEffect, useRef, useCallback } from 'react'
import { getStorageItem, setStorageItem } from '../utils/storage'
import { encryptToken, decryptToken } from './tokenCrypto'
import { toBase64, fromBase64 } from './base64Utils'
import { syncFileToGitHub, restoreFileFromGitHub } from './useGitHubSyncApi'

export { toBase64, fromBase64 }
export interface GitHubSyncConfig {
  owner: string
  repo: string
  filePath: string
  autoSync: boolean
  encryptedToken?: string
  tokenSalt?: string
  tokenIv?: string
}
export interface CommitEntry {
  sha: string
  message: string
  date: string
  url: string
}
export interface ConnectionTestResult {
  ok: boolean
  message: string
  warnings: string[]
}
export interface RestoreResult {
  ok: boolean
  message: string
  data?: unknown
}
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error'
export type SyncDomain = 'goals' | 'data' | 'tools' | 'allocation' | 'taxes' | 'budget'
export interface SyncProgress {
  total: number
  completed: number
  current: string
  errors: string[]
  domains: SyncDomain[]
}

const CONFIG_KEY = 'github-sync-config'
const DEFAULT_CONFIG: GitHubSyncConfig = { owner: '', repo: '', filePath: 'finance-goals.json', autoSync: false }
const DEBOUNCE_MS = 60_000

export const loadConfig = (): GitHubSyncConfig => {
  try {
    const parsed = { ...DEFAULT_CONFIG, ...getStorageItem('github-sync-config', DEFAULT_CONFIG) }
    parsed.filePath = DEFAULT_CONFIG.filePath
    if ('legacyToken' in parsed) {
      delete (parsed as Record<string, unknown>).legacyToken
      setStorageItem('github-sync-config', parsed)
    }
    return parsed
  } catch {
    return DEFAULT_CONFIG
  }
}

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
  const apiHeaders = useCallback(
    (token: string): Record<string, string> => ({
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    }),
    [],
  )
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
    async (path: string): Promise<string | null> => {
      if (!activeToken) throw new Error('Token is not unlocked.')
      const res = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`, {
        headers: apiHeaders(activeToken),
        cache: 'no-store',
      })
      if (res.status === 404) return null
      if (res.status === 401) throw new Error('Invalid token — check the token is correct and not expired.')
      if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
      const data = await res.json()
      return data.sha as string
    },
    [activeToken, config.owner, config.repo, apiHeaders],
  )

  const makeSyncFn =
    (opts: {
      filePath: string
      prefix: string
      domain: SyncDomain
      lastSyncedRef?: React.MutableRefObject<string | null>
      onSuccess?: () => void
      setStatus?: boolean
    }) =>
    async (data: object, message?: string): Promise<void> => {
      if (!isConfigured) return
      if (opts.setStatus) {
        setSyncStatus('syncing')
        setLastError(null)
      }
      try {
        await syncFileToGitHub({
          token: activeToken,
          owner: config.owner,
          repo: config.repo,
          filePath: opts.filePath,
          data,
          message,
          defaultMessagePrefix: opts.prefix,
          apiHeaders,
          getFileSha: getFileShaForPath,
          lastSyncedJsonRef: opts.lastSyncedRef,
          onSuccess: opts.onSuccess,
        })
        if (opts.setStatus) {
          setSyncStatus('success')
          setLastSyncAt(new Date().toISOString())
        }
        clearDirty(opts.domain)
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e))
        if (opts.setStatus) {
          setSyncStatus('error')
          setLastError(err.message)
        } else console.error(`${opts.prefix} error:`, err.message)
        throw err
      }
    }
  const makeRestoreFn =
    (
      filePath: string,
      ref?: string,
      opts?: {
        notFoundMsg?: string
        notFoundData?: unknown
        apiErrorMsg?: string
        formatMsg?: string
        errorMsg?: string
        successMsg?: string
      },
    ) =>
    async (): Promise<RestoreResult> => {
      if (!isConfigured) return { ok: false, message: opts?.errorMsg ? 'Connect and unlock token first.' : '' }
      const result = await restoreFileFromGitHub({
        token: activeToken,
        owner: config.owner,
        repo: config.repo,
        filePath,
        apiHeaders,
        ref,
      })
      if (result.ok) return { ok: true, message: opts?.successMsg ?? '', data: result.data }
      if (result.reason === 'not-found')
        return {
          ok: 'notFoundData' in (opts ?? {}),
          message: opts?.notFoundMsg ?? opts?.errorMsg ?? '',
          data: opts?.notFoundData,
        }
      if (result.reason === 'bad-format') return { ok: false, message: opts?.formatMsg ?? opts?.errorMsg ?? '' }
      if (result.reason === 'api-error') return { ok: false, message: opts?.apiErrorMsg ?? opts?.errorMsg ?? '' }
      return { ok: false, message: opts?.errorMsg ?? '' }
    }

  const syncNow = useCallback(
    makeSyncFn({
      filePath: config.filePath,
      prefix: 'Auto-save',
      domain: 'goals',
      lastSyncedRef: lastSyncedJsonRef,
      setStatus: true,
    }),
    [activeToken, apiHeaders, config.owner, config.repo, config.filePath, getFileShaForPath, isConfigured, clearDirty],
  )
  const syncDataNow = useCallback(
    makeSyncFn({
      filePath: dataFilePath,
      prefix: 'Data sync',
      domain: 'data',
      lastSyncedRef: lastSyncedDataJsonRef,
      onSuccess: () => {
        pendingDataFileRef.current = null
      },
    }),
    [activeToken, apiHeaders, config.owner, config.repo, dataFilePath, getFileShaForPath, isConfigured, clearDirty],
  )
  const syncToolsNow = useCallback(makeSyncFn({ filePath: toolsFilePath, prefix: 'Tools sync', domain: 'tools' }), [
    activeToken,
    apiHeaders,
    config.owner,
    config.repo,
    toolsFilePath,
    getFileShaForPath,
    isConfigured,
    clearDirty,
  ])
  const syncAllocationNow = useCallback(
    makeSyncFn({ filePath: allocationFilePath, prefix: 'Allocation sync', domain: 'allocation' }),
    [
      activeToken,
      apiHeaders,
      config.owner,
      config.repo,
      allocationFilePath,
      getFileShaForPath,
      isConfigured,
      clearDirty,
    ],
  )
  const syncTaxesNow = useCallback(makeSyncFn({ filePath: taxesFilePath, prefix: 'Taxes sync', domain: 'taxes' }), [
    activeToken,
    apiHeaders,
    config.owner,
    config.repo,
    taxesFilePath,
    getFileShaForPath,
    isConfigured,
    clearDirty,
  ])
  const restoreToolsLatest = useCallback(makeRestoreFn(toolsFilePath), [
    activeToken,
    apiHeaders,
    toolsFilePath,
    config.owner,
    config.repo,
    isConfigured,
  ])
  const restoreAllocationLatest = useCallback(makeRestoreFn(allocationFilePath), [
    activeToken,
    apiHeaders,
    allocationFilePath,
    config.owner,
    config.repo,
    isConfigured,
  ])
  const restoreTaxesLatest = useCallback(makeRestoreFn(taxesFilePath), [
    activeToken,
    apiHeaders,
    taxesFilePath,
    config.owner,
    config.repo,
    isConfigured,
  ])

  const fetchHistory = useCallback(async (): Promise<void> => {
    if (!isConfigured) return
    try {
      const res = await fetch(
        `https://api.github.com/repos/${config.owner}/${config.repo}/commits?path=${encodeURIComponent(config.filePath)}&per_page=100`,
        { headers: apiHeaders(activeToken) },
      )
      if (!res.ok) return
      const commits = await res.json()
      setHistory(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (commits as any[]).map(c => ({
          sha: (c.sha as string).slice(0, 7),
          message: c.commit.message as string,
          date: c.commit.author.date as string,
          url: c.html_url as string,
        })),
      )
    } catch {
      /* no-op */
    }
  }, [activeToken, apiHeaders, config.filePath, config.owner, config.repo, isConfigured])

  const testConnection = useCallback(async (): Promise<ConnectionTestResult> => {
    if (!activeToken || !config.owner || !config.repo) {
      return { ok: false, message: 'Fill in token, owner, and repository first.', warnings: [] }
    }
    try {
      const res = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}`, {
        headers: apiHeaders(activeToken),
      })
      if (res.status === 404)
        return {
          ok: false,
          message:
            'Repository not found — if it\'s private, ensure the token has access to private repositories (classic token needs "repo" scope; fine-grained token needs "Contents: Read & Write").',
          warnings: [],
        }
      if (res.status === 401)
        return { ok: false, message: 'Invalid token — check the token is correct and not expired.', warnings: [] }
      if (!res.ok) return { ok: false, message: `GitHub API error: ${res.status}`, warnings: [] }
      const warnings: string[] = []
      const scopes = res.headers.get('x-oauth-scopes')
      const repoData = (await res.json()) as { full_name: string; private?: boolean; permissions?: { push?: boolean } }
      if (repoData.private === false)
        warnings.push('This repository is public. Backups may expose sensitive financial data.')
      if (repoData.permissions && repoData.permissions.push === false)
        warnings.push('Token does not appear to have write access to this repository.')
      if (scopes && scopes.includes('repo'))
        warnings.push('Token has broad repo scope. Prefer a fine-grained token limited to one backup repo.')
      return { ok: true, message: `Connected to ${repoData.full_name}`, warnings }
    } catch {
      return { ok: false, message: 'Network error. Check your connection.', warnings: [] }
    }
  }, [activeToken, apiHeaders, config.owner, config.repo])

  const restoreFromCommit = useCallback(
    async (commitSha: string): Promise<RestoreResult> => {
      if (!isConfigured) return { ok: false, message: 'Connect and unlock token first.' }
      const result = await restoreFileFromGitHub({
        token: activeToken,
        owner: config.owner,
        repo: config.repo,
        filePath: config.filePath,
        apiHeaders,
        ref: commitSha,
      })
      if (result.ok) return { ok: true, message: `Restored from commit ${commitSha.slice(0, 7)}.`, data: result.data }
      if (result.reason === 'not-found') return { ok: false, message: 'Backup file not found in this commit.' }
      if (result.reason === 'api-error') return { ok: false, message: 'GitHub API error.' }
      if (result.reason === 'bad-format') return { ok: false, message: 'Backup file format is not supported.' }
      return { ok: false, message: 'Could not restore backup from GitHub.' }
    },
    [activeToken, apiHeaders, config.filePath, config.owner, config.repo, isConfigured],
  )

  const restoreLatest = useCallback(
    makeRestoreFn(config.filePath, undefined, {
      notFoundMsg: 'Backup file not found in repository.',
      apiErrorMsg: 'GitHub API error.',
      formatMsg: 'Backup file format is not supported.',
      errorMsg: 'Could not restore backup from GitHub.',
      successMsg: 'Latest backup restored from GitHub.',
    }),
    [activeToken, apiHeaders, config.filePath, config.owner, config.repo, isConfigured],
  )
  const restoreDataLatest = useCallback(
    makeRestoreFn(dataFilePath, undefined, {
      notFoundMsg: 'No data file found.',
      notFoundData: null,
      apiErrorMsg: 'GitHub API error.',
      formatMsg: 'Data file format is not supported.',
      errorMsg: 'Could not restore data file from GitHub.',
      successMsg: 'Data file restored.',
    }),
    [activeToken, apiHeaders, dataFilePath, config.owner, config.repo, isConfigured],
  )

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
  useEffect(() => {
    if (!config.autoSync || !isConfigured) return
    const handleVisChange = () => {
      if (document.visibilityState !== 'hidden') return
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
