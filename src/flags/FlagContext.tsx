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
const CACHE_KEY = 'flag-rollout-cache'
const CACHE_MAX_AGE_MS = 5 * 60 * 1000 // 5 minutes
const EMPTY_CONFIG: RolloutConfig = { version: 1, updatedAt: '', flags: {} }

/* ── Cache helpers ────────────────────────────────────────────────── */

interface CachedConfig {
  config: RolloutConfig
  fetchedAt: number
}

function getCachedConfig(): CachedConfig | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function setCachedConfig(config: RolloutConfig): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ config, fetchedAt: Date.now() }))
  } catch {
    /* localStorage full */
  }
}

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
    // Check cache first — if fresh, skip network entirely
    const cached = getCachedConfig()
    if (cached && Date.now() - cached.fetchedAt < CACHE_MAX_AGE_MS) {
      setRolloutConfig(cached.config)
      if (!activeToken) {
        setIsAdmin(false)
        setConfigSha(null)
      }
      // Still do authenticated fetch for admin status if token exists
      if (activeToken) {
        setIsLoading(true)
        setError(null)
        try {
          const adminRes = await fetch(
            'https://api.github.com/repos/dutta14/finance-tracking/contents/feature-flags.json',
            {
              headers: {
                Authorization: `Bearer ${activeToken}`,
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
              },
            },
          )

          if (adminRes.ok) {
            const data = await adminRes.json()
            const decoded = atob(data.content)
            const parsed = JSON.parse(decoded) as RolloutConfig
            if (!parsed.flags || typeof parsed.flags !== 'object' || Array.isArray(parsed.flags)) {
              console.warn('Invalid rollout config: flags must be an object, using defaults')
              setRolloutConfig(EMPTY_CONFIG)
            } else {
              setRolloutConfig(parsed)
              setCachedConfig(parsed)
            }
            setIsAdmin(true)
            setConfigSha(data.sha || null)
          } else if (adminRes.status === 404) {
            setRolloutConfig(EMPTY_CONFIG)
            setConfigSha(null)
            setIsAdmin(true)
          } else {
            // 403 or other — not admin, keep cached config
            setIsAdmin(false)
            setConfigSha(null)
          }
        } catch {
          setIsAdmin(false)
          setConfigSha(null)
        }
        setIsLoading(false)
      }
      return
    }

    setIsLoading(true)
    setError(null)

    if (activeToken) {
      // Authenticated fetch — gives both config content AND SHA (no race condition)
      try {
        const adminRes = await fetch(
          'https://api.github.com/repos/dutta14/finance-tracking/contents/feature-flags.json',
          {
            headers: {
              Authorization: `Bearer ${activeToken}`,
              Accept: 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28',
            },
          },
        )

        if (adminRes.ok) {
          const data = await adminRes.json()
          if (!data.content) {
            throw new Error('GitHub API response missing content field')
          }
          const decoded = atob(data.content)
          const parsed = JSON.parse(decoded) as RolloutConfig
          if (!parsed.flags || typeof parsed.flags !== 'object' || Array.isArray(parsed.flags)) {
            console.warn('Invalid rollout config: flags must be an object, using defaults')
            setRolloutConfig(EMPTY_CONFIG)
          } else {
            setRolloutConfig(parsed)
            setCachedConfig(parsed)
          }
          setIsAdmin(true)
          setConfigSha(data.sha || null)
        } else if (adminRes.status === 404) {
          // File doesn't exist yet — clean state, admin can create it
          setRolloutConfig(EMPTY_CONFIG)
          setConfigSha(null)
          setIsAdmin(true)
        } else {
          // 403 = no access to source repo — fall back to public fetch
          setIsAdmin(false)
          setConfigSha(null)
          await fetchPublicConfig()
        }
      } catch {
        // Network error on auth'd fetch — fall back to public
        setIsAdmin(false)
        setConfigSha(null)
        try {
          await fetchPublicConfig()
        } catch (publicErr) {
          setError(publicErr instanceof Error ? publicErr.message : String(publicErr))
          setRolloutConfig(EMPTY_CONFIG)
        }
      }
    } else {
      // No token — public fetch only
      setIsAdmin(false)
      setConfigSha(null)
      try {
        await fetchPublicConfig()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        setRolloutConfig(EMPTY_CONFIG)
      }
    }

    setIsLoading(false)
  }, [activeToken])

  async function fetchPublicConfig(): Promise<void> {
    const publicRes = await fetch('https://api.github.com/repos/dutta14/finance-tracking/contents/feature-flags.json', {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })

    if (publicRes.ok) {
      const data = await publicRes.json()
      if (!data.content) {
        throw new Error('GitHub API response missing content field')
      }
      const decoded = atob(data.content)
      const parsed = JSON.parse(decoded) as RolloutConfig
      if (!parsed.flags || typeof parsed.flags !== 'object' || Array.isArray(parsed.flags)) {
        console.warn('Invalid rollout config: flags must be an object, using defaults')
        setRolloutConfig(EMPTY_CONFIG)
      } else {
        setRolloutConfig(parsed)
        setCachedConfig(parsed)
      }
    } else if (publicRes.status === 404) {
      // File doesn't exist — not an error
      setRolloutConfig(EMPTY_CONFIG)
    } else if (publicRes.status === 403) {
      // Rate limited — use cache if available
      const rateLimitRemaining = publicRes.headers.get('X-RateLimit-Remaining')
      if (rateLimitRemaining === '0' || rateLimitRemaining === null) {
        const cached = getCachedConfig()
        if (cached) {
          setRolloutConfig(cached.config)
        } else {
          setRolloutConfig(EMPTY_CONFIG)
        }
      } else {
        setRolloutConfig(EMPTY_CONFIG)
      }
    } else {
      setRolloutConfig(EMPTY_CONFIG)
    }
  }

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
