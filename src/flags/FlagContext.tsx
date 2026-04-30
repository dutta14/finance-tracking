import { createContext, useContext, FC, ReactNode, useState, useCallback, useEffect, useRef } from 'react'
import { useGitHubSyncContext } from '../contexts/GitHubSyncContext'
import type { FlagDefinition, FlagType } from './flagSystem'

/* ── Hash function (deterministic, non-negative) ─────────────────── */

export function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return Math.abs(hash)
}

/* ── Types ────────────────────────────────────────────────────────── */

export interface RolloutFlagConfig {
  percentage?: number
  value?: unknown
}

export interface RolloutConfig {
  version: number
  updatedAt: string
  flags: Record<string, RolloutFlagConfig>
}

export interface FlagContextValue {
  resolveFlag: <T extends FlagType>(flag: FlagDefinition<T>) => FlagDefinition<T>['default']
  overrides: Record<string, unknown>
  rolloutConfig: RolloutConfig
  setOverride: (flagId: string, value: unknown) => void
  resetAllOverrides: () => void
  saveRolloutConfig: (newConfig: RolloutConfig) => Promise<void>
  refresh: () => Promise<void>
  isAdmin: boolean
  isLoading: boolean
  error: string | null
  environment: 'production' | 'staging'
  clientId: string
}

const OVERRIDES_KEY = 'flag-overrides'
const CLIENT_ID_KEY = 'flag-client-id'
const EMPTY_CONFIG: RolloutConfig = { version: 1, updatedAt: '', flags: {} }

/* ── Context ──────────────────────────────────────────────────────── */

export const FlagContext = createContext<FlagContextValue>({
  resolveFlag: <T extends FlagType>(flag: FlagDefinition<T>) => flag.default,
  overrides: {},
  rolloutConfig: EMPTY_CONFIG,
  setOverride: () => {},
  resetAllOverrides: () => {},
  saveRolloutConfig: async () => {},
  refresh: async () => {},
  isAdmin: false,
  isLoading: false,
  error: null,
  environment: 'staging',
  clientId: '',
})

export function useFlagContext(): FlagContextValue {
  const ctx = useContext(FlagContext)
  if (!ctx) {
    throw new Error('useFlagContext must be used within a FlagProvider')
  }
  return ctx
}

/* ── Helpers ──────────────────────────────────────────────────────── */

function getOrCreateClientId(): string {
  const existing = localStorage.getItem(CLIENT_ID_KEY)
  if (existing) return existing
  const id = crypto.randomUUID()
  localStorage.setItem(CLIENT_ID_KEY, id)
  return id
}

