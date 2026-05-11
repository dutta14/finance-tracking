import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { FC, ReactNode, useContext } from 'react'
import { FlagProvider, FlagContext, useFlagContext, hashCode } from './FlagContext'
import type { FlagDefinition } from './flagSystem'

/* ─── Mocks ─── */

vi.mock('../contexts/GitHubSyncContext', () => ({
  useGitHubSyncContext: vi.fn(() => ({ activeToken: null })),
}))
import { useGitHubSyncContext } from '../contexts/GitHubSyncContext'
const mockedUseGitHubSync = vi.mocked(useGitHubSyncContext)

vi.mock('../utils/storage', () => ({
  getStorageItem: vi.fn((_key: string, fallback: unknown) => {
    const raw = localStorage.getItem(_key)
    if (raw === null) return fallback
    try {
      return JSON.parse(raw)
    } catch {
      return fallback
    }
  }),
  setStorageItem: vi.fn((key: string, value: unknown) => {
    localStorage.setItem(key, JSON.stringify(value))
  }),
  removeStorageItem: vi.fn((key: string) => {
    localStorage.removeItem(key)
  }),
}))

/* ─── Helpers ─── */

const boolFlag = (id: string, defaultVal: boolean): FlagDefinition<'boolean'> => ({
  id,
  type: 'boolean',
  default: defaultVal,
  description: `Test flag ${id}`,
})

const stringFlag = (id: string, defaultVal: string): FlagDefinition<'string'> => ({
  id,
  type: 'string',
  default: defaultVal,
  description: `Test string flag ${id}`,
})

// Suppress fetch errors in tests
const mockFetch = vi.fn()

const wrapper: FC<{ children: ReactNode }> = ({ children }) => <FlagProvider>{children}</FlagProvider>

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  mockedUseGitHubSync.mockReturnValue({ activeToken: null } as ReturnType<typeof useGitHubSyncContext>)
  // Default: fetch returns 404 (no config file)
  mockFetch.mockResolvedValue({ ok: false, status: 404 })
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/* ═══════════════════════════════════════════════════════════════
   TESTS
   ═══════════════════════════════════════════════════════════════ */

describe('hashCode', () => {
  it('returns a non-negative integer for any string', () => {
    const result = hashCode('test-flag-abc123')
    expect(result).toBeGreaterThanOrEqual(0)
    expect(Number.isInteger(result)).toBe(true)
  })

  it('returns the same hash for the same input', () => {
    const a = hashCode('my-flag-id-client-uuid')
    const b = hashCode('my-flag-id-client-uuid')
    expect(a).toBe(b)
  })

  it('returns different hashes for different inputs', () => {
    const a = hashCode('flag-a-client-1')
    const b = hashCode('flag-b-client-2')
    expect(a).not.toBe(b)
  })

  it('returns 0 for empty string', () => {
    expect(hashCode('')).toBe(0)
  })
})

