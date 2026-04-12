import { useState, useEffect, useRef, useCallback } from 'react'

export interface GitHubSyncConfig {
  owner: string
  repo: string
  filePath: string
  autoSync: boolean
  encryptedToken?: string
  tokenSalt?: string
  tokenIv?: string
  legacyToken?: string
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

const CONFIG_KEY = 'github-sync-config'
const DEFAULT_CONFIG: GitHubSyncConfig = {
  owner: '',
  repo: '',
  filePath: 'finance-goals.json',
  autoSync: false,
}

const DEBOUNCE_MS = 60_000

const loadConfig = (): GitHubSyncConfig => {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return DEFAULT_CONFIG
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_CONFIG
  }
}

const toBase64 = (str: string): string => {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  bytes.forEach(b => { binary += String.fromCharCode(b) })
  return btoa(binary)
}

const fromBase64 = (b64: string): string => {
  const bin = atob(b64)
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

const bytesToB64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes))
const b64ToBytes = (b64: string): Uint8Array => Uint8Array.from(atob(b64), c => c.charCodeAt(0))

const deriveAesKey = async (passphrase: string, salt: Uint8Array): Promise<CryptoKey> => {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 310000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

const encryptToken = async (token: string, passphrase: string): Promise<{ encryptedToken: string; tokenSalt: string; tokenIv: string }> => {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveAesKey(passphrase, salt)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(token)
  )
  return {
    encryptedToken: bytesToB64(new Uint8Array(ciphertext)),
    tokenSalt: bytesToB64(salt),
    tokenIv: bytesToB64(iv),
  }
}

const decryptToken = async (
  encryptedToken: string,
  passphrase: string,
  tokenSalt: string,
  tokenIv: string
): Promise<string> => {
  const key = await deriveAesKey(passphrase, b64ToBytes(tokenSalt))
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(tokenIv) },
    key,
    b64ToBytes(encryptedToken)
  )
  return new TextDecoder().decode(plaintext)
}

