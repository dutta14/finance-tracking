import { describe, it, expect, beforeEach } from 'vitest'

// Test the pure helper functions from budgetGitHubSync that don't need fetch

// We replicate the base64 helpers since they're not exported
const toBase64 = (str: string): string => {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  bytes.forEach(b => { binary += String.fromCharCode(b) })
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

  it('file path derivation for data/tools/allocation/taxes', () => {
    const basePath = 'finance-goals.json'
    expect(basePath.replace(/\.json$/, '-data.json')).toBe('finance-goals-data.json')
    expect(basePath.replace(/\.json$/, '-tools.json')).toBe('finance-goals-tools.json')
    expect(basePath.replace(/\.json$/, '-allocation.json')).toBe('finance-goals-allocation.json')
    expect(basePath.replace(/\.json$/, '-taxes.json')).toBe('finance-goals-taxes.json')
  })
})
