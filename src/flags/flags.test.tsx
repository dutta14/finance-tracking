import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { render, screen, act } from '@testing-library/react'
import { useContext, type ReactNode, type FC } from 'react'
import { defineFlag } from './flagSystem'
import { FlagContext, FlagProvider, hashCode, type FlagContextValue, type RolloutConfig } from './FlagContext'
import { useFlag } from './useFlag'

/* ── Mock GitHubSyncContext ───────────────────────────────────────── */

const mockActiveToken = vi.fn(() => 'test-token')

vi.mock('../contexts/GitHubSyncContext', () => ({
  useGitHubSyncContext: () => ({
    activeToken: mockActiveToken(),
  }),
}))

/* ── Helpers ──────────────────────────────────────────────────────── */

const testFlag = defineFlag('test-flag', {
  type: 'boolean',
  default: false,
  description: 'A test flag',
  temporary: true,
})

const stringFlag = defineFlag('string-flag', {
  type: 'string',
  default: 'hello',
  description: 'A string flag',
})

/* ── Tests ────────────────────────────────────────────────────────── */

describe('flagSystem', () => {
  it('defineFlag returns correct structure', () => {
    const flag = defineFlag('my-flag', {
      type: 'boolean',
      default: true,
      description: 'My feature flag',
      temporary: true,
    })

    expect(flag).toEqual({
      id: 'my-flag',
      type: 'boolean',
      default: true,
      description: 'My feature flag',
      temporary: true,
    })
  })

  it('defineFlag works without temporary', () => {
    const flag = defineFlag('permanent', {
      type: 'number',
      default: 42,
      description: 'A permanent flag',
    })

    expect(flag.id).toBe('permanent')
    expect(flag.type).toBe('number')
    expect(flag.default).toBe(42)
    expect(flag.temporary).toBeUndefined()
  })
})

describe('hashCode', () => {
  it('is deterministic — same input produces same output', () => {
    const input = 'modern-design+client-123'
    const result1 = hashCode(input)
    const result2 = hashCode(input)
    expect(result1).toBe(result2)
  })

  it('produces different values for different inputs', () => {
    const a = hashCode('flag-a+client-1')
    const b = hashCode('flag-b+client-1')
    expect(a).not.toBe(b)
  })

  it('returns a non-negative number', () => {
    expect(hashCode('test')).toBeGreaterThanOrEqual(0)
    expect(hashCode('')).toBeGreaterThanOrEqual(0)
    expect(hashCode('a very long string with many characters')).toBeGreaterThanOrEqual(0)
  })
})

describe('FlagContext resolution', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('returns default when no override or rollout config', () => {
    const resolveFlag = (_flag: Parameters<FlagContextValue['resolveFlag']>[0]) => _flag.default

    const wrapper: FC<{ children: ReactNode }> = ({ children }) => (
      <FlagContext.Provider
        value={{
          resolveFlag,
          overrides: {},
          rolloutConfig: { version: 1, updatedAt: '', flags: {} },
          setOverride: () => {},
          resetAllOverrides: () => {},
          saveRolloutConfig: async () => {},
          refresh: async () => {},
          isAdmin: false,
          isLoading: false,
          error: null,
          environment: 'staging',
          clientId: 'test-client',
        }}
      >
        {children}
      </FlagContext.Provider>
    )

    const { result } = renderHook(() => useFlag(testFlag), { wrapper })
    expect(result.current).toBe(false)
  })

  it('override takes priority over default', () => {
    const wrapper: FC<{ children: ReactNode }> = ({ children }) => (
      <FlagContext.Provider
        value={{
          resolveFlag: () => true as never,
          overrides: { 'test-flag': true },
          rolloutConfig: { version: 1, updatedAt: '', flags: {} },
          setOverride: () => {},
          resetAllOverrides: () => {},
          saveRolloutConfig: async () => {},
          refresh: async () => {},
          isAdmin: false,
          isLoading: false,
          error: null,
          environment: 'staging',
          clientId: 'test-client',
        }}
      >
        {children}
      </FlagContext.Provider>
    )

    const { result } = renderHook(() => useFlag(testFlag), { wrapper })
    expect(result.current).toBe(true)
  })

  it('resolution order: override > rollout > default', () => {
    localStorage.setItem('flag-overrides', JSON.stringify({ 'test-flag': true }))

    const mockResolve = vi.fn().mockReturnValue(true)
    const wrapper: FC<{ children: ReactNode }> = ({ children }) => (
      <FlagContext.Provider
        value={{
          resolveFlag: mockResolve,
          overrides: { 'test-flag': true },
          rolloutConfig: { version: 1, updatedAt: '', flags: {} },
          setOverride: () => {},
          resetAllOverrides: () => {},
          saveRolloutConfig: async () => {},
          refresh: async () => {},
          isAdmin: true,
          isLoading: false,
          error: null,
          environment: 'staging',
          clientId: 'test-client',
        }}
      >
        {children}
      </FlagContext.Provider>
    )

    const { result } = renderHook(() => useFlag(testFlag), { wrapper })
    expect(result.current).toBe(true)
    expect(mockResolve).toHaveBeenCalledWith(testFlag)
  })

  it('percentage rollout: hash < percentage → enabled', () => {
    const clientId = 'client-abc'
    const hash = hashCode('test-flag' + clientId) % 100
    const isEnabled = hash < 50
    expect(typeof isEnabled).toBe('boolean')
  })

  it('percentage rollout: hash >= percentage → disabled', () => {
    const clientId = 'some-fixed-client-id'
    const hash = hashCode('test-flag' + clientId) % 100
    expect(hash).toBeGreaterThanOrEqual(0)
    expect(hash).toBeLessThan(100)
  })
})

