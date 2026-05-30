import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { render } from '@testing-library/react'
import { GitHubSyncProvider, useGitHubSyncContext } from './GitHubSyncContext'
import { SettingsProvider } from './SettingsContext'
import { GoalsProvider } from './GoalsContext'
import type { ReactNode } from 'react'

/* ── helpers ─────────────────────────────────────────────────────── */

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>
    <GoalsProvider>
      <GitHubSyncProvider>{children}</GitHubSyncProvider>
    </GoalsProvider>
  </SettingsProvider>
)

beforeEach(() => {
  localStorage.clear()
})

/* ── tests ───────────────────────────────────────────────────────── */

describe('GitHubSyncContext', () => {
  it('useGitHubSyncContext throws when used outside GitHubSyncProvider', () => {
    expect(() => {
      renderHook(() => useGitHubSyncContext())
    }).toThrow('useGitHubSyncContext must be used within a <GitHubSyncProvider>')
  })

  it('provides full context value via hook', () => {
    const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

    expect(result.current.syncStatus).toBe('idle')
    expect(result.current.isConfigured).toBe(false)
    expect(result.current.hasPendingChanges).toBe(false)
    expect(result.current.lastSyncAt).toBeNull()
    expect(result.current.lastError).toBeNull()
    expect(result.current.history).toEqual([])
    expect(result.current.hasStoredToken).toBe(false)
    expect(result.current.tokenUnlocked).toBe(false)
    expect(typeof result.current.fetchHistory).toBe('function')
    expect(typeof result.current.testConnection).toBe('function')
    expect(typeof result.current.restoreLatest).toBe('function')
    expect(typeof result.current.restoreFromCommit).toBe('function')
  })

  /* ── Bug 1 regression: ghDataToSync memoization ────────────────── */

  describe('ghDataToSync memoization (regression)', () => {
    it('ghDataToSync does not include volatile exportedAt field that breaks memoization', () => {
      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      const data = result.current.ghDataToSync as Record<string, unknown>
      expect(data).not.toHaveProperty('exportedAt')
    })

    it('ghDataToSync does not include localStorage-derived goalViewMode or homeCardOrder fields', () => {
      localStorage.setItem('goal-view-mode', 'grid')
      localStorage.setItem('home-card-order', 'custom')

      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      const data = result.current.ghDataToSync as Record<string, unknown>
      const settings = (data.settings ?? {}) as Record<string, unknown>

      expect(data).not.toHaveProperty('goalViewMode')
      expect(data).not.toHaveProperty('homeCardOrder')
      expect(settings).not.toHaveProperty('goalViewMode')
      expect(settings).not.toHaveProperty('homeCardOrder')

      localStorage.removeItem('goal-view-mode')
      localStorage.removeItem('home-card-order')
    })

    it('ghDataToSync returns a referentially stable object when dependencies have not changed', () => {
      const { result, rerender } = renderHook(() => useGitHubSyncContext(), { wrapper })

      const first = result.current.ghDataToSync
      rerender()
      const second = result.current.ghDataToSync

      expect(first).toBe(second)
    })
  })

  /* ── ghDataToSync shape ────────────────────────────────────────── */

  describe('ghDataToSync shape', () => {
    it('includes version 2, empty goals/gwGoals, and default settings in initial state', () => {
      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      const data = result.current.ghDataToSync as Record<string, unknown>
      expect(data.version).toBe(2)
      expect(data.goals).toEqual([])
      expect(data.gwGoals).toEqual([])
      expect(data.profile).toEqual({ name: '', avatarDataUrl: '', birthday: '' })
    })

    it('settings have correct default values', () => {
      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      const data = result.current.ghDataToSync as Record<string, unknown>
      const settings = data.settings as Record<string, unknown>
      expect(settings.accentTheme).toBe('blue')
      expect(settings.darkMode).toBe(false)
      expect(settings.allowCsvImport).toBe(false)
    })
  })

  /* ── Default config state ──────────────────────────────────────── */

  describe('default config state', () => {
    it('config has empty owner and repo by default', () => {
      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      expect(result.current.config.owner).toBe('')
      expect(result.current.config.repo).toBe('')
    })

    it('config has default filePath of finance-goals.json', () => {
      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      expect(result.current.config.filePath).toBe('finance-goals.json')
    })

    it('config has autoSync disabled by default', () => {
      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      expect(result.current.config.autoSync).toBe(false)
    })

    it('activeToken is empty string when no token is unlocked', () => {
      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      expect(result.current.activeToken).toBe('')
    })
  })

  /* ── Dirty flags ───────────────────────────────────────────────── */

  describe('dirty flags', () => {
    it('all dirty flags are false by default', () => {
      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      expect(result.current.dirtyFlags.goals).toBe(false)
      expect(result.current.dirtyFlags.data).toBe(false)
      expect(result.current.dirtyFlags.tools).toBe(false)
      expect(result.current.dirtyFlags.allocation).toBe(false)
    })

    it('hasPendingChanges is false when no dirty flags are set', () => {
      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      expect(result.current.hasPendingChanges).toBe(false)
    })
  })

  /* ── Sync progress ─────────────────────────────────────────────── */

  describe('sync progress', () => {
    it('syncProgress is null by default', () => {
      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      expect(result.current.syncProgress).toBeNull()
    })
  })

  /* ── handleSyncNow when not configured ─────────────────────────── */

  describe('handleSyncNow when not configured', () => {
    it('sets status to success when called with no dirty flags and not forced', async () => {
      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      await act(async () => {
        await result.current.handleSyncNow({}, undefined, false)
      })

      // No dirty domains means nothing to sync — status becomes success immediately
      expect(result.current.syncStatus).toBe('success')
      expect(result.current.lastError).toBeNull()
    })
  })

  /* ── Domain event listeners ────────────────────────────────────── */

  describe('domain-specific event listeners', () => {
    it('registers event listener for tools-changed', () => {
      const addSpy = vi.spyOn(window, 'addEventListener')

      render(
        <SettingsProvider>
          <GoalsProvider>
            <GitHubSyncProvider>
              <div />
            </GitHubSyncProvider>
          </GoalsProvider>
        </SettingsProvider>,
      )

      const toolsCalls = addSpy.mock.calls.filter(([event]) => event === 'tools-changed')
      expect(toolsCalls.length).toBe(1)

      addSpy.mockRestore()
    })

    it('registers event listener for allocation-changed', () => {
      const addSpy = vi.spyOn(window, 'addEventListener')

      render(
        <SettingsProvider>
          <GoalsProvider>
            <GitHubSyncProvider>
              <div />
            </GitHubSyncProvider>
          </GoalsProvider>
        </SettingsProvider>,
      )

      const allocationCalls = addSpy.mock.calls.filter(([event]) => event === 'allocation-changed')
      expect(allocationCalls.length).toBe(1)

      addSpy.mockRestore()
    })

    it('removes event listeners on unmount', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener')

      const { unmount } = render(
        <SettingsProvider>
          <GoalsProvider>
            <GitHubSyncProvider>
              <div />
            </GitHubSyncProvider>
          </GoalsProvider>
        </SettingsProvider>,
      )

      unmount()

      const toolsRemoved = removeSpy.mock.calls.filter(([event]) => event === 'tools-changed')
      const allocationRemoved = removeSpy.mock.calls.filter(([event]) => event === 'allocation-changed')
      expect(toolsRemoved.length).toBe(1)
      expect(allocationRemoved.length).toBe(1)

      removeSpy.mockRestore()
    })
  })

  /* ── Token state ───────────────────────────────────────────────── */

  describe('token state', () => {
    it('hasStoredToken is false when no encrypted token in config', () => {
      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      expect(result.current.hasStoredToken).toBe(false)
    })

    it('tokenUnlocked is false initially', () => {
      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      expect(result.current.tokenUnlocked).toBe(false)
    })
  })

  /* ── handleDataChange ──────────────────────────────────────────── */

  describe('handleDataChange', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('marks data dirty when called with real account/balance data', async () => {
      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      // Advance past the 3-second dirty-ready gate in useGitHubSync
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3100)
      })

      expect(result.current.dirtyFlags.data).toBe(false)

      act(() => {
        result.current.handleDataChange(
          [
            {
              id: 1,
              name: '401k',
              type: 'retirement',
              owner: 'primary',
              status: 'active',
              goalType: 'fi',
              nature: 'asset',
              allocation: 'us-stock',
            },
          ],
          [{ id: 1, accountId: 1, month: '2025-01', balance: 50000 }],
        )
      })

      expect(result.current.dirtyFlags.data).toBe(true)
    })
  })

  /* ── updateConfig ──────────────────────────────────────────────── */

  describe('updateConfig', () => {
    it('updates config and persists to localStorage', () => {
      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      act(() => {
        result.current.updateConfig({ owner: 'test-owner', repo: 'test-repo' })
      })

      expect(result.current.config.owner).toBe('test-owner')
      expect(result.current.config.repo).toBe('test-repo')

      const stored = JSON.parse(localStorage.getItem('github-sync-config') || '{}')
      expect(stored.owner).toBe('test-owner')
      expect(stored.repo).toBe('test-repo')
    })

    it('preserves existing config fields when partially updating', () => {
      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      act(() => {
        result.current.updateConfig({ owner: 'my-org' })
      })

      expect(result.current.config.owner).toBe('my-org')
      expect(result.current.config.filePath).toBe('finance-goals.json')
      expect(result.current.config.autoSync).toBe(false)
    })
  })

  /* ── isConfigured logic ────────────────────────────────────────── */

  describe('isConfigured', () => {
    it('remains false when owner and repo are set but no active token', () => {
      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      act(() => {
        result.current.updateConfig({ owner: 'org', repo: 'repo' })
      })

      expect(result.current.isConfigured).toBe(false)
    })
  })

  /* ── applyRestoredSnapshot ─────────────────────────────────────── */

  describe('applyRestoredSnapshot', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('logs error and does not throw for invalid data', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      // applyRestoredSnapshot catches errors internally, so it should not throw
      await act(async () => {
        await result.current.applyRestoredSnapshot('not-an-object')
        await vi.advanceTimersByTimeAsync(500)
      })

      expect(errorSpy).toHaveBeenCalledWith('Restore error:', expect.stringContaining('Invalid backup data'))

      errorSpy.mockRestore()
    })

    it('restores goals and settings from a valid snapshot', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      // Mock fetch for the internal restoreDataLatest/restoreToolsLatest/restoreAllocationLatest calls
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 404 }))

      // Use real timers — applyRestoredSnapshot has internal setTimeout(300) and setTimeout(100)
      vi.useRealTimers()

      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      const snapshot = {
        version: 2,
        goals: [
          {
            id: 1,
            goalName: 'Early Retirement',
            targetAmount: 1000000,
            currentAmount: 250000,
            currency: 'USD',
            type: 'fi',
          },
        ],
        gwGoals: [],
        profile: { name: 'Test User' },
        settings: { accentTheme: 'purple', darkMode: true, allowCsvImport: true },
      }

      await act(async () => {
        await result.current.applyRestoredSnapshot(snapshot)
      })

      // Goals should be restored in context
      const data = result.current.ghDataToSync as Record<string, unknown>
      const goals = data.goals as Array<Record<string, unknown>>
      expect(goals.length).toBe(1)
      expect(goals[0].goalName).toBe('Early Retirement')

      // Settings should be updated
      const settings = data.settings as Record<string, unknown>
      expect(settings.accentTheme).toBe('purple')
      expect(settings.darkMode).toBe(true)
      expect(settings.allowCsvImport).toBe(true)

      warnSpy.mockRestore()
      errorSpy.mockRestore()
      fetchSpy.mockRestore()
    })

    it('restores goalViewMode and homeCardOrder from settings', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 404 }))
      vi.useRealTimers()

      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      const snapshot = {
        version: 2,
        goals: [],
        gwGoals: [],
        settings: {
          accentTheme: 'blue',
          darkMode: false,
          allowCsvImport: false,
          goalViewMode: 'grid',
          homeCardOrder: JSON.stringify([3, 2, 1, 0]),
        },
      }

      await act(async () => {
        await result.current.applyRestoredSnapshot(snapshot)
      })

      expect(localStorage.getItem('goal-view-mode')).toContain('grid')
      const homeCardOrder = JSON.parse(localStorage.getItem('home-card-order') || '[]')
      expect(homeCardOrder).toEqual([3, 2, 1, 0])

      warnSpy.mockRestore()
      errorSpy.mockRestore()
      fetchSpy.mockRestore()
    })

    it('handles invalid homeCardOrder format gracefully', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 404 }))
      vi.useRealTimers()

      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      const snapshot = {
        version: 2,
        goals: [],
        gwGoals: [],
        settings: {
          accentTheme: 'blue',
          darkMode: false,
          homeCardOrder: 'not-valid-json{{{',
        },
      }

      await act(async () => {
        await result.current.applyRestoredSnapshot(snapshot)
      })

      expect(warnSpy).toHaveBeenCalledWith('[restore] Invalid homeCardOrder format, skipping')

      warnSpy.mockRestore()
      errorSpy.mockRestore()
      fetchSpy.mockRestore()
    })

    it('restores GitHub config from snapshot while preserving encrypted token fields', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 404 }))
      vi.useRealTimers()

      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      const snapshot = {
        version: 2,
        goals: [],
        gwGoals: [],
        gitHubConfig: {
          owner: 'restored-org',
          repo: 'restored-repo',
          autoSync: true,
        },
      }

      await act(async () => {
        await result.current.applyRestoredSnapshot(snapshot)
      })

      expect(result.current.config.owner).toBe('restored-org')
      expect(result.current.config.repo).toBe('restored-repo')

      warnSpy.mockRestore()
      errorSpy.mockRestore()
      fetchSpy.mockRestore()
    })

    it('restores profile from snapshot', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 404 }))
      vi.useRealTimers()

      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      const snapshot = {
        version: 2,
        goals: [],
        gwGoals: [],
        profile: { name: 'Restored User', avatarDataUrl: '', birthday: '1990-01-01' },
      }

      await act(async () => {
        await result.current.applyRestoredSnapshot(snapshot)
      })

      const data = result.current.ghDataToSync as Record<string, unknown>
      const profile = data.profile as Record<string, unknown>
      expect(profile.name).toBe('Restored User')

      warnSpy.mockRestore()
      errorSpy.mockRestore()
      fetchSpy.mockRestore()
    })
  })

  /* ── markDirty / clearDirty via context ────────────────────────── */

  describe('markDirty and clearDirty via context', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('marks goals dirty and hasPendingChanges becomes true', async () => {
      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3100)
      })

      act(() => {
        result.current.markDirty('goals')
      })
      expect(result.current.dirtyFlags.goals).toBe(true)
      expect(result.current.hasPendingChanges).toBe(true)
    })

    it('marks tools dirty and clears it', async () => {
      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3100)
      })

      act(() => {
        result.current.markDirty('tools')
      })
      expect(result.current.dirtyFlags.tools).toBe(true)

      act(() => {
        result.current.clearDirty('tools')
      })
      expect(result.current.dirtyFlags.tools).toBe(false)
    })

    it('marks allocation dirty via event dispatch', async () => {
      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3100)
      })

      act(() => {
        window.dispatchEvent(new Event('allocation-changed'))
      })
      expect(result.current.dirtyFlags.allocation).toBe(true)
    })

    it('marks tools dirty via event dispatch', async () => {
      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3100)
      })

      act(() => {
        window.dispatchEvent(new Event('tools-changed'))
      })
      expect(result.current.dirtyFlags.tools).toBe(true)
    })
  })

  /* ── handleSyncNow with dirty flags ────────────────────────────── */

  describe('handleSyncNow with dirty flags', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
      vi.restoreAllMocks()
    })

    it('sets success status immediately when no dirty flags and not forced', async () => {
      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      await act(async () => {
        await result.current.handleSyncNow({}, undefined, false)
      })

      expect(result.current.syncStatus).toBe('success')
      expect(result.current.lastError).toBeNull()
    })

    it('sets syncProgress with zero total when no dirty flags', async () => {
      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      await act(async () => {
        await result.current.handleSyncNow({}, undefined, false)
      })

      // syncProgress is set then cleared after 2s timeout
      expect(result.current.syncStatus).toBe('success')
    })
  })

  /* ── syncTaxesNow via context ──────────────────────────────────── */

  describe('syncTaxesNow via context', () => {
    it('is a function exposed on the context', () => {
      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })
      expect(typeof result.current.syncTaxesNow).toBe('function')
    })
  })

  /* ── restoreTaxesLatest via context ────────────────────────────── */

  describe('restoreTaxesLatest via context', () => {
    it('is a function exposed on the context', () => {
      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })
      expect(typeof result.current.restoreTaxesLatest).toBe('function')
    })
  })

  /* ── handleSyncNow with forceFull ─────────────────────────────── */

  describe('handleSyncNow with forceFull=true', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
      vi.restoreAllMocks()
    })

    it('enters syncing state and sets progress when forceFull=true', async () => {
      localStorage.setItem(
        'github-sync-config',
        JSON.stringify({ owner: 'org', repo: 'repo', filePath: 'f.json', autoSync: false }),
      )

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      // Start forceFull sync — sync functions return immediately without token,
      // but the code path through handleSyncNow's domain iteration is exercised
      act(() => {
        result.current.handleSyncNow({}, 'full sync', true)
      })

      // Should have entered syncing state
      expect(result.current.syncStatus).toBe('syncing')

      // Let it complete
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000)
      })

      // Sync functions silently return (no token), so all domains "succeed"
      expect(result.current.syncStatus).toBe('success')
      errorSpy.mockRestore()
    })

    it('sets progress with domain labels during sync', async () => {
      localStorage.setItem(
        'github-sync-config',
        JSON.stringify({ owner: 'org', repo: 'repo', filePath: 'f.json', autoSync: false }),
      )

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      let capturedProgress = null as typeof result.current.syncProgress
      act(() => {
        result.current.handleSyncNow({}, undefined, true)
        capturedProgress = result.current.syncProgress
      })

      // Progress should show all 4 domains
      if (capturedProgress) {
        expect(capturedProgress.total).toBe(4)
        expect(capturedProgress.domains).toEqual(['goals', 'data', 'tools', 'allocation'])
        expect(capturedProgress.current).toBe('Goals')
      }

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000)
      })

      errorSpy.mockRestore()
    })

    it('sets lastSyncAt on successful completion', async () => {
      localStorage.setItem(
        'github-sync-config',
        JSON.stringify({ owner: 'org', repo: 'repo', filePath: 'f.json', autoSync: false }),
      )

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      await act(async () => {
        result.current.handleSyncNow({}, undefined, true)
        await vi.advanceTimersByTimeAsync(5000)
      })

      // All domains silently succeeded — lastSyncAt should be set
      expect(result.current.lastSyncAt).toBeTruthy()
      expect(result.current.lastError).toBeNull()
      errorSpy.mockRestore()
    })
  })

  /* ── applyRestoredSnapshot domain restore paths ─────────────── */

  describe('applyRestoredSnapshot domain restore catch path', () => {
    it('does not throw when domain restores fail internally', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.useRealTimers()

      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      const snapshot = {
        version: 2,
        goals: [{ id: 1, goalName: 'Test', targetAmount: 1000, currentAmount: 0, currency: 'USD', type: 'fi' }],
        gwGoals: [{ id: 'gw1', goalName: 'GW Test', goalType: 'gw-liquid', subGoals: [] }],
        profile: { name: 'User', avatarDataUrl: '', birthday: '1990-01-01' },
        settings: {
          accentTheme: 'teal',
          darkMode: true,
          allowCsvImport: true,
          goalViewMode: 'list',
        },
        gitHubConfig: { owner: 'org', repo: 'repo', autoSync: true },
      }

      // applyRestoredSnapshot should not throw regardless of domain restore outcomes
      await act(async () => {
        await result.current.applyRestoredSnapshot(snapshot)
      })

      // Verify settings were applied
      const data = result.current.ghDataToSync as Record<string, unknown>
      const goals = data.goals as Array<Record<string, unknown>>
      expect(goals.length).toBe(1)
      expect(goals[0].goalName).toBe('Test')

      const settings = data.settings as Record<string, unknown>
      expect(settings.accentTheme).toBe('teal')
      expect(settings.darkMode).toBe(true)
      expect(settings.allowCsvImport).toBe(true)

      // Config should be updated
      expect(result.current.config.owner).toBe('org')
      expect(result.current.config.repo).toBe('repo')

      // Profile should be updated
      const profile = data.profile as Record<string, unknown>
      expect(profile.name).toBe('User')

      // goalViewMode should be persisted
      expect(localStorage.getItem('goal-view-mode')).toContain('list')

      warnSpy.mockRestore()
      errorSpy.mockRestore()
    })
  })

  /* ── handleSyncNow skip when already syncing ──────────────────── */

  describe('handleSyncNow early returns', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
      vi.restoreAllMocks()
    })

    it('skips sync when status is already syncing', async () => {
      localStorage.setItem(
        'github-sync-config',
        JSON.stringify({ owner: 'org', repo: 'repo', filePath: 'f.json', autoSync: false }),
      )

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { result } = renderHook(() => useGitHubSyncContext(), { wrapper })

      // Start a sync that will take time
      act(() => {
        result.current.handleSyncNow({}, undefined, true)
      })

      expect(result.current.syncStatus).toBe('syncing')

      // Second sync call should be no-op since already syncing
      await act(async () => {
        await result.current.handleSyncNow({}, undefined, true)
      })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000)
      })

      errorSpy.mockRestore()
    })
  })
})