export const useGitHubSync = () => {
  const [config, setConfigState] = useState<GitHubSyncConfig>(loadConfig)
  const [sessionToken, setSessionToken] = useState('')
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const [history, setHistory] = useState<CommitEntry[]>([])
  const [hasPendingChanges, setHasPendingChanges] = useState(false)

  const pendingDataRef = useRef<object | null>(null)
  const pendingDataFileRef = useRef<object | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSyncedJsonRef = useRef<string | null>(null)
  const lastSyncedDataJsonRef = useRef<string | null>(null)

  const hasStoredToken = !!(config.encryptedToken || config.legacyToken)
  const usingLegacyToken = !!config.legacyToken
  const tokenUnlocked = !!(sessionToken || config.legacyToken)
  const activeToken = sessionToken || config.legacyToken || ''
  const isConfigured = !!(activeToken && config.owner && config.repo && config.filePath)

  const updateConfig = useCallback((updates: Partial<GitHubSyncConfig>) => {
    setConfigState(prev => {
      const next = { ...prev, ...updates }
      // Ensure we persist all config fields to localStorage
      try {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(next))
        // Verify it was written successfully by reading it back
        const verify = localStorage.getItem(CONFIG_KEY)
        if (!verify) {
          console.warn('Failed to persist GitHub config to localStorage')
        }
      } catch (e) {
        console.error('Error saving GitHub config:', e)
      }
      return next
    })
  }, [])

  const apiHeaders = useCallback((token: string): Record<string, string> => ({
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  }), [])

  const lockToken = useCallback(() => {
    setSessionToken('')
  }, [])

  const saveEncryptedToken = useCallback(async (token: string, passphrase: string): Promise<{ ok: boolean; message: string }> => {
    if (!token.trim()) return { ok: false, message: 'Token is required.' }
    if (!passphrase.trim() || passphrase.length < 8) {
      return { ok: false, message: 'Passphrase must be at least 8 characters.' }
    }
    try {
      const encrypted = await encryptToken(token.trim(), passphrase)
      setConfigState(prev => {
        const next: GitHubSyncConfig = {
          ...prev,
          ...encrypted,
          legacyToken: undefined,
        }
        localStorage.setItem(CONFIG_KEY, JSON.stringify(next))
        return next
      })
      setSessionToken(token.trim())
      return { ok: true, message: 'Token encrypted and saved.' }
    } catch {
      return { ok: false, message: 'Could not encrypt token on this browser.' }
    }
  }, [])

  const migrateLegacyToken = useCallback(async (passphrase: string): Promise<{ ok: boolean; message: string }> => {
    if (!config.legacyToken) return { ok: false, message: 'No legacy token to migrate.' }
    return saveEncryptedToken(config.legacyToken, passphrase)
  }, [config.legacyToken, saveEncryptedToken])

  const unlockToken = useCallback(async (passphrase: string): Promise<{ ok: boolean; message: string }> => {
    if (config.legacyToken) return { ok: true, message: 'Legacy token is active. Migrate it to encrypt at rest.' }
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
  }, [config])

  const dataFilePath = config.filePath.replace(/\.json$/, '-data.json')

  const getFileShaForPath = useCallback(async (path: string): Promise<string | null> => {
    if (!activeToken) throw new Error('Token is not unlocked.')
    const res = await fetch(
      `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`,
      { headers: apiHeaders(activeToken) }
    )
    if (res.status === 404) return null
    if (res.status === 401) throw new Error('Invalid token — check the token is correct and not expired.')
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
    const data = await res.json()
    return data.sha as string
  }, [activeToken, config.owner, config.repo, apiHeaders])

  const getFileSha = useCallback(async (): Promise<string | null> => {
    return getFileShaForPath(config.filePath)
  }, [getFileShaForPath, config.filePath])

  const syncNow = useCallback(async (data: object, message?: string): Promise<void> => {
    if (!isConfigured) return
    setSyncStatus('syncing')
    setLastError(null)
    try {
      const canonicalJson = JSON.stringify(data)
      const prettyJson = JSON.stringify(data, null, 2)
      const content = toBase64(prettyJson)
      const sha = await getFileSha()
      const commitMessage =
        message ||
        `Auto-save: ${new Date().toLocaleString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })}`
      const body: Record<string, string> = { message: commitMessage, content }
      if (sha) body.sha = sha
      const res = await fetch(
        `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.filePath}`,
        { method: 'PUT', headers: apiHeaders(activeToken), body: JSON.stringify(body) }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { message?: string }).message || `GitHub API error: ${res.status}`)
      }
      lastSyncedJsonRef.current = canonicalJson
      setSyncStatus('success')
      setLastSyncAt(new Date().toISOString())
      setHasPendingChanges(false)
    } catch (e) {
      setSyncStatus('error')
      setLastError(e instanceof Error ? e.message : String(e))
    }
  }, [activeToken, apiHeaders, config.owner, config.repo, config.filePath, getFileSha, isConfigured])

  const syncDataNow = useCallback(async (data: object, message?: string): Promise<void> => {
    if (!isConfigured) return
    try {
      const canonicalJson = JSON.stringify(data)
      const prettyJson = JSON.stringify(data, null, 2)
      const content = toBase64(prettyJson)
      const sha = await getFileShaForPath(dataFilePath)
      const commitMessage =
        message ||
        `Data sync: ${new Date().toLocaleString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })}`
      const body: Record<string, string> = { message: commitMessage, content }
      if (sha) body.sha = sha
      const res = await fetch(
        `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${dataFilePath}`,
        { method: 'PUT', headers: apiHeaders(activeToken), body: JSON.stringify(body) }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { message?: string }).message || `GitHub API error: ${res.status}`)
      }
      lastSyncedDataJsonRef.current = canonicalJson
    } catch (e) {
      console.error('Data file sync error:', e instanceof Error ? e.message : e)
    }
  }, [activeToken, apiHeaders, config.owner, config.repo, dataFilePath, getFileShaForPath, isConfigured])

  const fetchHistory = useCallback(async (): Promise<void> => {
    if (!isConfigured) return
    try {
      const res = await fetch(
        `https://api.github.com/repos/${config.owner}/${config.repo}/commits?path=${encodeURIComponent(config.filePath)}&per_page=100`,
        { headers: apiHeaders(activeToken) }
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
        }))
      )
    } catch {
      // no-op
    }
  }, [activeToken, apiHeaders, config.filePath, config.owner, config.repo, isConfigured])

  const testConnection = useCallback(async (): Promise<ConnectionTestResult> => {
    if (!activeToken || !config.owner || !config.repo) {
      return { ok: false, message: 'Fill in token, owner, and repository first.', warnings: [] }
    }
    try {
      const res = await fetch(
        `https://api.github.com/repos/${config.owner}/${config.repo}`,
        { headers: apiHeaders(activeToken) }
      )
      if (res.status === 404) return { ok: false, message: 'Repository not found — if it\'s private, ensure the token has access to private repositories (classic token needs "repo" scope; fine-grained token needs "Contents: Read & Write").', warnings: [] }
      if (res.status === 401) return { ok: false, message: 'Invalid token — check the token is correct and not expired.', warnings: [] }
      if (!res.ok) return { ok: false, message: `GitHub API error: ${res.status}`, warnings: [] }

      const warnings: string[] = []
      const scopes = res.headers.get('x-oauth-scopes')
      const repoData = await res.json() as {
        full_name: string
        private?: boolean
        permissions?: { push?: boolean }
      }

      if (repoData.private === false) {
        warnings.push('This repository is public. Backups may expose sensitive financial data.')
      }
      if (repoData.permissions && repoData.permissions.push === false) {
        warnings.push('Token does not appear to have write access to this repository.')
      }
      if (scopes && scopes.includes('repo')) {
        warnings.push('Token has broad repo scope. Prefer a fine-grained token limited to one backup repo.')
      }
      if (usingLegacyToken) {
        warnings.push('Token is currently stored as plaintext. Migrate to encrypted storage with a passphrase.')
      }

      return { ok: true, message: `Connected to ${repoData.full_name}`, warnings }
    } catch {
      return { ok: false, message: 'Network error. Check your connection.', warnings: [] }
    }
  }, [activeToken, apiHeaders, config.owner, config.repo, usingLegacyToken])

  const restoreFromCommit = useCallback(async (commitSha: string): Promise<RestoreResult> => {
    if (!isConfigured) return { ok: false, message: 'Connect and unlock token first.' }
    try {
      const res = await fetch(
        `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.filePath}?ref=${commitSha}`,
        { headers: apiHeaders(activeToken) }
      )
      if (res.status === 404) return { ok: false, message: 'Backup file not found in this commit.' }
      if (!res.ok) return { ok: false, message: `GitHub API error: ${res.status}` }
      const file = await res.json() as { content?: string; encoding?: string }
      if (!file.content || file.encoding !== 'base64') {
        return { ok: false, message: 'Backup file format is not supported.' }
      }
      const decoded = fromBase64(file.content.replace(/\n/g, ''))
      const parsed = JSON.parse(decoded)
      return { ok: true, message: `Restored from commit ${commitSha.slice(0, 7)}.`, data: parsed }
    } catch {
      return { ok: false, message: 'Could not restore backup from GitHub.' }
    }
  }, [activeToken, apiHeaders, config.filePath, config.owner, config.repo, isConfigured])

  const restoreLatest = useCallback(async (): Promise<RestoreResult> => {
    if (!isConfigured) return { ok: false, message: 'Connect and unlock token first.' }
    try {
      const res = await fetch(
        `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.filePath}`,
        { headers: apiHeaders(activeToken) }
      )
      if (res.status === 404) return { ok: false, message: 'Backup file not found in repository.' }
      if (!res.ok) return { ok: false, message: `GitHub API error: ${res.status}` }
      const file = await res.json() as { content?: string; encoding?: string }
      if (!file.content || file.encoding !== 'base64') {
        return { ok: false, message: 'Backup file format is not supported.' }
      }
      const decoded = fromBase64(file.content.replace(/\n/g, ''))
      const parsed = JSON.parse(decoded)
      return { ok: true, message: 'Latest backup restored from GitHub.', data: parsed }
    } catch {
      return { ok: false, message: 'Could not restore backup from GitHub.' }
    }
  }, [activeToken, apiHeaders, config.filePath, config.owner, config.repo, isConfigured])

  const restoreDataLatest = useCallback(async (): Promise<RestoreResult> => {
    if (!isConfigured) return { ok: false, message: 'Connect and unlock token first.' }
    try {
      const res = await fetch(
        `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${dataFilePath}`,
        { headers: apiHeaders(activeToken) }
      )
      if (res.status === 404) return { ok: true, message: 'No data file found.', data: null }
      if (!res.ok) return { ok: false, message: `GitHub API error: ${res.status}` }
      const file = await res.json() as { content?: string; encoding?: string }
      if (!file.content || file.encoding !== 'base64') {
        return { ok: false, message: 'Data file format is not supported.' }
      }
      const decoded = fromBase64(file.content.replace(/\n/g, ''))
      const parsed = JSON.parse(decoded)
      return { ok: true, message: 'Data file restored.', data: parsed }
    } catch {
      return { ok: false, message: 'Could not restore data file from GitHub.' }
    }
  }, [activeToken, apiHeaders, dataFilePath, config.owner, config.repo, isConfigured])

  const updateData = useCallback((data: object) => {
    const json = JSON.stringify(data)
    if (json === lastSyncedJsonRef.current) {
      setHasPendingChanges(false)
      return
    }
    setHasPendingChanges(true)
    pendingDataRef.current = data
    if (!config.autoSync || !isConfigured) return
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      if (pendingDataRef.current) syncNow(pendingDataRef.current)
      if (pendingDataFileRef.current) syncDataNow(pendingDataFileRef.current)
    }, DEBOUNCE_MS)
  }, [config.autoSync, isConfigured, syncNow, syncDataNow])

  const updateDataFile = useCallback((data: object) => {
    const json = JSON.stringify(data)
    if (json === lastSyncedDataJsonRef.current) return
    pendingDataFileRef.current = data
    if (!config.autoSync || !isConfigured) return
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      if (pendingDataRef.current) syncNow(pendingDataRef.current)
      if (pendingDataFileRef.current) syncDataNow(pendingDataFileRef.current)
    }, DEBOUNCE_MS)
  }, [config.autoSync, isConfigured, syncNow, syncDataNow])

  const markRestored = useCallback(() => {
    setLastSyncAt(new Date().toISOString())
    setSyncStatus('success')
    setHasPendingChanges(false)
    setLastError(null)
  }, [])

  useEffect(() => () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
  }, [])

  return {
    config,
    updateConfig,
    isConfigured,
    syncStatus,
    lastSyncAt,
    lastError,
    hasPendingChanges,
    history,
    hasStoredToken,
    tokenUnlocked,
    usingLegacyToken,
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
    updateData,
    updateDataFile,
    syncDataNow,
    restoreDataLatest,
  }
}
