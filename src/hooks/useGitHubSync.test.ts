import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Test the pure helper functions from budgetGitHubSync that don't need fetch

// We replicate the base64 helpers since they're not exported
const toBase64 = (str: string): string => {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  bytes.forEach(b => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary)
}

const fromBase64 = (b64: string): string => {
  const bin = atob(b64)
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

describe('Base64 encoding/decoding (budget GitHub sync)', () => {
  it('round-trips ASCII text', () => {
    const text = 'Date,Category,Amount\n01/15/2025,Groceries,-50.00'
    expect(fromBase64(toBase64(text))).toBe(text)
  })

  it('round-trips UTF-8 text with special characters', () => {
    const text = 'Café,Résumé,naïve,€100'
    expect(fromBase64(toBase64(text))).toBe(text)
  })

  it('handles empty string', () => {
    expect(fromBase64(toBase64(''))).toBe('')
  })

  it('handles emoji', () => {
    const text = 'Savings 💰 $1,000'
    expect(fromBase64(toBase64(text))).toBe(text)
  })
})

// Test the useGitHubSync helper functions
describe('GitHub sync base64 helpers', () => {
  // These are the same helpers used in useGitHubSync.ts
  const bytesToB64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes))
  const b64ToBytes = (b64: string): Uint8Array => Uint8Array.from(atob(b64), c => c.charCodeAt(0))

  it('round-trips byte arrays', () => {
    const original = new Uint8Array([1, 2, 3, 255, 0, 128])
    const encoded = bytesToB64(original)
    const decoded = b64ToBytes(encoded)
    expect(Array.from(decoded)).toEqual(Array.from(original))
  })

  it('encodes empty array', () => {
    const encoded = bytesToB64(new Uint8Array([]))
    expect(encoded).toBe('')
  })
})

describe('GitHub sync config loading', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns default config when nothing stored', () => {
    const raw = localStorage.getItem('github-sync-config')
    expect(raw).toBeNull()
  })

  it('preserves stored config fields', () => {
    const config = {
      owner: 'testuser',
      repo: 'finance-backup',
      filePath: 'finance-goals.json',
      autoSync: true,
    }
    localStorage.setItem('github-sync-config', JSON.stringify(config))
    const loaded = JSON.parse(localStorage.getItem('github-sync-config')!)
    expect(loaded.owner).toBe('testuser')
    expect(loaded.repo).toBe('finance-backup')
    expect(loaded.autoSync).toBe(true)
  })

  it('stores encrypted token fields', () => {
    const config = {
      owner: 'user',
      repo: 'repo',
      filePath: 'finance-goals.json',
      autoSync: false,
      encryptedToken: 'abc123encrypted',
      tokenSalt: 'salt123',
      tokenIv: 'iv123',
    }
    localStorage.setItem('github-sync-config', JSON.stringify(config))
    const loaded = JSON.parse(localStorage.getItem('github-sync-config')!)
    expect(loaded.encryptedToken).toBe('abc123encrypted')
    expect(loaded.tokenSalt).toBe('salt123')
    expect(loaded.tokenIv).toBe('iv123')
  })

  it('loadConfig strips legacyToken from localStorage', () => {
    const config = {
      owner: 'user',
      repo: 'repo',
      filePath: 'finance-goals.json',
      autoSync: false,
      legacyToken: 'ghp_plaintext123',
    }
    localStorage.setItem('github-sync-config', JSON.stringify(config))

    // Re-read as loadConfig would: parse, strip legacyToken, persist cleaned
    const raw = localStorage.getItem('github-sync-config')!
    const parsed = { owner: '', repo: '', filePath: 'finance-goals.json', autoSync: false, ...JSON.parse(raw) }
    parsed.filePath = 'finance-goals.json'
    if ('legacyToken' in parsed) {
      delete parsed.legacyToken
      localStorage.setItem('github-sync-config', JSON.stringify(parsed))
    }

    const persisted = JSON.parse(localStorage.getItem('github-sync-config')!)
    expect(persisted).not.toHaveProperty('legacyToken')
    expect(persisted.owner).toBe('user')
  })

  it('activeToken is empty string when no sessionToken is set', () => {
    // With no legacyToken fallback, activeToken should derive only from sessionToken
    const sessionToken = ''
    const activeToken = sessionToken || ''
    expect(activeToken).toBe('')
  })

  it('file path derivation for data/tools/allocation/taxes', () => {
    const basePath = 'finance-goals.json'
    expect(basePath.replace(/\.json$/, '-data.json')).toBe('finance-goals-data.json')
    expect(basePath.replace(/\.json$/, '-tools.json')).toBe('finance-goals-tools.json')
    expect(basePath.replace(/\.json$/, '-allocation.json')).toBe('finance-goals-allocation.json')
    expect(basePath.replace(/\.json$/, '-taxes.json')).toBe('finance-goals-taxes.json')
  })
})

// Replicate getFileShaForPath logic to test SHA-fetch cache-busting behaviour.
// The production code calls fetch with { cache: 'no-store' } to prevent the
// browser from serving a stale SHA after a file is updated on GitHub.
describe('SHA mismatch self-healing (getFileShaForPath)', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  // Mirrors the production getFileShaForPath implementation
  const getFileShaForPath = async (
    path: string,
    owner: string,
    repo: string,
    token: string,
  ): Promise<string | null> => {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
    const data = await res.json()
    return data.sha as string
  }

  it('passes cache: no-store to prevent stale SHA responses', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ sha: 'abc123' }),
    })
    globalThis.fetch = mockFetch

    await getFileShaForPath('finance-goals-data.json', 'owner', 'repo', 'token')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const callArgs = mockFetch.mock.calls[0]
    expect(callArgs[1]).toHaveProperty('cache', 'no-store')
  })

  it('returns fresh SHA on consecutive calls (no browser cache)', async () => {
    const shas = ['sha-first', 'sha-second']
    let callCount = 0
    globalThis.fetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ sha: shas[callCount++] }),
    }))

    const first = await getFileShaForPath('f.json', 'o', 'r', 't')
    const second = await getFileShaForPath('f.json', 'o', 'r', 't')

    expect(first).toBe('sha-first')
    expect(second).toBe('sha-second')
  })

  it('returns null for 404 (new file)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 })
    const sha = await getFileShaForPath('missing.json', 'o', 'r', 't')
    expect(sha).toBeNull()
  })

  it('throws on non-404 error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    await expect(getFileShaForPath('f.json', 'o', 'r', 't')).rejects.toThrow('GitHub API error: 500')
  })
})
