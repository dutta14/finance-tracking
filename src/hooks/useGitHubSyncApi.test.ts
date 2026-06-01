import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { syncFileToGitHub, restoreFileFromGitHub } from './useGitHubSyncApi'
import type { SyncFileParams, RestoreFileParams } from './useGitHubSyncApi'

describe('syncFileToGitHub', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const baseParams: Omit<SyncFileParams, 'getFileSha'> = {
    token: 'ghp_test',
    owner: 'testuser',
    repo: 'testrepo',
    filePath: 'data/finance.json',
    data: { accounts: ['checking'] },
    apiHeaders: (t: string) => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }),
  }

  it('creates file when getFileSha returns null (no sha in body)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
    global.fetch = mockFetch

    await syncFileToGitHub({ ...baseParams, getFileSha: vi.fn().mockResolvedValue(null) })

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(callBody).not.toHaveProperty('sha')
    expect(callBody).toHaveProperty('content')
    expect(callBody).toHaveProperty('message')
  })

  it('updates file when getFileSha returns a sha (sha in body)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
    global.fetch = mockFetch

    await syncFileToGitHub({ ...baseParams, getFileSha: vi.fn().mockResolvedValue('abc123sha') })

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(callBody.sha).toBe('abc123sha')
  })

  it('retries on 409 status and succeeds on second attempt', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ message: 'conflict' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })
    global.fetch = mockFetch

    const syncPromise = syncFileToGitHub({ ...baseParams, getFileSha: vi.fn().mockResolvedValue(null) })

    // Advance past the retry delay (1000ms for first retry)
    await vi.advanceTimersByTimeAsync(1500)
    await syncPromise

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('throws on 401 status', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: 'Bad credentials' }) })
    global.fetch = mockFetch

    await expect(syncFileToGitHub({ ...baseParams, getFileSha: vi.fn().mockResolvedValue(null) })).rejects.toThrow(
      'Bad credentials',
    )
  })

  it('updates lastSyncedJsonRef on success excluding exportedAt', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
    global.fetch = mockFetch

    const lastSyncedJsonRef = { current: null } as React.MutableRefObject<string | null>
    const data = { accounts: ['checking'], exportedAt: '2024-01-01' }

    await syncFileToGitHub({
      ...baseParams,
      data,
      getFileSha: vi.fn().mockResolvedValue(null),
      lastSyncedJsonRef,
    })

    const parsed = JSON.parse(lastSyncedJsonRef.current!)
    expect(parsed).toEqual({ accounts: ['checking'] })
    expect(parsed).not.toHaveProperty('exportedAt')
  })
})

describe('restoreFileFromGitHub', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const baseParams: RestoreFileParams = {
    token: 'ghp_test',
    owner: 'testuser',
    repo: 'testrepo',
    filePath: 'data/finance.json',
    apiHeaders: (t: string) => ({ Authorization: `Bearer ${t}` }),
  }

  it('returns not-found on 404', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 })

    const result = await restoreFileFromGitHub(baseParams)

    expect(result).toEqual({ ok: false, reason: 'not-found' })
  })

  it('decodes base64 content and parses JSON on 200', async () => {
    const payload = { accounts: ['savings'], total: 5000 }
    const encoded = btoa(JSON.stringify(payload))

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ content: encoded, encoding: 'base64' }),
    })

    const result = await restoreFileFromGitHub(baseParams)

    expect(result.ok).toBe(true)
    expect(result.data).toEqual(payload)
  })

  it('returns bad-format when encoding is not base64', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ content: 'some-content', encoding: 'utf-8' }),
    })

    const result = await restoreFileFromGitHub(baseParams)

    expect(result).toEqual({ ok: false, reason: 'bad-format' })
  })
})
