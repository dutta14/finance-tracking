import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { toBase64 } from './base64Utils'
import {
  syncFileToGitHub,
  restoreFileFromGitHub,
  getFileShaForPathApi,
  testConnectionApi,
  fetchCommitHistory,
} from './useGitHubSyncApi'
import type { SyncFileParams } from './useGitHubSyncApi'

const mockFetch = vi.fn()

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const baseParams: SyncFileParams = {
  token: 'ghp_test',
  owner: 'testowner',
  repo: 'testrepo',
  filePath: 'data/finance.json',
  data: { accounts: [] },
  messagePrefix: 'sync',
  getFileSha: vi.fn().mockResolvedValue(null),
}

describe('syncFileToGitHub', () => {
  it('syncFileToGitHub: creates file when SHA is null (PUT, no sha)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

    const result = await syncFileToGitHub(baseParams)

    expect(result).toEqual({ ok: true })
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(callBody.sha).toBeUndefined()
    expect(callBody.content).toBeTruthy()
    expect(callBody.message).toContain('sync')
    expect(mockFetch.mock.calls[0][1].method).toBe('PUT')
  })

  it('syncFileToGitHub: updates file when SHA exists (PUT with sha)', async () => {
    mockFetch.mockReset()
    const params = { ...baseParams, getFileSha: vi.fn().mockResolvedValue('abc123') }
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

    const result = await syncFileToGitHub(params)

    expect(result).toEqual({ ok: true })
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(callBody.sha).toBe('abc123')
  })

  it('syncFileToGitHub: retries once on 409 with fresh SHA', async () => {
    mockFetch.mockReset()
    const getFileSha = vi.fn().mockResolvedValueOnce('old-sha').mockResolvedValueOnce('new-sha')
    const params = { ...baseParams, getFileSha }

    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ message: 'conflict' }) })
      .mockResolvedValueOnce({ ok: true, status: 200 })

    const promise = syncFileToGitHub(params)
    await vi.advanceTimersByTimeAsync(5000)
    const result = await promise

    expect(result).toEqual({ ok: true })
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(getFileSha).toHaveBeenCalledTimes(2)
  })

  it('syncFileToGitHub: returns ok:false with error on 401', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Bad credentials' }),
    })

    const result = await syncFileToGitHub(baseParams)

    expect(result.ok).toBe(false)
    expect(result.error).toContain('Bad credentials')
  })
})

describe('restoreFileFromGitHub', () => {
  const restoreParams = {
    token: 'ghp_test',
    owner: 'testowner',
    repo: 'testrepo',
    filePath: 'data/finance.json',
  }

  it('restoreFileFromGitHub: returns ok:false on 404', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })

    const result = await restoreFileFromGitHub(restoreParams)

    expect(result.ok).toBe(false)
    expect(result.status).toBe(404)
  })

  it('restoreFileFromGitHub: decodes base64 content and parses JSON', async () => {
    const payload = { accounts: [{ name: 'Checking' }] }
    const encoded = toBase64(JSON.stringify(payload))
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: encoded, encoding: 'base64' }),
    })

    const result = await restoreFileFromGitHub(restoreParams)

    expect(result.ok).toBe(true)
    expect(result.data).toEqual(payload)
  })

  it('restoreFileFromGitHub: returns ok:false on malformed JSON', async () => {
    const badContent = toBase64('not valid json {{{')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: badContent, encoding: 'base64' }),
    })

    await expect(restoreFileFromGitHub(restoreParams)).rejects.toThrow()
  })
})

describe('getFileShaForPathApi', () => {
  it('getFileShaForPathApi: returns sha on 200', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ sha: 'deadbeef123' }),
    })

    const sha = await getFileShaForPathApi('ghp_test', 'owner', 'repo', 'path.json')

    expect(sha).toBe('deadbeef123')
  })

  it('getFileShaForPathApi: returns null on 404', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })

    const sha = await getFileShaForPathApi('ghp_test', 'owner', 'repo', 'path.json')

    expect(sha).toBeNull()
  })

  it('getFileShaForPathApi: throws on 401', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })

    await expect(getFileShaForPathApi('ghp_test', 'owner', 'repo', 'path.json')).rejects.toThrow('Invalid token')
  })
})

describe('testConnectionApi', () => {
  it('testConnectionApi: returns ok:true with message on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({}),
      json: async () => ({ full_name: 'owner/repo', private: true, permissions: { push: true } }),
    })

    const result = await testConnectionApi('ghp_test', 'owner', 'repo')

    expect(result.ok).toBe(true)
    expect(result.message).toContain('owner/repo')
  })

  it('testConnectionApi: returns warning for public repo', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({}),
      json: async () => ({ full_name: 'owner/repo', private: false, permissions: { push: true } }),
    })

    const result = await testConnectionApi('ghp_test', 'owner', 'repo')

    expect(result.ok).toBe(true)
    expect(result.warnings).toContain('This repository is public. Backups may expose sensitive financial data.')
  })

  it('testConnectionApi: returns ok:false on 404', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: new Headers({}),
      json: async () => ({}),
    })

    const result = await testConnectionApi('ghp_test', 'owner', 'repo')

    expect(result.ok).toBe(false)
    expect(result.message).toContain('not found')
  })
})

describe('fetchCommitHistory', () => {
  it('fetchCommitHistory: parses commit array correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [
        {
          sha: 'abcdef1234567890',
          commit: { message: 'sync: Jan 1', author: { date: '2025-01-01T00:00:00Z' } },
          html_url: 'https://github.com/owner/repo/commit/abcdef1',
        },
      ],
    })

    const commits = await fetchCommitHistory('ghp_test', 'owner', 'repo', 'data/finance.json')

    expect(commits).toHaveLength(1)
    expect(commits[0]).toEqual({
      sha: 'abcdef1',
      message: 'sync: Jan 1',
      date: '2025-01-01T00:00:00Z',
      url: 'https://github.com/owner/repo/commit/abcdef1',
    })
  })

  it('fetchCommitHistory: returns empty array on error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

    const commits = await fetchCommitHistory('ghp_test', 'owner', 'repo', 'data/finance.json')

    expect(commits).toEqual([])
  })
})