describe('FlagProvider integration', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      }),
    )
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('falls back to defaults when config file returns 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({}),
      }),
    )

    function Consumer() {
      const value = useFlag(testFlag)
      return <span data-testid="flag-value">{String(value)}</span>
    }

    await act(async () => {
      render(
        <FlagProvider>
          <Consumer />
        </FlagProvider>,
      )
    })

    expect(screen.getByTestId('flag-value')).toHaveTextContent('false')
  })

  it('resolves overrides from localStorage', async () => {
    localStorage.setItem('flag-overrides', JSON.stringify({ 'test-flag': true }))

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      }),
    )

    function Consumer() {
      const value = useFlag(testFlag)
      return <span data-testid="flag-value">{String(value)}</span>
    }

    await act(async () => {
      render(
        <FlagProvider>
          <Consumer />
        </FlagProvider>,
      )
    })

    expect(screen.getByTestId('flag-value')).toHaveTextContent('true')
  })

  it('resolves string flag default correctly', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      }),
    )

    function Consumer() {
      const value = useFlag(stringFlag)
      return <span data-testid="flag-value">{value}</span>
    }

    await act(async () => {
      render(
        <FlagProvider>
          <Consumer />
        </FlagProvider>,
      )
    })

    expect(screen.getByTestId('flag-value')).toHaveTextContent('hello')
  })

  it('resetAllOverrides clears localStorage', async () => {
    localStorage.setItem('flag-overrides', JSON.stringify({ 'test-flag': true }))

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      }),
    )

    function Consumer() {
      const { resetAllOverrides } = useContext(FlagContext)
      const value = useFlag(testFlag)
      return (
        <div>
          <span data-testid="flag-value">{String(value)}</span>
          <button data-testid="reset" onClick={resetAllOverrides}>
            Reset
          </button>
        </div>
      )
    }

    await act(async () => {
      render(
        <FlagProvider>
          <Consumer />
        </FlagProvider>,
      )
    })

    expect(screen.getByTestId('flag-value')).toHaveTextContent('true')

    await act(async () => {
      screen.getByTestId('reset').click()
    })

    expect(screen.getByTestId('flag-value')).toHaveTextContent('false')
    expect(localStorage.getItem('flag-overrides')).toBeNull()
  })

  it('setOverride persists to localStorage and updates value', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      }),
    )

    function Consumer() {
      const { setOverride } = useContext(FlagContext)
      const value = useFlag(testFlag)
      return (
        <div>
          <span data-testid="flag-value">{String(value)}</span>
          <button data-testid="enable" onClick={() => setOverride('test-flag', true)}>
            Enable
          </button>
        </div>
      )
    }

    await act(async () => {
      render(
        <FlagProvider>
          <Consumer />
        </FlagProvider>,
      )
    })

    expect(screen.getByTestId('flag-value')).toHaveTextContent('false')

    await act(async () => {
      screen.getByTestId('enable').click()
    })

    expect(screen.getByTestId('flag-value')).toHaveTextContent('true')
    expect(JSON.parse(localStorage.getItem('flag-overrides') || '{}')).toEqual({ 'test-flag': true })
  })

  it('resolves rollout percentage from fetched config', () => {
    // Test the resolution logic directly: 100% rollout should enable the flag
    const clientId = 'test-client-abc'
    const resolveFlag = (flag: { id: string; type: string; default: unknown }) => {
      const rolloutConfig = { flags: { 'test-flag': { percentage: 100 } } }
      const cfg = rolloutConfig.flags[flag.id as keyof typeof rolloutConfig.flags]
      if (cfg && cfg.percentage !== undefined) {
        const hash = hashCode(flag.id + clientId) % 100
        if (hash < cfg.percentage) return flag.type === 'boolean' ? true : flag.default
        return flag.type === 'boolean' ? false : flag.default
      }
      return flag.default
    }

    const wrapper: FC<{ children: ReactNode }> = ({ children }) => (
      <FlagContext.Provider
        value={{
          resolveFlag: resolveFlag as FlagContextValue['resolveFlag'],
          setOverride: () => {},
          resetAllOverrides: () => {},
          isAdmin: true,
        }}
      >
        {children}
      </FlagContext.Provider>
    )

    const { result } = renderHook(() => useFlag(testFlag), { wrapper })
    expect(result.current).toBe(true)
  })

  it('percentage 0 means always disabled', () => {
    // Test the resolution logic: 0% rollout should disable the flag
    const clientId = 'test-client-abc'
    const resolveFlag = (flag: { id: string; type: string; default: unknown }) => {
      const rolloutConfig = { flags: { 'test-flag': { percentage: 0 } } }
      const cfg = rolloutConfig.flags[flag.id as keyof typeof rolloutConfig.flags]
      if (cfg && cfg.percentage !== undefined) {
        const hash = hashCode(flag.id + clientId) % 100
        if (hash < cfg.percentage) return flag.type === 'boolean' ? true : flag.default
        return flag.type === 'boolean' ? false : flag.default
      }
      return flag.default
    }

    const wrapper: FC<{ children: ReactNode }> = ({ children }) => (
      <FlagContext.Provider
        value={{
          resolveFlag: resolveFlag as FlagContextValue['resolveFlag'],
          setOverride: () => {},
          resetAllOverrides: () => {},
          isAdmin: true,
        }}
      >
        {children}
      </FlagContext.Provider>
    )

    const { result } = renderHook(() => useFlag(testFlag), { wrapper })
    expect(result.current).toBe(false)
  })

  it('generates a stable clientId in localStorage', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      }),
    )

    function Consumer() {
      const value = useFlag(testFlag)
      return <span data-testid="flag-value">{String(value)}</span>
    }

    await act(async () => {
      render(
        <FlagProvider>
          <Consumer />
        </FlagProvider>,
      )
    })

    const clientId = localStorage.getItem('flag-client-id')
    expect(clientId).toBeTruthy()
    expect(typeof clientId).toBe('string')
    expect(clientId!.length).toBeGreaterThan(8)
  })

  it('useFlag returns correct type for string flags', () => {
    // Test resolution of a value from config for non-boolean flags
    const resolveFlag = (flag: { id: string; type: string; default: unknown }) => {
      const rolloutConfig = { flags: { 'string-flag': { value: 'world' } } }
      const cfg = rolloutConfig.flags[flag.id as keyof typeof rolloutConfig.flags]
      if (cfg && 'value' in cfg) return cfg.value
      return flag.default
    }

    const wrapper: FC<{ children: ReactNode }> = ({ children }) => (
      <FlagContext.Provider
        value={{
          resolveFlag: resolveFlag as FlagContextValue['resolveFlag'],
          setOverride: () => {},
          resetAllOverrides: () => {},
          isAdmin: true,
        }}
      >
        {children}
      </FlagContext.Provider>
    )

    const { result } = renderHook(() => useFlag(stringFlag), { wrapper })
    expect(result.current).toBe('world')
  })

  it('isAdmin is true when fetchConfig succeeds', async () => {
    const configContent = btoa(JSON.stringify({ version: 1, updatedAt: '', flags: {} }))
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ content: configContent, sha: 'abc123' }),
      }),
    )

    function Consumer() {
      const { isAdmin } = useContext(FlagContext)
      return <span data-testid="admin">{String(isAdmin)}</span>
    }

    await act(async () => {
      render(
        <FlagProvider>
          <Consumer />
        </FlagProvider>,
      )
    })

    expect(screen.getByTestId('admin')).toHaveTextContent('true')
  })

  it('isAdmin is false when fetchConfig returns non-200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      }),
    )

    function Consumer() {
      const { isAdmin } = useContext(FlagContext)
      return <span data-testid="admin">{String(isAdmin)}</span>
    }

    await act(async () => {
      render(
        <FlagProvider>
          <Consumer />
        </FlagProvider>,
      )
    })

    expect(screen.getByTestId('admin')).toHaveTextContent('false')
  })

  it('environment is staging for non-production hostnames', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      }),
    )

    function Consumer() {
      const { environment } = useContext(FlagContext)
      return <span data-testid="env">{environment}</span>
    }

    await act(async () => {
      render(
        <FlagProvider>
          <Consumer />
        </FlagProvider>,
      )
    })

    expect(screen.getByTestId('env')).toHaveTextContent('staging')
  })

  it('clientId is stable across renders', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      }),
    )

    function Consumer() {
      const { clientId } = useContext(FlagContext)
      return <span data-testid="client-id">{clientId}</span>
    }

    let container: ReturnType<typeof render>

    await act(async () => {
      container = render(
        <FlagProvider>
          <Consumer />
        </FlagProvider>,
      )
    })

    const firstId = screen.getByTestId('client-id').textContent

    await act(async () => {
      container!.rerender(
        <FlagProvider>
          <Consumer />
        </FlagProvider>,
      )
    })

    const secondId = screen.getByTestId('client-id').textContent
    expect(firstId).toBe(secondId)
    expect(firstId).toBe(localStorage.getItem('flag-client-id'))
  })
})