describe('FlagProvider', () => {
  describe('resolveFlag', () => {
    it('returns default value when no override or rollout config exists', () => {
      const { result } = renderHook(() => useFlagContext(), { wrapper })
      const flag = boolFlag('new-feature', false)
      expect(result.current.resolveFlag(flag)).toBe(false)
    })

    it('returns true default when flag default is true', () => {
      const { result } = renderHook(() => useFlagContext(), { wrapper })
      const flag = boolFlag('always-on', true)
      expect(result.current.resolveFlag(flag)).toBe(true)
    })

    it('returns string default for string flags', () => {
      const { result } = renderHook(() => useFlagContext(), { wrapper })
      const flag = stringFlag('theme', 'light')
      expect(result.current.resolveFlag(flag)).toBe('light')
    })

    it('returns override value when override is set', () => {
      const { result } = renderHook(() => useFlagContext(), { wrapper })
      const flag = boolFlag('my-flag', false)

      act(() => {
        result.current.setOverride('my-flag', true)
      })

      expect(result.current.resolveFlag(flag)).toBe(true)
    })

    it('override takes priority over rollout config', async () => {
      // Set up rollout config in cache
      const rolloutConfig = {
        version: 1,
        updatedAt: '2024-01-01',
        flags: { 'my-flag': { percentage: 100 } },
      }
      localStorage.setItem('flag-rollout-cache', JSON.stringify({ config: rolloutConfig, fetchedAt: Date.now() }))

      const { result } = renderHook(() => useFlagContext(), { wrapper })

      // Wait for config to load
      await waitFor(() => {
        expect(result.current.rolloutConfig.flags['my-flag']).toBeDefined()
      })

      // Set override to false
      act(() => {
        result.current.setOverride('my-flag', false)
      })

      const flag = boolFlag('my-flag', false)
      // Override (false) should win over rollout (100% = true)
      expect(result.current.resolveFlag(flag)).toBe(false)
    })

    it('uses rollout percentage for boolean flags when no override exists', async () => {
      const rolloutConfig = {
        version: 1,
        updatedAt: '2024-01-01',
        flags: { 'rollout-flag': { percentage: 100 } },
      }
      localStorage.setItem('flag-rollout-cache', JSON.stringify({ config: rolloutConfig, fetchedAt: Date.now() }))

      const { result } = renderHook(() => useFlagContext(), { wrapper })

      await waitFor(() => {
        expect(result.current.rolloutConfig.flags['rollout-flag']).toBeDefined()
      })

      const flag = boolFlag('rollout-flag', false)
      // 100% rollout should always return true
      expect(result.current.resolveFlag(flag)).toBe(true)
    })

    it('returns false for 0% rollout', async () => {
      const rolloutConfig = {
        version: 1,
        updatedAt: '2024-01-01',
        flags: { 'zero-flag': { percentage: 0 } },
      }
      localStorage.setItem('flag-rollout-cache', JSON.stringify({ config: rolloutConfig, fetchedAt: Date.now() }))

      const { result } = renderHook(() => useFlagContext(), { wrapper })

      await waitFor(() => {
        expect(result.current.rolloutConfig.flags['zero-flag']).toBeDefined()
      })

      const flag = boolFlag('zero-flag', false)
      expect(result.current.resolveFlag(flag)).toBe(false)
    })

    it('uses rollout value for non-boolean flags', async () => {
      const rolloutConfig = {
        version: 1,
        updatedAt: '2024-01-01',
        flags: { 'theme-flag': { value: 'dark' } },
      }
      localStorage.setItem('flag-rollout-cache', JSON.stringify({ config: rolloutConfig, fetchedAt: Date.now() }))

      const { result } = renderHook(() => useFlagContext(), { wrapper })

      await waitFor(() => {
        expect(result.current.rolloutConfig.flags['theme-flag']).toBeDefined()
      })

      const flag = stringFlag('theme-flag', 'light')
      expect(result.current.resolveFlag(flag)).toBe('dark')
    })

    it('clamps rollout percentage above 100 to 100', async () => {
      const rolloutConfig = {
        version: 1,
        updatedAt: '2024-01-01',
        flags: { 'over-flag': { percentage: 200 } },
      }
      localStorage.setItem('flag-rollout-cache', JSON.stringify({ config: rolloutConfig, fetchedAt: Date.now() }))

      const { result } = renderHook(() => useFlagContext(), { wrapper })

      await waitFor(() => {
        expect(result.current.rolloutConfig.flags['over-flag']).toBeDefined()
      })

      const flag = boolFlag('over-flag', false)
      // 200% clamped to 100% → always true
      expect(result.current.resolveFlag(flag)).toBe(true)
    })

    it('clamps negative rollout percentage to 0', async () => {
      const rolloutConfig = {
        version: 1,
        updatedAt: '2024-01-01',
        flags: { 'neg-flag': { percentage: -50 } },
      }
      localStorage.setItem('flag-rollout-cache', JSON.stringify({ config: rolloutConfig, fetchedAt: Date.now() }))

      const { result } = renderHook(() => useFlagContext(), { wrapper })

      await waitFor(() => {
        expect(result.current.rolloutConfig.flags['neg-flag']).toBeDefined()
      })

      const flag = boolFlag('neg-flag', true)
      // -50% clamped to 0% → false
      expect(result.current.resolveFlag(flag)).toBe(false)
    })
  })

  describe('setOverride', () => {
    it('persists override to localStorage', () => {
      const { result } = renderHook(() => useFlagContext(), { wrapper })

      act(() => {
        result.current.setOverride('my-flag', true)
      })

      const stored = JSON.parse(localStorage.getItem('flag-overrides') || '{}')
      expect(stored['my-flag']).toBe(true)
    })

    it('updates overrides state', () => {
      const { result } = renderHook(() => useFlagContext(), { wrapper })

      act(() => {
        result.current.setOverride('feat-x', 'enabled')
      })

      expect(result.current.overrides['feat-x']).toBe('enabled')
    })

    it('overwrites previous override value', () => {
      const { result } = renderHook(() => useFlagContext(), { wrapper })

      act(() => {
        result.current.setOverride('my-flag', true)
      })
      act(() => {
        result.current.setOverride('my-flag', false)
      })

      expect(result.current.overrides['my-flag']).toBe(false)
      const stored = JSON.parse(localStorage.getItem('flag-overrides') || '{}')
      expect(stored['my-flag']).toBe(false)
    })
  })

  describe('resetAllOverrides', () => {
    it('clears all overrides from state and localStorage', () => {
      const { result } = renderHook(() => useFlagContext(), { wrapper })

      act(() => {
        result.current.setOverride('flag-a', true)
        result.current.setOverride('flag-b', 'dark')
      })

      act(() => {
        result.current.resetAllOverrides()
      })

      expect(result.current.overrides).toEqual({})
      expect(localStorage.getItem('flag-overrides')).toBeNull()
    })

    it('reverts resolved flag to default after overrides are cleared', () => {
      const { result } = renderHook(() => useFlagContext(), { wrapper })
      const flag = boolFlag('temp-flag', false)

      act(() => {
        result.current.setOverride('temp-flag', true)
      })
      expect(result.current.resolveFlag(flag)).toBe(true)

      act(() => {
        result.current.resetAllOverrides()
      })
      expect(result.current.resolveFlag(flag)).toBe(false)
    })
  })

  describe('clientId', () => {
    it('generates and persists a client ID', () => {
      const { result } = renderHook(() => useFlagContext(), { wrapper })
      expect(result.current.clientId).toBeTruthy()
      expect(typeof result.current.clientId).toBe('string')
    })

    it('reuses existing client ID from localStorage', () => {
      localStorage.setItem('flag-client-id', JSON.stringify('existing-uuid'))
      const { result } = renderHook(() => useFlagContext(), { wrapper })
      expect(result.current.clientId).toBe('existing-uuid')
    })
  })

  describe('environment', () => {
    it('returns staging for non-production hostname', () => {
      const { result } = renderHook(() => useFlagContext(), { wrapper })
      expect(result.current.environment).toBe('staging')
    })
  })

  describe('initial state', () => {
    it('starts with isAdmin false', () => {
      const { result } = renderHook(() => useFlagContext(), { wrapper })
      expect(result.current.isAdmin).toBe(false)
    })

    it('starts with error null', () => {
      const { result } = renderHook(() => useFlagContext(), { wrapper })
      expect(result.current.error).toBeNull()
    })

    it('starts with empty rollout config', () => {
      const { result } = renderHook(() => useFlagContext(), { wrapper })
      expect(result.current.rolloutConfig).toEqual({ version: 1, updatedAt: '', flags: {} })
    })
  })

  describe('fetchConfig', () => {
    it('uses cached config when cache is fresh without fetching', async () => {
      const localFetch = vi.fn()
      vi.stubGlobal('fetch', localFetch)

      const cachedConfig = {
        version: 1,
        updatedAt: '2024-01-01',
        flags: { 'cached-flag': { percentage: 50 } },
      }
      localStorage.setItem('flag-rollout-cache', JSON.stringify({ config: cachedConfig, fetchedAt: Date.now() }))

      const { result } = renderHook(() => useFlagContext(), { wrapper })

      await waitFor(() => {
        expect(result.current.rolloutConfig.flags['cached-flag']).toBeDefined()
      })
      // No fetch should be made (no token, cached)
      expect(localFetch).not.toHaveBeenCalled()
    })

    it('fetches authenticated config when token is present and cache is fresh', async () => {
      mockedUseGitHubSync.mockReturnValue({ activeToken: 'ghp_test123' } as ReturnType<typeof useGitHubSyncContext>)

      const cachedConfig = {
        version: 1,
        updatedAt: '2024-01-01',
        flags: { 'cached-flag': { percentage: 50 } },
      }
      localStorage.setItem('flag-rollout-cache', JSON.stringify({ config: cachedConfig, fetchedAt: Date.now() }))

      const serverConfig = {
        version: 2,
        updatedAt: '2024-06-01',
        flags: { 'server-flag': { percentage: 75 } },
      }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          content: btoa(JSON.stringify(serverConfig)),
          sha: 'abc123',
        }),
      })

      const { result } = renderHook(() => useFlagContext(), { wrapper })

      await waitFor(() => {
        expect(result.current.isAdmin).toBe(true)
      })
    })

    it('sets isAdmin true when authenticated fetch returns 404', async () => {
      mockedUseGitHubSync.mockReturnValue({ activeToken: 'ghp_test123' } as ReturnType<typeof useGitHubSyncContext>)

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const { result } = renderHook(() => useFlagContext(), { wrapper })

      await waitFor(() => {
        expect(result.current.isAdmin).toBe(true)
      })
    })

    it('falls back to public fetch when authenticated fetch returns 403', async () => {
      mockedUseGitHubSync.mockReturnValue({ activeToken: 'ghp_test123' } as ReturnType<typeof useGitHubSyncContext>)

      // First call (auth) returns 403
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      })
      // Second call (public) returns 404
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const { result } = renderHook(() => useFlagContext(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
      expect(result.current.isAdmin).toBe(false)
      // At least 2 calls: auth (403) + public fallback
      const calls = mockFetch.mock.calls.filter(
        (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('feature-flags'),
      )
      expect(calls.length).toBeGreaterThanOrEqual(2)
    })

    it('handles network error on authenticated fetch by falling back to public', async () => {
      mockedUseGitHubSync.mockReturnValue({ activeToken: 'ghp_test123' } as ReturnType<typeof useGitHubSyncContext>)

      // Auth fetch throws
      mockFetch.mockRejectedValueOnce(new Error('Network error'))
      // Public fetch succeeds
      const publicConfig = {
        version: 1,
        updatedAt: '2024-01-01',
        flags: { 'public-flag': { percentage: 100 } },
      }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          content: btoa(JSON.stringify(publicConfig)),
          sha: null,
        }),
      })

      const { result } = renderHook(() => useFlagContext(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
      expect(result.current.isAdmin).toBe(false)
    })

    it('handles invalid rollout config with missing flags object', async () => {
      mockedUseGitHubSync.mockReturnValue({ activeToken: 'ghp_test123' } as ReturnType<typeof useGitHubSyncContext>)

      const badConfig = { version: 1, updatedAt: '2024-01-01', flags: [] }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          content: btoa(JSON.stringify(badConfig)),
          sha: 'abc',
        }),
      })

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { result } = renderHook(() => useFlagContext(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
      expect(result.current.rolloutConfig).toEqual({ version: 1, updatedAt: '', flags: {} })
      warnSpy.mockRestore()
    })

    it('sets error when public fetch fails without token', async () => {
      // No token, public fetch throws
      mockFetch.mockRejectedValueOnce(new Error('Fetch failed'))

      const { result } = renderHook(() => useFlagContext(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
      expect(result.current.error).toBe('Fetch failed')
    })

    it('handles rate-limited public fetch (403) with cached config', async () => {
      const cachedConfig = {
        version: 1,
        updatedAt: '2024-01-01',
        flags: { 'cached-flag': { value: true } },
      }
      // Cache is expired (fetchedAt long ago)
      localStorage.setItem('flag-rollout-cache', JSON.stringify({ config: cachedConfig, fetchedAt: 0 }))

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers({ 'X-RateLimit-Remaining': '0' }),
      })

      const { result } = renderHook(() => useFlagContext(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
      // Should use cached config
      expect(result.current.rolloutConfig.flags['cached-flag']).toBeDefined()
    })

    it('falls back to empty config on rate-limited 403 without cache', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers({ 'X-RateLimit-Remaining': '0' }),
      })

      const { result } = renderHook(() => useFlagContext(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
      expect(result.current.rolloutConfig).toEqual({ version: 1, updatedAt: '', flags: {} })
    })

    it('handles 403 with remaining rate limit as non-rate-limited error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers({ 'X-RateLimit-Remaining': '59' }),
      })

      const { result } = renderHook(() => useFlagContext(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
      expect(result.current.rolloutConfig).toEqual({ version: 1, updatedAt: '', flags: {} })
    })

    it('handles public fetch missing content field', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ sha: 'abc' }), // no content field
      })

      const { result } = renderHook(() => useFlagContext(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
      expect(result.current.error).toBe('GitHub API response missing content field')
    })
  })

  describe('saveRolloutConfig', () => {
    it('does nothing when no token is present', async () => {
      const { result } = renderHook(() => useFlagContext(), { wrapper })

      const newConfig = { version: 2, updatedAt: '2024-06-01', flags: {} }
      await act(async () => {
        await result.current.saveRolloutConfig(newConfig)
      })

      // No fetch calls for save (only the initial fetch may have happened)
      const putCalls = mockFetch.mock.calls.filter(call => call[1] && (call[1] as RequestInit).method === 'PUT')
      expect(putCalls.length).toBe(0)
    })

    it('throws when save API returns error', async () => {
      mockedUseGitHubSync.mockReturnValue({ activeToken: 'ghp_test123' } as ReturnType<typeof useGitHubSyncContext>)

      // Initial fetch returns 404
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })

      const { result } = renderHook(() => useFlagContext(), { wrapper })

      await waitFor(() => {
        expect(result.current.isAdmin).toBe(true)
      })

      // Save returns 500
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Internal Server Error' }),
      })

      const newConfig = { version: 2, updatedAt: '2024-06-01', flags: {} }
      await expect(
        act(async () => {
          await result.current.saveRolloutConfig(newConfig)
        }),
      ).rejects.toThrow('Internal Server Error')
    })

    it('refetches config on 409 conflict', async () => {
      mockedUseGitHubSync.mockReturnValue({ activeToken: 'ghp_test123' } as ReturnType<typeof useGitHubSyncContext>)

      // Initial fetch returns 404
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })

      const { result } = renderHook(() => useFlagContext(), { wrapper })

      await waitFor(() => {
        expect(result.current.isAdmin).toBe(true)
      })

      // Save returns 409 conflict
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 409,
          json: async () => ({ message: 'Conflict' }),
        })
        // Refetch after conflict
        .mockResolvedValueOnce({ ok: false, status: 404 })

      const newConfig = { version: 2, updatedAt: '2024-06-01', flags: {} }
      await expect(
        act(async () => {
          await result.current.saveRolloutConfig(newConfig)
        }),
      ).rejects.toThrow('Conflict')

      // Should have called fetch again for refetch
      expect(mockFetch.mock.calls.length).toBeGreaterThan(2)
    })
  })

  describe('refresh', () => {
    it('re-fetches the config', async () => {
      const { result } = renderHook(() => useFlagContext(), { wrapper })

      // Initial fetch
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const fetchCountBefore = mockFetch.mock.calls.length

      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })

      await act(async () => {
        await result.current.refresh()
      })

      expect(mockFetch.mock.calls.length).toBeGreaterThan(fetchCountBefore)
    })
  })

  describe('rollout hashing consistency', () => {
    it('produces consistent results for the same flag and client', async () => {
      localStorage.setItem('flag-client-id', JSON.stringify('fixed-client-id'))

      const rolloutConfig = {
        version: 1,
        updatedAt: '2024-01-01',
        flags: { 'consistent-flag': { percentage: 50 } },
      }
      localStorage.setItem('flag-rollout-cache', JSON.stringify({ config: rolloutConfig, fetchedAt: Date.now() }))

      const { result: result1 } = renderHook(() => useFlagContext(), { wrapper })

      await waitFor(() => {
        expect(result1.current.rolloutConfig.flags['consistent-flag']).toBeDefined()
      })

      const flag = boolFlag('consistent-flag', false)
      const firstResult = result1.current.resolveFlag(flag)

      // Resolve again — same result
      const secondResult = result1.current.resolveFlag(flag)
      expect(firstResult).toBe(secondResult)
    })
  })

  describe('default context value', () => {
    it('provides default resolveFlag that returns flag default', () => {
      // Render without provider — uses default context
      const { result } = renderHook(() => {
        return useContext(FlagContext)
      })

      const flag = boolFlag('test', true)
      expect(result.current.resolveFlag(flag)).toBe(true)
    })
  })

  describe('cached config with token in fresh cache', () => {
    it('sets isAdmin false and clears configSha when no token and cache is fresh', async () => {
      const cachedConfig = {
        version: 1,
        updatedAt: '2024-01-01',
        flags: { 'cached-flag': { percentage: 50 } },
      }
      localStorage.setItem('flag-rollout-cache', JSON.stringify({ config: cachedConfig, fetchedAt: Date.now() }))

      const { result } = renderHook(() => useFlagContext(), { wrapper })

      await waitFor(() => {
        expect(result.current.rolloutConfig.flags['cached-flag']).toBeDefined()
      })
      expect(result.current.isAdmin).toBe(false)
    })
  })

  describe('auth fetch with valid config and missing content', () => {
    it('throws when authenticated fetch returns ok but missing content field', async () => {
      mockedUseGitHubSync.mockReturnValue({ activeToken: 'ghp_test123' } as ReturnType<typeof useGitHubSyncContext>)

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ sha: 'abc123' }), // no content
        })
        // Fall back to public
        .mockResolvedValueOnce({ ok: false, status: 404 })

      const { result } = renderHook(() => useFlagContext(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
      // Should have fallen back to public
      expect(result.current.isAdmin).toBe(false)
    })
  })

  describe('auth fetch with invalid flags in response', () => {
    it('resets to empty config when authenticated fetch returns invalid flags', async () => {
      mockedUseGitHubSync.mockReturnValue({ activeToken: 'ghp_test123' } as ReturnType<typeof useGitHubSyncContext>)

      const badConfig = { version: 1, updatedAt: '2024-01-01', flags: 'not-an-object' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          content: btoa(JSON.stringify(badConfig)),
          sha: 'abc',
        }),
      })

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { result } = renderHook(() => useFlagContext(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
      expect(result.current.rolloutConfig).toEqual({ version: 1, updatedAt: '', flags: {} })
      warnSpy.mockRestore()
    })
  })

  describe('network error on both auth and public fetch', () => {
    it('sets error when both fetches fail', async () => {
      mockedUseGitHubSync.mockReturnValue({ activeToken: 'ghp_test123' } as ReturnType<typeof useGitHubSyncContext>)

      mockFetch.mockRejectedValueOnce(new Error('Auth failed'))
      mockFetch.mockRejectedValueOnce(new Error('Public also failed'))

      const { result } = renderHook(() => useFlagContext(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
      expect(result.current.error).toBe('Public also failed')
    })
  })
})
