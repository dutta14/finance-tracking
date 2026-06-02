import type { GitHubSyncConfig } from './githubSyncTypes'
import { getStorageItem, setStorageItem } from '../utils/storage'

export const CONFIG_KEY = 'github-sync-config'

export const DEFAULT_CONFIG: GitHubSyncConfig = {
  owner: '',
  repo: '',
  filePath: 'finance-goals.json',
  autoSync: false,
}

export const DEBOUNCE_MS = 60_000

export const loadConfig = (): GitHubSyncConfig => {
  try {
    const parsed = { ...DEFAULT_CONFIG, ...getStorageItem('github-sync-config', DEFAULT_CONFIG) }
    // Always use canonical file path — older configs may have a custom value
    parsed.filePath = DEFAULT_CONFIG.filePath
    // Strip legacy plaintext token if present
    if ('legacyToken' in parsed) {
      delete (parsed as Record<string, unknown>).legacyToken
      setStorageItem('github-sync-config', parsed)
    }
    return parsed
  } catch {
    return DEFAULT_CONFIG
  }
}