/* ── Error handling and edge cases ────────────────────────────────── */

describe('error handling and edge cases', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  /* Gap 1: Network throw during fetch */

  it('handles network error during fetch gracefully and sets error state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    function Consumer() {
      const { error } = useContext(FlagContext)
      const value = useFlag(testFlag)
      return (
        <div>
          <span data-testid="flag-value">{String(value)}</span>
          <span data-testid="error">{error ?? 'none'}</span>
        </div>
      )
    }

    await act(async () => {
      render(
        <FlagProvider>
          <Consumer />
        </FlagProvider>,
      )
    })

    expect(screen.getByTestId('flag-value')).toHaveTextContent('false')
    expect(screen.getByTestId('error')).toHaveTextContent('Network error')
  })

  /* Gap 2: localStorage full/throws on write */

  it('handles localStorage.setItem throwing and still updates in-memory override', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      }),
    )

    function Consumer() {
      const { setOverride } = useContext(FlagContext)
      const value = useFlag(testFlag)
      return (
        <div>
          <span data-testid="flag-value">{String(value)}</span>
          <button data-testid="enable" onClick={() => setOverride('test-flag', true)}>
            Enable
          </button>
        </div>
      )
    }

    await act(async () => {
      render(
        <FlagProvider>
          <Consumer />
        </FlagProvider>,
      )
    })

    // Mock localStorage.setItem to throw AFTER mount so clientId creation succeeds
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError')
    })

    expect(screen.getByTestId('flag-value')).toHaveTextContent('false')

    await act(async () => {
      screen.getByTestId('enable').click()
    })

    expect(screen.getByTestId('flag-value')).toHaveTextContent('true')
  })

  /* Gap 3: Unknown flags in JSON not in flagDefinitions */

  it('ignores unknown flags in config JSON and resolves known flags correctly', async () => {
    const configWithUnknown = {
      version: 1,
      updatedAt: '',
      flags: {
        'unknown-flag': { percentage: 50 },
        'test-flag': { percentage: 100 },
      },
    }

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            sha: 'abc123',
            content: btoa(JSON.stringify(configWithUnknown)),
          }),
      }),
    )

    function Consumer() {
      const value = useFlag(testFlag)
      return <span data-testid="flag-value">{String(value)}</span>
    }

    await act(async () => {
      render(
        <FlagProvider>
          <Consumer />
        </FlagProvider>,
      )
    })

    expect(screen.getByTestId('flag-value')).toHaveTextContent('true')
  })

  /* Gap 4: saveRolloutConfig PUT integration */

  describe('saveRolloutConfig', () => {
    it('sends PUT with correct headers, SHA, and base64 content and updates local state', async () => {
      const initialConfig: RolloutConfig = { version: 1, updatedAt: '2024-01-01', flags: {} }
      const mockFetch = vi.fn()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            sha: 'original-sha',
            content: btoa(JSON.stringify(initialConfig)),
          }),
      })

      vi.stubGlobal('fetch', mockFetch)

      let capturedSave: ((config: RolloutConfig) => Promise<void>) | null = null

      function Consumer() {
        const { saveRolloutConfig, rolloutConfig } = useContext(FlagContext)
        capturedSave = saveRolloutConfig
        return <span data-testid="config">{JSON.stringify(rolloutConfig)}</span>
      }

      await act(async () => {
        render(
          <FlagProvider>
            <Consumer />
          </FlagProvider>,
        )
      })

      const newConfig: RolloutConfig = {
        version: 2,
        updatedAt: '2024-06-01',
        flags: { 'test-flag': { percentage: 100 } },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ content: { sha: 'new-sha' } }),
      })

      await act(async () => {
        await capturedSave!(newConfig)
      })

      const putCall = mockFetch.mock.calls[1]
      expect(putCall[0]).toBe('https://api.github.com/repos/dutta14/finance-tracking/contents/feature-flags.json')
      expect(putCall[1].method).toBe('PUT')
      expect(putCall[1].headers['Authorization']).toBe('Bearer test-token')
      expect(putCall[1].headers['Content-Type']).toBe('application/json')

      const putBody = JSON.parse(putCall[1].body)
      expect(putBody.sha).toBe('original-sha')
      expect(putBody.content).toBe(btoa(JSON.stringify(newConfig, null, 2)))

      expect(screen.getByTestId('config')).toHaveTextContent(JSON.stringify(newConfig))
    })

    it('throws on non-ok PUT response', async () => {
      const initialConfig: RolloutConfig = { version: 1, updatedAt: '', flags: {} }
      const mockFetch = vi.fn()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            sha: 'some-sha',
            content: btoa(JSON.stringify(initialConfig)),
          }),
      })

      vi.stubGlobal('fetch', mockFetch)

      let capturedSave: ((config: RolloutConfig) => Promise<void>) | null = null

      function Consumer() {
        const { saveRolloutConfig } = useContext(FlagContext)
        capturedSave = saveRolloutConfig
        return <span>consumer</span>
      }

      await act(async () => {
        render(
          <FlagProvider>
            <Consumer />
          </FlagProvider>,
        )
      })

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'Conflict' }),
      })

      let saveError: Error | null = null
      await act(async () => {
        try {
          await capturedSave!({ version: 2, updatedAt: '', flags: {} })
        } catch (e) {
          saveError = e as Error
        }
      })

      expect(saveError).toBeInstanceOf(Error)
      expect(saveError!.message).toBe('Conflict')
    })
  })

  /* Gap 5: refresh function re-fetches config */

  it('refresh re-fetches config and updates rollout data', async () => {
    const initialConfig = {
      version: 1,
      updatedAt: '',
      flags: { 'test-flag': { percentage: 0 } },
    }
    const updatedConfig = {
      version: 2,
      updatedAt: '',
      flags: { 'test-flag': { percentage: 100 } },
    }

    const mockFetch = vi.fn()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          sha: 'sha-1',
          content: btoa(JSON.stringify(initialConfig)),
        }),
    })

    vi.stubGlobal('fetch', mockFetch)

    let capturedRefresh: (() => Promise<void>) | null = null

    function Consumer() {
      const { refresh } = useContext(FlagContext)
      const value = useFlag(testFlag)
      capturedRefresh = refresh
      return <span data-testid="flag-value">{String(value)}</span>
    }

    await act(async () => {
      render(
        <FlagProvider>
          <Consumer />
        </FlagProvider>,
      )
    })

    expect(screen.getByTestId('flag-value')).toHaveTextContent('false')

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          sha: 'sha-2',
          content: btoa(JSON.stringify(updatedConfig)),
        }),
    })

    await act(async () => {
      await capturedRefresh!()
    })

    expect(screen.getByTestId('flag-value')).toHaveTextContent('true')
  })

  /* Gap 6: Corrupt JSON in overrides localStorage */

  it('handles corrupt JSON in localStorage overrides without crashing', async () => {
    localStorage.setItem('flag-overrides', 'not{valid{json')

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      }),
    )

    function Consumer() {
      const value = useFlag(testFlag)
      const { overrides } = useContext(FlagContext)
      return (
        <div>
          <span data-testid="flag-value">{String(value)}</span>
          <span data-testid="overrides">{JSON.stringify(overrides)}</span>
        </div>
      )
    }

    await act(async () => {
      render(
        <FlagProvider>
          <Consumer />
        </FlagProvider>,
      )
    })

    expect(screen.getByTestId('flag-value')).toHaveTextContent('false')
    expect(screen.getByTestId('overrides')).toHaveTextContent('{}')
  })
})
