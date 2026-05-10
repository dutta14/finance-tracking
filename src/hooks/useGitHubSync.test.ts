import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setStorageItem, getStorageItem } from '../utils/storage'
import { loadConfig, toBase64, fromBase64 } from './useGitHubSync'
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