function loadOverrides(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

/* ── Provider ─────────────────────────────────────────────────────── */

interface FlagProviderProps {
  children: ReactNode
}

export const FlagProvider: FC<FlagProviderProps> = ({ children }) => {
  const { activeToken } = useGitHubSyncContext()

  const clientIdRef = useRef(getOrCreateClientId())
  const [overrides, setOverrides] = useState<Record<string, unknown>>(loadOverrides)
  const [rolloutConfig, setRolloutConfig] = useState<RolloutConfig>(EMPTY_CONFIG)
  const [configSha, setConfigSha] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const environment: 'production' | 'staging' =
    window.location.hostname === 'dutta14.github.io' ? 'production' : 'staging'

  /* ── Fetch rollout config from GitHub ──────────────────────────── */

  const fetchConfig = useCallback(async () => {
    if (!activeToken) {
      setRolloutConfig(EMPTY_CONFIG)
      setIsAdmin(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('https://api.github.com/repos/dutta14/finance-tracking/contents/feature-flags.json', {
        headers: {
          Authorization: `Bearer ${activeToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      })

      if (!res.ok) {
        setIsAdmin(false)
        setRolloutConfig(EMPTY_CONFIG)
        setConfigSha(null)
        return
      }

      setIsAdmin(true)

      const data = await res.json()
      if (!data.content) {
        throw new Error('GitHub API response missing content field')
      }
      setConfigSha(data.sha || null)

      const decoded = atob(data.content)
      const parsed = JSON.parse(decoded) as RolloutConfig
      if (!parsed.flags || typeof parsed.flags !== 'object' || Array.isArray(parsed.flags)) {
        console.warn('Invalid rollout config: flags must be an object, using defaults')
        setRolloutConfig({ version: 1, updatedAt: '', flags: {} })
      } else {
        setRolloutConfig(parsed)
      }
    } catch (e) {
      setIsAdmin(false)
      setError(e instanceof Error ? e.message : String(e))
      setRolloutConfig(EMPTY_CONFIG)
    } finally {
      setIsLoading(false)
    }
  }, [activeToken])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  /* ── Resolution function ───────────────────────────────────────── */

  const resolveFlag = useCallback(
    <T extends FlagType>(flag: FlagDefinition<T>): FlagDefinition<T>['default'] => {
      // 1. Developer override
      if (flag.id in overrides) {
        return overrides[flag.id] as FlagDefinition<T>['default']
      }

      // 2. Rollout config
      const flagConfig = rolloutConfig.flags[flag.id]
      if (flagConfig) {
        if (flag.type === 'boolean' && typeof flagConfig.percentage === 'number') {
          const clampedPct = Math.min(100, Math.max(0, flagConfig.percentage))
          const hash = hashCode(flag.id + clientIdRef.current) % 100
          return (hash < clampedPct) as FlagDefinition<T>['default']
        }
        if (flagConfig.value !== undefined) {
          return flagConfig.value as FlagDefinition<T>['default']
        }
      }

      // 3. Default
      return flag.default
    },
    [overrides, rolloutConfig],
  )

  /* ── setOverride ───────────────────────────────────────────────── */

  const setOverride = useCallback((flagId: string, value: unknown) => {
    setOverrides(prev => {
      const next = { ...prev, [flagId]: value }
      try {
        localStorage.setItem(OVERRIDES_KEY, JSON.stringify(next))
      } catch {
        // localStorage may be full — override still applies in-memory
      }
      return next
    })
  }, [])

  /* ── resetAllOverrides ─────────────────────────────────────────── */

  const resetAllOverrides = useCallback(() => {
    setOverrides({})
    localStorage.removeItem(OVERRIDES_KEY)
  }, [])

  /* ── saveRolloutConfig ─────────────────────────────────────────── */

  const saveRolloutConfig = useCallback(
    async (newConfig: RolloutConfig) => {
      if (!activeToken) return

      const content = btoa(JSON.stringify(newConfig, null, 2))
      const body: Record<string, unknown> = {
        message: configSha ? 'chore: update feature flags' : 'feat: initialize feature flags configuration',
        content,
      }
      if (configSha) {
        body.sha = configSha
      }

      const res = await fetch('https://api.github.com/repos/dutta14/finance-tracking/contents/feature-flags.json', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${activeToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (res.status === 409) {
          await fetchConfig()
        }
        throw new Error((err as { message?: string }).message || 'Failed to save rollout config')
      }

      const result = await res.json()
      setConfigSha(result.content?.sha || null)
      setRolloutConfig(newConfig)
    },
    [activeToken, configSha, fetchConfig],
  )

  /* ── refresh ───────────────────────────────────────────────────── */

  const refresh = useCallback(async () => {
    await fetchConfig()
  }, [fetchConfig])

  /* ── Context value ─────────────────────────────────────────────── */

  const value: FlagContextValue = {
    resolveFlag,
    overrides,
    rolloutConfig,
    setOverride,
    resetAllOverrides,
    saveRolloutConfig,
    refresh,
    isAdmin,
    isLoading,
    error,
    environment,
    clientId: clientIdRef.current,
  }

  return <FlagContext.Provider value={value}>{children}</FlagContext.Provider>
}

export default FlagContext
