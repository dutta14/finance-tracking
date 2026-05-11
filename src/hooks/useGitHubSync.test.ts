import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { setStorageItem } from '../utils/storage'
import { loadConfig, toBase64, fromBase64, useGitHubSync } from './useGitHubSync'
import type { GitHubSyncConfig } from './useGitHubSync'

describe('toBase64 / fromBase64', () => {
  it('round-trips ASCII text', () => {
    const text = 'Date,Category,Amount\n01/15/2025,Groceries,-50.00'
    expect(fromBase64(toBase64(text))).toBe(text)
  })

  it('round-trips UTF-8 text with special characters', () => {
    const text = 'Café,Résumé,naïve,€100'
    expect(fromBase64(toBase64(text))).toBe(text)
  })

  it('handles empty string', () => {
    expect(toBase64('')).toBe('')
    expect(fromBase64(toBase64(''))).toBe('')
  })

  it('handles emoji', () => {
    const text = 'Savings 💰 $1,000'
    expect(fromBase64(toBase64(text))).toBe(text)
  })
})

describe('loadConfig', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns default config when nothing stored', () => {
    const config = loadConfig()
    expect(config.owner).toBe('')
    expect(config.repo).toBe('')
    expect(config.filePath).toBe('finance-goals.json')
    expect(config.autoSync).toBe(false)
  })

  it('loads stored config fields', () => {
    setStorageItem('github-sync-config', {
      owner: 'testuser',
      repo: 'finance-backup',
      filePath: 'finance-goals.json',
      autoSync: true,
    } as GitHubSyncConfig)

    const config = loadConfig()
    expect(config.owner).toBe('testuser')
    expect(config.repo).toBe('finance-backup')
    expect(config.autoSync).toBe(true)
  })

  it('preserves encrypted token fields', () => {
    setStorageItem('github-sync-config', {
      owner: 'user',
      repo: 'repo',
      filePath: 'finance-goals.json',
      autoSync: false,
      encryptedToken: 'abc123encrypted',
      tokenSalt: 'salt123',
      tokenIv: 'iv123',
    } as GitHubSyncConfig)

    const config = loadConfig()
    expect(config.encryptedToken).toBe('abc123encrypted')
    expect(config.tokenSalt).toBe('salt123')
    expect(config.tokenIv).toBe('iv123')
  })

  it('strips legacyToken from storage on load', () => {
    const raw = {
      owner: 'user',
      repo: 'repo',
      filePath: 'finance-goals.json',
      autoSync: false,
      legacyToken: 'ghp_plaintext123',
    }
    localStorage.setItem('github-sync-config', JSON.stringify(raw))

    const config = loadConfig()
    expect(config).not.toHaveProperty('legacyToken')
    expect(config.owner).toBe('user')

    // Verify legacyToken was stripped from localStorage too
    const persisted = JSON.parse(localStorage.getItem('github-sync-config')!)
    expect(persisted).not.toHaveProperty('legacyToken')
  })

  it('strips legacyToken while preserving encrypted fields', () => {
    const raw = {
      owner: 'user',
      repo: 'repo',
      filePath: 'finance-goals.json',
      autoSync: false,
      legacyToken: 'ghp_plaintext123',
      encryptedToken: 'abc123encrypted',
      tokenSalt: 'salt123',
      tokenIv: 'iv123',
    }
    localStorage.setItem('github-sync-config', JSON.stringify(raw))

    const config = loadConfig()
    expect(config).not.toHaveProperty('legacyToken')
    expect(config.encryptedToken).toBe('abc123encrypted')
  })

  it('is a no-op when no legacyToken exists', () => {
    const original = {
      owner: 'user',
      repo: 'repo',
      filePath: 'finance-goals.json',
      autoSync: true,
    }
    localStorage.setItem('github-sync-config', JSON.stringify(original))
    const beforeLoad = localStorage.getItem('github-sync-config')

    loadConfig()

    // Config should not be re-written when there's no legacyToken to strip
    const afterLoad = localStorage.getItem('github-sync-config')
    expect(afterLoad).toBe(beforeLoad)
  })

  it('always uses canonical filePath regardless of stored value', () => {
    setStorageItem('github-sync-config', {
      owner: 'user',
      repo: 'repo',
      filePath: 'custom-old-path.json',
      autoSync: false,
    } as GitHubSyncConfig)

    const config = loadConfig()
    expect(config.filePath).toBe('finance-goals.json')
  })

  it('returns default config when stored value is corrupt JSON', () => {
    localStorage.setItem('github-sync-config', '{invalid json')
    const config = loadConfig()
    expect(config.owner).toBe('')
    expect(config.filePath).toBe('finance-goals.json')
  })

  it('activeToken is empty when no encrypted token or session token', () => {
    const config = loadConfig()
    expect(config.encryptedToken).toBeUndefined()
  })
})

/* ── Helper: make a configured hook ──────────────────────────── */

const setupConfigured = () => {
  setStorageItem('github-sync-config', {
    owner: 'test-owner',
    repo: 'test-repo',
    filePath: 'finance-goals.json',
    autoSync: false,
  } as GitHubSyncConfig)
}

const mockFetchOk = (body: object = {}, headers: Record<string, string> = {}) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    headers: new Headers(headers),
  } as Response)

/* ── useGitHubSync hook ──────────────────────────────────────── */

