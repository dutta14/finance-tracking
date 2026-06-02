export interface GitHubSyncConfig {
  owner: string
  repo: string
  filePath: string
  autoSync: boolean
  encryptedToken?: string
  tokenSalt?: string
  tokenIv?: string
}

export interface CommitEntry {
  sha: string
  message: string
  date: string
  url: string
}

export interface ConnectionTestResult {
  ok: boolean
  message: string
  warnings: string[]
}

export interface RestoreResult {
  ok: boolean
  message: string
  data?: unknown
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error'

export type SyncDomain = 'goals' | 'data' | 'tools' | 'allocation' | 'taxes' | 'budget'

export interface SyncProgress {
  total: number
  completed: number
  current: string
  errors: string[]
  domains: SyncDomain[]
}
