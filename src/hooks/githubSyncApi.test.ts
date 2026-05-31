import { describe, it, expect, vi, beforeEach } from 'vitest'
import { syncFileToGitHub, restoreFileFromGitHub } from './githubSyncApi'

const mockApiHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'Content-Type': 'application/json',
})

describe('githubSyncApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const baseParams = {
    token: 'ghp_test123',
    owner: 'testuser',
    repo: 'testrepo',
    filePath: 'finance-goals.json',
    apiHeaders: mockApiHeaders,
  }

  describe('syncFileToGitHub', () => {
    it('creates file when SHA is null (PUT without sha field)', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(JSON.stringify({ content: { sha: 'abc123' } }), { status: 200 }))

      await syncFileToGitHub({
        ...baseParams,
        data: { goals: [] },
        defaultMessagePrefix: 'Auto-save',
        getFileSha: async () => null,
      })

      const call = fetchSpy.mock.calls[0]
      const body = JSON.parse(call[1]!.body as string)
      expect(body.sha).toBeUndefined()
      expect(body.content).toBeDefined()
      expect(body.message).toContain('Auto-save')
    })

    it('updates file when SHA exists (PUT with sha)', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))

      await syncFileToGitHub({
        ...baseParams,
        data: { goals: [] },
        defaultMessagePrefix: 'Auto-save',
        getFileSha: async () => 'existing-sha-456',
      })

      const call = fetchSpy.mock.calls[0]
      const body = JSON.parse(call[1]!.body as string)
      expect(body.sha).toBe('existing-sha-456')
    })

    it('retries on 409 with backoff, succeeds on second attempt', async () => {
      vi.useFakeTimers()
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response('', { status: 409 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))

      const onSuccess = vi.fn()
      const promise = syncFileToGitHub({
        ...baseParams,
        data: { goals: [] },
        defaultMessagePrefix: 'Auto-save',
        getFileSha: async () => 'sha1',
        onSuccess,
      })

      await vi.advanceTimersByTimeAsync(1000)
      await promise

      expect(fetchSpy).toHaveBeenCalledTimes(2)
      expect(onSuccess).toHaveBeenCalledTimes(1)
      vi.useRealTimers()
    })

    it('throws after 3 failed attempts', async () => {
      vi.useFakeTimers()
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response('', { status: 409 }))
        .mockResolvedValueOnce(new Response('', { status: 409 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Conflict' }), { status: 409 }))

      const onError = vi.fn()
      const promise = syncFileToGitHub({
        ...baseParams,
        data: { goals: [] },
        defaultMessagePrefix: 'Auto-save',
        getFileSha: async () => 'sha1',
        onError,
      })

      // Attach catch handler immediately to prevent unhandled rejection
      const resultPromise = promise.catch(e => e)

      await vi.advanceTimersByTimeAsync(1000)
      await vi.advanceTimersByTimeAsync(2000)

      const error = await resultPromise
      expect(error).toBeInstanceOf(Error)
      expect(error.message).toBe('Conflict')
      expect(onError).toHaveBeenCalledTimes(1)
      vi.useRealTimers()
    })

    it('throws on 401 without retry', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Bad credentials' }), { status: 401 }),
      )

      await expect(
        syncFileToGitHub({
          ...baseParams,
          data: { goals: [] },
          defaultMessagePrefix: 'Auto-save',
          getFileSha: async () => null,
        }),
      ).rejects.toThrow('Bad credentials')
    })

    it('calls onSuccess callback on success', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))

      const onSuccess = vi.fn()
      await syncFileToGitHub({
        ...baseParams,
        data: { goals: [] },
        defaultMessagePrefix: 'Auto-save',
        getFileSha: async () => null,
        onSuccess,
      })

      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
  })

  describe('restoreFileFromGitHub', () => {
    it('returns ok:true with decoded JSON data', async () => {
      const data = { goals: [{ name: 'FI' }] }
      const content = btoa(JSON.stringify(data))
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ content }), { status: 200 }))

      const result = await restoreFileFromGitHub(baseParams)
      expect(result.ok).toBe(true)
      expect(result.data).toEqual(data)
    })

    it('returns ok:false on 404', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 404 }))

      const result = await restoreFileFromGitHub(baseParams)
      expect(result.ok).toBe(false)
      expect(result.data).toBeUndefined()
    })

    it('returns ok:false on malformed JSON', async () => {
      const content = btoa('not valid json {{{')
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ content }), { status: 200 }))

      const result = await restoreFileFromGitHub(baseParams)
      expect(result.ok).toBe(false)
    })
  })
})