describe('useGitHubSync hook', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /* ── Initial state ─────────────────────────────────────────── */

  it('returns idle syncStatus and empty activeToken by default', () => {
    const { result } = renderHook(() => useGitHubSync())
    expect(result.current.syncStatus).toBe('idle')
    expect(result.current.activeToken).toBe('')
    expect(result.current.isConfigured).toBe(false)
    expect(result.current.hasPendingChanges).toBe(false)
    expect(result.current.history).toEqual([])
  })

  /* ── saveEncryptedToken ────────────────────────────────────── */

  describe('saveEncryptedToken', () => {
    it('rejects empty token', async () => {
      const { result } = renderHook(() => useGitHubSync())
      let res: { ok: boolean; message: string } = { ok: true, message: '' }
      await act(async () => {
        res = await result.current.saveEncryptedToken('', 'mypassphrase')
      })
      expect(res.ok).toBe(false)
      expect(res.message).toContain('Token is required')
    })

    it('rejects passphrase shorter than 8 characters', async () => {
      const { result } = renderHook(() => useGitHubSync())
      let res: { ok: boolean; message: string } = { ok: true, message: '' }
      await act(async () => {
        res = await result.current.saveEncryptedToken('ghp_abc123', 'short')
      })
      expect(res.ok).toBe(false)
      expect(res.message).toContain('at least 8 characters')
    })

    it('encrypts and stores token on success', async () => {
      const { result } = renderHook(() => useGitHubSync())
      let res: { ok: boolean; message: string } = { ok: false, message: '' }
      await act(async () => {
        res = await result.current.saveEncryptedToken('ghp_testtoken123', 'mypassphrase123')
      })
      expect(res.ok).toBe(true)
      expect(res.message).toContain('encrypted and saved')
      expect(result.current.hasStoredToken).toBe(true)
      expect(result.current.tokenUnlocked).toBe(true)
      expect(result.current.activeToken).toBe('ghp_testtoken123')
    })
  })

  /* ── unlockToken ───────────────────────────────────────────── */

  describe('unlockToken', () => {
    it('returns error when no encrypted token is stored', async () => {
      const { result } = renderHook(() => useGitHubSync())
      let res: { ok: boolean; message: string } = { ok: true, message: '' }
      await act(async () => {
        res = await result.current.unlockToken('anypassphrase')
      })
      expect(res.ok).toBe(false)
      expect(res.message).toContain('No encrypted token')
    })

    it('unlocks token with correct passphrase after saving', async () => {
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_secret', 'correctpass1')
      })
      // Lock it
      act(() => {
        result.current.lockToken()
      })
      expect(result.current.tokenUnlocked).toBe(false)
      // Unlock with correct passphrase
      let res: { ok: boolean; message: string } = { ok: false, message: '' }
      await act(async () => {
        res = await result.current.unlockToken('correctpass1')
      })
      expect(res.ok).toBe(true)
      expect(result.current.activeToken).toBe('ghp_secret')
    })

    it('returns error with wrong passphrase', async () => {
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_secret', 'correctpass1')
      })
      act(() => {
        result.current.lockToken()
      })
      let res: { ok: boolean; message: string } = { ok: true, message: '' }
      await act(async () => {
        res = await result.current.unlockToken('wrongpassphrase')
      })
      expect(res.ok).toBe(false)
      expect(res.message).toContain('incorrect')
    })
  })

  /* ── lockToken ─────────────────────────────────────────────── */

  describe('lockToken', () => {
    it('clears session token and sets tokenUnlocked to false', async () => {
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_tok', 'passphrase1')
      })
      expect(result.current.tokenUnlocked).toBe(true)
      act(() => {
        result.current.lockToken()
      })
      expect(result.current.tokenUnlocked).toBe(false)
      expect(result.current.activeToken).toBe('')
    })
  })

  /* ── syncNow ───────────────────────────────────────────────── */

  describe('syncNow', () => {
    it('returns immediately when not configured', async () => {
      const fetchSpy = mockFetchOk()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.syncNow({ goals: [] })
      })
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('uploads data to GitHub on success', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      // Mock: first call is getFileSha (404 = new file), second is PUT
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response)
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response)

      await act(async () => {
        await result.current.syncNow({ goals: [], exportedAt: '2025-01-01' }, 'Test commit')
      })
      expect(result.current.syncStatus).toBe('success')
      expect(result.current.lastSyncAt).not.toBeNull()
      expect(fetchSpy).toHaveBeenCalledTimes(2)
      // Second call should be PUT with the commit message
      const putCall = fetchSpy.mock.calls[1]
      expect(putCall[1]?.method).toBe('PUT')
      const body = JSON.parse(putCall[1]?.body as string)
      expect(body.message).toBe('Test commit')
    })

    it('retries on 409 conflict and succeeds on second attempt', async () => {
      vi.useFakeTimers()
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        // Attempt 1: getFileSha
        .mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response)
        // Attempt 1: PUT returns 409
        .mockResolvedValueOnce({ ok: false, status: 409, json: () => Promise.resolve({}) } as Response)
        // Attempt 2: getFileSha
        .mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response)
        // Attempt 2: PUT succeeds
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response)

      await act(async () => {
        const promise = result.current.syncNow({ goals: [] })
        await vi.advanceTimersByTimeAsync(5000)
        await promise
      })
      expect(result.current.syncStatus).toBe('success')
      expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(3)
      vi.useRealTimers()
    })

    it('sets error status after all retries fail', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      // getFileSha returns null (404) each time, PUT returns 500 each time
      // Status 500 does NOT trigger retry delay (only 409/422 do), so no fake timers needed
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      for (let i = 0; i < 3; i++) {
        fetchSpy
          .mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response)
          .mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ message: 'Server Error' }),
            headers: new Headers(),
          } as Response)
      }

      let threw = false
      await act(async () => {
        try {
          await result.current.syncNow({ goals: [] })
        } catch {
          threw = true
        }
      })
      expect(threw).toBe(true)
      expect(result.current.syncStatus).toBe('error')
      expect(result.current.lastError).toContain('Server Error')
    })

    it('includes sha when file already exists', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        // getFileSha returns existing sha
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ sha: 'abc123' }) } as Response)
        // PUT succeeds
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response)

      await act(async () => {
        await result.current.syncNow({ goals: [] })
      })
      const putBody = JSON.parse(fetchSpy.mock.calls[1][1]?.body as string)
      expect(putBody.sha).toBe('abc123')
    })
  })

  /* ── syncDataNow ───────────────────────────────────────────── */

  describe('syncDataNow', () => {
    it('returns immediately when not configured', async () => {
      const fetchSpy = mockFetchOk()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.syncDataNow({ accounts: [] })
      })
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('uploads data to the -data.json file path', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response)
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response)

      await act(async () => {
        await result.current.syncDataNow({ accounts: [], balances: [] })
      })
      const url = fetchSpy.mock.calls[0][0] as string
      expect(url).toContain('finance-goals-data.json')
    })
  })

  /* ── syncToolsNow ──────────────────────────────────────────── */

  describe('syncToolsNow', () => {
    it('uploads to -tools.json file path', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response)
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response)

      await act(async () => {
        await result.current.syncToolsNow({ fiSimulations: [] })
      })
      const url = fetchSpy.mock.calls[0][0] as string
      expect(url).toContain('finance-goals-tools.json')
    })
  })

  /* ── syncAllocationNow ─────────────────────────────────────── */

  describe('syncAllocationNow', () => {
    it('uploads to -allocation.json file path', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response)
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response)

      await act(async () => {
        await result.current.syncAllocationNow({ allocationCustomRatios: [] })
      })
      const url = fetchSpy.mock.calls[0][0] as string
      expect(url).toContain('finance-goals-allocation.json')
    })
  })

  /* ── syncTaxesNow ──────────────────────────────────────────── */

  describe('syncTaxesNow', () => {
    it('uploads to -taxes.json file path', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response)
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response)

      await act(async () => {
        await result.current.syncTaxesNow({ taxData: {} })
      })
      const url = fetchSpy.mock.calls[0][0] as string
      expect(url).toContain('finance-goals-taxes.json')
    })
  })

  /* ── testConnection ────────────────────────────────────────── */

  describe('testConnection', () => {
    it('returns error when token, owner, or repo are missing', async () => {
      const { result } = renderHook(() => useGitHubSync())
      let res = { ok: true, message: '', warnings: [] as string[] }
      await act(async () => {
        res = await result.current.testConnection()
      })
      expect(res.ok).toBe(false)
      expect(res.message).toContain('Fill in token')
    })

    it('returns success and repo name on 200', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ full_name: 'test-owner/test-repo', private: true, permissions: { push: true } }),
        headers: new Headers({}),
      } as Response)

      let res = { ok: false, message: '', warnings: [] as string[] }
      await act(async () => {
        res = await result.current.testConnection()
      })
      expect(res.ok).toBe(true)
      expect(res.message).toContain('test-owner/test-repo')
    })

    it('returns 404 error for nonexistent repo', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({}),
        headers: new Headers(),
      } as Response)

      let res = { ok: true, message: '', warnings: [] as string[] }
      await act(async () => {
        res = await result.current.testConnection()
      })
      expect(res.ok).toBe(false)
      expect(res.message).toContain('not found')
    })

    it('returns 401 error for invalid token', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({}),
        headers: new Headers(),
      } as Response)

      let res = { ok: true, message: '', warnings: [] as string[] }
      await act(async () => {
        res = await result.current.testConnection()
      })
      expect(res.ok).toBe(false)
      expect(res.message).toContain('Invalid token')
    })

    it('warns when repository is public', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ full_name: 'o/r', private: false, permissions: { push: true } }),
        headers: new Headers({}),
      } as Response)

      let res = { ok: false, message: '', warnings: [] as string[] }
      await act(async () => {
        res = await result.current.testConnection()
      })
      expect(res.ok).toBe(true)
      expect(res.warnings).toContain('This repository is public. Backups may expose sensitive financial data.')
    })

    it('warns when token lacks write access', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ full_name: 'o/r', private: true, permissions: { push: false } }),
        headers: new Headers({}),
      } as Response)

      let res = { ok: false, message: '', warnings: [] as string[] }
      await act(async () => {
        res = await result.current.testConnection()
      })
      expect(res.warnings).toContain('Token does not appear to have write access to this repository.')
    })

    it('warns when token has broad repo scope', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ full_name: 'o/r', private: true, permissions: { push: true } }),
        headers: new Headers({ 'x-oauth-scopes': 'repo, user' }),
      } as Response)

      let res = { ok: false, message: '', warnings: [] as string[] }
      await act(async () => {
        res = await result.current.testConnection()
      })
      expect(res.warnings).toContain(
        'Token has broad repo scope. Prefer a fine-grained token limited to one backup repo.',
      )
    })

    it('returns network error on fetch failure', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network failure'))

      let res = { ok: true, message: '', warnings: [] as string[] }
      await act(async () => {
        res = await result.current.testConnection()
      })
      expect(res.ok).toBe(false)
      expect(res.message).toContain('Network error')
    })
  })

  /* ── restoreLatest ─────────────────────────────────────────── */

  describe('restoreLatest', () => {
    it('returns error when not configured', async () => {
      const { result } = renderHook(() => useGitHubSync())
      let res = { ok: true, message: '' }
      await act(async () => {
        res = await result.current.restoreLatest()
      })
      expect(res.ok).toBe(false)
      expect(res.message).toContain('Connect and unlock')
    })

    it('returns data from GitHub on success', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      const content = toBase64(JSON.stringify({ goals: [{ id: 1 }] }))
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ content, encoding: 'base64' }),
        headers: new Headers(),
      } as Response)

      let res = { ok: false, message: '', data: undefined as unknown }
      await act(async () => {
        res = await result.current.restoreLatest()
      })
      expect(res.ok).toBe(true)
      expect(res.message).toContain('Latest backup restored')
      expect((res.data as { goals: unknown[] }).goals).toEqual([{ id: 1 }])
    })

    it('returns error when file is not found (404)', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({}),
        headers: new Headers(),
      } as Response)

      let res = { ok: true, message: '' }
      await act(async () => {
        res = await result.current.restoreLatest()
      })
      expect(res.ok).toBe(false)
      expect(res.message).toContain('not found')
    })

    it('returns error for unsupported encoding', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ content: null, encoding: 'utf-8' }),
        headers: new Headers(),
      } as Response)

      let res = { ok: true, message: '' }
      await act(async () => {
        res = await result.current.restoreLatest()
      })
      expect(res.ok).toBe(false)
      expect(res.message).toContain('not supported')
    })
  })

  /* ── restoreFromCommit ─────────────────────────────────────── */

  describe('restoreFromCommit', () => {
    it('returns error when not configured', async () => {
      const { result } = renderHook(() => useGitHubSync())
      let res = { ok: true, message: '' }
      await act(async () => {
        res = await result.current.restoreFromCommit('abc1234')
      })
      expect(res.ok).toBe(false)
      expect(res.message).toContain('Connect and unlock')
    })

    it('returns data for a valid commit', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      const content = toBase64(JSON.stringify({ goals: [] }))
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ content, encoding: 'base64' }),
        headers: new Headers(),
      } as Response)

      let res = { ok: false, message: '', data: undefined as unknown }
      await act(async () => {
        res = await result.current.restoreFromCommit('abc1234567890')
      })
      expect(res.ok).toBe(true)
      expect(res.message).toContain('abc1234')
    })

    it('returns error when commit file is not found', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({}),
        headers: new Headers(),
      } as Response)

      let res = { ok: true, message: '' }
      await act(async () => {
        res = await result.current.restoreFromCommit('deadbeef')
      })
      expect(res.ok).toBe(false)
      expect(res.message).toContain('not found')
    })
  })

  /* ── fetchHistory ──────────────────────────────────────────── */

  describe('fetchHistory', () => {
    it('does nothing when not configured', async () => {
      const fetchSpy = mockFetchOk()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.fetchHistory()
      })
      expect(fetchSpy).not.toHaveBeenCalled()
      expect(result.current.history).toEqual([])
    })

    it('populates history from GitHub commits API', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve([
            {
              sha: 'abcdef1234567890',
              commit: { message: 'Auto-save', author: { date: '2025-01-15T10:00:00Z' } },
              html_url: 'https://github.com/o/r/commit/abc',
            },
            {
              sha: '1234567890abcdef',
              commit: { message: 'Manual sync', author: { date: '2025-01-14T10:00:00Z' } },
              html_url: 'https://github.com/o/r/commit/123',
            },
          ]),
        headers: new Headers(),
      } as Response)

      await act(async () => {
        await result.current.fetchHistory()
      })
      expect(result.current.history).toHaveLength(2)
      expect(result.current.history[0].sha).toBe('abcdef1')
      expect(result.current.history[0].message).toBe('Auto-save')
      expect(result.current.history[1].sha).toBe('1234567')
    })
  })

  /* ── restoreDataLatest ─────────────────────────────────────── */

  describe('restoreDataLatest', () => {
    it('returns ok:false when not configured', async () => {
      const { result } = renderHook(() => useGitHubSync())
      let res = { ok: true }
      await act(async () => {
        res = await result.current.restoreDataLatest()
      })
      expect(res.ok).toBe(false)
    })

    it('returns ok:true with null data when file not found (404)', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({}),
        headers: new Headers(),
      } as Response)

      let res = { ok: false, data: undefined as unknown }
      await act(async () => {
        res = await result.current.restoreDataLatest()
      })
      expect(res.ok).toBe(true)
      expect(res.data).toBeNull()
    })
  })

  /* ── restoreToolsLatest ────────────────────────────────────── */

  describe('restoreToolsLatest', () => {
    it('returns ok:false when not configured', async () => {
      const { result } = renderHook(() => useGitHubSync())
      let res = { ok: true }
      await act(async () => {
        res = await result.current.restoreToolsLatest()
      })
      expect(res.ok).toBe(false)
    })

    it('returns parsed data on success', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      const data = { fiSimulations: [{ id: 1 }] }
      const content = btoa(JSON.stringify(data))
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ content }),
        headers: new Headers(),
      } as Response)

      let res = { ok: false, data: undefined as unknown }
      await act(async () => {
        res = await result.current.restoreToolsLatest()
      })
      expect(res.ok).toBe(true)
      expect(res.data).toEqual(data)
    })
  })

  /* ── restoreAllocationLatest ───────────────────────────────── */

  describe('restoreAllocationLatest', () => {
    it('returns ok:false when not configured', async () => {
      const { result } = renderHook(() => useGitHubSync())
      let res = { ok: true }
      await act(async () => {
        res = await result.current.restoreAllocationLatest()
      })
      expect(res.ok).toBe(false)
    })
  })

  /* ── restoreTaxesLatest ────────────────────────────────────── */

  describe('restoreTaxesLatest', () => {
    it('returns ok:false when not configured', async () => {
      const { result } = renderHook(() => useGitHubSync())
      let res = { ok: true }
      await act(async () => {
        res = await result.current.restoreTaxesLatest()
      })
      expect(res.ok).toBe(false)
    })

    it('returns parsed tax data on success', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      const data = { taxYear: 2024 }
      const content = btoa(JSON.stringify(data))
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ content }),
        headers: new Headers(),
      } as Response)

      let res = { ok: false, data: undefined as unknown }
      await act(async () => {
        res = await result.current.restoreTaxesLatest()
      })
      expect(res.ok).toBe(true)
      expect(res.data).toEqual(data)
    })
  })

  /* ── markDirty / clearDirty ────────────────────────────────── */

  describe('markDirty and clearDirty', () => {
    it('does not mark dirty before the 3-second gate', () => {
      vi.useFakeTimers()
      const { result } = renderHook(() => useGitHubSync())
      act(() => {
        result.current.markDirty('goals')
      })
      expect(result.current.dirtyFlags.goals).toBe(false)
      vi.useRealTimers()
    })

    it('marks dirty after the 3-second gate', async () => {
      vi.useFakeTimers()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3100)
      })
      act(() => {
        result.current.markDirty('goals')
      })
      expect(result.current.dirtyFlags.goals).toBe(true)
      vi.useRealTimers()
    })

    it('clearDirty resets a dirty flag', async () => {
      vi.useFakeTimers()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3100)
      })
      act(() => {
        result.current.markDirty('data')
      })
      expect(result.current.dirtyFlags.data).toBe(true)
      act(() => {
        result.current.clearDirty('data')
      })
      expect(result.current.dirtyFlags.data).toBe(false)
      vi.useRealTimers()
    })
  })

  /* ── updateConfig ──────────────────────────────────────────── */

  describe('updateConfig', () => {
    it('persists config changes to localStorage', () => {
      const { result } = renderHook(() => useGitHubSync())
      act(() => {
        result.current.updateConfig({ owner: 'my-org', repo: 'my-backup' })
      })
      expect(result.current.config.owner).toBe('my-org')
      expect(result.current.config.repo).toBe('my-backup')
      const stored = JSON.parse(localStorage.getItem('github-sync-config')!)
      expect(stored.owner).toBe('my-org')
    })
  })

  /* ── updateData ────────────────────────────────────────────── */

  describe('updateData', () => {
    it('marks goals dirty when data content changes', async () => {
      vi.useFakeTimers()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3100)
      })
      act(() => {
        result.current.updateData({ version: 2, goals: [{ id: 1 }], exportedAt: new Date().toISOString() })
      })
      expect(result.current.dirtyFlags.goals).toBe(true)
      vi.useRealTimers()
    })
  })

  /* ── updateDataFile ────────────────────────────────────────── */

  describe('updateDataFile', () => {
    it('marks data dirty when data file content changes', async () => {
      vi.useFakeTimers()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3100)
      })
      act(() => {
        result.current.updateDataFile({ version: 1, accounts: [{ id: 1 }], exportedAt: new Date().toISOString() })
      })
      expect(result.current.dirtyFlags.data).toBe(true)
      vi.useRealTimers()
    })
  })

  /* ── markRestored ──────────────────────────────────────────── */

  describe('markRestored', () => {
    it('sets success status and clears all dirty flags', async () => {
      vi.useFakeTimers()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3100)
      })
      act(() => {
        result.current.markDirty('goals')
        result.current.markDirty('data')
      })
      expect(result.current.dirtyFlags.goals).toBe(true)
      act(() => {
        result.current.markRestored()
      })
      expect(result.current.syncStatus).toBe('success')
      expect(result.current.dirtyFlags.goals).toBe(false)
      expect(result.current.dirtyFlags.data).toBe(false)
      expect(result.current.lastError).toBeNull()
      vi.useRealTimers()
    })
  })

  /* ── syncDataNow retry on conflict ────────────────────────────── */

  describe('syncDataNow retry and error paths', () => {
    it('retries on 409 conflict', async () => {
      vi.useFakeTimers()
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response)
        .mockResolvedValueOnce({ ok: false, status: 409, json: () => Promise.resolve({}) } as Response)
        .mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response)
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response)

      await act(async () => {
        const p = result.current.syncDataNow({ accounts: [] }, 'test')
        await vi.advanceTimersByTimeAsync(5000)
        await p
      })
      expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(3)
      vi.useRealTimers()
    })

    it('throws after all retries fail with 500', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      for (let i = 0; i < 3; i++) {
        fetchSpy
          .mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response)
          .mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ message: 'fail' }),
          } as Response)
      }
      let threw = false
      await act(async () => {
        try {
          await result.current.syncDataNow({ accounts: [] })
        } catch {
          threw = true
        }
      })
      expect(threw).toBe(true)
    })

    it('includes sha when data file exists', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ sha: 'datasha' }) } as Response)
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response)

      await act(async () => {
        await result.current.syncDataNow({ accounts: [] })
      })
      const putBody = JSON.parse(fetchSpy.mock.calls[1][1]?.body as string)
      expect(putBody.sha).toBe('datasha')
    })
  })

  /* ── syncToolsNow retry and error paths ────────────────────────── */

  describe('syncToolsNow retry and error paths', () => {
    it('retries on 422 conflict', async () => {
      vi.useFakeTimers()
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response)
        .mockResolvedValueOnce({ ok: false, status: 422, json: () => Promise.resolve({}) } as Response)
        .mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response)
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response)

      await act(async () => {
        const p = result.current.syncToolsNow({ fiSimulations: [] })
        await vi.advanceTimersByTimeAsync(5000)
        await p
      })
      expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(3)
      vi.useRealTimers()
    })

    it('throws after all retries fail', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      for (let i = 0; i < 3; i++) {
        fetchSpy
          .mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response)
          .mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ message: 'fail' }),
          } as Response)
      }
      let threw = false
      await act(async () => {
        try {
          await result.current.syncToolsNow({ fiSimulations: [] })
        } catch {
          threw = true
        }
      })
      expect(threw).toBe(true)
    })

    it('includes sha in PUT when tools file exists', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ sha: 'toolsha' }) } as Response)
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response)

      await act(async () => {
        await result.current.syncToolsNow({ fiSimulations: [] })
      })
      const putBody = JSON.parse(fetchSpy.mock.calls[1][1]?.body as string)
      expect(putBody.sha).toBe('toolsha')
    })
  })

  /* ── syncAllocationNow retry and error paths ───────────────────── */

  describe('syncAllocationNow retry and error paths', () => {
    it('retries on 409 conflict', async () => {
      vi.useFakeTimers()
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response)
        .mockResolvedValueOnce({ ok: false, status: 409, json: () => Promise.resolve({}) } as Response)
        .mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response)
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response)

      await act(async () => {
        const p = result.current.syncAllocationNow({ allocationCustomRatios: [] })
        await vi.advanceTimersByTimeAsync(5000)
        await p
      })
      expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(3)
      vi.useRealTimers()
    })

    it('throws after all retries fail', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      for (let i = 0; i < 3; i++) {
        fetchSpy
          .mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response)
          .mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ message: 'fail' }),
          } as Response)
      }
      let threw = false
      await act(async () => {
        try {
          await result.current.syncAllocationNow({ allocationCustomRatios: [] })
        } catch {
          threw = true
        }
      })
      expect(threw).toBe(true)
    })

    it('includes sha in PUT when allocation file exists', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ sha: 'allocsha' }) } as Response)
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response)

      await act(async () => {
        await result.current.syncAllocationNow({ allocationCustomRatios: [] })
      })
      const putBody = JSON.parse(fetchSpy.mock.calls[1][1]?.body as string)
      expect(putBody.sha).toBe('allocsha')
    })
  })

  /* ── syncTaxesNow retry and error paths ────────────────────────── */

  describe('syncTaxesNow retry and error paths', () => {
    it('retries on 422 conflict', async () => {
      vi.useFakeTimers()
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response)
        .mockResolvedValueOnce({ ok: false, status: 422, json: () => Promise.resolve({}) } as Response)
        .mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response)
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response)

      await act(async () => {
        const p = result.current.syncTaxesNow({ taxData: {} })
        await vi.advanceTimersByTimeAsync(5000)
        await p
      })
      expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(3)
      vi.useRealTimers()
    })

    it('throws after all retries fail', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      for (let i = 0; i < 3; i++) {
        fetchSpy
          .mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response)
          .mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ message: 'fail' }),
          } as Response)
      }
      let threw = false
      await act(async () => {
        try {
          await result.current.syncTaxesNow({ taxData: {} })
        } catch {
          threw = true
        }
      })
      expect(threw).toBe(true)
    })

    it('includes sha in PUT when taxes file exists', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ sha: 'taxsha' }) } as Response)
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response)

      await act(async () => {
        await result.current.syncTaxesNow({ taxData: {} })
      })
      const putBody = JSON.parse(fetchSpy.mock.calls[1][1]?.body as string)
      expect(putBody.sha).toBe('taxsha')
    })
  })

  /* ── restoreToolsLatest error paths ────────────────────────────── */

  describe('restoreToolsLatest error paths', () => {
    it('returns ok:false on 404', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({}),
        headers: new Headers(),
      } as Response)
      let res = { ok: true }
      await act(async () => {
        res = await result.current.restoreToolsLatest()
      })
      expect(res.ok).toBe(false)
    })

    it('returns ok:false on non-ok response', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
        headers: new Headers(),
      } as Response)
      let res = { ok: true }
      await act(async () => {
        res = await result.current.restoreToolsLatest()
      })
      expect(res.ok).toBe(false)
    })

    it('returns ok:false when content is not a string', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ content: null }),
        headers: new Headers(),
      } as Response)
      let res = { ok: true }
      await act(async () => {
        res = await result.current.restoreToolsLatest()
      })
      expect(res.ok).toBe(false)
    })

    it('returns ok:false on fetch exception', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network'))
      let res = { ok: true }
      await act(async () => {
        res = await result.current.restoreToolsLatest()
      })
      expect(res.ok).toBe(false)
    })
  })

  /* ── restoreAllocationLatest error paths ───────────────────────── */

  describe('restoreAllocationLatest paths', () => {
    it('returns parsed allocation data on success', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      const data = { allocationCustomRatios: [{ id: 1 }] }
      const content = btoa(JSON.stringify(data))
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ content }),
        headers: new Headers(),
      } as Response)
      let res = { ok: false, data: undefined as unknown }
      await act(async () => {
        res = await result.current.restoreAllocationLatest()
      })
      expect(res.ok).toBe(true)
      expect(res.data).toEqual(data)
    })

    it('returns ok:false on 404', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({}),
        headers: new Headers(),
      } as Response)
      let res = { ok: true }
      await act(async () => {
        res = await result.current.restoreAllocationLatest()
      })
      expect(res.ok).toBe(false)
    })

    it('returns ok:false on non-ok response', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
        headers: new Headers(),
      } as Response)
      let res = { ok: true }
      await act(async () => {
        res = await result.current.restoreAllocationLatest()
      })
      expect(res.ok).toBe(false)
    })

    it('returns ok:false when content is not a string', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ content: 123 }),
        headers: new Headers(),
      } as Response)
      let res = { ok: true }
      await act(async () => {
        res = await result.current.restoreAllocationLatest()
      })
      expect(res.ok).toBe(false)
    })

    it('returns ok:false on fetch exception', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network'))
      let res = { ok: true }
      await act(async () => {
        res = await result.current.restoreAllocationLatest()
      })
      expect(res.ok).toBe(false)
    })
  })

  /* ── restoreTaxesLatest error paths ────────────────────────────── */

  describe('restoreTaxesLatest error paths', () => {
    it('returns ok:false on 404', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({}),
        headers: new Headers(),
      } as Response)
      let res = { ok: true }
      await act(async () => {
        res = await result.current.restoreTaxesLatest()
      })
      expect(res.ok).toBe(false)
    })

    it('returns ok:false on non-ok response', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
        headers: new Headers(),
      } as Response)
      let res = { ok: true }
      await act(async () => {
        res = await result.current.restoreTaxesLatest()
      })
      expect(res.ok).toBe(false)
    })

    it('returns ok:false when content is not a string', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ content: null }),
        headers: new Headers(),
      } as Response)
      let res = { ok: true }
      await act(async () => {
        res = await result.current.restoreTaxesLatest()
      })
      expect(res.ok).toBe(false)
    })

    it('returns ok:false on fetch exception', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network'))
      let res = { ok: true }
      await act(async () => {
        res = await result.current.restoreTaxesLatest()
      })
      expect(res.ok).toBe(false)
    })
  })

  /* ── restoreDataLatest error paths ─────────────────────────────── */

  describe('restoreDataLatest error paths', () => {
    it('returns parsed data on success', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      const data = { accounts: [{ id: 1 }], balances: [] }
      const content = toBase64(JSON.stringify(data))
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ content, encoding: 'base64' }),
        headers: new Headers(),
      } as Response)
      let res = { ok: false, data: undefined as unknown, message: '' }
      await act(async () => {
        res = await result.current.restoreDataLatest()
      })
      expect(res.ok).toBe(true)
      expect((res.data as { accounts: unknown[] }).accounts).toEqual([{ id: 1 }])
    })

    it('returns ok:false on non-ok non-404 response', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
        headers: new Headers(),
      } as Response)
      let res = { ok: true, message: '' }
      await act(async () => {
        res = await result.current.restoreDataLatest()
      })
      expect(res.ok).toBe(false)
      expect(res.message).toContain('GitHub API error')
    })

    it('returns ok:false when content/encoding is wrong', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ content: null, encoding: 'utf-8' }),
        headers: new Headers(),
      } as Response)
      let res = { ok: true, message: '' }
      await act(async () => {
        res = await result.current.restoreDataLatest()
      })
      expect(res.ok).toBe(false)
      expect(res.message).toContain('not supported')
    })

    it('returns ok:false on fetch exception', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network'))
      let res = { ok: true, message: '' }
      await act(async () => {
        res = await result.current.restoreDataLatest()
      })
      expect(res.ok).toBe(false)
      expect(res.message).toContain('Could not restore')
    })
  })

  /* ── restoreFromCommit additional paths ────────────────────────── */

  describe('restoreFromCommit additional paths', () => {
    it('returns error on non-ok non-404 response', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
        headers: new Headers(),
      } as Response)
      let res = { ok: true, message: '' }
      await act(async () => {
        res = await result.current.restoreFromCommit('abc123')
      })
      expect(res.ok).toBe(false)
      expect(res.message).toContain('GitHub API error')
    })

    it('returns error when encoding is not base64', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ content: 'aGVsbG8=', encoding: 'utf-8' }),
        headers: new Headers(),
      } as Response)
      let res = { ok: true, message: '' }
      await act(async () => {
        res = await result.current.restoreFromCommit('abc123')
      })
      expect(res.ok).toBe(false)
      expect(res.message).toContain('not supported')
    })

    it('returns error on fetch exception', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network'))
      let res = { ok: true, message: '' }
      await act(async () => {
        res = await result.current.restoreFromCommit('abc123')
      })
      expect(res.ok).toBe(false)
      expect(res.message).toContain('Could not restore')
    })
  })

  /* ── restoreLatest additional paths ────────────────────────────── */

  describe('restoreLatest additional paths', () => {
    it('returns error on non-ok non-404 response', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
        headers: new Headers(),
      } as Response)
      let res = { ok: true, message: '' }
      await act(async () => {
        res = await result.current.restoreLatest()
      })
      expect(res.ok).toBe(false)
      expect(res.message).toContain('GitHub API error')
    })

    it('returns error on fetch exception', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network'))
      let res = { ok: true, message: '' }
      await act(async () => {
        res = await result.current.restoreLatest()
      })
      expect(res.ok).toBe(false)
      expect(res.message).toContain('Could not restore')
    })
  })

  /* ── updateData debounce behavior ──────────────────────────────── */

  describe('updateData debounce with autoSync', () => {
    it('sets up debounce timer when autoSync is on and configured', async () => {
      vi.useFakeTimers()
      setStorageItem('github-sync-config', {
        owner: 'test-owner',
        repo: 'test-repo',
        filePath: 'finance-goals.json',
        autoSync: true,
      } as GitHubSyncConfig)
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3100)
      })
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response)

      act(() => {
        result.current.updateData({ version: 2, goals: [{ id: 1 }], exportedAt: 'now' })
      })
      expect(result.current.dirtyFlags.goals).toBe(true)
      // No fetch yet — debounce hasn't fired
      expect(fetchSpy).not.toHaveBeenCalled()
      vi.useRealTimers()
    })

    it('does not set debounce when data matches last synced', async () => {
      vi.useFakeTimers()
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      // Sync some data first
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response)
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response)
      await act(async () => {
        await result.current.syncNow({ goals: [{ id: 1 }] })
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3100)
      })
      // Now update with same data (minus exportedAt)
      act(() => {
        result.current.updateData({ goals: [{ id: 1 }], exportedAt: 'now' })
      })
      // Should not mark dirty since content matches
      expect(result.current.dirtyFlags.goals).toBe(false)
      vi.useRealTimers()
    })
  })

  /* ── updateDataFile debounce behavior ──────────────────────────── */

  describe('updateDataFile debounce with autoSync', () => {
    it('sets up debounce timer when autoSync is on', async () => {
      vi.useFakeTimers()
      setStorageItem('github-sync-config', {
        owner: 'test-owner',
        repo: 'test-repo',
        filePath: 'finance-goals.json',
        autoSync: true,
      } as GitHubSyncConfig)
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3100)
      })
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response)

      act(() => {
        result.current.updateDataFile({ version: 1, accounts: [{ id: 1 }], exportedAt: 'now' })
      })
      expect(result.current.dirtyFlags.data).toBe(true)
      expect(fetchSpy).not.toHaveBeenCalled()
      vi.useRealTimers()
    })
  })

  /* ── getFileShaForPath error paths ─────────────────────────────── */

  describe('getFileShaForPath via syncNow', () => {
    it('throws on 401 from getFileSha', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({}),
        headers: new Headers(),
      } as Response)

      let threw = false
      await act(async () => {
        try {
          await result.current.syncNow({ goals: [] })
        } catch {
          threw = true
        }
      })
      expect(threw).toBe(true)
      expect(result.current.lastError).toContain('Invalid token')
    })

    it('throws on generic non-ok from getFileSha', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({}),
        headers: new Headers(),
      } as Response)

      let threw = false
      await act(async () => {
        try {
          await result.current.syncNow({ goals: [] })
        } catch {
          threw = true
        }
      })
      expect(threw).toBe(true)
      expect(result.current.lastError).toContain('GitHub API error: 403')
    })
  })

  /* ── loadConfig catch path ─────────────────────────────────────── */

  describe('loadConfig error handling', () => {
    it('returns default when getStorageItem throws', () => {
      // Corrupt the storage so getStorageItem throws
      localStorage.setItem('github-sync-config', '<<<not json>>>')
      const config = loadConfig()
      expect(config.owner).toBe('')
      expect(config.filePath).toBe('finance-goals.json')
    })
  })

  /* ── saveEncryptedToken catch path ──────────────────────────────── */

  describe('saveEncryptedToken encryption failure', () => {
    it('returns error when encryption fails', async () => {
      // Mock crypto.subtle.encrypt to throw
      const origEncrypt = crypto.subtle.encrypt
      crypto.subtle.encrypt = () => Promise.reject(new Error('Not supported'))
      const { result } = renderHook(() => useGitHubSync())
      let res = { ok: true, message: '' }
      await act(async () => {
        res = await result.current.saveEncryptedToken('ghp_token', 'longpassphrase')
      })
      expect(res.ok).toBe(false)
      expect(res.message).toContain('Could not encrypt')
      crypto.subtle.encrypt = origEncrypt
    })
  })

  /* ── updateConfig localStorage failure ─────────────────────────── */

  /* ── testConnection non-200 error ────────────────────────────── */

  describe('testConnection additional error', () => {
    it('returns error on generic non-ok status', async () => {
      setupConfigured()
      const { result } = renderHook(() => useGitHubSync())
      await act(async () => {
        await result.current.saveEncryptedToken('ghp_token', 'passphrase1')
      })
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({}),
        headers: new Headers(),
      } as Response)
      let res = { ok: true, message: '', warnings: [] as string[] }
      await act(async () => {
        res = await result.current.testConnection()
      })
      expect(res.ok).toBe(false)
      expect(res.message).toContain('GitHub API error: 403')
    })
  })
})
